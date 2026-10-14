import type {Question, QuestionSet} from '@/lib/question-types'
import {sanitizeDependencies} from '@/lib/dependencies'

// Jev 1.13: 64k tokens per request, of which 32k are for `state` plus the longest question.
export const STATE_TOKENS = 32_000
export const REQUEST_TOKENS = 64_000
/** Token counts are estimates, so stay 10% under every limit. */
const SAFETY = 0.9
/** Conservative: real text averages ~4 characters per token. */
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

export const estimateTokens = (text: string) => Math.ceil(text.length / CHARS_PER_TOKEN)
export const tokensToChars = (tokens: number) => Math.floor(tokens * CHARS_PER_TOKEN)

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
  totalQuestionTokens: number
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
  const perQuestion = set.questions.map(questionTokens)
  const longestQuestion = Math.max(0, ...set.questions.map(longestItemTokens))
  const totalQuestionTokens = perQuestion.reduce((a, b) => a + b, 0)
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
