import { createContext, type MutableRefObject } from 'react'
export const UrlStateContext = createContext<MutableRefObject<URLSearchParams> | null>(null)
