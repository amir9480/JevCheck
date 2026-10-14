import {useCallback, useEffect, useState} from 'react'
import {
  EMPTY_VAULT,
  VAULT_KEY,
  loadVault,
  saveVault,
  withVaultLock,
  type StoredKey,
  type VaultData
} from '@/lib/key-vault'
import {providerById, type ProviderConfig} from '@/lib/decision/providers'

/** Resolves a stored key into what the decision client needs, or null if it is incomplete. */
export function toProviderConfig(key: StoredKey): ProviderConfig | null {
  const provider = providerById(key.providerId)
  const protocol = key.protocol ?? provider.protocol
  const baseUrl = key.baseUrl || provider.baseUrl
  const model = key.model || provider.model
  if (!protocol || !baseUrl || !model) return null
  return {providerId: key.providerId, protocol, baseUrl, model, apiKey: key.apiKey}
}

// Writes are read-modify-write on one blob, so they hold a lock shared by every panel.
const mutate = (change: (data: VaultData) => VaultData): Promise<void> =>
  withVaultLock(async () => saveVault(change((await loadVault()).data)))

export function useKeys() {
  const [vault, setVault] = useState<VaultData>(EMPTY_VAULT)
  const [isLoaded, setIsLoaded] = useState(false)
  const [wasReset, setWasReset] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const {data, wasReset: reset} = await loadVault()
      setVault(data)
      if (reset) setWasReset(true)
    } catch {
      // Transient read failure: keep what is shown; the next storage change retries.
    }
    setIsLoaded(true)
  }, [])

  useEffect(() => {
    void refresh()
    const onChanged = (changes: {[key: string]: chrome.storage.StorageChange}, area: string) => {
      if (area === 'local' && VAULT_KEY in changes) void refresh()
    }
    chrome.storage.onChanged.addListener(onChanged)
    return () => chrome.storage.onChanged.removeListener(onChanged)
  }, [refresh])

  const addKey = useCallback(
    (key: Omit<StoredKey, 'id'>) =>
      mutate((data) => {
        const id = crypto.randomUUID()
        // A newly added key becomes the active one.
        return {keys: [...data.keys, {...key, id}], activeId: id}
      }),
    []
  )

  const removeKey = useCallback(
    (id: string) =>
      mutate((data) => {
        const keys = data.keys.filter((key) => key.id !== id)
        return {keys, activeId: data.activeId === id ? (keys[0]?.id ?? null) : data.activeId}
      }),
    []
  )

  const setActive = useCallback(
    (id: string) => mutate((data) => ({...data, activeId: id})),
    []
  )

  const activeKey = vault.keys.find((key) => key.id === vault.activeId) ?? null

  return {
    keys: vault.keys,
    activeKey,
    isLoaded,
    wasReset,
    dismissReset: () => setWasReset(false),
    addKey,
    removeKey,
    setActive
  }
}
