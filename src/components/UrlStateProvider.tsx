import { useRef, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { UrlStateContext } from '../lib/urlStateContext'
export function UrlStateProvider({ children }: { children: ReactNode }) {
  const [params] = useSearchParams()
  const pending = useRef(params)
  pending.current = params
  return <UrlStateContext.Provider value={pending}>{children}</UrlStateContext.Provider>
}
