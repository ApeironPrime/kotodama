import { useEffect } from 'react'
import { useAuth } from '../auth/authContext'
import { apiPaths, requestApi } from '../../lib/apiClient'
import type { AccountPreferences } from '../../lib/theme'

const preferenceKeys: Record<keyof AccountPreferences, string> = {
  dailyWords: 'daily-words',
  reviewLimit: 'review-limit',
  autoPronounce: 'auto-pronounce',
  furigana: 'furigana',
  romaji: 'romaji',
  pitchAccent: 'pitch-accent',
  reminders: 'reminders',
  streakReminders: 'streak-reminders',
  publicProfile: 'public-profile',
  analytics: 'analytics',
  accent: 'accent',
  background: 'background',
}

export function PreferencesBootstrap() {
  const { user } = useAuth()
  const userId = user?.id
  useEffect(() => {
    if (!userId) return
    let active = true
    void requestApi<AccountPreferences>({ method: 'GET', url: apiPaths.account.preferences })
      .then((value) => {
        if (!active) return
        for (const name of Object.keys(preferenceKeys) as Array<keyof AccountPreferences>) {
          if (value[name] === undefined) continue
          const stored = name === 'dailyWords' || name === 'reviewLimit' ? String(value[name]) : value[name]
          try {
            localStorage.setItem(`kotodama.settings.${preferenceKeys[name]}`, JSON.stringify(stored))
          } catch {
            /* Browser storage is optional. */
          }
        }
        window.dispatchEvent(new Event('kotodama:preference'))
      })
      .catch(() => {
        /* Retain the last known preferences offline. */
      })
    return () => {
      active = false
    }
  }, [userId])
  return null
}
