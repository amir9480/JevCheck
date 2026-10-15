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
  // No `contains` check first: Firefox drops the user gesture at the first await. Requesting an
  // already granted origin resolves true without a prompt.
  if (!(await chrome.permissions.request({origins}))) {
    throw new Error(`Access to ${host} was not granted. It is needed to reach the provider.`)
  }
}
