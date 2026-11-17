import { useEffect, useRef, type RefObject } from 'react'

const focusable =
  'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
const dialogs: HTMLElement[] = []
let originalOverflow = ''

/** Only the topmost dialog owns Escape and Tab. Restore focus when it closes. */
export function useDialogAccessibility(ref: RefObject<HTMLElement | null>, onClose: () => void, open = true) {
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    const panel = ref.current
    if (!open || !panel) return
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    if (dialogs.length === 0) originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialogs.push(panel)
    const candidates = () =>
      Array.from(panel.querySelectorAll<HTMLElement>(focusable)).filter(
        (el) =>
          !el.hidden &&
          el.getAttribute('aria-hidden') !== 'true' &&
          getComputedStyle(el).display !== 'none' &&
          !el.closest('[inert]')
      )
    const frame = window.setTimeout(() => (candidates()[0] ?? panel).focus())
    const handleKey = (event: KeyboardEvent) => {
      if (dialogs.at(-1) !== panel) return
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        closeRef.current()
      }
      if (event.key !== 'Tab') return
      const elements = candidates()
      const first = elements[0] ?? panel
      const last = elements.at(-1) ?? panel
      if (
        !panel.contains(document.activeElement) ||
        (event.shiftKey && document.activeElement === first) ||
        (!event.shiftKey && document.activeElement === last) ||
        elements.length === 0
      ) {
        event.preventDefault()
        ;(event.shiftKey ? last : first).focus()
      }
    }
    document.addEventListener('keydown', handleKey, true)
    return () => {
      window.clearTimeout(frame)
      document.removeEventListener('keydown', handleKey, true)
      const index = dialogs.indexOf(panel)
      if (index >= 0) dialogs.splice(index, 1)
      if (dialogs.length === 0) document.body.style.overflow = originalOverflow
      if (previous?.isConnected) previous.focus()
    }
  }, [ref, open])
}
