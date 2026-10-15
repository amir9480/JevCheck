import {PROTOCOLS, errorMessage, isTokenLimitError} from './protocols'
import type {ProviderConfig} from './providers'
import {DecisionError, type DecisionQuestion, type DecisionResult} from './types'

export async function decide(
  config: ProviderConfig,
  input: {state: unknown; questions: Record<string, DecisionQuestion>; signal?: AbortSignal}
): Promise<DecisionResult> {
  const protocol = PROTOCOLS[config.protocol]
  const request = {model: config.model, state: input.state, questions: input.questions}

  let response: Response
  try {
    response = await fetch(config.baseUrl.replace(/\/+$/, '') + protocol.path, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(protocol.encode(request)),
      signal: input.signal
    })
  } catch (error) {
    if (input.signal?.aborted) throw error
    throw new DecisionError('Could not reach the provider. Check your connection and base URL.')
  }

  const body = await response.json().catch(() => null)
  if (!response.ok) {
    throw new DecisionError(errorMessage(response.status, body), response.status, isTokenLimitError(body))
  }
  return protocol.decode(body, request)
}

const isDecisionModel = (id: string) => /decision|jev|typesafe/i.test(id)

/** Where each provider lists models, and how to narrow the list to decision models. */
function modelsEndpoint(config: ProviderConfig): {url: string; filter?: (id: string) => boolean} {
  const base = config.baseUrl.replace(/\/+$/, '')
  switch (config.protocol) {
    case 'vercel':
      // The TypeSafe-compatible API lists only the decision models available to the key.
      return {url: `${base}/typesafe/v1/models`}
    case 'openrouter':
      // The decisions API is under /api/alpha; the catalog is under /api/v1.
      return {url: `${base.replace(/\/alpha$/, '/v1')}/models?output_modalities=decisions`}
    case 'typesafe':
      // OpenCode's catalog also lists non-decision models.
      return {url: `${base}/v1/models`, filter: isDecisionModel}
    case 'openai':
      return {url: `${base}/models`, filter: isDecisionModel}
  }
}

/** Model ids the provider offers for decisions. Throws if the list is unavailable or empty. */
export async function listModels(config: ProviderConfig, signal?: AbortSignal): Promise<string[]> {
  const {url, filter} = modelsEndpoint(config)
  let response: Response
  try {
    // Catalogs are normally public; send the key only if one has been entered.
    const headers: Record<string, string> = config.apiKey ? {Authorization: `Bearer ${config.apiKey}`} : {}
    response = await fetch(url, {headers, signal})
  } catch {
    throw new DecisionError('Could not reach the provider to list models.')
  }
  const body = await response.json().catch(() => null)
  if (!response.ok) throw new DecisionError(errorMessage(response.status, body), response.status)

  const items: unknown[] = Array.isArray(body) ? body : (body?.data ?? body?.models ?? [])
  const ids = items
    .map((item) => (typeof item === 'string' ? item : ((item as {id?: unknown})?.id ?? (item as {name?: unknown})?.name)))
    .filter((id): id is string => typeof id === 'string' && (!filter || filter(id)))
  if (ids.length === 0) throw new DecisionError('The provider listed no decision models.')
  return [...new Set(ids)].sort()
}

export * from './types'
export * from './providers'
