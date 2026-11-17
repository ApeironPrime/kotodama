// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { Modal } from '../components/ui'
import { UrlStateProvider } from '../components/UrlStateProvider'
import { useUrlState } from './useUrlState'
import { sanitizeHtml } from './sanitizeHtml'
import { applyTheme } from './theme'
import { usePersistentState } from './usePersistentState'

describe('audit regression safeguards', () => {
  it('preserves Japanese ruby while removing active content and inline styling', () => {
    const html = sanitizeHtml(
      '<ruby onclick="alert(1)">学校<rt>がっこう</rt></ruby><img src=x onerror=alert(1)><script>alert(1)</script><span style="position:fixed">意味</span>'
    )
    expect(html).toContain('<ruby>学校<rt>がっこう</rt></ruby>')
    expect(html).not.toMatch(/onclick|onerror|script|img|style=/)
  })
  it('applies persisted themes before visiting Settings and rejects invalid presets', () => {
    document.head.innerHTML = '<meta name="theme-color" content="#000">'
    applyTheme('blue', 'midnight')
    expect(document.documentElement.dataset['backgroundTone']).toBe('dark')
    expect(document.documentElement.style.colorScheme).toBe('dark')
    applyTheme('invalid', 'invalid')
    expect(document.documentElement.dataset['background']).toBe('ivory')
    expect(document.documentElement.style.getPropertyValue('--color-bg-canvas')).toBe('#fffdf8')
    expect(document.querySelector('meta')?.content).toBe('#fffdf8')
  })
  it('shares persisted preferences between mounted readers and survives remount', () => {
    function Reader({ name }: { name: string }) {
      const [value, setValue] = usePersistentState('test.preference', false)
      return (
        <button onClick={() => setValue((previous) => !previous)}>
          {name}:{String(value)}
        </button>
      )
    }
    const first = render(
      <>
        <Reader name="one" />
        <Reader name="two" />
      </>
    )
    fireEvent.click(screen.getByRole('button', { name: 'one:false' }))
    expect(screen.getByText('two:true')).toBeTruthy()
    first.unmount()
    render(<Reader name="three" />)
    expect(screen.getByText('three:true')).toBeTruthy()
  })
  it('preserves multiple URL updates in one navigation event', () => {
    function Journey() {
      const [, setTab] = useUrlState<string>('tab', 'vocab')
      const [, setQuery] = useUrlState<string>('q', '')
      const location = useLocation()
      return (
        <>
          <button
            onClick={() => {
              setTab('kanji')
              setQuery('学校')
            }}
          >
            Search
          </button>
          <output>{location.search}</output>
        </>
      )
    }
    render(
      <MemoryRouter>
        <UrlStateProvider>
          <Journey />
        </UrlStateProvider>
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText('Search'))
    expect(new URLSearchParams(screen.getByRole('status').textContent ?? '').get('tab')).toBe('kanji')
    expect(new URLSearchParams(screen.getByRole('status').textContent ?? '').get('q')).toBe('学校')
  })
  it('traps Tab, handles Escape and restores the triggering control', async () => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => window.setTimeout(() => callback(0), 0))
    vi.stubGlobal('cancelAnimationFrame', clearTimeout)
    function Journey() {
      const [open, setOpen] = useState(false)
      return (
        <>
          <button onClick={() => setOpen(true)}>Open</button>
          {open && (
            <Modal title="Test" onClose={() => setOpen(false)}>
              <button>Last</button>
            </Modal>
          )}
        </>
      )
    }
    render(<Journey />)
    const trigger = screen.getByText('Open')
    trigger.focus()
    fireEvent.click(trigger)
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Đóng' })))
    screen.getByText('Last').focus()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Tab' })
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Đóng' }))
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(trigger)
    expect(document.body.style.overflow).toBe('')
  })
})
