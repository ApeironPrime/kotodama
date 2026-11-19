import { Button, EmptyState, PageShell } from '../../components/ui'
import PageHeader from '../../components/PageHeader'
import { BookOpen } from 'lucide-react'

export function CoursesPage({ canManageCourses, onManage }: { canManageCourses: boolean; onManage: () => void }) {
  return (
    <PageShell width="wide" className="courses-page-v2">
      <PageHeader
        eyebrow="KHÓA HỌC"
        title="Khám phá khóa học phù hợp với bạn"
        description="Các lộ trình có hướng dẫn đang được chuẩn bị."
        icon={BookOpen}
      />
      <section className="courses-empty">
        <EmptyState
          title="Khóa học sắp ra mắt"
          description="Trong lúc chờ, bạn có thể khám phá Tủ sách tại trang Tra từ."
          action={
            <>
              <a className="ui-button ui-button--secondary" href="/tra-tu?tab=vocabulary">
                Khám phá tủ sách
              </a>
              {canManageCourses && (
                <Button variant="secondary" onClick={onManage}>
                  Quản lý khóa học
                </Button>
              )}
            </>
          }
        />
      </section>
    </PageShell>
  )
}
