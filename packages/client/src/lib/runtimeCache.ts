export async function clearGameRuntimeCache(): Promise<void> {
  if (typeof window === 'undefined') return

  try {
    window.sessionStorage?.clear()
  } catch {
    // ignore
  }

  try {
    if ('caches' in window) {
      const keys = await window.caches.keys()
      await Promise.all(keys.map(key => window.caches.delete(key)))
    }
  } catch {
    // ignore
  }
}
