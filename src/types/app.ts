export type Page =
  | 'home'
  | 'onboarding'
  | 'vocabulary'
  | 'bunpo'
  | 'dictionary'
  | 'kanji'
  | 'jlpt'
  | 'review'
  | 'video'
  | 'courses'
  | 'learning'
  | 'courseAdmin'
  | 'accountAdmin'
  | 'profile'
  | 'settings'
  | 'security'
  | 'login'
  | 'register'
  | 'forgotPassword'
  | 'resetPassword'
  | 'verifyEmail'

export type Course = {
  id: string
  title: string
  language: string
  level: string
  description: string
}

export type AppRoute = { page: Page; path: string; title: string }

export const APP_ROUTES: readonly AppRoute[] = [
  { page: 'home', path: '/', title: 'Học ngôn ngữ cùng AI' },
  { page: 'onboarding', path: '/bat-dau', title: 'Tạo lộ trình học' },
  { page: 'vocabulary', path: '/tu-vung', title: 'Từ vựng N5-N1' },
  { page: 'bunpo', path: '/bunpo', title: 'Ngữ pháp N5-N1' },
  { page: 'dictionary', path: '/tra-tu', title: 'Tra từ điển tiếng Nhật' },
  { page: 'kanji', path: '/kanji', title: 'Hán tự & Chiết tự' },
  { page: 'jlpt', path: '/jlpt', title: 'Luyện thi JLPT' },
  { page: 'review', path: '/on-tap', title: 'Ôn tập SRS' },
  { page: 'video', path: '/video-ai', title: 'Video AI' },
  { page: 'courses', path: '/khoa-hoc', title: 'Khóa học' },
  { page: 'learning', path: '/hoc', title: 'Học bài' },
  { page: 'courseAdmin', path: '/quan-tri/khoa-hoc', title: 'Quản lý khóa học' },
  { page: 'accountAdmin', path: '/quan-tri/tai-khoan', title: 'Quản trị tài khoản' },
  { page: 'profile', path: '/ho-so', title: 'Hồ sơ' },
  { page: 'settings', path: '/cai-dat', title: 'Cài đặt' },
  { page: 'security', path: '/bao-mat-tai-khoan', title: 'Bảo mật tài khoản' },
  { page: 'login', path: '/dang-nhap', title: 'Đăng nhập' },
  { page: 'register', path: '/dang-ky', title: 'Đăng ký' },
  { page: 'forgotPassword', path: '/quen-mat-khau', title: 'Khôi phục mật khẩu' },
  { page: 'resetPassword', path: '/dat-lai-mat-khau', title: 'Đặt lại mật khẩu' },
  { page: 'verifyEmail', path: '/xac-minh-email', title: 'Xác minh email' },
]

export const PAGE_PATHS = Object.fromEntries(APP_ROUTES.map((route) => [route.page, route.path])) as Record<
  Page,
  string
>

export const PATH_PAGES = Object.fromEntries(
  Object.entries(PAGE_PATHS).map(([page, path]) => [path, page as Page])
) as Record<string, Page>

export function getPageFromPath(pathname: string): Page | undefined {
  const normalizedPath = pathname.replace(/\/+$/, '') || '/'
  return PATH_PAGES[normalizedPath]
}

export function getRoute(page: Page): AppRoute {
  const route = APP_ROUTES.find((item) => item.page === page)
  if (!route) throw new Error(`Không tìm thấy route cho trang: ${page}`)
  return route
}
