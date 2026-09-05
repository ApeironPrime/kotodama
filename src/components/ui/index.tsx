import {
  forwardRef,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'

function classes(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ')
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
}

export function Button({
  className,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={classes(
        'ui-button',
        `ui-button--${variant}`,
        `ui-button--${size}`,
        fullWidth && 'ui-button--full',
        className
      )}
      {...props}
    />
  )
}

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { label: string }

export function IconButton({ className, label, type = 'button', ...props }: IconButtonProps) {
  return <button type={type} aria-label={label} className={classes('ui-icon-button', className)} {...props} />
}

type CardProps = HTMLAttributes<HTMLDivElement> & { children: ReactNode; padding?: 'none' | 'sm' | 'md' | 'lg' }

export function Card({ className, padding = 'md', ...props }: CardProps) {
  return <div className={classes('ui-card', `ui-card--${padding}`, className)} {...props} />
}

type PageShellProps = HTMLAttributes<HTMLDivElement> & { children: ReactNode; width?: 'reading' | 'default' | 'wide' }

export function PageShell({ className, width = 'default', ...props }: PageShellProps) {
  return <div className={classes('ui-page-shell', `ui-page-shell--${width}`, className)} {...props} />
}

export function Field({
  label,
  error,
  description,
  children,
}: {
  label: string
  error?: string | undefined
  description?: string | undefined
  children: ReactNode
}) {
  return (
    <label className="ui-field">
      <span className="ui-field__label">{label}</span>
      {description && <span className="ui-field__description">{description}</span>}
      <span className="ui-field__control">{children}</span>
      {error && (
        <span className="ui-field__error" role="alert">
          {error}
        </span>
      )}
    </label>
  )
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => <input ref={ref} className={classes('ui-input', className)} {...props} />
)
Input.displayName = 'Input'

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => <textarea ref={ref} className={classes('ui-textarea', className)} {...props} />
)
Textarea.displayName = 'Textarea'

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => <select ref={ref} className={classes('ui-select', className)} {...props} />
)
Select.displayName = 'Select'

export function Switch({
  checked,
  onCheckedChange,
  label,
  disabled = false,
}: {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  label: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={classes('ui-switch', checked && 'is-checked')}
    >
      <span className="ui-switch__thumb" />
    </button>
  )
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <section className="ui-empty-state">
      <h2>{title}</h2>
      {description && <p>{description}</p>}
      {action && <div className="ui-empty-state__action">{action}</div>}
    </section>
  )
}

export function Tabs({
  tabs,
  value,
  onChange,
}: {
  tabs: Array<{ id: string; label: string }>
  value: string
  onChange: (id: string) => void
}) {
  return (
    <div className="ui-tabs" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={tab.id === value}
          className={classes('ui-tabs__tab', tab.id === value && 'is-active')}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="ui-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="ui-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="ui-modal__header">
          <h2>{title}</h2>
          <IconButton label="Đóng" onClick={onClose}>
            ×
          </IconButton>
        </header>
        {children}
      </section>
    </div>
  )
}

type BadgeVariant = 'primary' | 'secondary' | 'outline' | 'danger'
export function Badge({
  className,
  variant = 'primary',
  children,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return (
    <span
      className={classes(
        'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium',
        variant === 'primary' && 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300',
        variant === 'secondary' && 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300',
        variant === 'outline' && 'border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300',
        variant === 'danger' && 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300',
        className
      )}
      {...props}
    >
      {children}
    </span>
  )
}
