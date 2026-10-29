import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

class MemoryStorage implements Storage {
  private store = new Map<string, string>()

  get length() {
    return this.store.size
  }

  clear(): void {
    this.store.clear()
  }

  getItem(key: string): string | null {
    return this.store.get(key) ?? null
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null
  }

  removeItem(key: string): void {
    this.store.delete(key)
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value))
  }
}

if (typeof window !== 'undefined') {
  if (typeof window.localStorage?.setItem !== 'function') {
    const local = new MemoryStorage()
    Object.defineProperty(window, 'localStorage', { value: local, writable: true, configurable: true })
    Object.defineProperty(globalThis, 'localStorage', { value: local, writable: true, configurable: true })
  }
  if (typeof window.sessionStorage?.setItem !== 'function') {
    const session = new MemoryStorage()
    Object.defineProperty(window, 'sessionStorage', { value: session, writable: true, configurable: true })
    Object.defineProperty(globalThis, 'sessionStorage', { value: session, writable: true, configurable: true })
  }
  Object.defineProperty(window, 'scrollTo', { value: vi.fn(), writable: true, configurable: true })
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  if (typeof window === 'undefined') return
  window.localStorage?.clear?.()
  window.sessionStorage?.clear?.()
})
