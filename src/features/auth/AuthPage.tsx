import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useLocation } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Button, Input } from '../../components/ui'
import { useAuth } from './authContext'
import { AuthEditorialShell, AuthField, AuthPasswordField } from './AuthEditorialShell'
import { getPageFromPath, type Page } from '../../types/app'

type AuthForm = { name?: string; email: string; password: string; confirmPassword?: string }

function AuthFormCard({ mode, onNavigate }: { mode: 'login' | 'register'; onNavigate: (page: Page) => void }) {
  const isLogin = mode === 'login'
  const location = useLocation()
  const { signIn, signUp } = useAuth()
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<AuthForm>()
  const password = watch('password')
  const mutation = useMutation({
    mutationFn: async (values: AuthForm) => {
      const email = values.email.trim()
      return isLogin
        ? signIn({ email, password: values.password })
        : signUp({ name: (values.name ?? '').trim(), email, password: values.password })
    },
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
        noValidate
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
              {...register('name', {
                validate: (value) => Boolean(value?.trim()) || 'Vui lòng nhập họ và tên.',
              })}
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
              validate: (value) => /^\S+@\S+\.\S+$/.test(value.trim()) || 'Email chưa đúng định dạng.',
            })}
          />
        </AuthField>
        <AuthPasswordField
          id="auth-password"
          label="Mật khẩu"
          error={errors.password?.message}
          hint={
            !isLogin && password
              ? password.length >= 8
                ? '✓ Đủ độ dài tối thiểu (8+ ký tự)'
                : 'Tối thiểu 8 ký tự'
              : undefined
          }
          hintTone={!isLogin && password && password.length >= 8 ? 'ok' : 'muted'}
          autoComplete={isLogin ? 'current-password' : 'new-password'}
          placeholder={isLogin ? 'Nhập mật khẩu của bạn' : 'Ít nhất 8 ký tự'}
          {...register('password', {
            required: 'Vui lòng nhập mật khẩu.',
            minLength: { value: 8, message: 'Mật khẩu cần ít nhất 8 ký tự.' },
          })}
        />
        {!isLogin && (
          <AuthPasswordField
            id="auth-confirm-password"
            label="Xác nhận mật khẩu"
            error={errors.confirmPassword?.message}
            showLabel="Hiện mật khẩu xác nhận"
            hideLabel="Ẩn mật khẩu xác nhận"
            autoComplete="new-password"
            placeholder="Nhập lại mật khẩu"
            {...register('confirmPassword', {
              validate: (value) => value === password || 'Mật khẩu xác nhận không khớp.',
            })}
          />
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
    <AuthEditorialShell
      variant={mode}
      ariaLabel={isLogin ? 'Đăng nhập Kotodama' : 'Đăng ký Kotodama'}
      onBack={() => onNavigate('home')}
      onGoHome={() => onNavigate('home')}
      storyParagraph={
        isLogin ? (
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
        )
      }
    >
      <AuthFormCard key={mode} mode={mode} onNavigate={onNavigate} />
    </AuthEditorialShell>
  )
}
