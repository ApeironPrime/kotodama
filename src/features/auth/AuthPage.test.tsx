// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AuthLifecyclePage from './AuthLifecyclePage'
import AuthPage from './AuthPage'
import { AuthContext, type AuthContextValue } from './authContext'

const signInMock = vi.fn()
const signUpMock = vi.fn()

function renderWithProviders(ui: React.ReactElement, initialEntries: string[] = ['/']) {
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

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={authValue}>
        <MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>
  )
}

describe('AuthPage & AuthLifecyclePage', () => {
  beforeEach(() => {
    signInMock.mockReset()
    signUpMock.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders login copy, external tanzaku calligraphy, noValidate form, password toggle, and trims email on submit', async () => {
    signInMock.mockResolvedValueOnce(undefined)
    const onNavigate = vi.fn()
    const { container } = renderWithProviders(<AuthPage mode="login" onNavigate={onNavigate} />)

    expect(screen.getByRole('heading', { name: 'Chào mừng trở lại' })).toBeTruthy()
    expect(screen.getByText(/Trở về với những điều đã học\./)).toBeTruthy()
    expect(screen.queryByText('Không gian của bạn. Hành trình của bạn.')).toBeNull()
    expect(screen.queryByText('HỌC CHẬM RÃI. HIỂU SÂU HƠN.')).toBeNull()

    // Calligraphy is placed cleanly outside the painting in .auth-washi__tanzaku
    const tanzaku = container.querySelector('.auth-washi__tanzaku')
    const art = container.querySelector('.auth-washi__art')
    expect(tanzaku?.textContent).toContain('一語一会')
    expect(art?.textContent).toBe('')

    const form = container.querySelector('form')
    expect(form?.hasAttribute('novalidate')).toBe(true)

    const emailInput = screen.getByLabelText('Email') as HTMLInputElement
    const passwordInput = screen.getByLabelText('Mật khẩu') as HTMLInputElement
    expect(emailInput.readOnly).toBe(true)
    expect(passwordInput.readOnly).toBe(true)
    expect(passwordInput.type).toBe('password')

    fireEvent.focus(emailInput)
    fireEvent.focus(passwordInput)
    expect(emailInput.readOnly).toBe(false)
    expect(passwordInput.readOnly).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: 'Hiện mật khẩu' }))
    expect(passwordInput.type).toBe('text')
    fireEvent.click(screen.getByRole('button', { name: 'Ẩn mật khẩu' }))
    expect(passwordInput.type).toBe('password')

    fireEvent.input(emailInput, { target: { value: '  learner@kotodama.jp  ' } })
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

  it('renders register copy, all 4 fields, live password length hint, independent toggles, mismatch error, and trims inputs', async () => {
    signUpMock.mockResolvedValueOnce(undefined)
    const onNavigate = vi.fn()
    renderWithProviders(<AuthPage mode="register" onNavigate={onNavigate} />)

    expect(screen.getByRole('heading', { name: 'Tạo hành trình của bạn' })).toBeTruthy()
    expect(screen.getByText(/Bắt đầu từ những con chữ đầu tiên\./)).toBeTruthy()

    const nameInput = screen.getByLabelText('Họ và tên') as HTMLInputElement
    const emailInput = screen.getByLabelText('Email') as HTMLInputElement
    const passwordInput = screen.getByLabelText('Mật khẩu') as HTMLInputElement
    const confirmInput = screen.getByLabelText('Xác nhận mật khẩu') as HTMLInputElement

    fireEvent.input(passwordInput, { target: { value: 'short' } })
    expect(screen.getByText('Tối thiểu 8 ký tự')).toBeTruthy()
    fireEvent.input(passwordInput, { target: { value: 'kotodama123' } })
    expect(screen.getByText('✓ Đủ độ dài tối thiểu (8+ ký tự)')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Hiện mật khẩu' }))
    expect(passwordInput.type).toBe('text')
    expect(confirmInput.type).toBe('password')

    fireEvent.click(screen.getByRole('button', { name: 'Hiện mật khẩu xác nhận' }))
    expect(confirmInput.type).toBe('text')

    fireEvent.input(nameInput, { target: { value: '  Minh Anh  ' } })
    fireEvent.input(emailInput, { target: { value: ' minhanh@kotodama.jp ' } })
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

  it('renders AuthLifecyclePage inside shared Washi editorial shell with password toggles on resetPassword', () => {
    const onNavigate = vi.fn()
    const { container } = renderWithProviders(<AuthLifecyclePage mode="resetPassword" onNavigate={onNavigate} />, [
      '/dat-lai-mat-khau?token=abc123',
    ])

    expect(container.querySelector('.auth-washi--lifecycle')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Đặt lại mật khẩu' })).toBeTruthy()
    const newPwInput = screen.getByLabelText('Mật khẩu mới') as HTMLInputElement
    expect(newPwInput.type).toBe('password')
    fireEvent.click(screen.getByRole('button', { name: 'Hiện mật khẩu' }))
    expect(newPwInput.type).toBe('text')
  })
})
