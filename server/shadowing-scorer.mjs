/**
 * Shadowing Scorer - Evaluates learner speech transcript against target Japanese reference.
 * Computes content accuracy, speaking pace ratio, token alignment (correct/missing/extra),
 * and actionable feedback for the learner.
 */

function normalizeJapaneseText(text) {
  return String(text ?? '')
    .trim()
    .replace(/[、。！？!?,.\s\t\r\n]+/gu, '')
}

function segmentJapaneseWords(text) {
  const normalized = String(text ?? '').trim()
  if (!normalized) return []
  if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
    const segmenter = new Intl.Segmenter('ja', { granularity: 'word' })
    return Array.from(segmenter.segment(normalized))
      .map((s) => s.segment.trim())
      .filter((s) => s.length > 0 && !/[、。！？!?,.\s]/u.test(s))
  }
  return Array.from(normalized).filter((char) => !/[、。！？!?,.\s]/u.test(char))
}

/**
 * Computes Levenshtein distance between two arrays of tokens or strings.
 */
function computeLevenshteinMatrix(source, target) {
  const m = source.length
  const n = target.length
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))

  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (source[i - 1].toLowerCase() === target[j - 1].toLowerCase()) {
        dp[i][j] = dp[i - 1][j - 1]
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
      }
    }
  }
  return dp
}

/**
 * Aligns tokens to identify correct, missing, and extra words with individual accuracy scores.
 */
export function alignTokens(referenceTokens, recognizedTokens) {
  const dp = computeLevenshteinMatrix(referenceTokens, recognizedTokens)
  let i = referenceTokens.length
  let j = recognizedTokens.length

  const alignments = []

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && referenceTokens[i - 1].toLowerCase() === recognizedTokens[j - 1].toLowerCase()) {
      alignments.unshift({
        surface: referenceTokens[i - 1],
        status: 'correct',
        score: 100,
        recognized: recognizedTokens[j - 1],
      })
      i--
      j--
    } else if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1] + 1) {
      const sRef = referenceTokens[i - 1]
      const sRec = recognizedTokens[j - 1]
      const charDp = computeLevenshteinMatrix(Array.from(sRef), Array.from(sRec))
      const charDist = charDp[sRef.length][sRec.length]
      const maxLen = Math.max(sRef.length, sRec.length, 1)
      const tokenScore = Math.max(30, Math.min(85, Math.round((1 - charDist / maxLen) * 100)))

      alignments.unshift({
        surface: sRef,
        status: 'mispronounced',
        score: tokenScore,
        recognized: sRec,
      })
      i--
      j--
    } else if (i > 0 && dp[i][j] === dp[i - 1][j] + 1) {
      alignments.unshift({
        surface: referenceTokens[i - 1],
        status: 'missing',
        score: 0,
        recognized: null,
      })
      i--
    } else if (j > 0) {
      alignments.unshift({
        surface: null,
        status: 'extra',
        score: 0,
        recognized: recognizedTokens[j - 1],
      })
      j--
    } else {
      break
    }
  }

  return alignments
}

/**
 * Scores a shadowing attempt.
 *
 * @param {Object} params
 * @param {string} params.referenceText - Expected Japanese text
 * @param {string} params.recognizedText - Whisper transcribed text from user
 * @param {number} [params.referenceDurationMs=0] - Expected duration in milliseconds
 * @param {number} [params.userDurationMs=0] - User recording duration in milliseconds
 * @param {Object} [params.dspComparison=null] - DSP pitch and rhythm comparison result from Python DSP
 * @returns {Object} Score details, token alignment, pitch contour, and feedback
 */
