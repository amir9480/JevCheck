import Dexie, {type EntityTable} from 'dexie'
import type {DecisionProtocol} from '@/lib/decision/types'
import type {ProviderId} from '@/lib/decision/providers'

export interface StoredKey {
  id: string
  providerId: ProviderId
  label: string
  apiKey: string
  /** Custom providers, or a built-in's endpoint override. */
  baseUrl?: string
  model?: string
  /** Custom providers only. */
  protocol?: DecisionProtocol
}

export interface VaultData {
  keys: StoredKey[]
  activeId: string | null
}

export const VAULT_KEY = 'vault'
export const EMPTY_VAULT: VaultData = {keys: [], activeId: null}

interface Sealed {
  iv: number[]
  data: number[]
}

/**
 * The AES key lives in its own IndexedDB as a non-extractable CryptoKey, so its bytes are never
 * readable from JS. Only ciphertext goes to chrome.storage.local.
 */
const keyDb = new Dexie('JevCheckVault') as Dexie & {
  keys: EntityTable<{id: string; key: CryptoKey}, 'id'>
}
keyDb.version(1).stores({keys: 'id'})

const KEY_ID = 'master'

async function getMasterKey(create: boolean): Promise<CryptoKey | null> {
  const existing = await keyDb.keys.get(KEY_ID)
  if (existing) return existing.key
  if (!create) return null
  const key = await crypto.subtle.generateKey({name: 'AES-GCM', length: 256}, false, [
    'encrypt',
    'decrypt'
  ])
  try {
    // `add` (not `put`): if another panel created a key meanwhile, keep and use that one.
    await keyDb.keys.add({id: KEY_ID, key})
    return key
  } catch (error) {
    if (!(error instanceof Dexie.ConstraintError)) throw error
    return (await keyDb.keys.get(KEY_ID))!.key
  }
}

async function seal(key: CryptoKey, data: VaultData): Promise<Sealed> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const cipher = await crypto.subtle.encrypt(
    {name: 'AES-GCM', iv},
    key,
    new TextEncoder().encode(JSON.stringify(data))
  )
  return {iv: Array.from(iv), data: Array.from(new Uint8Array(cipher))}
}

async function unseal(key: CryptoKey, sealed: Sealed): Promise<VaultData> {
  const plain = await crypto.subtle.decrypt(
    {name: 'AES-GCM', iv: new Uint8Array(sealed.iv)},
    key,
    new Uint8Array(sealed.data)
  )
  return JSON.parse(new TextDecoder().decode(plain)) as VaultData
}

export async function wipeVault(): Promise<void> {
  await chrome.storage.local.remove(VAULT_KEY)
}

/**
 * Reads and decrypts the vault. If ciphertext exists but the encryption key is gone or does
 * not match, every stored API key is removed and `wasReset` is true. Any other failure (e.g.
 * IndexedDB unavailable for a moment) is thrown and nothing is deleted.
 */
export async function loadVault(): Promise<{data: VaultData; wasReset: boolean}> {
  const stored = (await chrome.storage.local.get(VAULT_KEY))[VAULT_KEY] as Sealed | undefined
  if (!stored) return {data: EMPTY_VAULT, wasReset: false}
  const key = await getMasterKey(false)
  let data: VaultData | null = null
  if (key) {
    try {
      data = await unseal(key, stored)
    } catch {
      // Wrong key or corrupt ciphertext: unrecoverable.
    }
  }
  if (data) return {data, wasReset: false}
  await wipeVault()
  return {data: EMPTY_VAULT, wasReset: true}
}

/** Runs `task` while no other panel (every tab has its own) is changing the vault. */
export function withVaultLock<T>(task: () => Promise<T>): Promise<T> {
  return navigator.locks.request('jevcheck-vault', task)
}

export async function saveVault(data: VaultData): Promise<void> {
  const key = (await getMasterKey(true))!
  await chrome.storage.local.set({[VAULT_KEY]: await seal(key, data)})
}
