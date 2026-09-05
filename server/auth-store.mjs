import { randomUUID } from 'node:crypto'
import { isIP } from 'node:net'

function iso(value) {
  if (!value) return null
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

function userFromRow(row) {
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.password_hash,
    role: row.role,
    emailVerified: row.email_verified,
    status: row.status,
    tokenVersion: row.token_version,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    lastActivityAt: iso(row.last_activity_at),
  }
}

function sessionFromRow(row) {
  if (!row) return null
  return {
    id: row.id,
    userId: row.user_id,
    csrfHash: row.csrf_hash,
    familyId: row.family_id,
    revokedAt: iso(row.revoked_at),
    expiresAt: new Date(row.expires_at).getTime(),
  }
}

const defaultPreferences = Object.freeze({
  dailyWords: 20,
  reviewLimit: 100,
  autoPronounce: true,
  furigana: true,
  romaji: false,
  pitchAccent: true,
  reminders: false,
  streakReminders: true,
  publicProfile: false,
  analytics: true,
  accent: 'rose',
  background: 'midnight',
})

function preferencesFromRow(row) {
  if (!row) return { ...defaultPreferences }
  return {
    dailyWords: row.daily_words,
    reviewLimit: row.review_limit === null ? 'unlimited' : row.review_limit,
    autoPronounce: row.auto_pronounce,
    furigana: row.furigana,
    romaji: row.romaji,
    pitchAccent: row.pitch_accent,
    reminders: row.reminders,
    streakReminders: row.streak_reminders,
    publicProfile: row.public_profile,
    analytics: row.analytics_enabled,
    accent: row.accent,
    background: row.background,
    updatedAt: iso(row.updated_at),
  }
}

function learningPlanFromRow(row) {
  if (!row) return null
  return {
    language: row.language,
    level: row.level,
    dailyWords: row.daily_words,
    dailyMinutes: row.daily_minutes,
    reason: row.reason,
    startedAt: iso(row.started_at),
    updatedAt: iso(row.updated_at),
  }
}

function mediaAssetFromRow(row) {
  if (!row) return null
  return {
    id: row.id,
    sourceType: row.source_type,
    title: row.title,
    language: row.language,
    rightsBasis: row.rights_basis,
    sourceReference: row.source_reference,
    originalFilename: row.original_filename,
    mimeType: row.mime_type,
    byteSize: row.byte_size === null ? null : Number(row.byte_size),
    durationMs: row.duration_ms,
    processingStatus: row.processing_status,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  }
}

function mediaAssetForProcessing(row) {
  const asset = mediaAssetFromRow(row)
  return asset ? { ...asset, storageKey: row.storage_key ?? row.storageKey ?? null } : null
}

function mediaAssetFromMemory(asset) {
  if (!asset) return null
  return {
    id: asset.id,
    sourceType: asset.sourceType,
    title: asset.title,
    language: asset.language,
    rightsBasis: asset.rightsBasis,
    sourceReference: asset.sourceReference ?? null,
    originalFilename: asset.originalFilename ?? null,
    mimeType: asset.mimeType ?? null,
    byteSize: asset.byteSize ?? null,
    durationMs: asset.durationMs ?? null,
    processingStatus: asset.processingStatus,
    errorCode: asset.errorCode ?? null,
    errorMessage: asset.errorMessage ?? null,
    createdAt: asset.createdAt,
    updatedAt: asset.updatedAt,
  }
}

function mediaProcessingJobFromRow(row) {
  if (!row) return null
  return {
    id: row.id,
    mediaAssetId: row.media_asset_id,
    jobType: row.job_type,
    status: row.status,
    attemptCount: row.attempt_count,
    provider: row.provider,
    input: row.input ?? {},
    output: row.output ?? {},
    errorCode: row.error_code,
    errorMessage: row.error_message,
    startedAt: iso(row.started_at),
    finishedAt: iso(row.finished_at),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  }
}

function mediaProcessingJobFromMemory(job) {
  if (!job) return null
  return {
    id: job.id,
    mediaAssetId: job.mediaAssetId,
    jobType: job.jobType,
    status: job.status,
    attemptCount: job.attemptCount,
    provider: job.provider ?? null,
    input: job.input ?? {},
    output: job.output ?? {},
    errorCode: job.errorCode ?? null,
    errorMessage: job.errorMessage ?? null,
    startedAt: job.startedAt ?? null,
    finishedAt: job.finishedAt ?? null,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  }
}

function transcriptFromRow(row, segments = []) {
  if (!row) return null
  return {
    id: row.id,
    mediaAssetId: row.media_asset_id,
    version: row.version,
    language: row.language,
    source: row.source,
    provider: row.provider,
    status: row.status,
    qualityScore: row.quality_score === null ? null : Number(row.quality_score),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    segments,
  }
}

function transcriptFromMemory(transcript, segments = []) {
  if (!transcript) return null
  return {
    id: transcript.id,
    mediaAssetId: transcript.mediaAssetId,
    version: transcript.version,
    language: transcript.language,
    source: transcript.source,
    provider: transcript.provider ?? null,
    status: transcript.status,
    qualityScore: transcript.qualityScore ?? null,
    createdAt: transcript.createdAt,
    updatedAt: transcript.updatedAt,
    segments,
  }
}

function shadowingSessionFromMemory(session, asset = null, transcript = null) {
  if (!session) return null
  return {
    id: session.id,
    userId: session.userId,
    mediaAssetId: session.mediaAssetId,
    transcriptVersionId: session.transcriptVersionId,
    mode: session.mode,
    selectedSpeakerLabel: session.selectedSpeakerLabel ?? null,
    status: session.status,
    currentSegmentSequence: session.currentSegmentSequence ?? 1,
    startedAt: session.startedAt,
    completedAt: session.completedAt ?? null,
    mediaAsset: asset ? mediaAssetFromMemory(asset) : undefined,
    transcript: transcript ?? undefined,
  }
}

function shadowingSessionFromRow(row, asset = null, transcript = null) {
  if (!row) return null
  return {
    id: row.id,
    userId: row.user_id,
    mediaAssetId: row.media_asset_id,
    transcriptVersionId: row.transcript_version_id,
    mode: row.mode,
    selectedSpeakerLabel: row.selected_speaker_label,
    status: row.status,
    currentSegmentSequence: row.current_segment_sequence ?? 1,
    startedAt: iso(row.started_at),
    completedAt: iso(row.completed_at),
    mediaAsset: asset ? mediaAssetFromRow(asset) : undefined,
    transcript: transcript ?? undefined,
  }
}

function shadowingScoreFromMemory(score) {
  if (!score) return null
  return {
    shadowingAttemptId: score.shadowingAttemptId,
    overallScore: score.overallScore,
    contentScore: score.contentScore,
    pronunciationScore: score.pronunciationScore,
    timingScore: score.timingScore,
    prosodyScore: score.prosodyScore ?? null,
    confidence: score.confidence,
    feedback: score.feedback ?? {},
    scoringVersion: score.scoringVersion,
    createdAt: score.createdAt,
  }
}

function shadowingScoreFromRow(row) {
  if (!row) return null
  return {
    shadowingAttemptId: row.shadowing_attempt_id ?? row.id,
    overallScore: row.overall_score === null ? null : Number(row.overall_score),
    contentScore: row.content_score === null ? null : Number(row.content_score),
    pronunciationScore: row.pronunciation_score === null ? null : Number(row.pronunciation_score),
    timingScore: row.timing_score === null ? null : Number(row.timing_score),
    prosodyScore: row.prosody_score === null ? null : Number(row.prosody_score),
    confidence: row.confidence === null ? null : Number(row.confidence),
    feedback: typeof row.feedback === 'object' && row.feedback !== null ? row.feedback : {},
    scoringVersion: row.scoring_version ?? 'whisper_basic_v1',
    createdAt: iso(row.score_created_at ?? row.created_at),
  }
}

