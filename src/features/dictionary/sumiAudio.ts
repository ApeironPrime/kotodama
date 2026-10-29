/**
 * Generative Web Audio Engine for Kotodama Sumi-e Interactive Art Experience
 * Pure acoustic synthesis via native Web Audio API (Zero external MP3s/assets).
 * 
 * Three micro-feedback sounds:
 * 1. Fude Brush Whispers (Tiếng sột soạt cọ lông cọ xát trên giấy dó)
 * 2. Suikinkutsu Water Resonance (Tiếng giọt nước ngân vang trong lu đá thủy cầm quật)
 * 3. Kaze Wind Swoosh (Làn gió mỏng xao động khi đổi cấp độ / xóa nét)
 */

class SumiAudioEngine {
  private ctx: AudioContext | null = null
  private muted: boolean = false
  private isInitialized: boolean = false
  private brushBuffer: AudioBuffer | null = null
  private windBuffer: AudioBuffer | null = null
  private lastBrushTime: number = 0

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (AudioCtx) {
        this.ctx = new AudioCtx()
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume()
    }
    return this.ctx
  }

  public initOnGesture(): void {
    if (this.isInitialized) return
    const ctx = this.getContext()
    if (ctx) {
      this.isInitialized = true
    }
  }

  public isMuted(): boolean {
    return this.muted
  }

  public toggleMute(): boolean {
    this.muted = !this.muted
    return this.muted
  }

  /**
   * 1. Fude Brush Whispers on Washi (Tiếng bút lông thư pháp sột soạt lướt trên giấy dó/xuyến chỉ):
   * Acoustic pink-brown noise synthesized with natural fiber friction resonance.
   * Dual-stage filtering: lowpass body filter (~2200Hz) + fibrous resonant bandpass (~1150Hz, Q=1.3)
   * with organic stroke envelope (~260ms) and micro-friction modulation.
   */
  public playBrushFriction(): void {
    if (this.muted) return
    const nowMs = performance.now()
    if (nowMs - this.lastBrushTime < 80) return // Throttle rapid calls
    this.lastBrushTime = nowMs

    const ctx = this.getContext()
    if (!ctx) return

    try {
      const duration = 0.26 + (Math.random() * 0.05 - 0.025) // 235ms - 285ms natural variance
      const sampleRate = ctx.sampleRate
      const bufferSize = Math.floor(sampleRate * 0.32)

      // Generate or reuse high-quality pink noise buffer (Paul Kellet filter)
      if (!this.brushBuffer || this.brushBuffer.sampleRate !== sampleRate) {
        this.brushBuffer = ctx.createBuffer(1, bufferSize, sampleRate)
        const data = this.brushBuffer.getChannelData(0)
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1
          b0 = 0.99886 * b0 + white * 0.0555179
          b1 = 0.99332 * b1 + white * 0.0750759
          b2 = 0.96900 * b2 + white * 0.1538520
          b3 = 0.86650 * b3 + white * 0.3104856
          b4 = 0.55000 * b4 + white * 0.5329522
          b5 = -0.76160 * b5 - white * 0.0168980
          const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362
          b6 = white * 0.115926
          // Grain envelope: subtle natural amplitude fluctuation simulating paper fiber texture
          const grain = 1.0 + 0.12 * Math.sin((i / sampleRate) * 2 * Math.PI * 18)
          data[i] = pink * 0.13 * grain
        }
      }

      const noiseSource = ctx.createBufferSource()
      noiseSource.buffer = this.brushBuffer

      // Stage 1: Warm lowpass filter to remove harsh digital sizzle
      const lpFilter = ctx.createBiquadFilter()
      lpFilter.type = 'lowpass'
      lpFilter.frequency.setValueAtTime(2100 + Math.random() * 300, ctx.currentTime)
      lpFilter.Q.setValueAtTime(0.7, ctx.currentTime)

      // Stage 2: Fibrous paper friction formant (mulberry/xuan paper acoustic resonance)
      const bpFilter = ctx.createBiquadFilter()
      bpFilter.type = 'bandpass'
      bpFilter.frequency.setValueAtTime(1150 + Math.random() * 180, ctx.currentTime)
      bpFilter.Q.setValueAtTime(1.3, ctx.currentTime)

      // Stage 3: Dynamic gain envelope (Khởi bút -> Hành bút -> Thu bút)
      const gain = ctx.createGain()
      const now = ctx.currentTime
      gain.gain.setValueAtTime(0.0001, now)
      // Khởi bút: contact with paper (soft attack ~22ms)
      gain.gain.linearRampToValueAtTime(0.085, now + 0.022)
      // Hành bút: sustain body of stroke
      gain.gain.linearRampToValueAtTime(0.065, now + duration * 0.7)
      // Thu bút: lifting brush off paper
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)

      noiseSource.connect(lpFilter)
      lpFilter.connect(bpFilter)
      bpFilter.connect(gain)
      gain.connect(ctx.destination)

      noiseSource.start(now)
      noiseSource.stop(now + duration)
    } catch {
      // Audio autoplay policy fallback
    }
  }

  /**
   * 2. Suikinkutsu Water Resonance (水琴窟):
   * Dual sine tone with resonant harmonic decay simulating a clear droplet
   * dropping into an underground Japanese garden water stone urn.
   */
  public playSuikinkutsu(): void {
    if (this.muted) return
    const ctx = this.getContext()
    if (!ctx) return

    try {
      const now = ctx.currentTime
      const baseFreq = 660 + Math.random() * 40 // Slight natural variance

      // Primary drop chime
      const osc1 = ctx.createOscillator()
      osc1.type = 'sine'
      osc1.frequency.setValueAtTime(baseFreq, now)
      osc1.frequency.exponentialRampToValueAtTime(baseFreq * 0.96, now + 0.45)

      // Soft harmonic overtone
      const osc2 = ctx.createOscillator()
      osc2.type = 'sine'
      osc2.frequency.setValueAtTime(baseFreq * 2.01, now)

      const filter = ctx.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.setValueAtTime(baseFreq, now)
      filter.Q.setValueAtTime(6.0, now)

      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0.001, now)
      gain.gain.linearRampToValueAtTime(0.08, now + 0.008)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.55)

      osc1.connect(filter)
      osc2.connect(filter)
      filter.connect(gain)
      gain.connect(ctx.destination)

      osc1.start(now)
      osc2.start(now)
      osc1.stop(now + 0.55)
      osc2.stop(now + 0.55)
    } catch {
      // Audio policy fallback
    }
  }

  /**
   * 3. Kaze Wind Swoosh (風):
   * Low-pass swept noise simulating a tranquil mountain wind moving paper and kanji.
   */
  public playWindSwoosh(): void {
    if (this.muted) return
    const ctx = this.getContext()
    if (!ctx) return

    try {
      const duration = 0.35
      if (!this.windBuffer || this.windBuffer.sampleRate !== ctx.sampleRate) {
        const sampleRate = ctx.sampleRate
        const bufferSize = Math.floor(sampleRate * duration)
        this.windBuffer = ctx.createBuffer(1, bufferSize, sampleRate)
        const data = this.windBuffer.getChannelData(0)
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1
        }
      }

      const noiseSource = ctx.createBufferSource()
      noiseSource.buffer = this.windBuffer

      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      const now = ctx.currentTime
      filter.frequency.setValueAtTime(250, now)
      filter.frequency.linearRampToValueAtTime(800, now + 0.15)
      filter.frequency.linearRampToValueAtTime(200, now + duration)

      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0.001, now)
      gain.gain.linearRampToValueAtTime(0.03, now + 0.12)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)

      noiseSource.connect(filter)
      filter.connect(gain)
      gain.connect(ctx.destination)

      noiseSource.start(now)
    } catch {
      // Audio policy fallback
    }
  }

  /**
   * 4. Hanko Seal Impact Clack (落款印の打捺音):
   * Pure acoustic synthesis of a heavy stone/wooden Hanko seal striking
   * fibrous washi paper against a firm calligraphy table.
   * Dual transient: high-frequency surface strike + deep wooden resonance.
   */
  public playHankoStamp(): void {
    if (this.muted) return
    const ctx = this.getContext()
    if (!ctx) return

    try {
      const now = ctx.currentTime

      // 1. Low Resonant Wooden Body Thud
      const osc = ctx.createOscillator()
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(145, now)
      osc.frequency.exponentialRampToValueAtTime(42, now + 0.18)

      const bodyGain = ctx.createGain()
      bodyGain.gain.setValueAtTime(0.001, now)
      bodyGain.gain.linearRampToValueAtTime(0.24, now + 0.005)
      bodyGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22)

      osc.connect(bodyGain)
      bodyGain.connect(ctx.destination)

      osc.start(now)
      osc.stop(now + 0.22)

      // 2. High-Frequency Surface Impact Crack (Noise burst)
      const duration = 0.04
      const bufferSize = Math.floor(ctx.sampleRate * duration)
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
      const output = noiseBuffer.getChannelData(0)
      for (let i = 0; i < bufferSize; i++) {
        output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.25))
      }

      const noiseSource = ctx.createBufferSource()
      noiseSource.buffer = noiseBuffer

      const filter = ctx.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.setValueAtTime(1850, now)
      filter.Q.setValueAtTime(2.8, now)

      const noiseGain = ctx.createGain()
      noiseGain.gain.setValueAtTime(0.18, now)
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + duration)

      noiseSource.connect(filter)
      filter.connect(noiseGain)
      noiseGain.connect(ctx.destination)

      noiseSource.start(now)
    } catch {
      // Audio policy fallback
    }
  }
}

export const sumiAudio = new SumiAudioEngine()
