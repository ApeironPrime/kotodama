import { useEffect } from 'react'
import { usePersistentState } from '../../lib/usePersistentState'
import { apiPaths, requestApi } from '../../lib/apiClient'
import { useAuth } from '../auth/authContext'

export type LearningLanguage = 'jp' | 'en' | 'fr' | 'ko' | 'zh'
export type LearningLevel = 'beginner' | 'elementary' | 'intermediate' | 'advanced'

export type LearningPlan = {
  language: LearningLanguage
  level: LearningLevel
  dailyWords: number
  dailyMinutes: number
  reason: string
  startedAt: string
}

export const ACTIVE_LEARNING_LANGUAGE: LearningLanguage = 'jp'

export const LEARNING_LANGUAGES: Record<LearningLanguage, { label: string; native: string; flag: string }> = {
  jp: { label: 'Tiếng Nhật', native: '日本語', flag: '🇯🇵' },
  en: { label: 'Tiếng Anh', native: 'English', flag: '🇬🇧' },
  fr: { label: 'Tiếng Pháp', native: 'Français', flag: '🇫🇷' },
  ko: { label: 'Tiếng Hàn', native: '한국어', flag: '🇰🇷' },
  zh: { label: 'Tiếng Trung', native: '中文', flag: '🇨🇳' },
}

export const LEARNING_LEVELS: Record<LearningLevel, string> = {
  beginner: 'Mới bắt đầu',
  elementary: 'Cơ bản',
  intermediate: 'Trung cấp',
  advanced: 'Nâng cao',
}

export function useLearningPlan() {
  const [storedPlan, setStoredPlan] = usePersistentState<LearningPlan | null>('kotodama.learning-plan', null)
  const [dailyWords, setDailyWords] = usePersistentState(
    'kotodama.settings.daily-words',
    String(storedPlan?.dailyWords ?? 20)
  )
  const { status } = useAuth()
  const plan = storedPlan
    ? { ...storedPlan, language: ACTIVE_LEARNING_LANGUAGE, dailyWords: Number(dailyWords) || 20 }
    : null

  useEffect(() => {
    if (storedPlan && storedPlan.language !== ACTIVE_LEARNING_LANGUAGE) {
      setStoredPlan({ ...storedPlan, language: ACTIVE_LEARNING_LANGUAGE })
    }
  }, [setStoredPlan, storedPlan])

  useEffect(() => {
    if (status !== 'authenticated') return
    let active = true
    void requestApi<LearningPlan | null>({
      method: 'GET',
      url: apiPaths.account.learningPlan,
      dedupeKey: 'account:learning-plan',
    })
      .then((value) => {
        if (active) setStoredPlan(value)
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [setStoredPlan, status])

  const savePlan = (nextPlan: LearningPlan | null) => {
    setStoredPlan(nextPlan)
    if (nextPlan) setDailyWords(String(nextPlan.dailyWords))
    if (status !== 'authenticated' || !nextPlan) return
    void requestApi<LearningPlan>({ method: 'POST', url: apiPaths.account.learningPlan, data: nextPlan })
      .then(setStoredPlan)
      .catch(() => undefined)
    void requestApi({
      method: 'POST',
      url: apiPaths.account.preferences,
      data: { dailyWords: nextPlan.dailyWords },
    }).catch(() => undefined)
  }

  return [plan, savePlan] as const
}
