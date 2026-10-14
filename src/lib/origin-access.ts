export async function hasOriginAccess(baseUrl: string): Promise<boolean> {
  try {
    return await chrome.permissions.contains({origins: [`${new URL(baseUrl).origin}/*`]})
  } catch {
    return false
  }
}

/**
 * Provider hosts are optional host permissions, requested when needed. `chrome.permissions.request`
 * must run inside a user gesture, so call this first in a click/submit handler.
 */
export async function ensureOriginAccess(baseUrl: string): Promise<void> {
  const {origin, host} = new URL(baseUrl)
  const origins = [`${origin}/*`]
  if (await chrome.permissions.contains({origins})) return
  if (!(await chrome.permissions.request({origins}))) {
    throw new Error(`Access to ${host} was not granted. It is needed to reach the provider.`)
  }
}
