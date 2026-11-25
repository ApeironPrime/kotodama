import type { ReactNode } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useLocation } from 'react-router-dom'
import { ArrowRight, CheckCircle2, CircleAlert } from 'lucide-react'
import { Button, Input } from '../../components/ui'
import { apiPaths, getApiErrorMessage, requestApi } from '../../lib/apiClient'
import type { Page } from '../../types/app'
import { AuthEditorialShell, AuthField, AuthPasswordField } from './AuthEditorialShell'

type LifecycleMode = 'forgotPassword' | 'resetPassword' | 'verifyEmail'
type EmailForm = { email: string }
type PasswordForm = { password: string; confirmPassword: string }

export default function AuthLifecyclePage({
  mode,
  onNavigate,
}: {
  mode: LifecycleMode
  onNavigate: (page: Page) => void
}) {
  const location = useLocation()
  const token = new URLSearchParams(location.search).get('token')
  if (mode === 'forgotPassword') return <ForgotPasswordPage onNavigate={onNavigate} />
  if (mode === 'resetPassword') return <ResetPasswordPage token={token} onNavigate={onNavigate} />
  return <VerifyEmailPage token={token} onNavigate={onNavigate} />
}

function ForgotPasswordPage({ onNavigate }: { onNavigate: (page: Page) => void }) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EmailForm>()
  const mutation = useMutation({
    mutationFn: (values: EmailForm) =>
      requestApi<void>({
        method: 'POST',
        url: apiPaths.auth.forgotPassword,
        data: { email: values.email.trim() },
      }),
  })
  return (
    <AuthWashiLifecycleCard
      eyebrow="KHÔI PHỤC TÀI KHOẢN"
      title="Quên mật khẩu?"
      intro="Nhập email của bạn. Nếu tài khoản tồn tại, chúng tôi sẽ gửi hướng dẫn đặt lại mật khẩu."
      ariaLabel="Khôi phục tài khoản Kotodama"
      onNavigate={onNavigate}
    >
      {mutation.isSuccess ? (
        <Success
          title="Kiểm tra hộp thư của bạn"
          description="Vì lý do bảo mật, chúng tôi không xác nhận email này có đăng ký hay không."
          action="Quay lại đăng nhập"
          onAction={() => onNavigate('login')}
        />
      ) : (
        <form noValidate onSubmit={handleSubmit((values) => mutation.mutate(values))}>
          <AuthField id="lifecycle-forgot-email" label="Email" error={errors.email?.message}>
            <Input
              id="lifecycle-forgot-email"
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
          <MutationError error={mutation.error} />
          <Button type="submit" fullWidth className="auth-washi__submit" disabled={mutation.isPending}>
            <span>{mutation.isPending ? 'Đang gửi…' : 'Gửi hướng dẫn'}</span>
            <ArrowRight size={17} aria-hidden="true" />
          </Button>
          <div className="auth-washi__switch">
            <Button variant="ghost" onClick={() => onNavigate('login')}>
              Quay lại đăng nhập <ArrowRight size={14} aria-hidden="true" />
            </Button>
          </div>
        </form>
      )}
    </AuthWashiLifecycleCard>
  )
}

function ResetPasswordPage({ token, onNavigate }: { token: string | null; onNavigate: (page: Page) => void }) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<PasswordForm>()
  const password = watch('password')
  const mutation = useMutation({
    mutationFn: (values: PasswordForm) =>
      requestApi<void>({
        method: 'POST',
        url: apiPaths.auth.resetPassword,
        data: { token, password: values.password },
      }),
  })
  return (
    <AuthWashiLifecycleCard
      eyebrow="BẢO MẬT TÀI KHOẢN"
      title="Đặt lại mật khẩu"
      intro="Chọn mật khẩu mới gồm ít nhất 8 ký tự."
      ariaLabel="Đặt lại mật khẩu Kotodama"
      onNavigate={onNavigate}
    >
      {!token ? (
        <Success
          title="Liên kết chưa hợp lệ"
          error
          description="Hãy mở lại liên kết đặt lại mật khẩu trong email của bạn."
          action="Gửi lại hướng dẫn"
          onAction={() => onNavigate('forgotPassword')}
        />
      ) : mutation.isSuccess ? (
        <Success
          title="Mật khẩu đã được cập nhật"
          description="Bạn có thể đăng nhập bằng mật khẩu mới ngay bây giờ."
          action="Đăng nhập"
          onAction={() => onNavigate('login')}
        />
      ) : (
        <form noValidate onSubmit={handleSubmit((values) => mutation.mutate(values))}>
          <PasswordFields register={register} errors={errors} password={password} />
          <MutationError error={mutation.error} />
          <Button type="submit" fullWidth className="auth-washi__submit" disabled={mutation.isPending}>
            <span>{mutation.isPending ? 'Đang cập nhật…' : 'Lưu mật khẩu mới'}</span>
            <ArrowRight size={17} aria-hidden="true" />
          </Button>
        </form>
      )}
    </AuthWashiLifecycleCard>
  )
}

