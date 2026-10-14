import type {ProviderId} from '@/lib/decision/providers'
export type QuestionType = 'boolean' | 'choice' | 'score' | 'multi'

/** Multi pick: answers at or above this probability count as picked. */
export const DEFAULT_THRESHOLD = 0.5
export const thresholdOf = (question: Pick<Question, 'threshold'>) => question.threshold ?? DEFAULT_THRESHOLD

export interface AnswerOption {
  id: string
  label: string
  description?: string
  /** Hex color, e.g. `#16a34a`. */
  color?: string
  /** Key into `ICONS` (src/lib/icon-map.ts). */
  icon?: string
}

/**
 * Display-only rule: the question is shown only when `questionId` (an earlier question) was
 * answered in a qualifying way. boolean / choice: the top answer is in `answerIds`. multi: any of
 * `answerIds` is at or above that question's threshold. score: the score is at least `minScore`.
 */
export interface QuestionDependency {
  questionId: string
  answerIds?: string[]
  minScore?: number
}

export interface Question {
  id: string
  text: string
  /** Extra instructions for the model, appended to the question. Never shown in the side panel. */
  details?: string
  type: QuestionType
  /**
   * boolean: exactly two (index 0 = yes/true, index 1 = no/false).
   * choice: unordered. score: ordered lowest to highest. multi: unordered, each judged on its own.
   */
  answers: AnswerOption[]
  /** multi only, 0..1. Display-only, so changing it never invalidates a saved result. */
  threshold?: number
  /** Hides this question in results unless the source question's answer qualifies. */
  dependsOn?: QuestionDependency
}

export interface QuestionSet {
  id: number
  name: string
  /** Normalized name (trim + lowercase); unique index. */
  nameKey: string
  /** Markdown given to the model before the documents and the page. */
  context: string
  questions: Question[]
  /**
   * Ids of the library documents sent with this set. A checkbox in the editor is the only source
   * of truth: an id whose document was deleted counts as missing and blocks evaluation.
   */
  documentIds: number[]
  /** When true, Evaluate is blocked until the set has at least one (existing) document. */
  requireDocuments: boolean
  /** Listed in the context menu; picking it opens the panel and runs the set. Absent = false. */
  quickAccess?: boolean
  createdAt: number
  updatedAt: number
}

/** One question's answer as stored in a result. */
export type StoredAnswer =
  | {type: 'boolean'; probability: number}
  | {type: 'choice'; choiceId: string; probabilities: Record<string, number>}
  | {type: 'score'; score: number; probabilities: Record<string, number>}
  /** Independent probability per answer id (they do not sum to 1). */
  | {type: 'multi'; probabilities: Record<string, number>}
  | {type: 'refusal'}

export interface Evaluation {
  id: number
  setId: number
  /** SHA-256 of everything that influences the answers (see evaluate-set.ts). */
  hash: string
  pageTitle: string
  pageUrl: string
  /** SHA-256 of the page text. Absent on old results. */
  pageHash?: string
  /** Keyed by question id. Choice/score probabilities are keyed by answer id. */
  answers: Record<string, StoredAnswer>
  /** The set's questions when the result was saved, so history renders as it was. Absent on old results. */
  questions?: Question[]
  /** Absent on old results. */
  providerId?: ProviderId
  model: string
  cost?: number
  truncated: boolean
  createdAt: number
}

export const newId = () => crypto.randomUUID()

export const makeAnswer = (label: string, extra: Partial<AnswerOption> = {}): AnswerOption => ({
  id: newId(),
  label,
  ...extra
})
