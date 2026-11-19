import { useUiSound } from '../lib/useUiSound'
import { sumiAudio } from '../features/dictionary/sumiAudio'
export function useInkSound() {
  const sound = useUiSound()
  return { ...sound, play: () => sumiAudio.playBrushFriction() }
}
