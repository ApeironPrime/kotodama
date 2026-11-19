import { useSyncExternalStore } from 'react'
import { getUiSoundEnabled, setUiSoundEnabled, subscribeUiSound } from './uiSound'
export function useUiSound() {
  const enabled = useSyncExternalStore(subscribeUiSound, getUiSoundEnabled, () => false)
  return { enabled, setEnabled: setUiSoundEnabled, toggle: () => setUiSoundEnabled(!getUiSoundEnabled()) }
}
