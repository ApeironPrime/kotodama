// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import App from './App'
import { AuthContext, type AuthContextValue, type AuthUser } from './features/auth/authContext'

const learner: AuthUser = {
  id: 'learner-1',
  name: 'Người học',
  email: 'learner@kotodama.test',
  role: 'learner',
  emailVerified: true,
  accountStatus: 'active',
}

const anonymousAuth: AuthContextValue = {
  status: 'anonymous',
  user: null,
  sessionExpired: false,
  signIn: vi.fn(),
  signUp: vi.fn(),
  acceptSession: vi.fn(),
  signOut: vi.fn(),
}

function renderApp(path: string, auth: AuthContextValue = anonymousAuth) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <MemoryRouter initialEntries={[path]}>
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider value={auth}>
          <App />
        </AuthContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>
  )
}

describe('application journeys', () => {
  it('reaches the full grammar catalog through the legacy grammar route', async () => {
    renderApp('/bunpo')
    expect(
      await screen.findByRole(
        'heading',
        { name: 'Kho Giáo Trình Ngữ Pháp (Shinkanzen Master & Mimikara)' },
        { timeout: 8000 }
      )
    ).toBeTruthy()
  })

  it('sends anonymous visitors from protected routes to login', async () => {
    renderApp('/on-tap')

    expect(await screen.findByRole('heading', { name: 'Chào mừng trở lại' }, { timeout: 8000 })).toBeTruthy()
  })

  it('opens the login page from the home primary action', async () => {
    renderApp('/')

    fireEvent.click(await screen.findByRole('button', { name: /Đăng nhập để bắt đầu/i }, { timeout: 8000 }))

    expect(await screen.findByRole('heading', { name: 'Chào mừng trở lại' }, { timeout: 8000 })).toBeTruthy()
  })

  it('renders the 3-tab library interface on /tra-tu and keeps deep lookup on /dictionary', async () => {
    renderApp('/tra-tu', { ...anonymousAuth, status: 'authenticated', user: learner })

    const libraryTabs = await screen.findByRole('tablist', { name: 'Danh mục thư viện' }, { timeout: 8000 })
    expect(libraryTabs).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Từ vựng' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Hán tự' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Ngữ pháp' })).toBeTruthy()
    expect(screen.queryByRole('tab', { name: 'Từ điển' })).toBeNull()
    expect(screen.getAllByRole('button', { name: 'Thư viện' }).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Tra từ điển (Ctrl+K)' })).toBeTruthy()
  })

  it('opens quick dictionary overlay without changing current route and navigates to /dictionary on deep lookup', async () => {
    renderApp('/anime')

    expect(await screen.findByRole('heading', { name: 'Học tiếng Nhật qua Anime' }, { timeout: 8000 })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Tra từ điển (Ctrl+K)' }))

    const dialog = await screen.findByRole('dialog', { name: 'Từ điển tra nhanh' }, { timeout: 8000 })
    expect(dialog).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Học tiếng Nhật qua Anime' })).toBeTruthy()
    expect(screen.getByText('Lịch sử tra gần đây')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Tra kho Hán tự/i })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /Mở trang Từ điển chuyên sâu/i }))
    expect(await screen.findByRole('textbox', { name: 'Từ cần tra' }, { timeout: 8000 })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Phân tích' })).toBeTruthy()
  })

  it('keeps visitor on library and deep dictionary pages without redirecting to login when session is expired', async () => {
    renderApp('/dictionary', { ...anonymousAuth, sessionExpired: true })

    const input = await screen.findByRole('textbox', { name: 'Từ cần tra' }, { timeout: 8000 })
    expect(input).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Chào mừng trở lại' })).toBeNull()
  })

  it('keeps visitor on JLPT page without redirecting to login when session is expired', async () => {
    renderApp('/jlpt', { ...anonymousAuth, sessionExpired: true })

    expect(await screen.findByRole('heading', { name: 'Đề mô phỏng JLPT' }, { timeout: 8000 })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Chào mừng trở lại' })).toBeNull()
  })

  it('opens the Anime route from the public navigation', async () => {
    renderApp('/anime')

    expect(await screen.findByRole('heading', { name: 'Học tiếng Nhật qua Anime' }, { timeout: 8000 })).toBeTruthy()
    const animeNavigationItems = screen.getAllByRole('button', { name: 'Anime' })
    expect(animeNavigationItems).toHaveLength(2)
    expect(animeNavigationItems.every((item) => item.getAttribute('aria-current') === 'page')).toBe(true)
  })
})
