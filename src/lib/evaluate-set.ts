import {decide, type DecisionQuestion, type ProviderConfig} from '@/lib/decision/client'
import {budgetOf, tokensToChars} from '@/lib/decision/limits'
import {truncateMiddle} from '@/lib/truncate'
import {findEvaluation, saveEvaluation} from '@/lib/question-sets'
import type {StoredDocument} from '@/lib/db'
import type {
  Evaluation,
  Question,
  QuestionSet,
  StoredAnswer
} from '@/lib/question-types'

export interface PageContent {
  title: string
  url: string
  markdown: string
}

/** Multi pick has no native type: each answer becomes its own yes/no question. */
const multiKey = (q: Question, answerId: string) => `${q.id}_${answerId}`

/** The question as the model reads it: the visible text plus the hidden details. */
const instructionsOf = (q: Question) => (q.details?.trim() ? `${q.text}

${q.details.trim()}` : q.text)

function toDecisionQuestions(q: Question): Record<string, DecisionQuestion> {
  if (q.type === 'multi') {
    return Object.fromEntries(
      q.answers.map((a) => [
        multiKey(q, a.id),
        {
          type: 'boolean' as const,
          instructions: `${instructionsOf(q)}

Option: ${a.label}${a.description ? ` (${a.description})` : ''}
Is this option true or applicable? Judge this option alone.`
        }
      ])
    )
  }
  return {[q.id]: toDecisionQuestion(q)}
}

function toDecisionQuestion(q: Question): DecisionQuestion {
  if (q.type === 'boolean') return {type: 'boolean', instructions: instructionsOf(q)}
  if (q.type === 'choice') {
    return {
      type: 'choice',
      instructions: instructionsOf(q),
      choices: Object.fromEntries(q.answers.map((a) => [a.label, a.description || a.label]))
    }
  }
  return {
    type: 'score',
    instructions: instructionsOf(q),
    levels: q.answers.map((a) => ({label: a.label, description: a.description || undefined}))
  }
}

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

/** Identifies the page text (full, before truncation), so history can tell a changed page from the same one. */
export const hashPage = (markdown: string) => sha256(markdown)

/** Who answers: a result from one provider/model is not reused for another. */
export type Answerer = Pick<ProviderConfig, 'providerId' | 'model'>

/** Everything that can change an answer. Included documents are sorted so order is irrelevant. */
function hashInput(
  set: QuestionSet,
  docs: StoredDocument[],
  page: PageContent,
  pageContent: string,
  answerer: Answerer
): string {
  return JSON.stringify({
    provider: answerer.providerId ?? '',
    model: answerer.model,
    context: set.context,
    docs: docs.map((d) => [d.title, d.markdown]).sort((a, b) => a[0].localeCompare(b[0])),
    questions: set.questions.map((q) => ({
      id: q.id,
      text: q.text,
      details: q.details?.trim() ?? '',
      type: q.type,
      answers: q.answers.map((a) => [a.id, a.label, a.description ?? ''])
    })),
    // Title and URL are sent with the page, so they can change the answer too.
    page: {title: page.title, url: page.url, content: pageContent}
  })
}

export interface EvaluateOutcome {
  evaluation: Evaluation
  cached: boolean
}

/** Fits the page into the set's budget and hashes everything that can change an answer. */
async function prepare(set: QuestionSet, docs: StoredDocument[], page: PageContent, answerer: Answerer) {
  const budget = budgetOf(set, docs)
  if (budget.pageBudget <= 0) throw new Error('This set leaves no room for the page. Shrink it first.')
  const {text: pageText, truncated} = truncateMiddle(page.markdown, tokensToChars(budget.pageBudget))
  const hash = await sha256(hashInput(set, docs, page, pageText, answerer))
  return {pageText, truncated, hash}
}

/**
 * The saved result for identical questions, context, documents and page, if any, plus the hash of
 * the current inputs. No network.
 */
export async function findCachedEvaluation(
  set: QuestionSet,
  documents: StoredDocument[],
  page: PageContent,
  answerer: Answerer
): Promise<{hash: string; evaluation: Evaluation | null} | null> {
  try {
    const {hash} = await prepare(set, documents, page, answerer)
    return {hash, evaluation: (await findEvaluation(set.id, hash)) ?? null}
  } catch {
    return null
  }
}

export async function evaluateSet(
  config: ProviderConfig,
  input: {
    set: QuestionSet
    /** The set's documents, all of which are sent. */
    documents: StoredDocument[]
    page: PageContent
    /** Skip the cache and ask the model again. */
    force?: boolean
    signal?: AbortSignal
  }
): Promise<EvaluateOutcome> {
  const {set, page} = input
  const docs = input.documents
  const {pageText, truncated, hash} = await prepare(set, docs, page, config)

  if (!input.force) {
    const cached = await findEvaluation(set.id, hash)
    if (cached) return {evaluation: cached, cached: true}
  }

  const result = await decide(config, {
    state: {
      context: set.context,
      documents: docs.map((d) => ({title: d.title, content: d.markdown})),
      page: {title: page.title, url: page.url, content: pageText}
    },
    questions: Object.assign({}, ...set.questions.map(toDecisionQuestions)),
    signal: input.signal
  })

  const answers: Record<string, StoredAnswer> = {}
  for (const q of set.questions) {
    if (q.type === 'multi') {
      const parts = q.answers.map((o) => result.answers[multiKey(q, o.id)])
      answers[q.id] = parts.some((p) => p?.type === 'boolean')
        ? {
            type: 'multi',
            probabilities: Object.fromEntries(
              q.answers.map((o, i) => [o.id, parts[i]?.type === 'boolean' ? parts[i].probability : 0])
            )
          }
        : {type: 'refusal'}
      continue
    }
    const a = result.answers[q.id]
    if (a?.type === 'boolean' && q.type === 'boolean') {
      answers[q.id] = {type: 'boolean', probability: a.probability}
    } else if (a?.type === 'choice' && q.type === 'choice') {
      const picked = q.answers.find((o) => o.label === a.choice)
      answers[q.id] = picked
        ? {
            type: 'choice',
            choiceId: picked.id,
            probabilities: Object.fromEntries(
              q.answers.map((o) => [o.id, a.probabilities[o.label] ?? 0])
            )
          }
        : {type: 'refusal'}
    } else if (a?.type === 'score' && q.type === 'score') {
      answers[q.id] = {
        type: 'score',
        score: a.score,
        probabilities: Object.fromEntries(q.answers.map((o, i) => [o.id, a.probabilities[String(i)] ?? 0]))
      }
    } else {
      answers[q.id] = {type: 'refusal'}
    }
  }

  const evaluation: Omit<Evaluation, 'id'> = {
    setId: set.id,
    hash,
    pageTitle: page.title,
    pageUrl: page.url,
    pageHash: await hashPage(page.markdown),
    answers,
    questions: set.questions,
    providerId: config.providerId,
    model: result.model,
    cost: result.cost,
    truncated,
    createdAt: Date.now()
  }
  const id = await saveEvaluation(evaluation)
  return {evaluation: {...evaluation, id}, cached: false}
}
