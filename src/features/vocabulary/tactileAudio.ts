/**
 * Tactile Audio Synthesizer (和紙・木版 音響合成)
 * Pure Web Audio API synthesis for organic Japanese tactile interactions:
 * - Gentle Washi paper rustle on hover
 * - Subtle wooden bamboo clack on shelf drawer / navigation
 * Zero external audio assets, zero network requests, ultra-lightweight.
 */

let audioCtx: AudioContext | null = null
let soundEnabled = true

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (AudioContextClass) {
      try {
        audioCtx = new AudioContextClass()
      } catch {
        audioCtx = null
      }
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {})
  }
  return audioCtx
}

export function setTactileAudioEnabled(enabled: boolean) {
  soundEnabled = enabled
}

export function isTactileAudioEnabled(): boolean {
  return soundEnabled
}

/**
 * Subtle Washi paper flutter / brush sound on book hover
 */
export function playWashiPaperSound() {
  if (!soundEnabled) return
  const ctx = getAudioContext()
  if (!ctx) return

  try {
    const bufferSize = ctx.sampleRate * 0.06 // 60ms
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.5
    }

    const noise = ctx.createBufferSource()
    noise.buffer = buffer

    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 1800
    filter.Q.value = 1.2

    const gain = ctx.createGain()
    const now = ctx.currentTime
    gain.gain.setValueAtTime(0.015, now)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.055)

    noise.connect(filter)
    filter.connect(gain)
    gain.connect(ctx.destination)

    noise.start(now)
    noise.stop(now + 0.06)
  } catch {
    // Fail silently if browser audio is blocked
  }
}

/**
 * Subtle wooden book pull / slide resonance on shelf navigation
 */
export function playWoodShelfSound() {
  if (!soundEnabled) return
  const ctx = getAudioContext()
  if (!ctx) return

  try {
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(180, now)
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.04)

    gain.gain.setValueAtTime(0.025, now)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(now)
    osc.stop(now + 0.045)
  } catch {
    // Fail silently
  }
}
