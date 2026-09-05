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
  it('sends anonymous visitors from protected routes to login', async () => {
    renderApp('/on-tap')

    expect(await screen.findByRole('heading', { name: 'Chào mừng trở lại' }, { timeout: 8000 })).toBeTruthy()
  })

  it('opens the login page from the home primary action', async () => {
    renderApp('/')

    fireEvent.click(await screen.findByRole('button', { name: /Đăng nhập để bắt đầu/i }, { timeout: 8000 }))

    expect(await screen.findByRole('heading', { name: 'Chào mừng trở lại' }, { timeout: 8000 })).toBeTruthy()
  })

  it('renders the dictionary search interface for an authenticated learner', async () => {
    renderApp('/tra-tu', { ...anonymousAuth, status: 'authenticated', user: learner })

    const input = await screen.findByRole('textbox', { name: 'Từ cần tra' }, { timeout: 8000 })
    expect(input).toBeTruthy()
    expect(screen.getByText('TỪ ĐIỂN NHẬT - VIỆT (VNJP DICTIONARY)')).toBeTruthy()
    expect(screen.getByText('Sẵn sàng tra cứu')).toBeTruthy()
  })
})
