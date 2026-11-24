/**
 * Procedural Web Audio Engine for Kotodama Study Sanctuary.
 * Synthesizes subtle tactile paper, karuta, wood stamp, and soft miss cues
 * using pure Web Audio API (zero external audio files, ~16% max volume).
 */

const SOUND_FX_STORAGE_KEY = 'kotodama.vocab.sound-fx'
const MASTER_VOLUME = 0.16
const listeners = new Set<() => void>()

let sharedCtx: AudioContext | null = null
let cachedEnabled: boolean | null = null

function readStoredPreference(): boolean {
  if (cachedEnabled !== null) return cachedEnabled
  if (typeof window === 'undefined') return true
  try {
    const raw = window.localStorage.getItem(SOUND_FX_STORAGE_KEY)
    if (raw === null) {
      cachedEnabled = true
      return true
    }
    cachedEnabled = raw !== 'false'
    return cachedEnabled
  } catch {
    cachedEnabled = true
    return true
  }
}

export function isSoundEnabled(): boolean {
  return readStoredPreference()
}

export function setSoundEnabled(enabled: boolean): void {
  cachedEnabled = enabled
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(SOUND_FX_STORAGE_KEY, enabled ? 'true' : 'false')
    } catch {
      // ignore storage quota / sandbox restrictions
    }
  }
  listeners.forEach((listener) => listener())
}

export function toggleSoundEnabled(): boolean {
  const next = !isSoundEnabled()
  setSoundEnabled(next)
  return next
}

export function subscribeSoundEnabled(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined' || !isSoundEnabled()) return null
  if (!sharedCtx) {
    const AudioCtx =
      window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return null
    sharedCtx = new AudioCtx()
  }
  if (sharedCtx.state === 'suspended') {
    void sharedCtx.resume().catch(() => undefined)
  }
  return sharedCtx
}

function createNoiseBuffer(ctx: AudioContext, durationSec: number): AudioBuffer {
  const sampleRate = ctx.sampleRate
  const length = Math.max(1, Math.floor(sampleRate * durationSec))
  const buffer = ctx.createBuffer(1, length, sampleRate)
  const data = buffer.getChannelData(0)
  let last = 0
  for (let i = 0; i < length; i += 1) {
    const white = Math.random() * 2 - 1
    last = (last + 0.08 * white) / 1.08
    data[i] = last * 2.4
  }
  return buffer
}

/**
 * 1. Soft Washi paper turn (~80ms bandpass-filtered noise).
 */
export function playPaperFlip(): void {
  const ctx = getAudioContext()
  if (!ctx) return
  try {
    const now = ctx.currentTime
    const source = ctx.createBufferSource()
    source.buffer = createNoiseBuffer(ctx, 0.085)

    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(1350, now)
    filter.Q.setValueAtTime(1.4, now)

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.linearRampToValueAtTime(MASTER_VOLUME * 0.72, now + 0.015)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.082)

    source.connect(filter)
    filter.connect(gain)
    gain.connect(ctx.destination)

    source.onended = () => {
      source.disconnect()
      filter.disconnect()
      gain.disconnect()
    }
    source.start(now)
    source.stop(now + 0.085)
  } catch {
    // ignore Web Audio failure
  }
}

/**
 * 2. Crisp tatami karuta card slap (~60ms).
 */
export function playKarutaSlap(): void {
  const ctx = getAudioContext()
  if (!ctx) return
  try {
    const now = ctx.currentTime

    // Short woody contact transient
    const noise = ctx.createBufferSource()
    noise.buffer = createNoiseBuffer(ctx, 0.024)
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.setValueAtTime(950, now)
    bp.Q.setValueAtTime(1.2, now)
    const nGain = ctx.createGain()
    nGain.gain.setValueAtTime(MASTER_VOLUME * 0.9, now)
    nGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.022)
    noise.connect(bp)
    bp.connect(nGain)
    nGain.connect(ctx.destination)
    noise.onended = () => {
      noise.disconnect()
      bp.disconnect()
      nGain.disconnect()
    }
    noise.start(now)
    noise.stop(now + 0.024)

    // Tatami body thud
    const osc = ctx.createOscillator()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(195, now)
    osc.frequency.exponentialRampToValueAtTime(68, now + 0.058)
    const oGain = ctx.createGain()
    oGain.gain.setValueAtTime(MASTER_VOLUME * 0.85, now)
    oGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06)
    osc.connect(oGain)
    oGain.connect(ctx.destination)
    osc.onended = () => {
      osc.disconnect()
      oGain.disconnect()
    }
    osc.start(now)
    osc.stop(now + 0.062)
  } catch {
    // ignore Web Audio failure
  }
}

/**
 * 3. Warm wooden Hanko / hyōshigi success resonance (~115ms).
 */
export function playStampSuccess(): void {
  const ctx = getAudioContext()
  if (!ctx) return
  try {
    const now = ctx.currentTime

    const osc = ctx.createOscillator()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(320, now)
    osc.frequency.exponentialRampToValueAtTime(240, now + 0.11)

    const overtone = ctx.createOscillator()
    overtone.type = 'sine'
    overtone.frequency.setValueAtTime(640, now)
    overtone.frequency.exponentialRampToValueAtTime(480, now + 0.075)

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.linearRampToValueAtTime(MASTER_VOLUME * 0.78, now + 0.008)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.115)

    const overtoneGain = ctx.createGain()
    overtoneGain.gain.setValueAtTime(0.0001, now)
    overtoneGain.gain.linearRampToValueAtTime(MASTER_VOLUME * 0.25, now + 0.006)
    overtoneGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.075)

    osc.connect(gain)
    overtone.connect(overtoneGain)
    gain.connect(ctx.destination)
    overtoneGain.connect(ctx.destination)

    osc.onended = () => {
      osc.disconnect()
      gain.disconnect()
    }
    overtone.onended = () => {
      overtone.disconnect()
      overtoneGain.disconnect()
    }

    osc.start(now)
    overtone.start(now)
    osc.stop(now + 0.118)
    overtone.stop(now + 0.08)
  } catch {
    // ignore Web Audio failure
  }
}

/**
 * 4. Calm low muted pulse for missed answers (~95ms, gentle gain).
 */
export function playSoftMiss(): void {
  const ctx = getAudioContext()
  if (!ctx) return
  try {
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(145, now)
    osc.frequency.exponentialRampToValueAtTime(112, now + 0.095)

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.linearRampToValueAtTime(0.1, now + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.095)

    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.onended = () => {
      osc.disconnect()
      gain.disconnect()
    }
    osc.start(now)
    osc.stop(now + 0.1)
  } catch {
    // ignore Web Audio failure
  }
}
