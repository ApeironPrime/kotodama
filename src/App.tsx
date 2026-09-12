import { lazy, startTransition, Suspense, useEffect, useRef } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import TopNav from './components/TopNav'
import AppErrorBoundary from './components/AppErrorBoundary'
import { NotFoundPage, PageSkeleton } from './components/AppStates'
import HomePage from './HomePage'
import AccessDeniedPage from './features/auth/AccessDeniedPage'
import { useAuth } from './features/auth/authContext'
import { getPageAccess, hasPermission } from './features/auth/permissions'
import { getPageFromPath, getRoute, PAGE_PATHS, type Page } from './types/app'

const loadVideoLearning = () => import('./VideoLearning')
const loadManagedAuthPage = () => import('./features/auth/AuthPage')
const loadDictionaryPage = () => import('./features/dictionary/DictionaryPage')
const loadJlptPage = () => import('./features/nhaikanji/JlptPage')
const loadAnimePage = () => import('./features/anime/AnimePage')

const VideoLearning = lazy(loadVideoLearning)
const ManagedAuthPage = lazy(loadManagedAuthPage)
const AuthLifecyclePage = lazy(() => import('./features/auth/AuthLifecyclePage'))
const LocalProfilePage = lazy(() => import('./features/account/ProfilePage'))
const AccountSecurityPage = lazy(() => import('./features/account/AccountSecurityPage'))
const AccountAdminPage = lazy(() => import('./features/account/AccountAdminPage'))
const DictionaryPage = lazy(loadDictionaryPage)
const JlptPage = lazy(loadJlptPage)
const AnimePage = lazy(loadAnimePage)
const OnboardingPage = lazy(() => import('./features/learning/OnboardingPage'))
const ReviewPage = lazy(() => import('./features/srs/ReviewPage'))
const SettingsPage = lazy(() => import('./pages/AccountPages').then(({ SettingsPage: Page }) => ({ default: Page })))
const CourseAdminPage = lazy(() =>
  import('./features/learning/CourseAdminPage').then(({ CourseAdminPage: Page }) => ({ default: Page }))
)
const CourseLearningPage = lazy(() =>
  import('./features/learning/CourseLearningPage').then(({ CourseLearningPage: Page }) => ({ default: Page }))
)
const CoursesPage = lazy(() =>
  import('./features/learning/CoursesPage').then(({ CoursesPage: Page }) => ({ default: Page }))
)

export default function App() {
  const location = useLocation()
  const navigate = useNavigate()
  return (
    <AppErrorBoundary resetKey={location.pathname} onGoHome={() => navigate(PAGE_PATHS.home)}>
      <AppContent />
    </AppErrorBoundary>
  )
}

