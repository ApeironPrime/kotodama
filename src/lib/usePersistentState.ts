import { useCallback, useEffect, useRef, useState, type SetStateAction } from 'react'

const volatileValues = new Map<string, unknown>()

/** Browser preferences synchronize across components and tabs, with an in-memory fallback. */
export function usePersistentState<T>(key: string, initialValue: T) {
  const fallback = useRef(initialValue)
  const read = useCallback(() => {
    if (volatileValues.has(key)) return volatileValues.get(key) as T
    try {
      const storedValue = window.localStorage.getItem(key)
      return storedValue === null ? fallback.current : (JSON.parse(storedValue) as T)
    } catch {
      return fallback.current
    }
  }, [key])
  const [value, setValue] = useState<T>(read)

  useEffect(() => {
    setValue(read())
    const sync = () => setValue(read())
    window.addEventListener('storage', sync)
    window.addEventListener('kotodama:preference', sync)
    return () => {
      window.removeEventListener('storage', sync)
      window.removeEventListener('kotodama:preference', sync)
    }
  }, [read])

  const update = useCallback(
    (next: SetStateAction<T>) => {
      const current = read()
      const resolved = typeof next === 'function' ? (next as (previous: T) => T)(current) : next
      try {
        window.localStorage.setItem(key, JSON.stringify(resolved))
        volatileValues.delete(key)
      } catch {
        volatileValues.set(key, resolved)
      }
      setValue(resolved)
      window.dispatchEvent(new Event('kotodama:preference'))
    },
    [key, read]
  )

  return [value, update] as const
}
