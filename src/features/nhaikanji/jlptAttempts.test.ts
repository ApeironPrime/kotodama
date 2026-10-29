// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { JlptAttempt, JlptSubmissionResult } from './nhaikanjiTypes'
import {
  backupJlptAttemptProgress,
  finishJlptAttempt,
  getJlptAttempt,
  listJlptAttempts,
  saveJlptAttemptProgress,
} from './jlptAttempts'
import { nhaikanjiApi } from './nhaikanjiApi'

vi.mock('./nhaikanjiApi', () => ({
  nhaikanjiApi: {
    fetchJlptAttempt: vi.fn(),
    listJlptAttempts: vi.fn(),
    submitJlptAttempt: vi.fn(),
    saveJlptAttempt: vi.fn(),
    submitJlptExam: vi.fn(),
  },
}))

const now = '2026-09-23T10:00:00.000Z'
const attempt = (status: JlptAttempt['status'] = 'in_progress'): JlptAttempt => ({
  id: 'b8ddf0e1-3f80-4cbe-8944-e3e9be387f45',
  examId: 'toan-n3-202512-full',
  level: 'N3',
  mode: 'exam',
  status,
  answers: { q1: 3 },
  currentQuestion: 0,
  remainingSeconds: 8000,
  startedAt: now,
  updatedAt: now,
})

const result: JlptSubmissionResult = {
  examId: 'toan-n3-202512-full',
  totalQuestions: 101,
  correctCount: 1,
  scorePercentage: 1,
  passed: false,
  questionResults: [],
}

describe('JLPT attempt persistence', () => {
  beforeEach(() => vi.clearAllMocks())

  it('opens a server attempt on a device with no local copy', async () => {
    vi.mocked(nhaikanjiApi.fetchJlptAttempt).mockResolvedValueOnce({ ...attempt('completed'), result })
    const found = await getJlptAttempt(attempt().id, 'signed-in-user')
    expect(nhaikanjiApi.fetchJlptAttempt).toHaveBeenCalledWith(attempt().id)
    expect(found?.status).toBe('completed')
    expect(found?.result?.scorePercentage).toBe(1)
  })

  it('never replaces a submitted local result with a stale progress write', async () => {
    vi.mocked(nhaikanjiApi.submitJlptExam).mockResolvedValueOnce(result)
    const draft = attempt()
    await finishJlptAttempt(draft, null, { q1: 3 })
    backupJlptAttemptProgress(draft, null, { answers: { q1: 1 }, currentQuestion: 1, remainingSeconds: 100 })
    await saveJlptAttemptProgress(draft, null, { answers: { q1: 1 }, currentQuestion: 1, remainingSeconds: 100 })
    const found = await getJlptAttempt(draft.id, null)
    expect(found?.status).toBe('completed')
    expect(found?.answers).toEqual({ q1: 3 })
    expect(found?.result?.scorePercentage).toBe(1)
  })

  it('keeps a completed server result when a newer local draft exists', async () => {
    const draft = { ...attempt(), persistence: 'server' as const }
    backupJlptAttemptProgress(draft, 'signed-in-user', {
      answers: { q1: 1 },
      currentQuestion: 1,
      remainingSeconds: 100,
    })
    vi.mocked(nhaikanjiApi.listJlptAttempts).mockResolvedValueOnce({
      attempts: [{ ...attempt('completed'), result }],
    })
    vi.mocked(nhaikanjiApi.fetchJlptAttempt).mockResolvedValueOnce({ ...attempt('completed'), result })
    const summaries = await listJlptAttempts('N3', 'signed-in-user')
    expect(summaries).toHaveLength(1)
    expect(summaries[0]?.status).toBe('completed')
    const found = await getJlptAttempt(draft.id, 'signed-in-user')
    expect(found?.status).toBe('completed')
    expect(found?.result?.scorePercentage).toBe(1)
    expect(nhaikanjiApi.saveJlptAttempt).not.toHaveBeenCalled()
  })
})