function VerifyEmailPage({ token, onNavigate }: { token: string | null; onNavigate: (page: Page) => void }) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EmailForm>()
  const verify = useMutation({
    mutationFn: () => requestApi<void>({ method: 'POST', url: apiPaths.auth.verifyEmail, data: { token } }),
  })
  const resend = useMutation({
    mutationFn: (values: EmailForm) =>
      requestApi<void>({
        method: 'POST',
        url: apiPaths.auth.resendVerification,
        data: { email: values.email.trim() },
      }),
  })
  const verified = token && verify.isSuccess
  return (
    <AuthWashiLifecycleCard
      eyebrow="XÁC MINH TÀI KHOẢN"
      title="Xác minh email"
      intro="Xác minh email giúp bảo vệ tài khoản và cho phép khôi phục mật khẩu."
      ariaLabel="Xác minh email Kotodama"
      onNavigate={onNavigate}
    >
      {verified ? (
        <Success
          title="Email đã được xác minh"
          description="Tài khoản của bạn đã sẵn sàng."
          action="Đến hồ sơ"
          onAction={() => onNavigate('profile')}
        />
      ) : token ? (
        <>
          <Button fullWidth className="auth-washi__submit" disabled={verify.isPending} onClick={() => verify.mutate()}>
            <span>{verify.isPending ? 'Đang xác minh…' : 'Xác minh email'}</span>
            <ArrowRight size={17} aria-hidden="true" />
          </Button>
          <MutationError error={verify.error} />
          <div className="auth-washi__switch">
            <Button variant="ghost" onClick={() => onNavigate('profile')}>
              Để sau <ArrowRight size={14} aria-hidden="true" />
            </Button>
          </div>
        </>
      ) : resend.isSuccess ? (
        <Success
          title="Kiểm tra hộp thư của bạn"
          description="Nếu email được liên kết với một tài khoản, liên kết xác minh đã được gửi."
          action="Đến hồ sơ"
          onAction={() => onNavigate('profile')}
        />
      ) : (
        <form noValidate onSubmit={handleSubmit((values) => resend.mutate(values))}>
          <AuthField id="lifecycle-verify-email" label="Email" error={errors.email?.message}>
            <Input
              id="lifecycle-verify-email"
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
          <MutationError error={resend.error} />
          <Button type="submit" fullWidth className="auth-washi__submit" disabled={resend.isPending}>
            <span>{resend.isPending ? 'Đang gửi…' : 'Gửi lại email xác minh'}</span>
            <ArrowRight size={17} aria-hidden="true" />
          </Button>
          <div className="auth-washi__switch">
            <Button variant="ghost" onClick={() => onNavigate('profile')}>
              Để sau <ArrowRight size={14} aria-hidden="true" />
            </Button>
          </div>
        </form>
      )}
    </AuthWashiLifecycleCard>
  )
}

function AuthWashiLifecycleCard({
  eyebrow,
  title,
  intro,
  ariaLabel,
  onNavigate,
  children,
}: {
  eyebrow: string
  title: string
  intro: string
  ariaLabel: string
  onNavigate: (page: Page) => void
  children: ReactNode
}) {
  return (
    <AuthEditorialShell
      variant="lifecycle"
      ariaLabel={ariaLabel}
      backLabel="Quay lại đăng nhập"
      onBack={() => onNavigate('login')}
      onGoHome={() => onNavigate('home')}
      storyParagraph={
        <>
          Mỗi chặng dừng đều có thể nối lại.
          <br />
          Giữ an toàn cho không gian tiếng Nhật của bạn.
        </>
      }
    >
      <div className="auth-card auth-washi__card">
        <p className="auth-washi__eyebrow">
          <span aria-hidden="true" /> {eyebrow}
        </p>
        <h1>{title}</h1>
        <p className="auth-card__intro">{intro}</p>
        {children}
      </div>
    </AuthEditorialShell>
  )
}

function MutationError({ error }: { error: Error | null }) {
  return error ? (
    <div className="auth-card__error" role="alert">
      {getApiErrorMessage(error, error.message)}
    </div>
  ) : null
}

function Success({
  title,
  description,
  action,
  onAction,
  error = false,
}: {
  error?: boolean
  title: string
  description: string
  action: string
  onAction: () => void
}) {
  return (
    <div className="auth-lifecycle-success auth-washi__lifecycle-status" role="status">
      <div className={`auth-washi__status-icon${error ? ' is-error' : ''}`} aria-hidden="true">
        {error ? <CircleAlert size={26} strokeWidth={1.6} /> : <CheckCircle2 size={26} strokeWidth={1.6} />}
      </div>
      <h2>{title}</h2>
      <p>{description}</p>
      <Button fullWidth className="auth-washi__submit" onClick={onAction}>
        <span>{action}</span>
        <ArrowRight size={17} aria-hidden="true" />
      </Button>
    </div>
  )
}

function PasswordFields({
  register,
  errors,
  password,
}: {
  register: ReturnType<typeof useForm<PasswordForm>>['register']
  errors: ReturnType<typeof useForm<PasswordForm>>['formState']['errors']
  password?: string
}) {
  return (
    <>
      <AuthPasswordField
        id="lifecycle-new-password"
        label="Mật khẩu mới"
        error={errors.password?.message}
        hint={password ? (password.length >= 8 ? '✓ Đủ độ dài tối thiểu (8+ ký tự)' : 'Tối thiểu 8 ký tự') : undefined}
        hintTone={password && password.length >= 8 ? 'ok' : 'muted'}
        autoComplete="new-password"
        placeholder="Ít nhất 8 ký tự"
        {...register('password', {
          required: 'Vui lòng nhập mật khẩu mới.',
          minLength: { value: 8, message: 'Mật khẩu cần ít nhất 8 ký tự.' },
        })}
      />
      <AuthPasswordField
        id="lifecycle-confirm-password"
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
    </>
  )
}
