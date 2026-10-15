import type {Question, QuestionSet} from '@/lib/question-types'
import {sanitizeDependencies} from '@/lib/dependencies'
import {pageCheckQuestions} from '@/lib/page-checks'

// Jev 1.13: 64k tokens per request, of which 32k are for `state` plus the longest question.
export const STATE_TOKENS = 32_000
export const REQUEST_TOKENS = 64_000
/** Token counts are estimates, so stay 10% under every limit. */
const SAFETY = 0.9
/** Conservative: English text averages ~4 characters per token. */
export const CHARS_PER_TOKEN = 3.5

export const MAX_CHOICES = 255
export const MIN_LEVELS = 2
export const MAX_LEVELS = 10
/** Each multi-pick answer is asked as its own yes/no question; the token budget in validateSet is the real cap. */
export const MAX_MULTI = MAX_CHOICES
export const MAX_QUESTIONS = 50
/** The page needs room too; a set may not leave it less than this. */
export const MIN_PAGE_TOKENS = 4_000

export const MAX_NAME_CHARS = 60
export const MAX_QUESTION_CHARS = 500
export const MAX_DETAILS_CHARS = 2000
export const MAX_LABEL_CHARS = 80
export const MAX_DESCRIPTION_CHARS = 300

/**
 * Estimated tokens for one code point. Tokenizers are trained mostly on English, so other
 * scripts split into far more tokens per character; a flat chars/token ratio undercounts
 * Persian, Russian or Chinese pages by 2–4x.
 */
export function codePointTokens(cp: number): number {
  if (cp < 0x80) return 1 / CHARS_PER_TOKEN // ASCII
  if (cp < 0x370) return 0.5 // Latin-1, Latin Extended, IPA, diacritics
  if (cp < 0x590) return 0.6 // Greek, Cyrillic, Armenian
  if (cp < 0x900) return 1 // Hebrew, Arabic, Syriac, Thaana
  if (cp < 0x1100) return 1.2 // Indic scripts, Thai, Lao, Tibetan, Myanmar, Georgian
  if (cp >= 0x2000 && cp < 0x2e80) return 1 // punctuation, symbols, arrows
  if (cp < 0x10000) return 1.2 // CJK, kana, Hangul, other BMP
  return 2 // emoji and other astral characters
}

export function estimateTokens(text: string): number {
  let tokens = 0
  for (const ch of text) tokens += codePointTokens(ch.codePointAt(0)!)
  return Math.ceil(tokens)
}

const answerTokens = (a: Question['answers'][number]) =>
  estimateTokens(a.label) + estimateTokens(a.description ?? '') + 8

const instructionTokens = (q: Question) => estimateTokens(q.text) + estimateTokens(q.details ?? '')

export function questionTokens(question: Question): number {
  // A multi pick is sent as one yes/no question per answer, each repeating the question text.
  if (question.type === 'multi') {
    return question.answers.reduce((sum, a) => sum + instructionTokens(question) + answerTokens(a) + 12, 0)
  }
  return instructionTokens(question) + question.answers.reduce((sum, a) => sum + answerTokens(a), 0) + 12
}

/** The largest single request item the API sees for this question. */
export function longestItemTokens(question: Question): number {
  if (question.type !== 'multi') return questionTokens(question)
  return instructionTokens(question) + Math.max(0, ...question.answers.map(answerTokens)) + 12
}

export interface DocumentSize {
  title: string
  markdown: string
}

export const documentTokens = (doc: DocumentSize) => estimateTokens(doc.title + doc.markdown) + 12

export interface Budget {
  /** Context + included documents. */
  fixedTokens: number
  longestQuestion: number
  /** The set's questions plus the hidden page checks. */
  totalQuestionTokens: number
  /** The hidden page checks (page-checks.ts) alone; part of `totalQuestionTokens`. */
  checkTokens: number
  /** Max tokens `state` may use (context + documents + page). */
  stateBudget: number
  /** What is left for the page. May be negative. */
  pageBudget: number
  /** Tokens still available to add to the context/documents before the page is squeezed out. */
  headroom: number
}

