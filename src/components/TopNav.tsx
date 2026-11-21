import { useQuery } from '@tanstack/react-query'
import {
  Award,
  BookOpen,
  Clapperboard,
  Flame,
  House,
  Layers,
  LogIn,
  Settings,
  Video,
  type LucideIcon,
} from 'lucide-react'
import { IconButton } from './ui'
import type { Page } from '../types/app'
import { srsApi } from '../features/srs/srsApi'
import { useAuth } from '../features/auth/authContext'

const NAV_TABS: Array<{ id: Page; label: string; mobileLabel?: string; jp: string; icon: LucideIcon; badge?: string }> =
  [
    { id: 'home', label: 'Trang chủ', mobileLabel: 'Trang', jp: '始まり', icon: House },
    { id: 'dictionary', label: 'Từ Điển', mobileLabel: 'Từ điển', jp: '辞書', icon: BookOpen },
    { id: 'review', label: 'Ôn Tập SRS', mobileLabel: 'Ôn tập', jp: '復習', icon: Layers },
    { id: 'jlpt', label: 'Thi JLPT', mobileLabel: 'JLPT', jp: '試験', icon: Award },
    { id: 'anime', label: 'Anime', jp: 'アニメ', icon: Clapperboard },
    { id: 'video', label: 'Video AI', mobileLabel: 'Video', jp: '映像', icon: Video },
  ]

export default function TopNav({
  page,
  navigate,
  isAuthenticated,
  userName,
}: {
  page: Page
  navigate: (page: Page) => void
  isAuthenticated: boolean
  userName?: string | undefined
}) {
  const { user } = useAuth()

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
      <nav className="nav-bar nav-bar--home" aria-label="Điều hướng chính">
        <div className="nav-inner">
          <button
            type="button"
            className="nav-brand"
            aria-label="Kotodama — về trang chủ"
            onClick={() => navigate('home')}
          >
            <span className="nav-brand__mark">
              <img src="/kotodama-logo.png" alt="" />
            </span>
            <span className="nav-brand__wordmark">
              <span>Kotodama</span>
              <small>言霊 · WORDS WITH SOUL</small>
            </span>
          </button>
          <div className="nav-divider" />
          <div className="nav-tabs nav-tabs--desktop">
            {NAV_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`nav-tab${page === tab.id ? ' active' : ''}`}
                aria-label={tab.label}
                aria-current={page === tab.id ? 'page' : undefined}
                onClick={() => navigate(tab.id)}
              >
                <tab.icon aria-hidden="true" size={18} strokeWidth={1.9} />
                <span className="nav-tab__words">
                  <span className="nav-tab__jp" aria-hidden="true">
                    {tab.jp}
                  </span>
                  <span>{tab.label}</span>
                </span>
                {tab.id === 'review' && dueCount > 0 ? (
                  <span className="nav-due-badge" title={`Còn ${dueCount} thẻ cần ôn hôm nay!`}>
                    {dueCount}
                  </span>
                ) : tab.badge ? (
                  <span className="nav-ai-badge">{tab.badge}</span>
                ) : null}
              </button>
            ))}
          </div>
          <div className="nav-actions">
            {isAuthenticated && (
              <>
                <div
                  className={`nav-stat nav-stat--streak${streak > 0 ? ' is-active' : ''}`}
                  title={`Chuỗi học tập liên tục: ${streak} ngày`}
                >
                  <Flame aria-hidden="true" size={17} strokeWidth={2} /> {streak}
                </div>
              </>
            )}
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
              <button type="button" className="nav-login-link" onClick={() => navigate('login')} aria-label="Đăng nhập">
                <LogIn aria-hidden="true" size={15} strokeWidth={1.5} />
                <span>Đăng nhập</span>
              </button>
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
            aria-label={tab.label}
            aria-current={page === tab.id ? 'page' : undefined}
            onClick={() => navigate(tab.id)}
          >
            <tab.icon aria-hidden="true" size={18} strokeWidth={1.9} />
            <span>{tab.mobileLabel || tab.label}</span>
            {tab.id === 'review' && dueCount > 0 ? (
              <i className="nav-mobile__badge">{dueCount}</i>
            ) : tab.badge ? (
              <i>{tab.badge}</i>
            ) : null}
          </button>
        ))}
      </nav>
    </>
  )
}