function shadowingAttemptFromMemory(attempt, score = null) {
  if (!attempt) return null
  return {
    id: attempt.id,
    sessionId: attempt.sessionId,
    transcriptSegmentId: attempt.transcriptSegmentId,
    attemptNo: attempt.attemptNo,
    audioStorageKey: attempt.audioStorageKey ?? null,
    durationMs: attempt.durationMs ?? null,
    recognizedText: attempt.recognizedText ?? null,
    alignment: attempt.alignment ?? [],
    evaluatorProvider: attempt.evaluatorProvider ?? null,
    evaluationStatus: attempt.evaluationStatus,
    createdAt: attempt.createdAt,
    score: score ? shadowingScoreFromMemory(score) : null,
  }
}

function shadowingAttemptFromRow(row, score = null) {
  if (!row) return null
  return {
    id: row.id,
    sessionId: row.session_id,
    transcriptSegmentId: row.transcript_segment_id,
    attemptNo: row.attempt_no,
    audioStorageKey: row.audio_storage_key,
    durationMs: row.duration_ms,
    recognizedText: row.recognized_text,
    alignment: Array.isArray(row.alignment)
      ? row.alignment
      : typeof row.alignment === 'string'
        ? JSON.parse(row.alignment || '[]')
        : [],
    evaluatorProvider: row.evaluator_provider,
    evaluationStatus: row.evaluation_status,
    createdAt: iso(row.created_at),
    score: score ? shadowingScoreFromRow(score) : null,
  }
}

function transcriptTokenFromRow(row) {
  return {
    id: row.id,
    sequenceNo: row.sequence_no,
    surface: row.surface,
    reading: row.reading,
    lemma: row.lemma,
    partOfSpeech: row.part_of_speech,
    startMs: row.start_ms,
    endMs: row.end_ms,
  }
}

function transcriptSegmentFromRow(row, tokens = []) {
  return {
    id: row.id,
    sequenceNo: row.sequence_no,
    speakerLabel: row.speaker_label,
    speakerConfidence: row.speaker_confidence === null ? null : Number(row.speaker_confidence),
    startMs: row.start_ms,
    endMs: row.end_ms,
    textJa: row.text_ja,
    textFurigana: row.text_furigana,
    textVi: row.text_vi,
    confidence: row.confidence === null ? null : Number(row.confidence),
    tokens,
  }
}

function normalizedSegmentTokens(tokens, segment) {
  if (!Array.isArray(tokens)) return []
  return tokens
    .map((token, index) => {
      const startMs = Number(token?.startMs)
      const endMs = Number(token?.endMs)
      const surface = typeof token?.surface === 'string' ? token.surface.trim() : ''
      if (!surface || !Number.isFinite(startMs) || !Number.isFinite(endMs)) return null
      const boundedStart = Math.max(segment.startMs, Math.round(startMs))
      const boundedEnd = Math.min(segment.endMs, Math.round(endMs))
      if (boundedEnd < boundedStart) return null
      return {
        id: token.id ?? randomUUID(),
        sequenceNo: index + 1,
        surface,
        reading: typeof token.reading === 'string' ? token.reading : null,
        lemma: typeof token.lemma === 'string' ? token.lemma : null,
        partOfSpeech: typeof token.partOfSpeech === 'string' ? token.partOfSpeech : null,
        startMs: boundedStart,
        endMs: boundedEnd,
      }
    })
    .filter(Boolean)
}

function attachTokensToSegments(segments, tokenRows) {
  const tokensBySegmentId = new Map()
  for (const row of tokenRows) {
    const tokens = tokensBySegmentId.get(row.transcript_segment_id) ?? []
    tokens.push(transcriptTokenFromRow(row))
    tokensBySegmentId.set(row.transcript_segment_id, tokens)
  }
  return segments.map((segment) => transcriptSegmentFromRow(segment, tokensBySegmentId.get(segment.id) ?? []))
}

function normalizedIp(value) {
  const ip = String(value ?? '').replace(/^::ffff:/, '')
  return isIP(ip) ? ip : null
}

