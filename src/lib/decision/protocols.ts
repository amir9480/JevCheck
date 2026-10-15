import {
  type DecisionAnswer,
  type DecisionProtocol,
  type DecisionQuestion,
  type DecisionRequest,
  type DecisionResult
} from './types'

interface Protocol {
  path: string
  encode(request: DecisionRequest): unknown
  decode(body: any, request: DecisionRequest): DecisionResult
}

const asNumber = (value: unknown, fallback = 0) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback

/** Score probabilities keyed by level index, whichever shape the API used. */
function levelProbabilities(raw: unknown): Record<string, number> {
  if (Array.isArray(raw)) {
    return Object.fromEntries(
      raw.map((entry: any, index) => [String(entry?.value ?? index), asNumber(entry?.probability)])
    )
  }
  if (raw && typeof raw === 'object') {
    return Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, asNumber(value)]))
  }
  return {}
}

function choiceProbabilities(raw: unknown): Record<string, number> {
  if (Array.isArray(raw)) {
    return Object.fromEntries(
      raw.map((entry: any) => [String(entry?.value), asNumber(entry?.probability)])
    )
  }
  return levelProbabilities(raw)
}

function decodeKeyed(answers: Record<string, any>): Record<string, DecisionAnswer> {
  const out: Record<string, DecisionAnswer> = {}
  for (const [name, a] of Object.entries(answers ?? {})) {
    if (a?.type === 'boolean' || a?.type === 'noul') {
      out[name] = {type: 'boolean', probability: asNumber(a.probability ?? a.noul)}
    } else if (a?.type === 'choice') {
      out[name] = {
        type: 'choice',
        choice: String(a.choice),
        probabilities: choiceProbabilities(a.probabilities)
      }
    } else if (a?.type === 'score') {
      out[name] = {
        type: 'score',
        score: asNumber(a.score),
        probabilities: levelProbabilities(a.probabilities)
      }
    } else {
      out[name] = {type: 'refusal'}
    }
  }
  return out
}

/** `{type, instructions, criteria}` questions shared by Vercel, OpenRouter and TypeSafe. */
function encodeKeyed(request: DecisionRequest, booleanType: 'boolean' | 'noul') {
  const questions: Record<string, unknown> = {}
  for (const [name, q] of Object.entries(request.questions)) {
    if (q.type === 'boolean') {
      questions[name] = {type: booleanType, instructions: q.instructions}
    } else if (q.type === 'choice') {
      questions[name] = {type: 'choice', instructions: q.instructions, criteria: q.choices}
    } else {
      questions[name] = {
        type: 'score',
        instructions: q.instructions,
        criteria: q.levels.map((l) => (l.description ? `${l.label}: ${l.description}` : l.label))
      }
    }
  }
  return {model: request.model, state: request.state, questions}
}

function usageOf(body: any): Pick<DecisionResult, 'inputTokens' | 'cost'> {
  const usage = body?.usage ?? {}
  const cost = Number(usage.cost ?? body?.provider_metadata?.gateway?.cost ?? body?.providerMetadata?.gateway?.cost)
  return {
    inputTokens: usage.input_tokens ?? usage.inputTokens,
    cost: Number.isFinite(cost) ? cost : undefined
  }
}

function keyedProtocol(path: string, booleanType: 'boolean' | 'noul'): Protocol {
  return {
    path,
    encode: (request) => encodeKeyed(request, booleanType),
    decode: (body, request) => ({
      model: String(body?.model ?? request.model),
      answers: decodeKeyed(body?.answers),
      ...usageOf(body)
    })
  }
}

function encodeOpenAiQuestion(name: string, q: DecisionQuestion) {
  if (q.type === 'boolean') return {type: 'predicate', name, instructions: q.instructions}
  if (q.type === 'choice') {
    return {
      type: 'choice',
      name,
      instructions: q.instructions,
      choices: Object.entries(q.choices).map(([value, description]) => ({value, description}))
    }
  }
  return {
    type: 'score',
    name,
    instructions: q.instructions,
    levels: q.levels
  }
}

const openai: Protocol = {
  path: '/decisions',
  encode: (request) => ({
    model: request.model,
    // OpenAI takes a string or messages, so structured state is serialized.
    input: typeof request.state === 'string' ? request.state : JSON.stringify(request.state),
    questions: Object.entries(request.questions).map(([name, q]) => encodeOpenAiQuestion(name, q))
  }),
  decode: (body, request) => {
    const answers: Record<string, DecisionAnswer> = {}
    for (const a of body?.answers ?? []) {
      const name = String(a?.name)
      if (a?.type === 'predicate') {
        answers[name] = {type: 'boolean', probability: asNumber(a.probability)}
      } else if (a?.type === 'choice') {
        answers[name] = {
          type: 'choice',
          choice: String(a.choice),
          probabilities: choiceProbabilities(a.probabilities)
        }
      } else if (a?.type === 'score') {
        answers[name] = {
          type: 'score',
          score: asNumber(a.score),
          probabilities: levelProbabilities(a.probabilities)
        }
      } else {
        answers[name] = {type: 'refusal'}
      }
    }
    return {model: String(body?.model ?? request.model), answers, ...usageOf(body)}
  }
}

export const PROTOCOLS: Record<DecisionProtocol, Protocol> = {
  vercel: keyedProtocol('/v1/evaluate', 'boolean'),
  // OpenRouter's base URL already carries /api/alpha.
  openrouter: keyedProtocol('/decisions', 'noul'),
  openai,
  typesafe: keyedProtocol('/v1/systemone', 'noul')
}

/** e.g. `{"detail": {"error_type": "max_tokens_exceeded"}}` */
export const isTokenLimitError = (body: any): boolean =>
  /max_tokens_exceeded|context_length_exceeded|too many tokens/i.test(JSON.stringify(body ?? ''))

export function errorMessage(status: number, body: any): string {
  if (isTokenLimitError(body)) return "The request is over the model's token limit."
  const detail = body?.error?.message ?? body?.message ?? (typeof body?.error === 'string' ? body.error : '')
  if (status === 401 || status === 403) return `The API key was rejected${detail ? `: ${detail}` : '.'}`
  if (status === 402) return `Insufficient credits${detail ? `: ${detail}` : '.'}`
  if (status === 404) return `Model or endpoint not found${detail ? `: ${detail}` : '.'}`
  if (status === 429) return 'Rate limited by the provider. Try again shortly.'
  return detail || `Request failed (HTTP ${status}).`
}
