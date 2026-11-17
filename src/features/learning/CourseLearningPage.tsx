import { Button, EmptyState, PageShell } from '../../components/ui'
import { ArrowLeft } from 'lucide-react'

export function CourseLearningPage({ onBack }: { onBack: () => void }) {
  return (
    <PageShell width="reading" className="learning-page">
      <Button variant="ghost" size="sm" onClick={onBack}>
        <ArrowLeft aria-hidden="true" size={16} /> Tất cả lộ trình
      </Button>
      <EmptyState
        title="Bài học đang được chuẩn bị"
        description="Bạn có thể học ngay với Từ điển, Tủ sách và ôn tập SRS."
      />
    </PageShell>
  )
}
