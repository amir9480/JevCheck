import type {DecisionProtocol} from './types'

export type ProviderId = 'vercel' | 'openrouter' | 'openai' | 'typesafe' | 'opencode' | 'custom'

export interface ProviderInfo {
  id: ProviderId
  label: string
  /** Fixed for built-ins; chosen by the user for `custom`. */
  protocol?: DecisionProtocol
  baseUrl?: string
  model?: string
  /** Short tag shown next to the provider name, e.g. "Free". */
  badge?: string
  /** Page where the user finds or creates an API key. */
  keyUrl?: string
  /** The provider's own policies, which the user accepts by using it. */
  privacyUrl?: string
  termsUrl?: string
}

export const PROVIDERS: ProviderInfo[] = [
  {
    id: 'vercel',
    label: 'Vercel AI Gateway',
    protocol: 'vercel',
    baseUrl: 'https://ai-gateway.vercel.sh',
    model: 'typesafe-ai/jev',
    keyUrl: 'https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fai-gateway%2Fapi-keys',
    privacyUrl: 'https://vercel.com/legal/privacy-policy',
    termsUrl: 'https://vercel.com/legal/terms'
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    protocol: 'openrouter',
    baseUrl: 'https://openrouter.ai/api/alpha',
    model: 'typesafe/jev-1.13',
    keyUrl: 'https://openrouter.ai/settings/keys',
    privacyUrl: 'https://openrouter.ai/privacy',
    termsUrl: 'https://openrouter.ai/terms'
  },
  {
    id: 'openai',
    label: 'OpenAI',
    protocol: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-6-luna-decisions',
    keyUrl: 'https://platform.openai.com/api-keys',
    privacyUrl: 'https://openai.com/policies/privacy-policy',
    termsUrl: 'https://openai.com/policies/terms-of-use'
  },
  {
    id: 'typesafe',
    label: 'TypeSafe',
    protocol: 'typesafe',
    // Editable assumption: the direct TypeSafe host is not documented in the sources used.
    baseUrl: 'https://api.typesafe.ai',
    model: 'jev-latest',
    keyUrl: 'https://console.typesafe.ai/',
    privacyUrl: 'https://typesafe.ai/legal/privacy-policy',
    termsUrl: 'https://typesafe.ai/legal/terms'
  },
  {
    id: 'opencode',
    label: 'OpenCode',
    protocol: 'typesafe',
    baseUrl: 'https://opencode.ai/inference',
    model: 'jev-1.13-free',
    badge: 'Free',
    keyUrl: 'https://opencode.ai/auth',
    privacyUrl: 'https://opencode.ai/legal/privacy-policy',
    termsUrl: 'https://opencode.ai/legal/terms-of-service'
  },
  {id: 'custom', label: 'Custom'}
]

export const providerById = (id: ProviderId) => PROVIDERS.find((p) => p.id === id)!

/** The two wire formats a custom provider may speak. */
export const CUSTOM_PROTOCOLS: {value: DecisionProtocol; label: string}[] = [
  {value: 'openai', label: 'OpenAI-compatible'},
  {value: 'typesafe', label: 'TypeSafe-compatible'}
]

/** Connection details the client needs; produced from a stored key. */
export interface ProviderConfig {
  providerId?: ProviderId
  protocol: DecisionProtocol
  baseUrl: string
  model: string
  apiKey: string
}
