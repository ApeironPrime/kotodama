import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Award,
  BookOpen,
  Flame,
  GraduationCap,
  House,
  Layers,
  LogIn,
  Search,
  Settings,
  Sparkles,
  Video,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { Button, IconButton } from './ui'
import type { Page } from '../types/app'
import { srsApi } from '../features/srs/srsApi'
import { useAuth } from '../features/auth/authContext'

const NAV_TABS: Array<{ id: Page; label: string; icon: LucideIcon; badge?: string }> = [
  { id: 'home', label: 'Trang chủ', icon: House },
  { id: 'kanji', label: 'Hán Tự', icon: Sparkles },
  { id: 'vocabulary', label: 'Từ Vựng', icon: BookOpen },
  { id: 'bunpo', label: 'Ngữ Pháp', icon: GraduationCap },
  { id: 'dictionary', label: 'Từ Điển', icon: Search },
  { id: 'review', label: 'Ôn Tập SRS', icon: Layers, badge: 'Anki' },
  { id: 'jlpt', label: 'Thi JLPT', icon: Award },
  { id: 'video', label: 'Video AI', icon: Video },
]

export default function TopNav({
  onSearchFocus,
  page,
  navigate,
  isAuthenticated,
  userName,
}: {
  onSearchFocus: () => void
  page: Page
  navigate: (page: Page) => void
  isAuthenticated: boolean
  userName?: string | undefined
}) {
  const { user } = useAuth()
  const [credits] = useState(0)

  const { data: srsStats } = useQuery({
    queryKey: ['srs', user?.id ?? 'me', 'stats', 'global'],
    queryFn: () => srsApi.fetchStats('all'),
    refetchOnMount: 'always',
    enabled: isAuthenticated,
  })

  const streak = srsStats?.streak ?? 0
  const dueCount = srsStats?.dueTodayCount ?? 0

  return (
    <>
      <a className="skip-link" href="#main-content">
        Chuyển đến nội dung chính
      </a>
      <nav className="nav-bar" aria-label="Điều hướng chính">
        <div className="nav-inner">
          <button type="button" className="nav-brand" onClick={() => navigate('home')}>
            <span className="nav-brand__mark">
              <img src="/kotodama-logo.png" alt="" />
            </span>
            <span>Kotodama</span>
          </button>
          <div className="nav-divider" />
          <div className="nav-tabs nav-tabs--desktop">
            {NAV_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`nav-tab${page === tab.id ? ' active' : ''}`}
                aria-current={page === tab.id ? 'page' : undefined}
                onClick={() => navigate(tab.id)}
              >
                <tab.icon aria-hidden="true" size={18} strokeWidth={1.9} />
                {tab.label}
                {tab.id === 'review' && dueCount > 0 ? (
                  <span
                    style={{
                      background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                      color: '#ffffff',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      padding: '1px 6px',
                      borderRadius: '999px',
                      marginLeft: '4px',
                      boxShadow: '0 0 8px rgba(239, 68, 68, 0.4)',
                    }}
                    title={`Còn ${dueCount} thẻ cần ôn hôm nay!`}
                  >
                    {dueCount}
                  </span>
                ) : tab.badge ? (
                  <span className="nav-ai-badge">{tab.badge}</span>
                ) : null}
              </button>
            ))}
          </div>
          {page === 'vocabulary' && (
            <Button variant="secondary" size="sm" className="nav-search-button" onClick={onSearchFocus}>
              Tìm từ
            </Button>
          )}
          <div className="nav-actions">
            <div
              className="nav-stat nav-stat--streak"
              title={`Chuỗi học tập liên tục: ${streak} ngày`}
              style={{
                color: streak > 0 ? '#f59e0b' : 'inherit',
                fontWeight: streak > 0 ? 800 : 600,
              }}
            >
              <Flame
                aria-hidden="true"
                size={17}
                strokeWidth={2}
                style={{ color: streak > 0 ? '#f59e0b' : undefined }}
              />{' '}
              {streak}
            </div>
            <div className="nav-stat nav-stat--credits">
              <Zap aria-hidden="true" size={17} strokeWidth={2} /> {credits}
            </div>
            {isAuthenticated ? (
              <>
                <IconButton label="Cài đặt" onClick={() => navigate('settings')}>
                  <Settings aria-hidden="true" size={18} strokeWidth={1.9} />
                </IconButton>
                <IconButton label="Hồ sơ" className="nav-profile-button" onClick={() => navigate('profile')}>
                  {userName?.trim().slice(0, 1).toUpperCase() || 'K'}
                </IconButton>
              </>
            ) : (
              <Button size="sm" onClick={() => navigate('login')}>
                <LogIn aria-hidden="true" size={17} strokeWidth={2} />
                Đăng nhập
              </Button>
            )}
          </div>
        </div>
      </nav>
      <nav className="nav-mobile" aria-label="Điều hướng chính trên điện thoại">
        {NAV_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`nav-mobile__item${page === tab.id ? ' is-active' : ''}`}
            aria-current={page === tab.id ? 'page' : undefined}
            onClick={() => navigate(tab.id)}
          >
            <tab.icon aria-hidden="true" size={18} strokeWidth={1.9} />
            <span>{tab.label}</span>
            {tab.id === 'review' && dueCount > 0 ? (
              <i style={{ background: '#ef4444', color: '#fff', padding: '1px 5px', borderRadius: '999px' }}>
                {dueCount}
              </i>
            ) : tab.badge ? (
              <i>{tab.badge}</i>
            ) : null}
          </button>
        ))}
      </nav>
    </>
  )
}
