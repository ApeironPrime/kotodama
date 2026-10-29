import { nhaikanjiApi } from './nhaikanjiApi'
import type { JlptAttempt, JlptSubmissionResult } from './nhaikanjiTypes'

type StoredAttempt = JlptAttempt & { persistence: 'server' | 'local' }
const STORAGE_PREFIX = 'kotodama.jlpt-attempts.'

function storageKey(userId?: string | null) {
  return `${STORAGE_PREFIX}${userId || 'guest'}`
}

function readLocal(userId?: string | null): StoredAttempt[] {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(storageKey(userId)) || '[]')
    return Array.isArray(value) ? value.filter((item): item is StoredAttempt => Boolean(item?.id && item?.examId)) : []
  } catch {
    return []
  }
}

function writeLocal(userId: string | null | undefined, attempt: StoredAttempt) {
  try {
    const attempts = readLocal(userId).filter((item) => item.id !== attempt.id)
    window.localStorage.setItem(storageKey(userId), JSON.stringify([attempt, ...attempts].slice(0, 100)))
  } catch {
    // Storage can be disabled or full; the in-memory exam remains usable.
  }
}

export function backupJlptAttemptProgress(
  attempt: JlptAttempt,
  userId: string | null | undefined,
  progress: Pick<JlptAttempt, 'answers' | 'currentQuestion' | 'remainingSeconds'>
) {
  if (
    attempt.status === 'completed' ||
    readLocal(userId).some((item) => item.id === attempt.id && item.status === 'completed')
  )
    return
  writeLocal(userId, {
    ...(attempt as StoredAttempt),
    ...progress,
    updatedAt: new Date().toISOString(),
    persistence: (attempt as StoredAttempt).persistence || 'local',
  })
}

function attemptId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `local-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export async function listJlptAttempts(level: string, userId?: string | null): Promise<JlptAttempt[]> {
  let remote: StoredAttempt[] = []
  if (userId) {
    try {
      const response = await nhaikanjiApi.listJlptAttempts(level)
      remote = response.attempts.map((item) => ({ ...item, persistence: 'server' }))
    } catch {
      // Keep locally stored history visible during a temporary API outage.
    }
  }
  const local = readLocal(userId).filter((item) => item.level.toUpperCase() === level.toUpperCase())
  const byId = new Map<string, StoredAttempt>()
  for (const item of [...remote, ...local].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))) {
    const previous = byId.get(item.id)
    if (
      !previous ||
      (item.status === 'completed' && previous.status !== 'completed') ||
      (item.status === 'completed' && !previous.result && Boolean(item.result))
    )
      byId.set(item.id, item)
  }
  return [...byId.values()].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
}

export async function startJlptAttempt(
  examId: string,
  level: string,
  userId?: string | null,
  timeLimitMinutes = 0
): Promise<JlptAttempt> {
  if (userId) {
    try {
      const attempt = await nhaikanjiApi.createJlptAttempt({ examId, level })
      const stored = { ...attempt, persistence: 'server' as const }
      writeLocal(userId, stored)
      return stored
    } catch {
      // A local attempt remains available if this deployment has no history database.
    }
  }
  const now = new Date().toISOString()
  const attempt: StoredAttempt = {
    id: attemptId(),
    examId,
    level,
    mode: 'exam',
    status: 'in_progress',
    answers: {},
    currentQuestion: 0,
    remainingSeconds: Math.max(0, Math.floor(timeLimitMinutes * 60)),
    startedAt: now,
    updatedAt: now,
    persistence: 'local',
  }
  writeLocal(userId, attempt)
  return attempt
}

export async function getJlptAttempt(attemptIdValue: string, userId?: string | null): Promise<JlptAttempt | null> {
  const local = readLocal(userId).find((item) => item.id === attemptIdValue)
  const localWithElapsedTime =
    local?.status === 'in_progress'
      ? {
          ...local,
          remainingSeconds: Math.max(
            0,
            local.remainingSeconds - Math.floor((Date.now() - Date.parse(local.updatedAt)) / 1000)
          ),
        }
      : local
  if (local?.persistence === 'local') return localWithElapsedTime || null
  if (local?.status === 'completed' && userId) {
    try {
      const result = await nhaikanjiApi.submitJlptAttempt(local.id, local.answers)
      const completed = { ...local, result, status: 'completed' as const, persistence: 'server' as const }
      writeLocal(userId, completed)
      return completed
    } catch {
      return localWithElapsedTime || null
    }
  }
  if (userId) {
    try {
      const remote = await nhaikanjiApi.fetchJlptAttempt(attemptIdValue)
      const stored = { ...remote, persistence: 'server' as const }
      if (remote.status === 'completed') {
        writeLocal(userId, stored)
        return stored
      }
      if (localWithElapsedTime && local && Date.parse(local.updatedAt) > Date.parse(remote.updatedAt)) {
        const newerLocal = localWithElapsedTime
        if (newerLocal.status === 'completed') {
          const result = await nhaikanjiApi.submitJlptAttempt(newerLocal.id, newerLocal.answers)
          const completed = { ...newerLocal, result, persistence: 'server' as const }
          writeLocal(userId, completed)
          return completed
        }
        await nhaikanjiApi
          .saveJlptAttempt(newerLocal.id, {
            answers: newerLocal.answers,
            currentQuestion: newerLocal.currentQuestion,
            remainingSeconds: newerLocal.remainingSeconds,
          })
          .catch(() => {})
        return newerLocal
      }
      writeLocal(userId, stored)
      return stored
    } catch {
      return localWithElapsedTime || null
    }
  }
  return localWithElapsedTime || null
}

export async function saveJlptAttemptProgress(
  attempt: JlptAttempt,
  userId: string | null | undefined,
  progress: Pick<JlptAttempt, 'answers' | 'currentQuestion' | 'remainingSeconds'>
): Promise<boolean> {
  if (
    attempt.status === 'completed' ||
    readLocal(userId).some((item) => item.id === attempt.id && item.status === 'completed')
  )
    return true
  const updated: StoredAttempt = {
    ...attempt,
    ...progress,
    updatedAt: new Date().toISOString(),
    persistence: (attempt as StoredAttempt).persistence || 'local',
  }
  writeLocal(userId, updated)
  if (updated.persistence !== 'server' || !userId) return true
  try {
    await nhaikanjiApi.saveJlptAttempt(attempt.id, progress)
    return true
  } catch {
    return false
  }
}

export async function finishJlptAttempt(
  attempt: JlptAttempt,
  userId: string | null | undefined,
  answers: Record<string, number | string>
): Promise<{ result: JlptSubmissionResult; synced: boolean }> {
  let result: JlptSubmissionResult
  let synced = false
  if ((attempt as StoredAttempt).persistence === 'server' && userId) {
    try {
      result = await nhaikanjiApi.submitJlptAttempt(attempt.id, answers)
      synced = true
    } catch {
      result = await nhaikanjiApi.submitJlptExam({ examId: attempt.examId, answers })
    }
  } else {
    result = await nhaikanjiApi.submitJlptExam({ examId: attempt.examId, answers })
  }
  writeLocal(userId, {
    ...(attempt as StoredAttempt),
    status: 'completed',
    answers,
    result,
    updatedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
  })
  return { result, synced }
}
