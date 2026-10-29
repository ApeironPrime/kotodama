import { useCallback, useEffect, useRef, useState } from 'react'

export function useInkSound() {
  const [enabled, setEnabled] = useState(false)
  const contextRef = useRef<AudioContext | null>(null)
  const lastPlayedRef = useRef(0)

  const toggle = useCallback(() => {
    if (enabled) {
      if (contextRef.current) void contextRef.current.suspend()
      setEnabled(false)
      return
    }
    if (typeof window.AudioContext === 'undefined') return
    contextRef.current ??= new window.AudioContext()
    void contextRef.current.resume()
    setEnabled(true)
  }, [enabled])

  const play = useCallback(() => {
    const context = contextRef.current
    if (!enabled || !context || context.state !== 'running') return
    if (context.currentTime - lastPlayedRef.current < 0.14) return
    lastPlayedRef.current = context.currentTime

    const duration = 0.16
    const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate)
    const channel = buffer.getChannelData(0)
    for (let index = 0; index < channel.length; index += 1) {
      const fade = 1 - index / channel.length
      channel[index] = (Math.random() * 2 - 1) * fade
    }
    const source = context.createBufferSource()
    source.buffer = buffer
    const filter = context.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 720
    filter.Q.value = 0.55
    const gain = context.createGain()
    gain.gain.setValueAtTime(0.001, context.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.018, context.currentTime + 0.018)
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration)
    source.connect(filter).connect(gain).connect(context.destination)
    source.start()
    source.stop(context.currentTime + duration)
  }, [enabled])

  useEffect(
    () => () => {
      if (contextRef.current) void contextRef.current.close()
    },
    []
  )

  return { enabled, toggle, play }
}