export function budgetOf(
  set: Pick<QuestionSet, 'context' | 'questions'>,
  includedDocs: DocumentSize[]
): Budget {
  // The hidden page checks go with every request.
  const hidden = Object.values(pageCheckQuestions(set.questions)).map((q) => estimateTokens(q.instructions) + 12)
  const perQuestion = set.questions.map(questionTokens)
  const longestQuestion = Math.max(...hidden, ...set.questions.map(longestItemTokens))
  const checkTokens = hidden.reduce((a, b) => a + b, 0)
  const totalQuestionTokens = perQuestion.reduce((a, b) => a + b, checkTokens)
  const fixedTokens = estimateTokens(set.context) + includedDocs.reduce((s, d) => s + documentTokens(d), 0) + 40

  // 32k for state + the longest question, and 64k for the whole request.
  const stateBudget = Math.min(
    Math.floor(STATE_TOKENS * SAFETY) - longestQuestion,
    Math.floor(REQUEST_TOKENS * SAFETY) - totalQuestionTokens
  )
  const pageBudget = stateBudget - fixedTokens
  return {
    fixedTokens,
    longestQuestion,
    totalQuestionTokens,
    checkTokens,
    stateBudget,
    pageBudget,
    headroom: pageBudget - MIN_PAGE_TOKENS
  }
}

export function validateAnswers(question: Question): string[] {
  const issues: string[] = []
  const {answers, type} = question
  const labels = answers.map((a) => a.label.trim().toLowerCase())
  if (answers.some((a) => !a.label.trim())) issues.push('Every answer needs a label.')
  if (new Set(labels).size !== labels.length) issues.push('Answer labels must be unique.')
  if (type === 'boolean' && answers.length !== 2) issues.push('Yes/No needs exactly two answers.')
  if (type === 'choice' && (answers.length < 1 || answers.length > MAX_CHOICES)) {
    issues.push(`A choice needs 1–${MAX_CHOICES} answers.`)
  }
  if (type === 'multi' && (answers.length < 1 || answers.length > MAX_MULTI)) {
    issues.push(`A multi pick needs 1–${MAX_MULTI} answers.`)
  }
  if (type === 'score' && (answers.length < MIN_LEVELS || answers.length > MAX_LEVELS)) {
    issues.push(`A score needs ${MIN_LEVELS}–${MAX_LEVELS} levels.`)
  }
  return issues
}

export function validateQuestion(question: Question): string[] {
  const issues: string[] = []
  if (!question.text.trim()) issues.push('Write the question text.')
  return [...issues, ...validateAnswers(question)]
}

export function validateSet(
  set: Pick<QuestionSet, 'name' | 'context' | 'questions'>,
  includedDocs: DocumentSize[]
): string[] {
  const issues: string[] = []
  if (!set.name.trim()) issues.push('The set needs a name.')
  if (set.questions.length === 0) issues.push('Add at least one question.')
  if (set.questions.length > MAX_QUESTIONS) issues.push(`At most ${MAX_QUESTIONS} questions.`)
  set.questions.forEach((q, i) => {
    for (const issue of validateQuestion(q)) issues.push(`Question ${i + 1}: ${issue}`)
  })
  const clean = sanitizeDependencies(set.questions)
  set.questions.forEach((q, i) => {
    if (q.dependsOn && !clean[i].dependsOn) {
      issues.push(`Question ${i + 1}: its "depends on" rule points to something that no longer exists.`)
    }
  })
  const budget = budgetOf(set, includedDocs)
  if (budget.pageBudget < MIN_PAGE_TOKENS) {
    issues.push(
      'Context, documents and questions use too much of the model limit, leaving no room for the page.'
    )
  }
  return issues
}
