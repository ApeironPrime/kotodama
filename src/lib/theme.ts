export type Accent = 'rose' | 'blue' | 'violet' | 'orange' | 'emerald' | 'white'
export type Background = 'midnight' | 'ocean' | 'sakura' | 'forest' | 'ivory' | 'sky'
export type AccountPreferences = {
  dailyWords: number
  reviewLimit: number | 'unlimited'
  autoPronounce: boolean
  furigana: boolean
  romaji: boolean
  pitchAccent: boolean
  reminders: boolean
  streakReminders: boolean
  publicProfile: boolean
  analytics: boolean
  accent: Accent
  background: Background
}

export const accents: Record<Accent, { label: string; base: string; hover: string; subtle: string }> = {
  rose: { label: 'Chu sa', base: '#b82e2e', hover: '#982424', subtle: 'rgb(184 46 46 / 12%)' },
  blue: { label: 'Xanh dương', base: '#245cc4', hover: '#174794', subtle: 'rgb(77 139 255 / 15%)' },
  violet: { label: 'Tím', base: '#8139c6', hover: '#6629a3', subtle: 'rgb(168 85 247 / 15%)' },
  orange: { label: 'Cam', base: '#b5480a', hover: '#913906', subtle: 'rgb(249 115 22 / 15%)' },
  emerald: { label: 'Ngọc lục', base: '#087b58', hover: '#056044', subtle: 'rgb(16 185 129 / 15%)' },
  white: { label: 'Trắng', base: '#f4f3ed', hover: '#fffdf5', subtle: 'rgb(244 243 237 / 15%)' },
}
export const backgrounds: Record<
  Background,
  {
    label: string
    swatch: string
    canvas: string
    subtle: string
    surface: string
    elevated: string
    hover: string
    tone: 'dark' | 'light'
  }
> = {
  midnight: {
    label: 'Đen Sumi',
    swatch: '#09090f',
    canvas: '#09090f',
    subtle: '#0d0d15',
    surface: '#111119',
    elevated: '#171722',
    hover: '#1e1e2c',
    tone: 'dark',
  },
  ocean: {
    label: 'Xanh Asagi',
    swatch: '#d9edf1',
    canvas: '#eaf5f7',
    subtle: '#dceef2',
    surface: '#f5fbfc',
    elevated: '#ffffff',
    hover: '#cce4e9',
    tone: 'light',
  },
  sakura: {
    label: 'Hồng Sakura',
    swatch: '#f8d9df',
    canvas: '#fff0f3',
    subtle: '#fde4e9',
    surface: '#fff8f9',
    elevated: '#ffffff',
    hover: '#f8d7df',
    tone: 'light',
  },
  forest: {
    label: 'Xanh Matcha',
    swatch: '#dce8d2',
    canvas: '#edf4e6',
    subtle: '#e1edda',
    surface: '#f7fbf4',
    elevated: '#ffffff',
    hover: '#d3e3c8',
    tone: 'light',
  },
  ivory: {
    label: 'Giấy Washi',
    swatch: '#f4ead6',
    canvas: '#fffdf8',
    subtle: '#f7f1e7',
    surface: '#fffaf2',
    elevated: '#ffffff',
    hover: '#eee1c9',
    tone: 'light',
  },
  sky: {
    label: 'Mận Ume',
    swatch: '#eadceb',
    canvas: '#f6edf6',
    subtle: '#eee2ef',
    surface: '#fcf7fc',
    elevated: '#ffffff',
    hover: '#e5d4e6',
    tone: 'light',
  },
}

