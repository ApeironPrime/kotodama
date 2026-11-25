import { forwardRef, useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { ArrowLeft, Eye, EyeOff } from 'lucide-react'
import { Button, Input } from '../../components/ui'
import '../../styles/auth-washi.css'

export function AuthField({
  id,
  label,
  error,
  hint,
  hintTone = 'muted',
  invalid = false,
  trailing,
  children,
}: {
  id: string
  label: string
  error?: string | undefined
  hint?: ReactNode
  hintTone?: 'muted' | 'ok' | undefined
  invalid?: boolean | undefined
  trailing?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="ui-field auth-washi__field" data-invalid={invalid || Boolean(error) ? 'true' : undefined}>
      <label htmlFor={id} className="ui-field__label">
        {label}
      </label>
      <div className="ui-field__control auth-washi__control">
        {children}
        {trailing}
      </div>
      <div className="auth-washi__feedback" aria-live="polite">
        {error ? (
          <span className="ui-field__error" role="alert">
            {error}
          </span>
        ) : hint ? (
          <span className={`auth-washi__hint${hintTone === 'ok' ? ' is-ok' : ''}`}>{hint}</span>
        ) : null}
      </div>
    </div>
  )
}

type AuthPasswordFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  id: string
  label: string
  error?: string | undefined
  hint?: ReactNode
  hintTone?: 'muted' | 'ok'
  showLabel?: string
  hideLabel?: string
}

export const AuthPasswordField = forwardRef<HTMLInputElement, AuthPasswordFieldProps>(
  (
    {
      id,
      label,
      error,
      hint,
      hintTone,
      showLabel = 'Hiện mật khẩu',
      hideLabel = 'Ẩn mật khẩu',
      className,
      ...inputProps
    },
    ref
  ) => {
    const [visible, setVisible] = useState(false)
    return (
      <AuthField id={id} label={label} error={error} hint={hint} hintTone={hintTone} invalid={Boolean(error)}>
        <Input
          ref={ref}
          id={id}
          type={visible ? 'text' : 'password'}
          className={className ? `auth-washi__input--pw ${className}` : 'auth-washi__input--pw'}
          aria-invalid={Boolean(error)}
          {...inputProps}
        />
        <button
          type="button"
          className="auth-washi__pw-toggle"
          onClick={() => setVisible((prev) => !prev)}
          aria-label={visible ? hideLabel : showLabel}
          aria-pressed={visible}
        >
          {visible ? (
            <EyeOff size={15} strokeWidth={1.5} aria-hidden="true" />
          ) : (
            <Eye size={15} strokeWidth={1.5} aria-hidden="true" />
          )}
        </button>
      </AuthField>
    )
  }
)
AuthPasswordField.displayName = 'AuthPasswordField'

export function AuthEditorialShell({
  variant,
  ariaLabel,
  backLabel = 'Về trang chủ',
  onBack,
  onGoHome,
  storyParagraph,
  children,
}: {
  variant: 'login' | 'register' | 'lifecycle'
  ariaLabel: string
  backLabel?: string
  onBack: () => void
  onGoHome: () => void
  storyParagraph: ReactNode
  children: ReactNode
}) {
  return (
    <section className={`auth-washi auth-washi--${variant}`} aria-label={ariaLabel}>
      <div className="auth-washi__shell">
        <header className="auth-washi__topbar">
          <Button variant="ghost" className="auth-washi__back" onClick={onBack}>
            <ArrowLeft size={15} aria-hidden="true" />
            <span>{backLabel}</span>
          </Button>
          <button type="button" className="auth-washi__brand" onClick={onGoHome} aria-label="Kotodama — về trang chủ">
            <span className="auth-washi__brand-seal" aria-hidden="true">
              言
            </span>
            <span className="auth-washi__brand-name">Kotodama</span>
            <span className="auth-washi__brand-jp" lang="ja" aria-hidden="true">
              言霊
            </span>
          </button>
        </header>
        <div className="auth-washi__layout">
          <aside className="auth-washi__story" aria-label="Tinh thần Kotodama">
            <div className="auth-washi__edition">
              <span>KOTODAMA</span>
              <span>言霊 · Ngôn linh</span>
            </div>
            <div className="auth-washi__art-row" aria-hidden="true">
              <div className="auth-washi__art">
                <img src="/assets/journey-01-destination.jpg" alt="" />
              </div>
              <div className="auth-washi__tanzaku">
                <span className="auth-washi__calligraphy" lang="ja">
                  一語一会
                </span>
                <img className="auth-washi__seal" src="/assets/kotodama-seal-imprint.svg" alt="" />
              </div>
            </div>
            <div className="auth-washi__verse">
              <p className="auth-washi__caption">MỖI CON CHỮ, MỘT CUỘC GẶP</p>
              <h2>
                Một nét mực.
                <br />
                Một bước gần hơn.
              </h2>
              <p>{storyParagraph}</p>
            </div>
          </aside>
          <div className="auth-washi__form-panel">{children}</div>
        </div>
      </div>
    </section>
  )
}
