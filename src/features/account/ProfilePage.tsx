import { useQuery } from '@tanstack/react-query'
import { Button, Card, EmptyState, PageShell } from '../../components/ui'
import type { Page } from '../../types/app'
import { useAuth } from '../auth/authContext'
import { srsApi } from '../srs/srsApi'

export default function LocalProfilePage({ onNavigate }: { onNavigate: (page: Page) => void }) {
  const { user } = useAuth()
  const stats = useQuery({
    queryKey: ['srs', user?.id, 'stats', 'profile'],
    queryFn: () => srsApi.fetchStats('all'),
    enabled: Boolean(user),
  })
  const activity = (stats.data?.heatmap ?? [])
    .filter((day) => day.count > 0)
    .sort((a, b) => b.date.localeCompare(a.date))
  return (
    <PageShell width="wide" className="profile-page">
      <header className="page-header">
        <h1>Hành trình của {user?.name || 'bạn'}</h1>
        <p>Theo dõi kho thẻ và những lần ôn tập đã ghi nhận.</p>
      </header>
      {stats.isLoading && <p role="status">Đang tải tiến độ của bạn…</p>}
      {stats.isError && (
        <Card padding="md">
          <p role="alert">Chưa tải được tiến độ. Hãy kiểm tra kết nối và thử lại.</p>
          <Button onClick={() => void stats.refetch()}>Thử lại</Button>
        </Card>
      )}
      {stats.data && (
        <>
          <div className="profile-stat-grid">
            <Stat value={stats.data.totalCards} label="Thẻ đã lưu" />
            <Stat value={stats.data.masteredCount} label="Thẻ thành thạo" />
            <Stat value={stats.data.dueTodayCount} label="Thẻ đến hạn" />
            <Stat value={stats.data.streak ?? '—'} label="Chuỗi ngày ôn tập" />
          </div>
          <Card padding="lg">
            <h2>Ôn tập hôm nay</h2>
            <p>
              {stats.data.dueTodayCount > 0
                ? `Bạn có ${stats.data.dueTodayCount} thẻ đến hạn.`
                : 'Bạn đã xem hết thẻ đến hạn. Có thể học thêm từ mới hoặc ôn lại kho thẻ.'}
            </p>
            <Button onClick={() => onNavigate('review')}>Mở thẻ ôn tập</Button>
          </Card>
          <Card padding="lg">
            <h2>Hoạt động gần đây</h2>
            {activity.length ? (
              <ul className="profile-activity-list">
                {activity.slice(0, 14).map((day) => (
                  <li key={day.date}>
                    <time dateTime={day.date}>{new Date(`${day.date}T12:00:00`).toLocaleDateString('vi-VN')}</time> ·{' '}
                    {day.count} lượt ôn tập
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                title="Bắt đầu lần ôn tập đầu tiên"
                description="Những lần ôn tập hoàn thành sẽ được ghi lại tại đây."
              />
            )}
          </Card>
        </>
      )}
      <Card padding="lg">
        <h2>Tài khoản của bạn</h2>
        <p>{user?.email}</p>
        {user && !user.emailVerified && (
          <Button variant="secondary" onClick={() => onNavigate('verifyEmail')}>
            Xác minh email
          </Button>
        )}{' '}
        <Button variant="secondary" onClick={() => onNavigate('security')}>
          Bảo mật tài khoản
        </Button>{' '}
        <Button variant="secondary" onClick={() => onNavigate('onboarding')}>
          Điều chỉnh lộ trình
        </Button>
      </Card>
    </PageShell>
  )
}
function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="profile-stat">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  )
}