function createMemoryStore() {
  const usersById = new Map()
  const userIdByEmail = new Map()
  const refreshSessions = new Map()
  const oneTimeTokens = new Map()
  const auditLog = []
  const rateLimits = new Map()
  const preferencesByUserId = new Map()
  const learningPlansByUserId = new Map()
  const mediaAssetsById = new Map()
  const mediaJobsById = new Map()
  const transcriptsById = new Map()
  const transcriptSegmentsByTranscriptId = new Map()
  const shadowingSessionsById = new Map()
  const shadowingAttemptsById = new Map()
  const shadowingScoresByAttemptId = new Map()

  return {
    mode: 'memory',
    async findUserById(id) {
      return usersById.get(id) ?? null
    },
    async findUserByEmail(email) {
      const id = userIdByEmail.get(email)
      return id ? usersById.get(id) : null
    },
    async createUser(user) {
      if (userIdByEmail.has(user.email)) {
        const error = new Error('Email already exists.')
        error.code = '23505'
        throw error
      }
      usersById.set(user.id, user)
      userIdByEmail.set(user.email, user.id)
      return user
    },
    async updateUser(id, patch) {
      const user = usersById.get(id)
      if (!user) return null
      Object.assign(user, patch, { updatedAt: new Date().toISOString() })
      return user
    },
    async touchUser(id, at) {
      const user = usersById.get(id)
      if (user) user.lastActivityAt = at
    },
    async incrementTokenVersion(id) {
      const user = usersById.get(id)
      if (!user) return null
      user.tokenVersion = (user.tokenVersion ?? 0) + 1
      user.updatedAt = new Date().toISOString()
      return user
    },
    async activeAdminCount() {
      return [...usersById.values()].filter((user) => user.role === 'admin' && user.status === 'active').length
    },
    async updateUserAccess(id, patch) {
      const target = usersById.get(id)
      if (!target) return { user: null }
      const nextRole = patch.role ?? target.role
      const nextStatus = patch.status ?? target.status
      const removesLastActiveAdmin =
        target.role === 'admin' && target.status === 'active' && (nextRole !== 'admin' || nextStatus !== 'active')
      if (removesLastActiveAdmin && (await this.activeAdminCount()) <= 1) return { conflict: 'LAST_ADMIN_PROTECTED' }
      target.tokenVersion = (target.tokenVersion ?? 0) + 1
      return { user: await this.updateUser(id, patch) }
    },
    async listUsers({ query, role, status, page, pageSize }) {
      const filtered = [...usersById.values()]
        .filter(
          (user) =>
            (!query || `${user.name} ${user.email}`.toLowerCase().includes(query)) &&
            (!role || user.role === role) &&
            (!status || user.status === status)
        )
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      const total = filtered.length
      const totalPages = Math.max(1, Math.ceil(total / pageSize))
      const safePage = Math.min(page, totalPages)
      return {
        items: filtered.slice((safePage - 1) * pageSize, safePage * pageSize),
        page: safePage,
        pageSize,
        total,
        totalPages,
      }
    },
    async getPreferences(userId) {
      return { ...defaultPreferences, ...(preferencesByUserId.get(userId) ?? {}) }
    },
    async updatePreferences(userId, patch) {
      const next = { ...defaultPreferences, ...(preferencesByUserId.get(userId) ?? {}), ...patch }
      preferencesByUserId.set(userId, next)
      return next
    },
    async getLearningPlan(userId) {
      return learningPlansByUserId.get(userId) ?? null
    },
    async saveLearningPlan(userId, plan) {
      const next = {
        ...plan,
        startedAt: learningPlansByUserId.get(userId)?.startedAt ?? plan.startedAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      learningPlansByUserId.set(userId, next)
      return next
    },
    async createMediaAsset(asset) {
      const next = {
        ...asset,
        processingStatus: asset.processingStatus ?? 'draft',
        createdAt: asset.createdAt ?? new Date().toISOString(),
        updatedAt: asset.updatedAt ?? new Date().toISOString(),
        errorCode: null,
        errorMessage: null,
      }
      mediaAssetsById.set(next.id, next)
      return mediaAssetFromMemory(next)
    },
    async listMediaAssets(userId, limit) {
      return [...mediaAssetsById.values()]
        .filter((asset) => (asset.ownerUserId === userId || asset.processingStatus === 'ready') && !asset.deletedAt)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .slice(0, limit)
        .map(mediaAssetFromMemory)
    },
    async findMediaAssetForUser(id, userId) {
      const asset = mediaAssetsById.get(id)
      return asset && (asset.ownerUserId === userId || asset.processingStatus === 'ready') && !asset.deletedAt
        ? mediaAssetFromMemory(asset)
        : null
    },
    async markMediaAssetUploading(id, userId) {
      const asset = mediaAssetsById.get(id)
      if (!asset || asset.ownerUserId !== userId || asset.deletedAt) return null
      if (!['draft', 'failed'].includes(asset.processingStatus)) return { conflict: true }
      asset.processingStatus = 'uploading'
      asset.errorCode = null
      asset.errorMessage = null
      asset.updatedAt = new Date().toISOString()
      return { asset: mediaAssetFromMemory(asset) }
    },
    async completeMediaAssetUpload(id, userId, upload) {
      const asset = mediaAssetsById.get(id)
      if (!asset || asset.ownerUserId !== userId || asset.processingStatus !== 'uploading') return null
      asset.storageKey = upload.storageKey
      asset.mimeType = upload.mimeType
      asset.byteSize = upload.byteSize
      asset.processingStatus = 'queued'
      asset.updatedAt = new Date().toISOString()
      const job = {
        id: randomUUID(),
        mediaAssetId: id,
        jobType: 'upload_verify',
        status: 'queued',
        attemptCount: 0,
        input: { storageKey: upload.storageKey },
        output: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      mediaJobsById.set(job.id, job)
      return { asset: mediaAssetFromMemory(asset), job: mediaProcessingJobFromMemory(job) }
    },
    async completeDownloadedMediaAsset(id, upload, title) {
      const asset = mediaAssetsById.get(id)
      if (!asset || asset.deletedAt) return null
      asset.storageKey = upload.storageKey
      asset.mimeType = upload.mimeType
      asset.byteSize = upload.byteSize
      asset.title = title
      asset.processingStatus = 'queued'
      asset.errorCode = null
      asset.errorMessage = null
      asset.updatedAt = new Date().toISOString()
      const job = {
        id: randomUUID(),
        mediaAssetId: id,
        jobType: 'upload_verify',
        status: 'queued',
        attemptCount: 0,
        input: { storageKey: upload.storageKey, importedFrom: 'youtube' },
        output: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      mediaJobsById.set(job.id, job)
      return { asset: mediaAssetFromMemory(asset), job: mediaProcessingJobFromMemory(job) }
    },
    async enqueueMediaProcessingJob(mediaAssetId, jobType, { input = {}, provider = null } = {}) {
      const asset = mediaAssetsById.get(mediaAssetId)
      if (!asset || asset.deletedAt) return null
      asset.processingStatus = 'processing'
      asset.errorCode = null
      asset.errorMessage = null
      asset.updatedAt = new Date().toISOString()
      const job = {
        id: randomUUID(),
        mediaAssetId,
        jobType,
        status: 'queued',
        attemptCount: 0,
        provider,
        input,
        output: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      mediaJobsById.set(job.id, job)
      return mediaProcessingJobFromMemory(job)
    },
    async failMediaAssetUpload(id, userId, errorCode, errorMessage) {
      const asset = mediaAssetsById.get(id)
      if (!asset || asset.ownerUserId !== userId || asset.deletedAt) return null
      asset.processingStatus = 'failed'
      asset.errorCode = errorCode
      asset.errorMessage = errorMessage
      asset.updatedAt = new Date().toISOString()
      return mediaAssetFromMemory(asset)
    },
    async listMediaProcessingJobsForAsset(assetId, userId) {
      const asset = mediaAssetsById.get(assetId)
      if (!asset || (asset.ownerUserId !== userId && asset.processingStatus !== 'ready') || asset.deletedAt) return null
      return [...mediaJobsById.values()]
        .filter((job) => job.mediaAssetId === assetId)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .map(mediaProcessingJobFromMemory)
    },
    async retryFailedMediaProcessingJob(assetId, userId) {
      const asset = mediaAssetsById.get(assetId)
      if (!asset || asset.ownerUserId !== userId || asset.deletedAt) return null
      const job = [...mediaJobsById.values()]
        .filter((candidate) => candidate.mediaAssetId === assetId && candidate.status === 'failed')
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0]
      if (!job) return null
      job.status = 'queued'
      job.errorCode = null
      job.errorMessage = null
      job.startedAt = null
      job.finishedAt = null
      job.updatedAt = new Date().toISOString()
      asset.processingStatus = 'queued'
      asset.errorCode = null
      asset.errorMessage = null
      asset.updatedAt = job.updatedAt
      return { asset: mediaAssetFromMemory(asset), job: mediaProcessingJobFromMemory(job) }
    },
    async claimNextMediaProcessingJob() {
      const job = [...mediaJobsById.values()]
        .filter((candidate) => candidate.status === 'queued')
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt))[0]
      if (!job) return null
      job.status = 'running'
      job.attemptCount += 1
      job.startedAt = new Date().toISOString()
      job.updatedAt = job.startedAt
      return mediaProcessingJobFromMemory(job)
    },
    async findMediaAssetForProcessing(id) {
      return mediaAssetsById.get(id) ?? null
    },
    async completeMediaProcessingJob(id, output) {
      const job = mediaJobsById.get(id)
      if (!job || job.status !== 'running') return null
      job.status = 'succeeded'
      job.output = output
      job.finishedAt = new Date().toISOString()
      job.updatedAt = job.finishedAt
      return mediaProcessingJobFromMemory(job)
    },
    async failMediaProcessingJob(id, errorCode, errorMessage) {
      const job = mediaJobsById.get(id)
      if (!job || !['queued', 'running'].includes(job.status)) return null
      job.status = 'failed'
      job.errorCode = errorCode
      job.errorMessage = errorMessage
      job.finishedAt = new Date().toISOString()
      job.updatedAt = job.finishedAt
      const asset = mediaAssetsById.get(job.mediaAssetId)
      if (asset) {
        asset.processingStatus = 'failed'
        asset.errorCode = errorCode
        asset.errorMessage = errorMessage
        asset.updatedAt = job.updatedAt
      }
      return mediaProcessingJobFromMemory(job)
    },
    async saveMachineTranscript({ mediaAssetId, provider, segments }) {
      const asset = mediaAssetsById.get(mediaAssetId)
      if (!asset || asset.deletedAt) return null
      const version =
        Math.max(
          0,
          ...[...transcriptsById.values()]
            .filter((item) => item.mediaAssetId === mediaAssetId)
            .map((item) => item.version)
        ) + 1
      for (const transcript of transcriptsById.values())
        if (transcript.mediaAssetId === mediaAssetId && transcript.status === 'ready') transcript.status = 'superseded'
      const now = new Date().toISOString()
      const transcript = {
        id: randomUUID(),
        mediaAssetId,
        version,
        language: 'ja',
        source: 'machine',
        provider,
        status: 'ready',
        qualityScore: null,
        createdAt: now,
        updatedAt: now,
      }
      const savedSegments = segments.map((segment, index) => {
        const savedSegment = {
          id: randomUUID(),
          sequenceNo: index + 1,
          speakerLabel: segment.speakerLabel ?? null,
          speakerConfidence: segment.speakerConfidence ?? null,
          startMs: segment.startMs,
          endMs: segment.endMs,
          textJa: segment.textJa,
          textFurigana: segment.textFurigana ?? null,
          textVi: segment.textVi ?? null,
          confidence: segment.confidence ?? null,
        }
        return { ...savedSegment, tokens: normalizedSegmentTokens(segment.tokens, savedSegment) }
      })
      transcriptsById.set(transcript.id, transcript)
      transcriptSegmentsByTranscriptId.set(transcript.id, savedSegments)
      asset.processingStatus = 'ready'
      asset.updatedAt = now
      return transcriptFromMemory(transcript, savedSegments)
    },
    async findCurrentTranscript(mediaAssetId, userId) {
      const asset = mediaAssetsById.get(mediaAssetId)
      if (!asset || (asset.ownerUserId !== userId && asset.processingStatus !== 'ready') || asset.deletedAt) return null
      const transcript = [...transcriptsById.values()].find(
        (item) => item.mediaAssetId === mediaAssetId && item.status === 'ready'
      )
      return transcript
        ? transcriptFromMemory(transcript, transcriptSegmentsByTranscriptId.get(transcript.id) ?? [])
        : null
    },
    async createShadowingSession({
      userId,
      mediaAssetId,
      transcriptVersionId = null,
      mode = 'sequential',
      selectedSpeakerLabel = null,
    }) {
      const asset = mediaAssetsById.get(mediaAssetId)
      if (!asset || asset.ownerUserId !== userId || asset.deletedAt) return null
      const transcript = transcriptVersionId
        ? transcriptsById.get(transcriptVersionId)
        : [...transcriptsById.values()].find((item) => item.mediaAssetId === mediaAssetId && item.status === 'ready')
      const now = new Date().toISOString()
      const session = {
        id: randomUUID(),
        userId,
        mediaAssetId,
        transcriptVersionId: transcript?.id ?? null,
        mode,
        selectedSpeakerLabel: selectedSpeakerLabel ?? null,
        status: 'active',
        currentSegmentSequence: 1,
        startedAt: now,
        completedAt: null,
      }
      shadowingSessionsById.set(session.id, session)
      return shadowingSessionFromMemory(
        session,
        asset,
        transcript ? transcriptFromMemory(transcript, transcriptSegmentsByTranscriptId.get(transcript.id) ?? []) : null
      )
    },
    async findShadowingSession(sessionId, userId) {
      const session = shadowingSessionsById.get(sessionId)
      if (!session || session.userId !== userId) return null
      const asset = mediaAssetsById.get(session.mediaAssetId)
      const transcript = session.transcriptVersionId ? transcriptsById.get(session.transcriptVersionId) : null
      return shadowingSessionFromMemory(
        session,
        asset,
        transcript ? transcriptFromMemory(transcript, transcriptSegmentsByTranscriptId.get(transcript.id) ?? []) : null
      )
    },
    async advanceShadowingSession(sessionId, userId, nextSequenceNo, isCompleted = false) {
      const session = shadowingSessionsById.get(sessionId)
      if (!session || session.userId !== userId) return null
      session.currentSegmentSequence = nextSequenceNo
      if (isCompleted) {
        session.status = 'completed'
        session.completedAt = new Date().toISOString()
      }
      const asset = mediaAssetsById.get(session.mediaAssetId)
      const transcript = session.transcriptVersionId ? transcriptsById.get(session.transcriptVersionId) : null
      return shadowingSessionFromMemory(
        session,
        asset,
        transcript ? transcriptFromMemory(transcript, transcriptSegmentsByTranscriptId.get(transcript.id) ?? []) : null
      )
    },
    async saveShadowingAttempt({
      sessionId,
      transcriptSegmentId,
      attemptNo,
      audioStorageKey = null,
      durationMs = null,
      recognizedText = null,
      alignment = [],
      evaluatorProvider = 'whisper_basic_v1',
      evaluationStatus = 'scored',
      score = null,
    }) {
      const session = shadowingSessionsById.get(sessionId)
      if (!session) return null
      const now = new Date().toISOString()
      const attemptId = randomUUID()
      const attempt = {
        id: attemptId,
        sessionId,
        transcriptSegmentId,
        attemptNo,
        audioStorageKey,
        durationMs,
        recognizedText,
        alignment,
        evaluatorProvider,
        evaluationStatus,
        createdAt: now,
      }
      shadowingAttemptsById.set(attemptId, attempt)

      let savedScore = null
      if (score) {
        savedScore = {
          shadowingAttemptId: attemptId,
          overallScore: score.overallScore ?? 0,
          contentScore: score.contentScore ?? 0,
          pronunciationScore: score.pronunciationScore ?? 0,
          timingScore: score.timingScore ?? 0,
          prosodyScore: score.prosodyScore ?? null,
          confidence: score.confidence ?? 100,
          feedback: score.feedback ?? {},
          scoringVersion: score.scoringVersion ?? 'whisper_basic_v1',
          createdAt: now,
        }
        shadowingScoresByAttemptId.set(attemptId, savedScore)
      }
      return shadowingAttemptFromMemory(attempt, savedScore)
    },
    async findShadowingAttempt(attemptId, userId) {
      const attempt = shadowingAttemptsById.get(attemptId)
      if (!attempt) return null
      const session = shadowingSessionsById.get(attempt.sessionId)
      if (!session || session.userId !== userId) return null
      const score = shadowingScoresByAttemptId.get(attemptId)
      return shadowingAttemptFromMemory(attempt, score)
    },
    async listShadowingAttemptsForSession(sessionId, userId) {
      const session = shadowingSessionsById.get(sessionId)
      if (!session || session.userId !== userId) return []
      return [...shadowingAttemptsById.values()]
        .filter((attempt) => attempt.sessionId === sessionId)
        .sort((left, right) => left.attemptNo - right.attemptNo)
        .map((attempt) => shadowingAttemptFromMemory(attempt, shadowingScoresByAttemptId.get(attempt.id)))
    },
    async createRefreshSession(tokenHash, session) {
      const stored = {
        ...session,
        id: session.id ?? randomUUID(),
        familyId: session.familyId ?? randomUUID(),
        revokedAt: null,
      }
      refreshSessions.set(tokenHash, stored)
      return stored
    },
    async findRefreshSession(tokenHash) {
      const session = refreshSessions.get(tokenHash)
      return session && !session.revokedAt && session.expiresAt > Date.now() ? session : null
    },
    async findRefreshSessionRecord(tokenHash) {
      return refreshSessions.get(tokenHash) ?? null
    },
    async deleteRefreshSession(tokenHash) {
      const session = refreshSessions.get(tokenHash)
      if (session && !session.revokedAt) session.revokedAt = new Date().toISOString()
    },
    async rotateRefreshSession(currentHash, nextHash, nextSession) {
      const current = refreshSessions.get(currentHash)
      if (!current) return { status: 'invalid' }
      if (current.revokedAt || current.expiresAt <= Date.now()) {
        for (const session of refreshSessions.values())
          if (session.familyId === current.familyId && !session.revokedAt) session.revokedAt = new Date().toISOString()
        return { status: current.revokedAt ? 'reused' : 'invalid' }
      }
      current.revokedAt = new Date().toISOString()
      const next = await this.createRefreshSession(nextHash, { ...nextSession, familyId: current.familyId })
      current.replacedBySessionId = next.id
      return { status: 'rotated', session: next }
    },
    async revokeUserSessions(userId) {
      for (const session of refreshSessions.values())
        if (session.userId === userId && !session.revokedAt) session.revokedAt = new Date().toISOString()
    },
    async createOneTimeToken({ tokenHash, userId, purpose, expiresAt }) {
      await this.invalidateOneTimeTokens(userId, purpose)
      oneTimeTokens.set(tokenHash, { userId, purpose, expiresAt })
    },
    async invalidateOneTimeTokens(userId, purpose) {
      for (const [tokenHash, token] of oneTimeTokens.entries())
        if (token.userId === userId && token.purpose === purpose) oneTimeTokens.delete(tokenHash)
    },
    async consumeOneTimeToken(tokenHash, purpose) {
      const value = oneTimeTokens.get(tokenHash)
      oneTimeTokens.delete(tokenHash)
      return value?.purpose === purpose && value.expiresAt > Date.now() ? { userId: value.userId } : null
    },
    async addAudit(entry) {
      auditLog.unshift(entry)
      auditLog.length = Math.min(auditLog.length, 500)
    },
    async listAudit(limit = 100) {
      return auditLog.slice(0, limit).map(({ metadata, ...entry }) => ({
        ...entry,
        ...(metadata ?? {}),
      }))
    },
    async consumeRateLimit(scope, subject, { limit, windowMs }) {
      const key = `${scope}:${subject}`
      const now = Date.now()
      const entries = (rateLimits.get(key) ?? []).filter((time) => now - time < windowMs)
      if (entries.length >= limit)
        return { allowed: false, retryAfter: Math.ceil((windowMs - (now - entries[0])) / 1000) }
      entries.push(now)
      rateLimits.set(key, entries)
      return { allowed: true, retryAfter: 0 }
    },
    async cleanupExpiredData() {
      const now = Date.now()
      for (const [tokenHash, token] of oneTimeTokens.entries())
        if (token.expiresAt <= now) oneTimeTokens.delete(tokenHash)
      for (const [tokenHash, session] of refreshSessions.entries())
        if (session.expiresAt <= now) refreshSessions.delete(tokenHash)
    },
  }
}

function createPostgresStore(pool) {
  return {
    mode: 'postgresql',
    async findUserById(id) {
      const result = await pool.query('select * from users where id = $1', [id])
      return userFromRow(result.rows[0])
    },
    async findUserByEmail(email) {
      const result = await pool.query('select * from users where email = $1', [email])
      return userFromRow(result.rows[0])
    },
    async createUser(user) {
      const result = await pool.query(
        `insert into users
          (id, name, email, password_hash, role, status, email_verified, created_at, last_activity_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         returning *`,
        [
          user.id,
          user.name,
          user.email,
          user.passwordHash,
          user.role,
          user.status,
          user.emailVerified,
          user.createdAt,
          user.lastActivityAt,
        ]
      )
      return userFromRow(result.rows[0])
    },
    async updateUser(id, patch) {
      const columns = {
        name: 'name',
        passwordHash: 'password_hash',
        emailVerified: 'email_verified',
        status: 'status',
        role: 'role',
        tokenVersion: 'token_version',
      }
      const entries = Object.entries(patch).filter(([key]) => columns[key])
      if (!entries.length) return this.findUserById(id)
      const values = entries.map(([, value]) => value)
      const assignments = entries.map(([key], index) => `${columns[key]} = $${index + 1}`)
      const result = await pool.query(
        `update users set ${assignments.join(', ')}, updated_at = now()
         where id = $${values.length + 1} returning *`,
        [...values, id]
      )
      return userFromRow(result.rows[0])
    },
    async touchUser(id, at) {
      await pool.query('update users set last_activity_at = $1 where id = $2', [at, id])
    },
    async incrementTokenVersion(id) {
      const result = await pool.query(
        'update users set token_version = token_version + 1, updated_at = now() where id = $1 returning *',
        [id]
      )
      return userFromRow(result.rows[0])
    },
    async activeAdminCount() {
      const result = await pool.query(
        "select count(*)::int as count from users where role = 'admin' and status = 'active'"
      )
      return result.rows[0].count
    },
    async updateUserAccess(id, patch) {
      const client = await pool.connect()
      try {
        await client.query('begin')
        await client.query(`select pg_advisory_xact_lock(hashtext('kotodama-active-admin'))`)
        const targetResult = await client.query('select * from users where id = $1 for update', [id])
        const target = userFromRow(targetResult.rows[0])
        if (!target) {
          await client.query('rollback')
          return { user: null }
        }
        const nextRole = patch.role ?? target.role
        const nextStatus = patch.status ?? target.status
        const removesLastActiveAdmin =
          target.role === 'admin' && target.status === 'active' && (nextRole !== 'admin' || nextStatus !== 'active')
        if (removesLastActiveAdmin) {
          const countResult = await client.query(
            "select count(*)::int as count from users where role = 'admin' and status = 'active'"
          )
          if (countResult.rows[0].count <= 1) {
            await client.query('rollback')
            return { conflict: 'LAST_ADMIN_PROTECTED' }
          }
        }
        const columns = { status: 'status', role: 'role' }
        const entries = Object.entries(patch).filter(([key]) => columns[key])
        const values = entries.map(([, value]) => value)
        const assignments = [
          ...entries.map(([key], index) => `${columns[key]} = $${index + 1}`),
          'token_version = token_version + 1',
        ]
        const result = await client.query(
          `update users set ${assignments.join(', ')}, updated_at = now()
           where id = $${values.length + 1} returning *`,
          [...values, id]
        )
        await client.query('commit')
        return { user: userFromRow(result.rows[0]) }
      } catch (error) {
        await client.query('rollback')
        throw error
      } finally {
        client.release()
      }
    },
    async enqueueMediaProcessingJob(mediaAssetId, jobType, { input = {}, provider = null } = {}) {
      const client = await pool.connect()
      try {
        await client.query('begin')
        const assetResult = await client.query(
          `update media_assets set processing_status = 'processing', error_code = null, error_message = null, updated_at = now()
           where id = $1 and deleted_at is null returning id`,
          [mediaAssetId]
        )
        if (!assetResult.rows[0]) {
          await client.query('rollback')
          return null
        }
        const result = await client.query(
          `insert into media_processing_jobs (id, media_asset_id, job_type, status, provider, input)
           values ($1, $2, $3, 'queued', $4, $5) returning *`,
          [randomUUID(), mediaAssetId, jobType, provider, input]
        )
        await client.query('commit')
        return mediaProcessingJobFromRow(result.rows[0])
      } catch (error) {
        await client.query('rollback')
        throw error
      } finally {
        client.release()
      }
    },
    async listUsers({ query, role, status, page, pageSize }) {
      const conditions = []
      const values = []
      if (query) {
        values.push(`%${query}%`)
        conditions.push(`lower(name || ' ' || email) like $${values.length}`)
      }
      if (role) {
        values.push(role)
        conditions.push(`role = $${values.length}`)
      }
      if (status) {
        values.push(status)
        conditions.push(`status = $${values.length}`)
      }
      const where = conditions.length ? `where ${conditions.join(' and ')}` : ''
      const totalResult = await pool.query(`select count(*)::int as count from users ${where}`, values)
      const total = totalResult.rows[0].count
      const totalPages = Math.max(1, Math.ceil(total / pageSize))
      const safePage = Math.min(page, totalPages)
      const listValues = [...values, pageSize, (safePage - 1) * pageSize]
      const result = await pool.query(
        `select * from users ${where} order by created_at desc limit $${values.length + 1} offset $${values.length + 2}`,
        listValues
      )
      return { items: result.rows.map(userFromRow), page: safePage, pageSize, total, totalPages }
    },
    async getPreferences(userId) {
      const result = await pool.query('select * from account_preferences where user_id = $1', [userId])
      return preferencesFromRow(result.rows[0])
    },
    async updatePreferences(userId, patch) {
      await pool.query('insert into account_preferences (user_id) values ($1) on conflict (user_id) do nothing', [
        userId,
      ])
      const columns = {
        dailyWords: 'daily_words',
        reviewLimit: 'review_limit',
        autoPronounce: 'auto_pronounce',
        furigana: 'furigana',
        romaji: 'romaji',
        pitchAccent: 'pitch_accent',
        reminders: 'reminders',
        streakReminders: 'streak_reminders',
        publicProfile: 'public_profile',
        analytics: 'analytics_enabled',
        accent: 'accent',
        background: 'background',
      }
      const entries = Object.entries(patch).filter(([key]) => columns[key])
      if (!entries.length) return this.getPreferences(userId)
      const values = entries.map(([, value]) => (value === 'unlimited' ? null : value))
      const assignments = entries.map(([key], index) => `${columns[key]} = $${index + 1}`)
      const result = await pool.query(
        `update account_preferences set ${assignments.join(', ')}, updated_at = now()
         where user_id = $${values.length + 1} returning *`,
        [...values, userId]
      )
      return preferencesFromRow(result.rows[0])
    },
    async getLearningPlan(userId) {
      const result = await pool.query('select * from learning_plans where user_id = $1', [userId])
      return learningPlanFromRow(result.rows[0])
    },
    async saveLearningPlan(userId, plan) {
      const result = await pool.query(
        `insert into learning_plans (user_id, language, level, daily_words, daily_minutes, reason, started_at)
         values ($1, $2, $3, $4, $5, $6, $7)
         on conflict (user_id) do update set
           language = excluded.language,
           level = excluded.level,
           daily_words = excluded.daily_words,
           daily_minutes = excluded.daily_minutes,
           reason = excluded.reason,
           updated_at = now()
         returning *`,
        [
          userId,
          plan.language,
          plan.level,
          plan.dailyWords,
          plan.dailyMinutes,
          plan.reason,
          plan.startedAt ?? new Date().toISOString(),
        ]
      )
      return learningPlanFromRow(result.rows[0])
    },
    async createMediaAsset(asset) {
      const result = await pool.query(
        `insert into media_assets
          (id, owner_user_id, source_type, title, language, rights_basis, source_reference, original_filename, processing_status)
         values ($1, $2, $3, $4, $5, $6, $7, $8, 'draft')
         returning *`,
        [
          asset.id,
          asset.ownerUserId,
          asset.sourceType,
          asset.title,
          asset.language,
          asset.rightsBasis,
          asset.sourceReference,
          asset.originalFilename,
        ]
      )
      return mediaAssetFromRow(result.rows[0])
    },
    async listMediaAssets(userId, limit) {
      const result = await pool.query(
        `select * from media_assets
         where (owner_user_id = $1 or processing_status = 'ready') and deleted_at is null
         order by created_at desc limit $2`,
        [userId, limit]
      )
      return result.rows.map(mediaAssetFromRow)
    },
    async findMediaAssetForUser(id, userId) {
      const result = await pool.query(
        `select * from media_assets
         where id = $1 and (owner_user_id = $2 or processing_status = 'ready') and deleted_at is null`,
        [id, userId]
      )
      return result.rows[0] ? mediaAssetFromRow(result.rows[0]) : null
    },
    async markMediaAssetUploading(id, userId) {
      const result = await pool.query(
        `update media_assets set processing_status = 'uploading', error_code = null, error_message = null, updated_at = now()
         where id = $1 and owner_user_id = $2 and deleted_at is null and processing_status in ('draft', 'failed')
         returning *`,
        [id, userId]
      )
      return result.rows[0] ? { asset: mediaAssetFromRow(result.rows[0]) } : null
    },
    async completeMediaAssetUpload(id, userId, upload) {
      const client = await pool.connect()
      try {
        await client.query('begin')
        const assetResult = await client.query(
          `update media_assets set
             storage_key = $1, mime_type = $2, byte_size = $3,
             processing_status = 'queued', error_code = null, error_message = null, updated_at = now()
           where id = $4 and owner_user_id = $5 and processing_status = 'uploading' and deleted_at is null
           returning *`,
          [upload.storageKey, upload.mimeType, upload.byteSize, id, userId]
        )
        if (!assetResult.rows[0]) {
          await client.query('rollback')
          return null
        }
        const jobId = randomUUID()
        const jobResult = await client.query(
          `insert into media_processing_jobs (id, media_asset_id, job_type, status, input)
           values ($1, $2, 'upload_verify', 'queued', $3)
           returning *`,
          [jobId, id, { storageKey: upload.storageKey }]
        )
        await client.query('commit')
        return { asset: mediaAssetFromRow(assetResult.rows[0]), job: mediaProcessingJobFromRow(jobResult.rows[0]) }
      } catch (error) {
        await client.query('rollback')
        throw error
      } finally {
        client.release()
      }
    },
    async completeDownloadedMediaAsset(id, upload, title) {
      const client = await pool.connect()
      try {
        await client.query('begin')
        const assetResult = await client.query(
          `update media_assets set
             storage_key = $1, mime_type = $2, byte_size = $3, title = $4,
             processing_status = 'queued', error_code = null, error_message = null, updated_at = now()
           where id = $5 and deleted_at is null returning *`,
          [upload.storageKey, upload.mimeType, upload.byteSize, title, id]
        )
        if (!assetResult.rows[0]) {
          await client.query('rollback')
          return null
        }
        const jobResult = await client.query(
          `insert into media_processing_jobs (id, media_asset_id, job_type, status, input)
           values ($1, $2, 'upload_verify', 'queued', $3) returning *`,
          [randomUUID(), id, { storageKey: upload.storageKey, importedFrom: 'youtube' }]
        )
        await client.query('commit')
        return { asset: mediaAssetFromRow(assetResult.rows[0]), job: mediaProcessingJobFromRow(jobResult.rows[0]) }
      } catch (error) {
        await client.query('rollback')
        throw error
      } finally {
        client.release()
      }
    },
    async failMediaAssetUpload(id, userId, errorCode, errorMessage) {
      const result = await pool.query(
        `update media_assets set processing_status = 'failed', error_code = $1, error_message = $2, updated_at = now()
         where id = $3 and owner_user_id = $4 and deleted_at is null
         returning *`,
        [errorCode, errorMessage, id, userId]
      )
      return mediaAssetFromRow(result.rows[0])
    },
    async listMediaProcessingJobsForAsset(assetId, userId) {
      const result = await pool.query(
        `select jobs.* from media_processing_jobs jobs
         join media_assets assets on assets.id = jobs.media_asset_id
         where jobs.media_asset_id = $1 and (assets.owner_user_id = $2 or assets.processing_status = 'ready') and assets.deleted_at is null
         order by jobs.created_at desc`,
        [assetId, userId]
      )
      return result.rows.map(mediaProcessingJobFromRow)
    },
    async retryFailedMediaProcessingJob(assetId, userId) {
      const client = await pool.connect()
      try {
        await client.query('begin')
        const assetResult = await client.query(
          `select * from media_assets where id = $1 and owner_user_id = $2 and deleted_at is null for update`,
          [assetId, userId]
        )
        const asset = assetResult.rows[0]
        if (!asset) {
          await client.query('rollback')
          return null
        }
        const jobResult = await client.query(
          `select * from media_processing_jobs
           where media_asset_id = $1 and status = 'failed'
           order by updated_at desc for update limit 1`,
          [assetId]
        )
        const job = jobResult.rows[0]
        if (!job) {
          await client.query('rollback')
          return null
        }
        const retriedJob = await client.query(
          `update media_processing_jobs set
             status = 'queued', error_code = null, error_message = null, started_at = null, finished_at = null, updated_at = now()
           where id = $1 returning *`,
          [job.id]
        )
        const retriedAsset = await client.query(
          `update media_assets set processing_status = 'queued', error_code = null, error_message = null, updated_at = now()
           where id = $1 returning *`,
          [assetId]
        )
        await client.query('commit')
        return { asset: mediaAssetFromRow(retriedAsset.rows[0]), job: mediaProcessingJobFromRow(retriedJob.rows[0]) }
      } catch (error) {
        await client.query('rollback')
        throw error
      } finally {
        client.release()
      }
    },
    async claimNextMediaProcessingJob() {
      const client = await pool.connect()
      try {
        await client.query('begin')
        const nextResult = await client.query(
          `select * from media_processing_jobs
           where status = 'queued'
           order by created_at asc
           for update skip locked limit 1`
        )
        const next = nextResult.rows[0]
        if (!next) {
          await client.query('commit')
          return null
        }
        const claimed = await client.query(
          `update media_processing_jobs set
             status = 'running', attempt_count = attempt_count + 1, started_at = now(), updated_at = now()
           where id = $1 returning *`,
          [next.id]
        )
        await client.query('commit')
        return mediaProcessingJobFromRow(claimed.rows[0])
      } catch (error) {
        await client.query('rollback')
        throw error
      } finally {
        client.release()
      }
    },
    async findMediaAssetForProcessing(id) {
      const result = await pool.query('select * from media_assets where id = $1 and deleted_at is null', [id])
      return mediaAssetForProcessing(result.rows[0])
    },
    async completeMediaProcessingJob(id, output) {
      const result = await pool.query(
        `update media_processing_jobs set status = 'succeeded', output = $1, finished_at = now(), updated_at = now()
         where id = $2 and status = 'running' returning *`,
        [output, id]
      )
      return mediaProcessingJobFromRow(result.rows[0])
    },
    async failMediaProcessingJob(id, errorCode, errorMessage) {
      const client = await pool.connect()
      try {
        await client.query('begin')
        const jobResult = await client.query(
          `update media_processing_jobs set
             status = 'failed', error_code = $1, error_message = $2, finished_at = now(), updated_at = now()
           where id = $3 and status in ('queued', 'running') returning *`,
          [errorCode, errorMessage, id]
        )
        const job = jobResult.rows[0]
        if (!job) {
          await client.query('rollback')
          return null
        }
        await client.query(
          `update media_assets set processing_status = 'failed', error_code = $1, error_message = $2, updated_at = now()
           where id = $3`,
          [errorCode, errorMessage, job.media_asset_id]
        )
        await client.query('commit')
        return mediaProcessingJobFromRow(job)
      } catch (error) {
        await client.query('rollback')
        throw error
      } finally {
        client.release()
      }
    },
    async saveMachineTranscript({ mediaAssetId, provider, segments }) {
      const client = await pool.connect()
      try {
        await client.query('begin')
        const asset = await client.query(
          'select id from media_assets where id = $1 and deleted_at is null for update',
          [mediaAssetId]
        )
        if (!asset.rows[0]) {
          await client.query('rollback')
          return null
        }
        const versionResult = await client.query(
          'select coalesce(max(version), 0) as version from transcript_versions where media_asset_id = $1',
          [mediaAssetId]
        )
        await client.query(
          `update transcript_versions set status = 'superseded', updated_at = now()
           where media_asset_id = $1 and status = 'ready'`,
          [mediaAssetId]
        )
        const transcriptResult = await client.query(
          `insert into transcript_versions (id, media_asset_id, version, language, source, provider, status)
           values ($1, $2, $3, 'ja', 'machine', $4, 'ready') returning *`,
          [randomUUID(), mediaAssetId, Number(versionResult.rows[0].version) + 1, provider]
        )
        const transcript = transcriptResult.rows[0]
        const savedSegments = []
        for (const [index, segment] of segments.entries()) {
          const result = await client.query(
            `insert into transcript_segments
              (id, transcript_version_id, sequence_no, speaker_label, speaker_confidence, start_ms, end_ms, text_ja, text_furigana, text_vi, confidence)
             values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) returning *`,
            [
              randomUUID(),
              transcript.id,
              index + 1,
              segment.speakerLabel,
              segment.speakerConfidence,
              segment.startMs,
              segment.endMs,
              segment.textJa,
              segment.textFurigana ?? null,
              segment.textVi ?? null,
              segment.confidence,
            ]
          )
          const savedSegment = transcriptSegmentFromRow(result.rows[0])
          const tokens = normalizedSegmentTokens(segment.tokens, savedSegment)
          for (const token of tokens) {
            await client.query(
              `insert into segment_tokens
                (id, transcript_segment_id, sequence_no, surface, reading, lemma, part_of_speech, start_ms, end_ms)
               values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
              [
                token.id,
                savedSegment.id,
                token.sequenceNo,
                token.surface,
                token.reading,
                token.lemma,
                token.partOfSpeech,
                token.startMs,
                token.endMs,
              ]
            )
          }
          savedSegments.push({ ...savedSegment, tokens })
        }
        await client.query(
          `update media_assets set processing_status = 'ready', error_code = null, error_message = null, updated_at = now()
           where id = $1`,
          [mediaAssetId]
        )
        await client.query('commit')
        return transcriptFromRow(transcript, savedSegments)
      } catch (error) {
        await client.query('rollback')
        throw error
      } finally {
        client.release()
      }
    },
    async findCurrentTranscript(mediaAssetId, userId) {
      const transcriptResult = await pool.query(
        `select versions.* from transcript_versions versions
          join media_assets assets on assets.id = versions.media_asset_id
          where versions.media_asset_id = $1 and versions.status = 'ready'
            and (assets.owner_user_id = $2 or assets.processing_status = 'ready') and assets.deleted_at is null
          order by versions.version desc limit 1`,
        [mediaAssetId, userId]
      )
      const transcript = transcriptResult.rows[0]
      if (!transcript) return null
      const segments = await pool.query(
        'select * from transcript_segments where transcript_version_id = $1 order by sequence_no asc',
        [transcript.id]
      )
      const tokens = segments.rows.length
        ? await pool.query(
            `select * from segment_tokens where transcript_segment_id = any($1::uuid[])
             order by transcript_segment_id asc, sequence_no asc`,
            [segments.rows.map((segment) => segment.id)]
          )
        : { rows: [] }
      return transcriptFromRow(transcript, attachTokensToSegments(segments.rows, tokens.rows))
    },
    async createShadowingSession({
      userId,
      mediaAssetId,
      transcriptVersionId = null,
      mode = 'sequential',
      selectedSpeakerLabel = null,
    }) {
      let resolvedTranscriptId = transcriptVersionId
      if (!resolvedTranscriptId) {
        const transcriptRes = await pool.query(
          `select id from transcript_versions where media_asset_id = $1 and status = 'ready' order by version desc limit 1`,
          [mediaAssetId]
        )
        resolvedTranscriptId = transcriptRes.rows[0]?.id ?? null
      }
      const id = randomUUID()
      const result = await pool.query(
        `insert into shadowing_sessions
          (id, user_id, media_asset_id, transcript_version_id, mode, selected_speaker_label, status, current_segment_sequence)
         values ($1, $2, $3, $4, $5, $6, 'active', 1)
         returning *`,
        [id, userId, mediaAssetId, resolvedTranscriptId, mode, selectedSpeakerLabel]
      )
      return shadowingSessionFromRow(result.rows[0])
    },
    async findShadowingSession(sessionId, userId) {
      const result = await pool.query(`select * from shadowing_sessions where id = $1 and user_id = $2`, [
        sessionId,
        userId,
      ])
      return shadowingSessionFromRow(result.rows[0])
    },
    async advanceShadowingSession(sessionId, userId, nextSequenceNo, isCompleted = false) {
      const statusClause = isCompleted ? `, status = 'completed', completed_at = now()` : ''
      const result = await pool.query(
        `update shadowing_sessions
         set current_segment_sequence = $3 ${statusClause}
         where id = $1 and user_id = $2
         returning *`,
        [sessionId, userId, nextSequenceNo]
      )
      return shadowingSessionFromRow(result.rows[0])
    },
    async saveShadowingAttempt({
      sessionId,
      transcriptSegmentId,
      attemptNo,
      audioStorageKey = null,
      durationMs = null,
      recognizedText = null,
      alignment = [],
      evaluatorProvider = 'whisper_basic_v1',
      evaluationStatus = 'scored',
      score = null,
    }) {
      const client = await pool.connect()
      try {
        // Validate segment ID BEFORE starting transaction (to avoid aborting the txn on check failure)
        let validSegmentId = transcriptSegmentId ?? null
        if (validSegmentId) {
          try {
            const segCheck = await client.query('select id from transcript_segments where id = $1', [validSegmentId])
            if (!segCheck.rows[0]) validSegmentId = null
          } catch {
            validSegmentId = null
          }
        }
        await client.query('begin')
        const attemptId = randomUUID()
        const attemptResult = await client.query(
          `insert into shadowing_attempts
            (id, session_id, transcript_segment_id, attempt_no, audio_storage_key, duration_ms, recognized_text, alignment, evaluator_provider, evaluation_status)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           returning *`,
          [
            attemptId,
            sessionId,
            validSegmentId,
            attemptNo,
            audioStorageKey,
            durationMs,
            recognizedText,
            JSON.stringify(alignment),
            evaluatorProvider,
            evaluationStatus,
          ]
        )
        let savedScoreRow = null
        if (score) {
          const scoreResult = await client.query(
            `insert into shadowing_scores
              (shadowing_attempt_id, overall_score, content_score, pronunciation_score, timing_score, prosody_score, confidence, feedback, scoring_version)
             values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             returning *`,
            [
              attemptId,
              score.overallScore ?? 0,
              score.contentScore ?? 0,
              score.pronunciationScore ?? 0,
              score.timingScore ?? 0,
              score.prosodyScore ?? null,
              score.confidence ?? 100,
              JSON.stringify(score.feedback ?? {}),
              score.scoringVersion ?? 'whisper_basic_v1',
            ]
          )
          savedScoreRow = scoreResult.rows[0]
        }
        await client.query('commit')
        return shadowingAttemptFromRow(
          attemptResult.rows[0],
          savedScoreRow ? shadowingScoreFromRow(savedScoreRow) : null
        )
      } catch (error) {
        await client.query('rollback')
        throw error
      } finally {
        client.release()
      }
    },
    async findShadowingAttempt(attemptId, userId) {
      const result = await pool.query(
        `select attempts.*,
                scores.overall_score, scores.content_score, scores.pronunciation_score,
                scores.timing_score, scores.prosody_score, scores.confidence,
                scores.feedback, scores.scoring_version, scores.created_at as score_created_at
         from shadowing_attempts attempts
         join shadowing_sessions sessions on sessions.id = attempts.session_id
         left join shadowing_scores scores on scores.shadowing_attempt_id = attempts.id
         where attempts.id = $1 and sessions.user_id = $2`,
        [attemptId, userId]
      )
      const row = result.rows[0]
      if (!row) return null
      const score = row.overall_score !== null ? shadowingScoreFromRow(row) : null
      return shadowingAttemptFromRow(row, score)
    },
    async listShadowingAttemptsForSession(sessionId, userId) {
      const result = await pool.query(
        `select attempts.*,
                scores.overall_score, scores.content_score, scores.pronunciation_score,
                scores.timing_score, scores.prosody_score, scores.confidence,
                scores.feedback, scores.scoring_version, scores.created_at as score_created_at
         from shadowing_attempts attempts
         join shadowing_sessions sessions on sessions.id = attempts.session_id
         left join shadowing_scores scores on scores.shadowing_attempt_id = attempts.id
         where attempts.session_id = $1 and sessions.user_id = $2
         order by attempts.attempt_no asc`,
        [sessionId, userId]
      )
      return result.rows.map((row) => {
        const score = row.overall_score !== null ? shadowingScoreFromRow(row) : null
        return shadowingAttemptFromRow(row, score)
      })
    },
    async createRefreshSession(tokenHash, session) {
      const id = session.id ?? randomUUID()
      const familyId = session.familyId ?? randomUUID()
      await pool.query(
        `insert into refresh_sessions
          (id, user_id, token_hash, csrf_hash, family_id, expires_at, ip_address, user_agent)
         values ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          id,
          session.userId,
          tokenHash,
          session.csrfHash,
          familyId,
          new Date(session.expiresAt),
          normalizedIp(session.ip),
          session.userAgent?.slice(0, 500) || null,
        ]
      )
      return { ...session, id, familyId }
    },
    async findRefreshSession(tokenHash) {
      const result = await pool.query(
        `select * from refresh_sessions
         where token_hash = $1 and revoked_at is null and expires_at > now()`,
        [tokenHash]
      )
      return sessionFromRow(result.rows[0])
    },
    async findRefreshSessionRecord(tokenHash) {
      const result = await pool.query('select * from refresh_sessions where token_hash = $1', [tokenHash])
      return sessionFromRow(result.rows[0])
    },
    async deleteRefreshSession(tokenHash) {
      await pool.query('update refresh_sessions set revoked_at = now() where token_hash = $1 and revoked_at is null', [
        tokenHash,
      ])
    },
    async rotateRefreshSession(currentHash, nextHash, nextSession) {
      const client = await pool.connect()
      try {
        await client.query('begin')
        const currentResult = await client.query(
          `select id, user_id, family_id, revoked_at, expires_at
           from refresh_sessions where token_hash = $1 for update`,
          [currentHash]
        )
        const current = currentResult.rows[0]
        if (!current) {
          await client.query('rollback')
          return { status: 'invalid' }
        }
        if (current.revoked_at || new Date(current.expires_at).getTime() <= Date.now()) {
          if (current.revoked_at)
            await client.query(
              'update refresh_sessions set revoked_at = now() where family_id = $1 and revoked_at is null',
              [current.family_id]
            )
          await client.query('commit')
          return { status: current.revoked_at ? 'reused' : 'invalid' }
        }
        const nextId = nextSession.id ?? randomUUID()
        await client.query(
          'update refresh_sessions set revoked_at = now(), replaced_by_session_id = $2 where id = $1',
          [current.id, nextId]
        )
        await client.query(
          `insert into refresh_sessions
            (id, user_id, token_hash, csrf_hash, family_id, expires_at, ip_address, user_agent)
           values ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            nextId,
            current.user_id,
            nextHash,
            nextSession.csrfHash,
            current.family_id,
            new Date(nextSession.expiresAt),
            normalizedIp(nextSession.ip),
            nextSession.userAgent?.slice(0, 500) || null,
          ]
        )
        await client.query('commit')
        return { status: 'rotated', session: { ...nextSession, id: nextId, familyId: current.family_id } }
      } catch (error) {
        await client.query('rollback')
        throw error
      } finally {
        client.release()
      }
    },
    async revokeUserSessions(userId) {
      await pool.query('update refresh_sessions set revoked_at = now() where user_id = $1 and revoked_at is null', [
        userId,
      ])
    },
    async createOneTimeToken({ tokenHash, userId, purpose, expiresAt }) {
      const client = await pool.connect()
      try {
        await client.query('begin')
        await client.query(
          'update one_time_tokens set consumed_at = now() where user_id = $1 and purpose = $2 and consumed_at is null',
          [userId, purpose]
        )
        await client.query(
          `insert into one_time_tokens (id, user_id, token_hash, purpose, expires_at)
           values ($1, $2, $3, $4, $5)`,
          [randomUUID(), userId, tokenHash, purpose, new Date(expiresAt)]
        )
        await client.query('commit')
      } catch (error) {
        await client.query('rollback')
        throw error
      } finally {
        client.release()
      }
    },
    async invalidateOneTimeTokens(userId, purpose) {
      await pool.query(
        'update one_time_tokens set consumed_at = now() where user_id = $1 and purpose = $2 and consumed_at is null',
        [userId, purpose]
      )
    },
    async consumeOneTimeToken(tokenHash, purpose) {
      const result = await pool.query(
        `update one_time_tokens set consumed_at = now()
         where token_hash = $1 and purpose = $2 and consumed_at is null and expires_at > now()
         returning user_id`,
        [tokenHash, purpose]
      )
      return result.rows[0] ? { userId: result.rows[0].user_id } : null
    },
    async addAudit(entry) {
      await pool.query(
        `insert into audit_logs
          (id, actor_user_id, action, target_user_id, ip_address, metadata, created_at)
         values ($1, $2, $3, $4, $5, $6, $7)`,
        [
          entry.id,
          entry.userId,
          entry.action,
          entry.targetUserId ?? null,
          normalizedIp(entry.ip),
          entry.metadata ?? {},
          entry.at,
        ]
      )
    },
    async listAudit(limit = 100) {
      const result = await pool.query(
        `select id, actor_user_id, action, target_user_id, metadata, created_at
         from audit_logs order by created_at desc limit $1`,
        [limit]
      )
      return result.rows.map((row) => ({
        id: row.id,
        action: row.action,
        userId: row.actor_user_id,
        targetUserId: row.target_user_id,
        at: iso(row.created_at),
        ...(row.metadata ?? {}),
      }))
    },
    async consumeRateLimit(scope, subject, { limit, windowMs }) {
      const windowStartedAt = new Date(Math.floor(Date.now() / windowMs) * windowMs)
      const result = await pool.query(
        `insert into rate_limit_windows (scope, subject, window_started_at, request_count)
         values ($1, $2, $3, 1)
         on conflict (scope, subject, window_started_at) do update
           set request_count = rate_limit_windows.request_count + 1, updated_at = now()
           where rate_limit_windows.request_count < $4
         returning request_count`,
        [scope, subject.slice(0, 255), windowStartedAt, limit]
      )
      const retryAfter = Math.max(1, Math.ceil((windowStartedAt.getTime() + windowMs - Date.now()) / 1000))
      return { allowed: Boolean(result.rows[0]), retryAfter }
    },
    async cleanupExpiredData() {
      await pool.query(
        `delete from one_time_tokens
         where expires_at < now() - interval '7 days'
            or (consumed_at is not null and consumed_at < now() - interval '7 days')`
      )
      await pool.query(
        `delete from refresh_sessions
         where expires_at < now() - interval '30 days'
            or (revoked_at is not null and revoked_at < now() - interval '30 days')`
      )
      await pool.query(`delete from rate_limit_windows where window_started_at < now() - interval '2 days'`)
    },
  }
}

export function createAuthStore(pool) {
  return pool ? createPostgresStore(pool) : createMemoryStore()
}
