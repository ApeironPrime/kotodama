import { useState, type ReactNode } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useLocation } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Eye, EyeOff } from 'lucide-react'
import { Button, Input } from '../../components/ui'
import { useAuth } from './authContext'
import { getPageFromPath, type Page } from '../../types/app'
import '../../styles/auth-washi.css'

type AuthForm = { name?: string; email: string; password: string; confirmPassword?: string }

function AuthField({
  id,
  label,
  error,
  trailing,
  children,
}: {
  id: string
  label: string
  error?: string | undefined
  trailing?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="ui-field auth-washi__field">
      <label htmlFor={id} className="ui-field__label">
        {label}
      </label>
      <div className="ui-field__control auth-washi__control">
        {children}
        {trailing}
      </div>
      {error && (
        <span className="ui-field__error" role="alert">
          {error}
        </span>
      )}
    </div>
  )
}

function AuthFormCard({ mode, onNavigate }: { mode: 'login' | 'register'; onNavigate: (page: Page) => void }) {
  const isLogin = mode === 'login'
  const location = useLocation()
  const { signIn, signUp } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<AuthForm>()
  const password = watch('password')
  const mutation = useMutation({
    mutationFn: async (values: AuthForm) =>
      isLogin
        ? signIn({ email: values.email, password: values.password })
        : signUp({ name: values.name ?? '', email: values.email, password: values.password }),
    onSuccess: () => {
      if (!isLogin) {
        onNavigate('verifyEmail')
        return
      }
      const from = typeof location.state?.from === 'string' ? getPageFromPath(location.state.from) : undefined
      onNavigate(from ?? 'profile')
    },
  })
  const sessionMessage = typeof location.state?.message === 'string' ? location.state.message : undefined

  const switchMode = () => {
    mutation.reset()
    if (typeof document !== 'undefined') {
      document.documentElement.dataset['vtScope'] = 'auth'
      window.setTimeout(() => {
        if (document.documentElement.dataset['vtScope'] === 'auth') {
          delete document.documentElement.dataset['vtScope']
        }
      }, 450)
    }
    onNavigate(isLogin ? 'register' : 'login')
  }

  return (
    <div className="auth-card auth-washi__card">
      <p className="auth-washi__eyebrow">
        <span aria-hidden="true" /> {isLogin ? 'TIẾP NỐI HÀNH TRÌNH' : 'MỞ MỘT TRANG MỚI'}
      </p>
      <h1>{isLogin ? 'Chào mừng trở lại' : 'Tạo hành trình của bạn'}</h1>
      <p className="auth-card__intro">
        {isLogin
          ? 'Đăng nhập để tiếp tục lộ trình học của bạn.'
          : 'Lưu tiến độ học và đồng bộ trải nghiệm trên các thiết bị.'}
      </p>
      {sessionMessage && (
        <div className="auth-card__notice" role="status">
          {sessionMessage}
        </div>
      )}
      <form
        aria-label={isLogin ? 'Đăng nhập' : 'Tạo tài khoản'}
        onSubmit={handleSubmit((values) => mutation.mutate(values))}
      >
        {!isLogin && (
          <AuthField id="auth-name" label="Họ và tên" error={errors.name?.message}>
            <Input
              id="auth-name"
              placeholder="Tên của bạn"
              autoComplete="name"
              aria-invalid={!!errors.name}
              {...register('name', { required: 'Vui lòng nhập họ và tên.' })}
            />
          </AuthField>
        )}
        <AuthField id="auth-email" label="Email" error={errors.email?.message}>
          <Input
            id="auth-email"
            type="email"
            autoComplete="email"
            placeholder="ban@example.com"
            aria-invalid={!!errors.email}
            {...register('email', {
              required: 'Vui lòng nhập email.',
              pattern: { value: /^\S+@\S+\.\S+$/, message: 'Email chưa đúng định dạng.' },
            })}
          />
        </AuthField>
        <AuthField
          id="auth-password"
          label="Mật khẩu"
          error={errors.password?.message}
          trailing={
            <button
              type="button"
              className="auth-washi__pw-toggle"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              aria-pressed={showPassword}
            >
              {showPassword ? (
                <EyeOff size={15} strokeWidth={1.5} aria-hidden="true" />
              ) : (
                <Eye size={15} strokeWidth={1.5} aria-hidden="true" />
              )}
            </button>
          }
        >
          <Input
            id="auth-password"
            type={showPassword ? 'text' : 'password'}
            className="auth-washi__input--pw"
            autoComplete={isLogin ? 'current-password' : 'new-password'}
            placeholder={isLogin ? 'Nhập mật khẩu của bạn' : 'Ít nhất 8 ký tự'}
            aria-invalid={!!errors.password}
            {...register('password', {
              required: 'Vui lòng nhập mật khẩu.',
              minLength: { value: 8, message: 'Mật khẩu cần ít nhất 8 ký tự.' },
            })}
          />
        </AuthField>
        {!isLogin && (
          <AuthField
            id="auth-confirm-password"
            label="Xác nhận mật khẩu"
            error={errors.confirmPassword?.message}
            trailing={
              <button
                type="button"
                className="auth-washi__pw-toggle"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                aria-label={showConfirmPassword ? 'Ẩn mật khẩu xác nhận' : 'Hiện mật khẩu xác nhận'}
                aria-pressed={showConfirmPassword}
              >
                {showConfirmPassword ? (
                  <EyeOff size={15} strokeWidth={1.5} aria-hidden="true" />
                ) : (
                  <Eye size={15} strokeWidth={1.5} aria-hidden="true" />
                )}
              </button>
            }
          >
            <Input
              id="auth-confirm-password"
              type={showConfirmPassword ? 'text' : 'password'}
              className="auth-washi__input--pw"
              autoComplete="new-password"
              placeholder="Nhập lại mật khẩu"
              aria-invalid={!!errors.confirmPassword}
              {...register('confirmPassword', {
                validate: (value) => value === password || 'Mật khẩu xác nhận không khớp.',
              })}
            />
          </AuthField>
        )}
        {isLogin && (
          <Button variant="ghost" className="auth-washi__forgot" onClick={() => onNavigate('forgotPassword')}>
            Quên mật khẩu?
          </Button>
        )}
        {mutation.isError && (
          <div className="auth-card__error" role="alert">
            {mutation.error.message}
          </div>
        )}
        <Button type="submit" fullWidth className="auth-washi__submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Đang xử lý...' : isLogin ? 'Đăng nhập' : 'Tạo tài khoản'}
          <ArrowRight size={17} aria-hidden="true" />
        </Button>
      </form>
      <div className="auth-washi__switch">
        <span>{isLogin ? 'Chưa có tài khoản?' : 'Đã có tài khoản?'}</span>
        <Button variant="ghost" onClick={switchMode}>
          {isLogin ? 'Đăng ký' : 'Đăng nhập'} <ArrowRight size={14} aria-hidden="true" />
        </Button>
      </div>
    </div>
  )
}