function AppContent() {
  const searchInputRef = useRef<HTMLInputElement>(null)
  const location = useLocation()
  const navigate = useNavigate()
  const { status, user, sessionExpired, signOut } = useAuth()
  const page = getPageFromPath(location.pathname)

  useEffect(() => {
    if (page) {
      document.title = `${getRoute(page).title} · Kotodama`
      window.scrollTo(0, 0)
    }
  }, [page])
  const goTo = (nextPage: Page) => {
    const dictionarySectionUrls: Record<string, string> = {
      vocabulary: `${PAGE_PATHS.dictionary}?tab=vocabulary`,
      bunpo: `${PAGE_PATHS.dictionary}?tab=grammar`,
      kanji: `${PAGE_PATHS.dictionary}?tab=kanji`,
    }
    startTransition(() => {
      navigate(dictionarySectionUrls[nextPage] || PAGE_PATHS[nextPage])
    })
  }
  const isAuthenticated = status === 'authenticated'
  const canRenderBeforeSessionRestore = page === 'home' || page === 'dictionary' || page === 'jlpt' || page === 'anime'
  useEffect(() => {
    // Preload the primary destinations only after the first paint. The initial
    // screen remains fast, while navigation does not wait for a new chunk.
    const preload = () => {
      void loadDictionaryPage()
      void loadJlptPage()
      void loadAnimePage()
      void loadManagedAuthPage()
    }
    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number
      cancelIdleCallback?: (id: number) => void
    }
    if (idleWindow.requestIdleCallback) {
      const id = idleWindow.requestIdleCallback(preload, { timeout: 1200 })
      return () => idleWindow.cancelIdleCallback?.(id)
    }
    const id = window.setTimeout(preload, 250)
    return () => window.clearTimeout(id)
  }, [])
  useEffect(() => {
    const requiresSession = page ? getPageAccess(page, null) === 'login-required' : false
    if (sessionExpired && page && requiresSession)
      navigate(PAGE_PATHS.login, {
        replace: true,
        state: { from: location.pathname, message: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại để tiếp tục.' },
      })
  }, [location.pathname, navigate, page, sessionExpired])

  if (!page)
    return (
      <div className="app-shell">
        <TopNav
          page="home"
          navigate={goTo}
          isAuthenticated={isAuthenticated}
          userName={user?.name}
        />
        <main id="main-content" tabIndex={-1}>
          <NotFoundPage onNavigate={goTo} />
        </main>
      </div>
    )
  if (status === 'loading' && !canRenderBeforeSessionRestore)
    return <PageSkeleton label="Đang khôi phục phiên đăng nhập…" />
  if (page === 'vocabulary') return <Navigate to={`${PAGE_PATHS.dictionary}?tab=vocabulary`} replace />
  if (page === 'bunpo') return <Navigate to={`${PAGE_PATHS.dictionary}?tab=grammar`} replace />
  if (page === 'kanji') return <Navigate to={`${PAGE_PATHS.dictionary}?tab=kanji`} replace />
  const pageAccess = getPageAccess(page, user)
  if (pageAccess === 'login-required')
    return (
      <Navigate
        to={PAGE_PATHS.login}
        replace
        state={{
          from: location.pathname,
          message: sessionExpired ? 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại để tiếp tục.' : undefined,
        }}
      />
    )
  if ((page === 'login' || page === 'register') && status === 'authenticated')
    return <Navigate to={PAGE_PATHS.profile} replace />

  return (
    <div className="app-shell">
      <TopNav
        page={page}
        navigate={goTo}
        isAuthenticated={isAuthenticated}
        userName={user?.name}
      />
      <main id="main-content" tabIndex={-1}>
        <p className="route-announcer" aria-live="polite">
          {getRoute(page).title}
        </p>
        {pageAccess === 'forbidden' ? (
          <AccessDeniedPage onNavigate={goTo} />
        ) : (
          <Suspense fallback={<PageSkeleton label="Đang tải trang…" compact />}>
            {page === 'home' && <HomePage setPage={goTo} isAuthenticated={isAuthenticated} />}
            {page === 'onboarding' && <OnboardingPage onNavigate={goTo} />}
            {page === 'dictionary' && <DictionaryPage inputRef={searchInputRef} onReview={() => goTo('review')} />}
            {page === 'jlpt' && <JlptPage />}
            {page === 'anime' && <AnimePage />}
            {page === 'review' && <ReviewPage onDictionary={() => goTo('dictionary')} />}
            {page === 'video' && <VideoLearning />}
            {page === 'courses' && (
              <CoursesPage
                canManageCourses={hasPermission(user, 'course:manage')}
                onManage={() => goTo('courseAdmin')}
              />
            )}
            {page === 'learning' && <CourseLearningPage onBack={() => goTo('courses')} />}
            {page === 'courseAdmin' && <CourseAdminPage onBack={() => goTo('courses')} />}
            {page === 'accountAdmin' && <AccountAdminPage onNavigate={goTo} />}
            {page === 'profile' && <LocalProfilePage onNavigate={goTo} />}
            {page === 'settings' && <SettingsPage onLogout={() => void signOut()} />}
            {page === 'security' && <AccountSecurityPage onNavigate={goTo} />}
            {page === 'login' && <ManagedAuthPage mode="login" onNavigate={goTo} />}
            {page === 'register' && <ManagedAuthPage mode="register" onNavigate={goTo} />}
            {page === 'forgotPassword' && <AuthLifecyclePage mode="forgotPassword" onNavigate={goTo} />}
            {page === 'resetPassword' && <AuthLifecyclePage mode="resetPassword" onNavigate={goTo} />}
            {page === 'verifyEmail' && <AuthLifecyclePage mode="verifyEmail" onNavigate={goTo} />}
          </Suspense>
        )}
      </main>
    </div>
  )
}