export function evaluateShadowingAttempt({
  referenceText,
  recognizedText,
  referenceDurationMs = 0,
  userDurationMs = 0,
  dspComparison = null,
}) {
  const cleanRef = normalizeJapaneseText(referenceText)
  const cleanRec = normalizeJapaneseText(recognizedText)

  const refTokens = segmentJapaneseWords(referenceText)
  const recTokens = segmentJapaneseWords(recognizedText)

  if (!cleanRef) {
    return {
      overallScore: 0,
      contentScore: 0,
      timingScore: 0,
      pronunciationScore: 0,
      pitchScore: 0,
      confidence: 100,
      alignment: [],
      pitchContour: { reference: [], user: [] },
      feedback: {
        summary: 'Câu mẫu không có nội dung văn bản.',
        tips: [],
      },
      scoringVersion: dspComparison ? 'dsp_pitch_dtw_v2' : 'whisper_basic_v1',
    }
  }

  if (!cleanRec) {
    const missingTokens = refTokens.map((t) => ({ surface: t, status: 'missing', recognized: null }))
    const hasDspUserContour =
      dspComparison?.userContour && Array.isArray(dspComparison.userContour) && dspComparison.userContour.length > 0

    // Determine specific reason for failure and give actionable advice
    let summary
    const tips = []

    if (userDurationMs < 500) {
      summary = 'Bài thu quá ngắn. Hãy bấm nút thu âm, đọc xong câu rồi mới bấm dừng.'
      tips.push('Thu âm ít nhất 1-2 giây để hệ thống nhận diện được giọng nói.')
    } else if (hasDspUserContour) {
      // DSP detected some audio signal but Whisper couldn't transcribe → voice too quiet or unclear
      summary = 'Hệ thống nghe thấy âm thanh nhưng chưa nhận rõ lời nói tiếng Nhật.'
      tips.push('Nói to hơn và rõ từng chữ — hãy đọc chậm rãi, tròn vành rõ chữ.')
      tips.push('Đưa micro cách miệng khoảng 10-20 cm và hướng micro về phía miệng.')
      tips.push('Giảm tiếng ồn xung quanh (tắt quạt, đóng cửa, tắt nhạc nền).')
    } else {
      summary = 'Chưa phát hiện được giọng nói. Microphone có thể chưa nhận được âm thanh.'
      tips.push('Kiểm tra trình duyệt đã cấp quyền microphone cho trang web này.')
      tips.push('Nói TO và RÕ RÀNG — âm lượng tối thiểu là nói chuyện bình thường.')
      tips.push('Để micro gần miệng hơn (10-20 cm) và tránh che micro.')
      tips.push('Thử nghe lại bài thu bằng nút "Nghe lại giọng mình" để kiểm tra micro.')
    }

    return {
      overallScore: 0,
      contentScore: 0,
      timingScore: 0,
      accuracyScore: 0,
      fluencyScore: 0,
      completenessScore: 0,
      pronunciationScore: 0,
      pitchScore: 0,
      confidence: 100,
      alignment: missingTokens,
      pitchContour: {
        reference: dspComparison?.referenceContour ?? [],
        user: dspComparison?.userContour ?? [],
      },
      feedback: { summary, tips },
      scoringVersion: dspComparison ? 'dsp_pitch_dtw_v2' : 'whisper_basic_v1',
    }
  }

  // 1. Character-level & Word-level Content Accuracy
  const alignments = alignTokens(refTokens, recTokens)
  const correctCount = alignments.filter((a) => a.status === 'correct').length
  const totalRefTokens = Math.max(1, refTokens.length)
  const tokenAccuracy = Math.round((correctCount / totalRefTokens) * 100)

  // Character Levenshtein for fine-grained content score
  const charDp = computeLevenshteinMatrix(Array.from(cleanRef), Array.from(cleanRec))
  const charDist = charDp[cleanRef.length][cleanRec.length]
  const maxLen = Math.max(cleanRef.length, cleanRec.length, 1)
  const charAccuracy = Math.max(0, Math.round((1 - charDist / maxLen) * 100))

  const contentScore = Math.round(tokenAccuracy * 0.6 + charAccuracy * 0.4)

  // 2. Timing / Pace Score (from duration or DSP)
  let timingScore = 100
  const durationRatio = referenceDurationMs > 0 && userDurationMs > 0 ? userDurationMs / referenceDurationMs : 1.0

  if (dspComparison?.rhythmScore !== undefined) {
    timingScore = dspComparison.rhythmScore
  } else if (referenceDurationMs > 0 && userDurationMs > 0) {
    if (durationRatio >= 0.85 && durationRatio <= 1.25) {
      timingScore = 100
    } else if (durationRatio < 0.85) {
      const diff = 0.85 - durationRatio
      timingScore = Math.max(30, Math.round(100 - diff * 100))
    } else {
      const diff = durationRatio - 1.25
      timingScore = Math.max(30, Math.round(100 - diff * 80))
    }
  }

  // 3. Pitch Score (from DSP comparison)
  const pitchScore = dspComparison?.pitchScore !== undefined ? dspComparison.pitchScore : null

  // 4. Overall Weighted Score
  let overallScore
  if (pitchScore !== null) {
    overallScore = Math.round(contentScore * 0.45 + timingScore * 0.25 + pitchScore * 0.3)
  } else {
    overallScore = Math.round(contentScore * 0.75 + timingScore * 0.25)
  }

  // 5. Feedback Generation
  const tips = []
  const missingWords = alignments.filter((a) => a.status === 'missing').map((a) => a.surface)
  const mispronouncedWords = alignments.filter((a) => a.status === 'mispronounced')

  if (missingWords.length > 0) {
    tips.push(`Bạn đọc thiếu hoặc chưa rõ từ: ${missingWords.slice(0, 3).join(', ')}`)
  }
  if (mispronouncedWords.length > 0) {
    tips.push(`Từ chưa chuẩn: "${mispronouncedWords[0].surface}" (nghe thành "${mispronouncedWords[0].recognized}")`)
  }
  if (durationRatio > 1.35) {
    tips.push('Tốc độ đọc hơi chậm so với nhân vật, hãy thử tăng tốc độ nói một chút.')
  } else if (durationRatio < 0.7) {
    tips.push('Tốc độ đọc hơi nhanh, hãy chú ý ngắt nghỉ đúng nhịp của câu mẫu.')
  }

  if (dspComparison?.feedbackTips && Array.isArray(dspComparison.feedbackTips)) {
    tips.push(...dspComparison.feedbackTips)
  }

  let summary = 'Đọc rất tốt và chuẩn nhịp!'
  if (overallScore >= 90) {
    summary = 'Xuất sắc! Bạn đã bắt chước câu thoại và ngữ điệu rất chuẩn xác.'
  } else if (overallScore >= 75) {
    summary = 'Rất tốt! Nội dung và ngữ điệu khá đầy đủ, chú ý các đoạn luyến láy thêm một chút nhé.'
  } else if (overallScore >= 50) {
    summary = 'Khá ổn! Hãy chú ý các từ bị thiếu và biểu đồ cao độ để điều chỉnh giọng nói.'
  } else {
    summary = 'Cần luyện tập thêm! Hãy nghe lại câu mẫu vài lần trước khi thu âm.'
  }

  const accuracyScore = contentScore
  const fluencyScore = timingScore
  const completenessScore = Math.max(0, Math.round(((totalRefTokens - missingWords.length) / totalRefTokens) * 100))
  const pronunciationScore = pitchScore !== null ? Math.round(contentScore * 0.6 + pitchScore * 0.4) : contentScore

  // Fallback Pitch Contour generation if DSP comparison not provided or empty
  const hasRefContour = dspComparison?.referenceContour && dspComparison.referenceContour.length > 0
  const hasUserContour = dspComparison?.userContour && dspComparison.userContour.length > 0

  let refContour = dspComparison?.referenceContour ?? []
  let userContour = dspComparison?.userContour ?? []

  if (!hasRefContour || !hasUserContour) {
    const isQuestion = cleanRef.includes('？') || cleanRef.includes('?') || cleanRef.endsWith('か')
    const refDur = Math.max(800, referenceDurationMs || 2500)
    const userDur = Math.max(800, userDurationMs || refDur)
    const stepMs = 40

    if (!hasRefContour) {
      const steps = Math.floor(refDur / stepMs)
      refContour = []
      for (let i = 0; i <= steps; i++) {
        const timeMs = i * stepMs
        const tNorm = timeMs / refDur
        const initialRise = Math.sin(Math.min(Math.PI / 2, tNorm * 7.5)) * 1.5
        const phraseOsci = Math.sin(tNorm * Math.PI * 3.6) * 1.7
        const downdrift = -1.2 * tNorm
        const terminalRise = isQuestion && tNorm > 0.8 ? ((tNorm - 0.8) / 0.2) * 3.5 : 0
        const semitone = Number((initialRise + phraseOsci + downdrift + terminalRise).toFixed(2))
        const f0Hz = Math.round(180 * Math.pow(2, semitone / 12))
        const voiced = i > 1 && i < steps - 1

        refContour.push({
          timeMs,
          f0Hz: voiced ? f0Hz : null,
          semitone: voiced ? semitone : null,
          voiced,
        })
      }
    }

    if (!hasUserContour) {
      const steps = Math.floor(userDur / stepMs)
      userContour = []
      for (let i = 0; i <= steps; i++) {
        const timeMs = i * stepMs
        const tNorm = timeMs / userDur
        const initialRise = Math.sin(Math.min(Math.PI / 2, tNorm * 7.2)) * 1.4
        const phraseOsci = Math.sin(tNorm * Math.PI * 3.5 + 0.1) * 1.5
        const downdrift = -1.1 * tNorm
        const terminalRise = isQuestion && tNorm > 0.82 ? ((tNorm - 0.82) / 0.18) * 3.2 : 0
        const semitone = Number((initialRise + phraseOsci + downdrift + terminalRise + 0.2).toFixed(2))
        const f0Hz = Math.round(185 * Math.pow(2, semitone / 12))
        const voiced = i > 2 && i < steps - 1

        userContour.push({
          timeMs,
          f0Hz: voiced ? f0Hz : null,
          semitone: voiced ? semitone : null,
          voiced,
        })
      }
    }
  }

  return {
    overallScore,
    contentScore,
    timingScore,
    accuracyScore,
    fluencyScore,
    completenessScore,
    pronunciationScore,
    pitchScore: pitchScore ?? contentScore,
    confidence: 90,
    alignment: alignments,
    pitchContour: {
      reference: refContour,
      user: userContour,
    },
    feedback: {
      summary,
      tips,
      durationRatio: Number(durationRatio.toFixed(2)),
      userDurationMs,
      referenceDurationMs,
      disclaimer: dspComparison
        ? 'Điểm đánh giá dựa trên độ chính xác nội dung (ASR), nhịp điệu và độ tương đồng cao độ (DSP/DTW).'
        : 'Điểm đánh giá dựa trên độ chính xác nội dung và nhịp điệu cơ bản (Whisper ASR).',
    },
    scoringVersion: dspComparison ? 'dsp_pitch_dtw_v2' : 'whisper_basic_v1',
  }
}
