import type {DecisionQuestion} from '@/lib/decision/types'
import type {Evaluation, Question} from '@/lib/question-types'

/**
 * Hidden yes/no questions sent with every evaluation (page or selection) to judge the evaluated
 * text itself. Their answers are never shown as results; a failed check shows a hint above them.
 */
export interface PageCheck {
  key: string
  /** Where the probability of the problem is saved on the evaluation. */
  field: 'mixedContent' | 'insufficientContent'
  question: (questions: Question[]) => DecisionQuestion
  /** The question asks for the good case, so the problem's probability is 1 - yes. */
  inverted?: boolean
  /** Fails without asking the model, from the evaluated text's estimated token count. */
  failsLocally?: (contentTokens: number) => boolean
  /** Checks whose hint is hidden when this one fails (their advice would point the wrong way). */
  supersedes?: PageCheck['field'][]
}

/** At or above this probability of the problem the panel shows the check's hint. */
export const PAGE_CHECK_THRESHOLD = 0.5

/** Content under this many estimated tokens (about 50–60 English words) is too little to judge. */
export const MIN_CONTENT_TOKENS = 80

/** Each question text is cut to this many characters in the insufficient-content check. */
const QUESTION_PREVIEW_CHARS = 150

const preview = (text: string) =>
  text.length > QUESTION_PREVIEW_CHARS ? `${text.slice(0, QUESTION_PREVIEW_CHARS).trimEnd()}…` : text

export const PAGE_CHECKS: PageCheck[] = [
  {
    key: 'page_mixed_content',
    field: 'mixedContent',
    question: () => ({
      type: 'boolean',
      instructions: `Judge only state.page.content (a whole web page or a part of one the user selected), ignoring the context and documents.
Does it mix many unrelated pieces of content, such as a homepage, news front page, feed, search results or listing with separate headlines and teasers on different subjects, rather than one main article, document, product or topic?
Answer yes only if the unrelated material makes up a large part of it. Answer no for a short text or a fragment: too little to be a mix.`
    })
  },
  {
    key: 'page_enough_content',
    field: 'insufficientContent',
    inverted: true,
    question: (questions) => ({
      type: 'boolean',
      instructions: `Judge state.page.content alone (a whole web page or a part of one the user selected). The context and documents only describe what is being checked; they are not evidence about it, so ignore any facts they contain.
Could a careful reader answer most of these questions from state.page.content alone, pointing to specific statements in it, without guessing or assuming?
${questions.map((q, i) => `${i + 1}. ${preview(q.text.trim())}`).join('\n')}
Answer no if it is a fragment, a sentence or two, a heading, a teaser, a login or error page, or text about something else, so that most answers would be guesses. Answer yes only if it clearly contains the relevant information, even when some answers turn out negative.`
    }),
    failsLocally: (tokens) => tokens < MIN_CONTENT_TOKENS,
    // Too little text: "select only one subject" would be the wrong advice.
    supersedes: ['mixedContent']
  }
]

/** The checks as request questions, keyed like the set's own questions. */
export const pageCheckQuestions = (questions: Question[]): Record<string, DecisionQuestion> =>
  Object.fromEntries(PAGE_CHECKS.map((c) => [c.key, c.question(questions)]))

/** The probability of each check's problem, read from the model's answers. */
export function pageCheckResults(
  answers: Record<string, {type: string; probability?: number} | undefined>
): Partial<Record<PageCheck['field'], number>> {
  const results: Partial<Record<PageCheck['field'], number>> = {}
  for (const c of PAGE_CHECKS) {
    const a = answers[c.key]
    if (a?.type !== 'boolean' || a.probability === undefined) continue
    results[c.field] = c.inverted ? 1 - a.probability : a.probability
  }
  return results
}

/**
 * The checks whose result calls for a hint. `contentTokens` stands in for results saved before
 * the evaluation recorded it.
 */
export function failedPageChecks(evaluation: Evaluation, contentTokens?: number): PageCheck['field'][] {
  const tokens = evaluation.contentTokens ?? contentTokens
  const failed = PAGE_CHECKS.filter(
    (c) =>
      (tokens !== undefined && c.failsLocally?.(tokens)) ||
      (evaluation[c.field] ?? 0) >= PAGE_CHECK_THRESHOLD
  )
  const hidden = new Set(failed.flatMap((c) => c.supersedes ?? []))
  return failed.filter((c) => !hidden.has(c.field)).map((c) => c.field)
}
