import { useCallback, useContext, useRef, type SetStateAction } from 'react'
import { useSearchParams } from 'react-router-dom'
import { UrlStateContext } from './urlStateContext'

/** Preserve navigation state across reloads, shared links and browser Back. */
export function useUrlState<T extends string | null>(key: string, fallback: T, allowed?: readonly string[]) {
  const [params, setParams] = useSearchParams()
  const localPending = useRef(params)
  localPending.current = params
  const shared = useContext(UrlStateContext)
  const pending = shared ?? localPending
  const raw = params.get(key)
  const value = (raw !== null && (!allowed || allowed.includes(raw)) ? raw : fallback) as T
  const setValue = useCallback(
    (next: SetStateAction<T>) => {
      const current = (pending.current.get(key) ?? fallback) as T
      const resolved = typeof next === 'function' ? next(current) : next
      if (resolved === current) return
      const updated = new URLSearchParams(pending.current)
      if (resolved === null || resolved === fallback) updated.delete(key)
      else updated.set(key, resolved)
      pending.current = updated
      setParams(updated)
    },
    [fallback, key, setParams, pending]
  )
  return [value, setValue] as const
}
