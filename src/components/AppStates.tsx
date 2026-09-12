import { Button, EmptyState, PageShell } from './ui'
import type { Page } from '../types/app'

export function PageSkeleton({ label = 'Đang tải nội dung…', compact = false }: { label?: string; compact?: boolean }) {
  return (
    <div className={`app-loading${compact ? ' app-loading--content' : ''}`} role="status" aria-live="polite">
      <div className="app-loading__mark" aria-hidden="true" />
      <div>
        <strong>{label}</strong>
        <span>Vui lòng chờ trong giây lát.</span>
      </div>
    </div>
  )
}

export function NotFoundPage({ onNavigate }: { onNavigate: (page: Page) => void }) {
  return (
    <PageShell width="reading" className="app-state-page">
      <EmptyState
        title="Không tìm thấy trang này"
        description="Đường dẫn có thể đã thay đổi hoặc không còn tồn tại."
        action={<Button onClick={() => onNavigate('home')}>Về trang chủ</Button>}
      />
    </PageShell>
  )
}

export function RetryState({
  title,
  description,
  onRetry,
}: {
  title: string
  description: string
  onRetry: () => void
}) {
  return (
    <section className="retry-state" role="alert">
      <h2>{title}</h2>
      <p>{description}</p>
      <Button variant="secondary" onClick={onRetry}>
        Thử lại
      </Button>
    </section>
  )
}
