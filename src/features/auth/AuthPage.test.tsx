// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AuthPage from './AuthPage'
import { AuthContext, type AuthContextValue } from './authContext'

const signInMock = vi.fn()
const signUpMock = vi.fn()

function renderAuthPage(mode: 'login' | 'register', onNavigate = vi.fn()) {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  })
  const authValue: AuthContextValue = {
    status: 'anonymous',
    user: null,
    sessionExpired: false,
    signIn: signInMock,
    signUp: signUpMock,
    acceptSession: vi.fn(),
    signOut: vi.fn(),
  }

  return {
    onNavigate,
    ...render(
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider value={authValue}>
          <MemoryRouter>
            <AuthPage mode={mode} onNavigate={onNavigate} />
          </MemoryRouter>
        </AuthContext.Provider>
      </QueryClientProvider>
    ),
  }
}

describe('AuthPage', () => {
  beforeEach(() => {
    signInMock.mockReset()
    signUpMock.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders login copy without removed footers or calligraphy overlay, toggles password visibility, and submits signIn', async () => {
    signInMock.mockResolvedValueOnce(undefined)
    const { onNavigate } = renderAuthPage('login')

    expect(screen.getByRole('heading', { name: 'Chào mừng trở lại' })).toBeTruthy()
    expect(screen.getByText(/Trở về với những điều đã học\./)).toBeTruthy()
    expect(screen.queryByText('Không gian của bạn. Hành trình của bạn.')).toBeNull()
    expect(screen.queryByText('HỌC CHẬM RÃI. HIỂU SÂU HƠN.')).toBeNull()
    expect(screen.queryByText('一語一会')).toBeNull()

    const passwordInput = screen.getByLabelText('Mật khẩu') as HTMLInputElement
    expect(passwordInput.type).toBe('password')

    fireEvent.click(screen.getByRole('button', { name: 'Hiện mật khẩu' }))
    expect(passwordInput.type).toBe('text')
    fireEvent.click(screen.getByRole('button', { name: 'Ẩn mật khẩu' }))
    expect(passwordInput.type).toBe('password')

    fireEvent.input(screen.getByLabelText('Email'), { target: { value: 'learner@kotodama.jp' } })
    fireEvent.input(passwordInput, { target: { value: 'kotodama123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }))

    await waitFor(() => {
      expect(signInMock).toHaveBeenCalledWith({
        email: 'learner@kotodama.jp',
        password: 'kotodama123',
      })
      expect(onNavigate).toHaveBeenCalledWith('profile')
    })
  })

  it('renders register copy, all 4 fields, independent password toggles, inline mismatch error, and submits signUp', async () => {
    signUpMock.mockResolvedValueOnce(undefined)
    const { onNavigate } = renderAuthPage('register')

    expect(screen.getByRole('heading', { name: 'Tạo hành trình của bạn' })).toBeTruthy()
    expect(screen.getByText(/Bắt đầu từ những con chữ đầu tiên\./)).toBeTruthy()

    const nameInput = screen.getByLabelText('Họ và tên') as HTMLInputElement
    const emailInput = screen.getByLabelText('Email') as HTMLInputElement
    const passwordInput = screen.getByLabelText('Mật khẩu') as HTMLInputElement
    const confirmInput = screen.getByLabelText('Xác nhận mật khẩu') as HTMLInputElement

    fireEvent.click(screen.getByRole('button', { name: 'Hiện mật khẩu' }))
    expect(passwordInput.type).toBe('text')
    expect(confirmInput.type).toBe('password')

    fireEvent.click(screen.getByRole('button', { name: 'Hiện mật khẩu xác nhận' }))
    expect(confirmInput.type).toBe('text')

    fireEvent.input(nameInput, { target: { value: 'Minh Anh' } })
    fireEvent.input(emailInput, { target: { value: 'minhanh@kotodama.jp' } })
    fireEvent.input(passwordInput, { target: { value: 'kotodama123' } })
    fireEvent.input(confirmInput, { target: { value: 'different123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Tạo tài khoản' }))

    expect(await screen.findByText('Mật khẩu xác nhận không khớp.')).toBeTruthy()
    expect(signUpMock).not.toHaveBeenCalled()

    fireEvent.input(confirmInput, { target: { value: 'kotodama123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Tạo tài khoản' }))

    await waitFor(() => {
      expect(signUpMock).toHaveBeenCalledWith({
        name: 'Minh Anh',
        email: 'minhanh@kotodama.jp',
        password: 'kotodama123',
      })
      expect(onNavigate).toHaveBeenCalledWith('verifyEmail')
    })
  })
})