export function applyTheme(accentValue: unknown, backgroundValue: unknown) {
  const accent: Accent =
    typeof accentValue === 'string' && Object.hasOwn(accents, accentValue) ? (accentValue as Accent) : 'rose'
  const background: Background =
    typeof backgroundValue === 'string' && Object.hasOwn(backgrounds, backgroundValue)
      ? (backgroundValue as Background)
      : 'ivory'
  const backgroundPalette = backgrounds[background]
  const palette =
    accent === 'white' && backgroundPalette.tone === 'light'
      ? { base: '#514a40', hover: '#302b25', subtle: 'rgb(81 74 64 / 12%)' }
      : accents[accent]
  document.documentElement.style.setProperty('--color-accent', palette.base)
  document.documentElement.style.setProperty(
    '--color-accent-text',
    backgroundPalette.tone === 'dark' ? `color-mix(in srgb, ${palette.base} 65%, white)` : palette.base
  )
  document.documentElement.style.setProperty('--color-accent-hover', palette.hover)
  document.documentElement.style.setProperty('--color-accent-subtle', palette.subtle)
  document.documentElement.style.setProperty(
    '--color-text-inverse',
    accent === 'white' && backgroundPalette.tone === 'dark' ? '#1c1b20' : '#ffffff'
  )
  document.documentElement.style.setProperty('--color-bg-canvas', backgroundPalette.canvas)
  document.documentElement.style.setProperty('--color-bg-subtle', backgroundPalette.subtle)
  document.documentElement.style.setProperty('--color-bg-surface', backgroundPalette.surface)
  document.documentElement.style.setProperty('--color-bg-elevated', backgroundPalette.elevated)
  document.documentElement.style.setProperty('--color-bg-hover', backgroundPalette.hover)
  const textPalette =
    backgroundPalette.tone === 'light'
      ? {
          text: '#1c1b20',
          secondary: 'rgb(28 27 32 / 68%)',
          muted: 'rgb(28 27 32 / 65%)',
          disabled: 'rgb(28 27 32 / 36%)',
          border: 'rgb(28 27 32 / 13%)',
          borderSubtle: 'rgb(28 27 32 / 8%)',
          borderStrong: 'rgb(28 27 32 / 22%)',
          borderHover: 'rgb(28 27 32 / 18%)',
          selected: 'rgb(28 27 32 / 7%)',
          overlay: 'rgb(255 253 248 / 92%)',
        }
      : {
          text: '#eaeae0',
          secondary: 'rgb(234 234 224 / 78%)',
          muted: 'rgb(234 234 224 / 65%)',
          disabled: 'rgb(234 234 224 / 28%)',
          border: 'rgb(255 255 255 / 7%)',
          borderSubtle: 'rgb(255 255 255 / 5%)',
          borderStrong: 'rgb(255 255 255 / 18%)',
          borderHover: 'rgb(255 255 255 / 14%)',
          selected: 'rgb(255 255 255 / 8%)',
          overlay: 'rgb(13 13 23 / 92%)',
        }
  const dark = backgroundPalette.tone === 'dark'
  for (const [token, value] of Object.entries({
    success: dark ? '#34d399' : '#08794b',
    warning: dark ? '#fbbf24' : '#8a5700',
    info: dark ? '#7dabff' : '#245cc4',
  })) {
    document.documentElement.style.setProperty(`--color-${token}`, value)
  }
  document.documentElement.style.setProperty('--color-text', textPalette.text)
  document.documentElement.style.setProperty('--color-text-secondary', textPalette.secondary)
  document.documentElement.style.setProperty('--color-text-muted', textPalette.muted)
  document.documentElement.style.setProperty('--color-text-disabled', textPalette.disabled)
  document.documentElement.style.setProperty('--color-border', textPalette.border)
  document.documentElement.style.setProperty('--color-border-subtle', textPalette.borderSubtle)
  document.documentElement.style.setProperty('--color-border-strong', textPalette.borderStrong)
  document.documentElement.style.setProperty('--color-border-hover', textPalette.borderHover)
  document.documentElement.style.setProperty('--color-bg-selected', textPalette.selected)
  document.documentElement.style.setProperty('--color-bg-overlay', textPalette.overlay)
  document.documentElement.dataset['accent'] = accent
  document.documentElement.dataset['background'] = background
  document.documentElement.dataset['backgroundTone'] = backgroundPalette.tone
  document.documentElement.dataset['theme'] = backgroundPalette.tone
  document.documentElement.classList.toggle('dark', backgroundPalette.tone === 'dark')

  document.documentElement.style.colorScheme = backgroundPalette.tone
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', backgroundPalette.canvas)
  document.documentElement.style.setProperty(
    '--color-danger-text',
    backgroundPalette.tone === 'light' ? '#a51d32' : '#ffadbb'
  )
}

export function bootstrapTheme() {
  const read = (key: string) => {
    try {
      return JSON.parse(localStorage.getItem(key) || 'null') as unknown
    } catch {
      return null
    }
  }
  const sync = () => applyTheme(read('kotodama.settings.accent'), read('kotodama.settings.background'))
  sync()
  window.addEventListener('storage', sync)
  window.addEventListener('kotodama:preference', sync)
}
