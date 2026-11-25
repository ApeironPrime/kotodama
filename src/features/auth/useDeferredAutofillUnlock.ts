import { useCallback, useState } from 'react'

export function useDeferredAutofillUnlock() {
  const [unlocked, setUnlocked] = useState(false)
  const unlock = useCallback(() => {
    setUnlocked((prev) => (prev ? prev : true))
  }, [])

  return {
    readOnly: !unlocked,
    onPointerDown: unlock,
    onFocus: unlock,
    onKeyDown: unlock,
    onInput: unlock,
  }
}
