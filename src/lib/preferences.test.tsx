// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useUiSound } from './useUiSound'
import { getUiSoundEnabled, setUiSoundEnabled } from './uiSound'
import { sumiAudio } from '../features/dictionary/sumiAudio'
import { isTactileAudioEnabled, playWashiPaperSound, setTactileAudioEnabled } from '../features/vocabulary/tactileAudio'
import { applyTheme } from './theme'
import { SettingsPage } from '../pages/AccountPages'

function SoundControl({ label }: { label: string }) {
  const sound = useUiSound()
  return (
    <button aria-pressed={sound.enabled} onClick={sound.toggle}>
      {label}
    </button>
  )
}

describe('shared interface preferences', () => {
  it('labels working learning controls and disables features that are not implemented', () => {
    render(<SettingsPage onLogout={() => {}} />)
    expect(screen.getByRole('combobox', { name: 'Giới hạn ôn tập mỗi ngày' })).toBeTruthy()
    for (const name of [
      'Cao độ (pitch accent)',
      'Nhắc học tập',
      'Duy trì chuỗi ngày',
      'Hồ sơ công khai',
      'Dữ liệu cải thiện sản phẩm',
    ]) {
      expect(screen.getByRole('switch', { name }).hasAttribute('disabled')).toBe(true)
    }
  })
  it('keeps all interface sound engines silent until the learner enables them', () => {
    const context = vi.fn()
    vi.stubGlobal('AudioContext', context)
    expect(getUiSoundEnabled()).toBe(false)
    sumiAudio.initOnGesture()
    sumiAudio.playBrushFriction()
    sumiAudio.playSuikinkutsu()
    playWashiPaperSound()
    expect(context).not.toHaveBeenCalled()
  })

  it('synchronizes sound controls and engines and persists the choice', () => {
    render(
      <>
        <SoundControl label="Trang chủ" />
        <SoundControl label="Cài đặt" />
      </>
    )
    fireEvent.click(screen.getByRole('button', { name: 'Trang chủ' }))
    expect(screen.getByRole('button', { name: 'Cài đặt' }).getAttribute('aria-pressed')).toBe('true')
    expect(sumiAudio.isMuted()).toBe(false)
    expect(isTactileAudioEnabled()).toBe(true)
    expect(localStorage.getItem('kotodama.settings.ui-sound')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'Cài đặt' }))
    expect(sumiAudio.isMuted()).toBe(true)
    setTactileAudioEnabled(false)
    expect(getUiSoundEnabled()).toBe(false)
  })

  it('keeps session sound controls usable when browser storage rejects writes', () => {
    const failure = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    setUiSoundEnabled(true)
    expect(getUiSoundEnabled()).toBe(true)
    failure.mockRestore()
    setUiSoundEnabled(false)
  })

  it('sets the same explicit theme contract for all stylesheet consumers', () => {
    applyTheme('rose', 'midnight')
    expect(document.documentElement.dataset['theme']).toBe('dark')
    expect(document.documentElement.dataset['backgroundTone']).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    applyTheme('rose', 'forest')
    expect(document.documentElement.dataset['theme']).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(document.documentElement.style.colorScheme).toBe('light')
    applyTheme('rose', 'ivory')
  })
})
