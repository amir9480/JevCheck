/** Wire formats spoken by the supported decision APIs. */
export type DecisionProtocol = 'vercel' | 'openrouter' | 'openai' | 'typesafe'

export type DecisionQuestion =
  | {type: 'boolean'; instructions: string}
  | {type: 'choice'; instructions: string; choices: Record<string, string>}
  /** `levels` are ordered lowest to highest; the score is the index scale (0..n-1). */
  | {type: 'score'; instructions: string; levels: {label: string; description?: string}[]}

export type DecisionAnswer =
  | {type: 'boolean'; probability: number}
  | {type: 'choice'; choice: string; probabilities: Record<string, number>}
  | {type: 'score'; score: number; probabilities: Record<string, number>}
  | {type: 'refusal'}

export interface DecisionResult {
  model: string
  answers: Record<string, DecisionAnswer>
  inputTokens?: number
  /** USD, when the provider reports it. */
  cost?: number
}

export interface DecisionRequest {
  model: string
  state: unknown
  questions: Record<string, DecisionQuestion>
}

export class DecisionError extends Error {
  constructor(
    message: string,
    readonly status?: number
  ) {
    super(message)
    this.name = 'DecisionError'
  }
}
