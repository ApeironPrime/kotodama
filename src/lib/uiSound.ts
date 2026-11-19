const KEY = 'kotodama.settings.ui-sound'
const listeners = new Set<() => void>()
let fallback = false
let storageUnavailable = false

export function getUiSoundEnabled(): boolean {
  if (storageUnavailable) return fallback
  try {
    return localStorage.getItem(KEY) === 'true'
  } catch {
    return fallback
  }
}

export function setUiSoundEnabled(enabled: boolean) {
  fallback = enabled
  try {
    localStorage.setItem(KEY, JSON.stringify(enabled))
    storageUnavailable = false
  } catch {
    storageUnavailable = true
  }
  listeners.forEach((listener) => listener())
}

export function subscribeUiSound(listener: () => void) {
  listeners.add(listener)
  const sync = (event: StorageEvent) => {
    if (event.key === KEY || event.key === null) listener()
  }
  window.addEventListener('storage', sync)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', sync)
  }
}