export default function AuthPage({
  mode,
  onNavigate,
}: {
  mode: 'login' | 'register'
  onNavigate: (page: Page) => void
}) {
  const isLogin = mode === 'login'

  return (
    <section
      className={`auth-washi auth-washi--${mode}`}
      aria-label={isLogin ? 'Đăng nhập Kotodama' : 'Đăng ký Kotodama'}
    >
      <div className="auth-washi__shell">
        <div className="auth-washi__topbar">
          <Button variant="ghost" className="auth-washi__back" onClick={() => onNavigate('home')}>
            <ArrowLeft size={15} aria-hidden="true" /> Về trang chủ
          </Button>
        </div>
        <div className="auth-washi__layout">
          <aside className="auth-washi__story" aria-label="Tinh thần Kotodama">
            <div className="auth-washi__edition">
              <span>KOTODAMA</span>
              <span>言霊 · Ngôn linh</span>
            </div>
            <div className="auth-washi__art" aria-hidden="true">
              <img src="/assets/ink-journey-poster.jpg" alt="" />
            </div>
            <div className="auth-washi__verse">
              <p className="auth-washi__caption">MỖI CON CHỮ, MỘT CUỘC GẶP</p>
              <h2>
                Một nét mực.
                <br />
                Một bước gần hơn.
              </h2>
              <p>
                {isLogin ? (
                  <>
                    Trở về với những điều đã học.
                    <br />
                    Mở thêm một trang tiếng Nhật của riêng bạn.
                  </>
                ) : (
                  <>
                    Bắt đầu từ những con chữ đầu tiên.
                    <br />
                    Lưu giữ nhịp học tiếng Nhật của riêng bạn.
                  </>
                )}
              </p>
            </div>
          </aside>
          <div className="auth-washi__form-panel">
            <AuthFormCard key={mode} mode={mode} onNavigate={onNavigate} />
          </div>
        </div>
      </div>
    </section>
  )
}
