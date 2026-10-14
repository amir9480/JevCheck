import {ANSWER_PRESETS, buildAnswers} from '@/lib/answer-presets'
import {newId, type AnswerOption, type Question} from '@/lib/question-types'

/** A ready-to-use starting point for a question set. Add one directory per template. */
export interface QuestionSetTemplate {
  id: string
  name: string
  description: string
  /** Key into `ICONS` (lib/icon-map). */
  icon: string
  /** Whether the user must supply documents (a resume, criteria…) for the set to work. */
  requireDocuments: boolean
  /** Shown above the upload step during onboarding. */
  documentHint?: string
  context: string
  /** A factory: every call yields fresh question and answer ids. */
  questions: () => Question[]
}

/** Answers of a built-in preset (`yes-no`, `poor-excellent`…), with fresh ids. */
export const presetAnswers = (id: string): AnswerOption[] =>
  buildAnswers(ANSWER_PRESETS.find((p) => p.id === id)!)

/** A yes/no "is this the right kind of page?" question that the rest of a template depends on. */
export const gateQuestion = (text: string, details?: string): Question => ({
  id: newId(),
  text,
  details,
  type: 'boolean',
  answers: presetAnswers('yes-no')
})

/** The gate first, then every other question, shown only when the gate is answered Yes. */
export const withGate = (gate: Question, rest: Question[]): Question[] => [
  gate,
  ...rest.map((q) => ({...q, dependsOn: {questionId: gate.id, answerIds: [gate.answers[0].id]}}))
]
