import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useLocation } from 'react-router-dom'
import { Button, Card, Field, Input, PageShell } from '../../components/ui'
import { CheckCircle2, CircleAlert } from 'lucide-react'
import { apiPaths, getApiErrorMessage, requestApi } from '../../lib/apiClient'
import type { Page } from '../../types/app'

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
      requestApi<void>({ method: 'POST', url: apiPaths.auth.forgotPassword, data: values }),
  })
  return (
    <AuthCard
      eyebrow="KHÔI PHỤC TÀI KHOẢN"
      title="Quên mật khẩu?"
      intro="Nhập email của bạn. Nếu tài khoản tồn tại, chúng tôi sẽ gửi hướng dẫn đặt lại mật khẩu."
    >
      {mutation.isSuccess ? (
        <Success
          title="Kiểm tra hộp thư của bạn"
          description="Vì lý do bảo mật, chúng tôi không xác nhận email này có đăng ký hay không."
          action="Quay lại đăng nhập"
          onAction={() => onNavigate('login')}
        />
      ) : (
        <form onSubmit={handleSubmit((values) => mutation.mutate(values))}>
          <Field label="Email" error={errors.email?.message}>
            <Input
              type="email"
              autoComplete="email"
              {...register('email', {
                required: 'Vui lòng nhập email.',
                pattern: { value: /^\S+@\S+\.\S+$/, message: 'Email chưa đúng định dạng.' },
              })}
            />
          </Field>
          <MutationError error={mutation.error} />
          <Button type="submit" fullWidth disabled={mutation.isPending}>
            {mutation.isPending ? 'Đang gửi…' : 'Gửi hướng dẫn'}
          </Button>
          <Button variant="ghost" fullWidth onClick={() => onNavigate('login')}>
            Quay lại đăng nhập
          </Button>
        </form>
      )}
    </AuthCard>
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
    <AuthCard eyebrow="BẢO MẬT TÀI KHOẢN" title="Đặt lại mật khẩu" intro="Chọn mật khẩu mới gồm ít nhất 8 ký tự.">
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
        <form onSubmit={handleSubmit((values) => mutation.mutate(values))}>
          <PasswordFields register={register} errors={errors} password={password} />
          <MutationError error={mutation.error} />
          <Button type="submit" fullWidth disabled={mutation.isPending}>
            {mutation.isPending ? 'Đang cập nhật…' : 'Lưu mật khẩu mới'}
          </Button>
        </form>
      )}
    </AuthCard>
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
      requestApi<void>({ method: 'POST', url: apiPaths.auth.resendVerification, data: values }),
  })
  const verified = token && verify.isSuccess
  return (
    <AuthCard
      eyebrow="XÁC MINH TÀI KHOẢN"
      title="Xác minh email"
      intro="Xác minh email giúp bảo vệ tài khoản và cho phép khôi phục mật khẩu."
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
          <Button fullWidth disabled={verify.isPending} onClick={() => verify.mutate()}>
            {verify.isPending ? 'Đang xác minh…' : 'Xác minh email'}
          </Button>
          <MutationError error={verify.error} />
          <Button variant="ghost" fullWidth onClick={() => onNavigate('profile')}>
            Để sau
          </Button>
        </>
      ) : resend.isSuccess ? (
        <Success
          title="Kiểm tra hộp thư của bạn"
          description="Nếu email được liên kết với một tài khoản, liên kết xác minh đã được gửi."
          action="Đến hồ sơ"
          onAction={() => onNavigate('profile')}
        />
      ) : (
        <form onSubmit={handleSubmit((values) => resend.mutate(values))}>
          <Field label="Email" error={errors.email?.message}>
            <Input
              type="email"
              autoComplete="email"
              {...register('email', {
                required: 'Vui lòng nhập email.',
                pattern: { value: /^\S+@\S+\.\S+$/, message: 'Email chưa đúng định dạng.' },
              })}
            />
          </Field>
          <MutationError error={resend.error} />
          <Button type="submit" fullWidth disabled={resend.isPending}>
            {resend.isPending ? 'Đang gửi…' : 'Gửi lại email xác minh'}
          </Button>
          <Button variant="ghost" fullWidth onClick={() => onNavigate('profile')}>
            Để sau
          </Button>
        </form>
      )}
    </AuthCard>
  )
}

function AuthCard({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow: string
  title: string
  intro: string
  children: React.ReactNode
}) {
  return (
    <PageShell width="reading" className="auth-page">
      <Card padding="lg" className="auth-card">
        <p className="auth-card__eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="auth-card__intro">{intro}</p>
        {children}
      </Card>
    </PageShell>
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
    <div className="auth-lifecycle-success" role="status">
      {error ? <CircleAlert aria-hidden="true" size={30} /> : <CheckCircle2 aria-hidden="true" size={30} />}
      <h2>{title}</h2>
      <p>{description}</p>
      <Button fullWidth onClick={onAction}>
        {action}
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
      <Field label="Mật khẩu mới" error={errors.password?.message}>
        <Input
          type="password"
          autoComplete="new-password"
          {...register('password', {
            required: 'Vui lòng nhập mật khẩu mới.',
            minLength: { value: 8, message: 'Mật khẩu cần ít nhất 8 ký tự.' },
          })}
        />
      </Field>
      <Field label="Xác nhận mật khẩu" error={errors.confirmPassword?.message}>
        <Input
          type="password"
          autoComplete="new-password"
          {...register('confirmPassword', {
            validate: (value) => value === password || 'Mật khẩu xác nhận không khớp.',
          })}
        />
      </Field>
    </>
  )
}
