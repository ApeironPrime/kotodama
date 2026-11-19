import { useRef, type ReactNode } from 'react'
import { useDialogAccessibility } from '../lib/useDialogAccessibility'
import { Button } from './ui'

export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  cancelLabel = 'Tiếp tục làm bài',
  busy = false,
  onCancel,
  onConfirm,
}: {
  title: string
  children: ReactNode
  confirmLabel: string
  cancelLabel?: string
  busy?: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const panel = useRef<HTMLDivElement>(null)
  useDialogAccessibility(panel, () => {
    if (!busy) onCancel()
  })
  return (
    <div className="confirm-dialog-backdrop">
      <div ref={panel} tabIndex={-1} className="confirm-dialog" role="dialog" aria-modal="true" aria-label={title}>
        <h2>{title}</h2>
        {children}
        <div className="confirm-dialog__actions">
          <Button variant="secondary" disabled={busy} onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button disabled={busy} onClick={onConfirm}>
            {busy ? 'Đang nộp bài…' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
