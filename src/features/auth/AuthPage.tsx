import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useLocation } from 'react-router-dom'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { Button, Field, Input } from '../../components/ui'
import { useAuth } from './authContext'
import { getPageFromPath, type Page } from '../../types/app'
import '../../styles/auth-washi.css'

type AuthForm = { name?: string; email: string; password: string; confirmPassword?: string }

export default function AuthPage({
  mode,
  onNavigate,
}: {
  mode: 'login' | 'register'
  onNavigate: (page: Page) => void
}) {
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
  return (
    <section className="auth-washi" aria-label={isLogin ? 'Đăng nhập Kotodama' : 'Đăng ký Kotodama'}>
      <div className="auth-washi__shell">
        <Button variant="ghost" className="auth-washi__back" onClick={() => onNavigate('home')}>
          <ArrowLeft size={15} aria-hidden="true" /> Về trang chủ
        </Button>
        <div className="auth-washi__layout">
          <aside className="auth-washi__story" aria-label="Tinh thần Kotodama">
            <div className="auth-washi__edition">
              <span>KOTODAMA</span>
              <span>言霊 · Ngôn linh</span>
            </div>
            <div className="auth-washi__art" aria-hidden="true">
              <img src="/assets/ink-journey-poster.jpg" alt="" />
              <span className="auth-washi__calligraphy" lang="ja">
                一語一会
              </span>
              <img className="auth-washi__seal" src="/assets/kotodama-seal-imprint.svg" alt="" />
            </div>
            <div className="auth-washi__verse">
              <p className="auth-washi__caption">MỖI CON CHỮ, MỘT CUỘC GẶP</p>
              <h2>
                Một nét mực.
                <br />
                Một bước gần hơn.
              </h2>
              <p>
                Trở về với những điều đã học.
                <br />
                Mở thêm một trang tiếng Nhật của riêng bạn.
              </p>
            </div>
            <div className="auth-washi__colophon">
              <span>HỌC CHẬM RÃI. HIỂU SÂU HƠN.</span>
              <span lang="ja">学びの旅</span>
            </div>
          </aside>
          <div className="auth-washi__form-panel">
            <div className="auth-card auth-washi__card" key={mode}>
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
                  <Field label="Họ và tên" error={errors.name?.message}>
                    <Input
                      placeholder="Tên của bạn"
                      autoComplete="name"
                      aria-invalid={!!errors.name}
                      {...register('name', { required: 'Vui lòng nhập họ và tên.' })}
                    />
                  </Field>
                )}
                <Field label="Email" error={errors.email?.message}>
                  <Input
                    type="email"
                    autoComplete="email"
                    placeholder="ban@example.com"
                    aria-invalid={!!errors.email}
                    {...register('email', {
                      required: 'Vui lòng nhập email.',
                      pattern: { value: /^\S+@\S+\.\S+$/, message: 'Email chưa đúng định dạng.' },
                    })}
                  />
                </Field>
                <Field label="Mật khẩu" error={errors.password?.message}>
                  <Input
                    type="password"
                    autoComplete={isLogin ? 'current-password' : 'new-password'}
                    placeholder={isLogin ? 'Nhập mật khẩu của bạn' : 'Ít nhất 8 ký tự'}
                    aria-invalid={!!errors.password}
                    {...register('password', {
                      required: 'Vui lòng nhập mật khẩu.',
                      minLength: { value: 8, message: 'Mật khẩu cần ít nhất 8 ký tự.' },
                    })}
                  />
                </Field>
                {!isLogin && (
                  <Field label="Xác nhận mật khẩu" error={errors.confirmPassword?.message}>
                    <Input
                      type="password"
                      autoComplete="new-password"
                      placeholder="Nhập lại mật khẩu"
                      aria-invalid={!!errors.confirmPassword}
                      {...register('confirmPassword', {
                        validate: (value) => value === password || 'Mật khẩu xác nhận không khớp.',
                      })}
                    />
                  </Field>
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
                <Button
                  variant="ghost"
                  onClick={() => {
                    mutation.reset()
                    onNavigate(isLogin ? 'register' : 'login')
                  }}
                >
                  {isLogin ? 'Đăng ký' : 'Đăng nhập'} <ArrowRight size={14} aria-hidden="true" />
                </Button>
              </div>
              <p className="auth-washi__footnote">Không gian của bạn. Hành trình của bạn.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
