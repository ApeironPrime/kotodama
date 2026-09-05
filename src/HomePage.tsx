import { Button } from './components/ui'
import { LEARNING_LANGUAGES, LEARNING_LEVELS, useLearningPlan } from './features/learning/learningPlan'
import type { Page } from './types/app'
import {
  ArrowRight,
  BookOpen,
  CircleDashed,
  GraduationCap,
  Languages,
  LogIn,
  Sparkles,
  Video,
  Zap,
  type LucideIcon,
} from 'lucide-react'

export default function HomePage({
  setPage,
  isAuthenticated,
}: {
  setPage: (page: Page) => void
  isAuthenticated: boolean
}) {
  const [plan] = useLearningPlan()
  const visiblePlan = isAuthenticated ? plan : null
  const language = visiblePlan ? LEARNING_LANGUAGES[visiblePlan.language] : null
  const ctaPage: Page = isAuthenticated ? (visiblePlan ? 'vocabulary' : 'onboarding') : 'login'

  return (
    <div className="showcase-home">
      <section className="showcase-hero">
        <div className="showcase-hero__orb showcase-hero__orb--rose" />
        <div className="showcase-hero__orb showcase-hero__orb--blue" />
        <div className="showcase-shell showcase-hero__grid">
          <div className="showcase-hero__copy">
            <p className="showcase-kicker">
              <i /> TRUNG TÂM NGÔN NGỮ AI
            </p>
            <h1>
              Học ngôn ngữ mới. <span>Mở ra thế giới mới.</span>
            </h1>
            <p className="showcase-hero__description">
              Tra từ sâu hơn, học qua video thực tế và xây dựng lộ trình phù hợp với mục tiêu của bạn.
            </p>
            <div className="showcase-hero__actions">
              <Button size="lg" onClick={() => setPage(ctaPage)}>
                <Zap aria-hidden="true" size={17} />{' '}
                {visiblePlan && language ? `Tiếp tục học ${language.label}` : 'Đăng nhập để bắt đầu'}
              </Button>
              <Button variant="secondary" size="lg" onClick={() => setPage('video')}>
                <Video aria-hidden="true" size={17} /> Khám phá Video AI
              </Button>
            </div>
          </div>
          <LearningPanel plan={visiblePlan} setPage={setPage} isAuthenticated={isAuthenticated} />
        </div>
      </section>

      <div className="showcase-shell showcase-content">
        <section className="showcase-section">
          <SectionHeader
            title="Lộ trình của bạn"
            description="Dữ liệu học tập sẽ được hiển thị tại đây sau khi bạn hoàn tất thiết lập."
            action={isAuthenticated ? (visiblePlan ? 'Mở lộ trình' : 'Thiết lập lộ trình') : 'Đăng nhập'}
            onClick={() => setPage(isAuthenticated ? (visiblePlan ? 'vocabulary' : 'onboarding') : 'login')}
          />
          <div className="showcase-empty-grid">
            <EmptyState
              icon={Languages}
              title={visiblePlan && language ? language.label : 'Chưa chọn ngôn ngữ'}
              description={
                visiblePlan && language
                  ? `Trình độ ${LEARNING_LEVELS[visiblePlan.level]} · ${visiblePlan.dailyMinutes} phút mỗi ngày`
                  : isAuthenticated
                    ? 'Tiếng Nhật đang là lộ trình duy nhất được mở trong giai đoạn hiện tại.'
                    : 'Đăng nhập để tạo và xem lộ trình học của riêng bạn.'
              }
              action={isAuthenticated ? (visiblePlan ? 'Đi tới bài học' : 'Tạo lộ trình tiếng Nhật') : 'Đăng nhập'}
              onClick={() => setPage(isAuthenticated ? (visiblePlan ? 'vocabulary' : 'onboarding') : 'login')}
            />
            <EmptyState
              icon={BookOpen}
              title="Tiến độ học"
              description="Hoạt động, từ vựng và mốc thành tích sẽ xuất hiện từ dữ liệu học thực tế của bạn."
              action="Ôn tập SRS"
              onClick={() => setPage('review')}
            />
          </div>
        </section>

        <section className="showcase-section">
          <SectionHeader
            title="Khóa học"
            description="Nội dung khóa học được kết nối từ hệ thống dữ liệu khi backend sẵn sàng."
            action="Mở khóa học"
            onClick={() => setPage('courses')}
          />
          <div className="showcase-empty-course">
            <Sparkles aria-hidden="true" size={22} />
            <div>
              <h2>Danh sách khóa học đang chờ dữ liệu</h2>
              <p>Khung giao diện đã sẵn sàng; chưa có khóa học minh họa hoặc dữ liệu giả được thêm vào.</p>
            </div>
            <Button variant="secondary" onClick={() => setPage('courses')}>
              Xem khóa học <ArrowRight aria-hidden="true" size={16} />
            </Button>
          </div>
        </section>

        <section className="showcase-section showcase-section--tools">
          <div className="showcase-tool-grid">
            <FeatureCard
              icon={Sparkles}
              title="Kho Hán Tự (Kanji)"
              description="2500+ Chữ Hán phân loại N5→N1 với Âm Hán-Việt, câu chuyện chiết tự và luyện viết nét."
              action="Học Hán Tự"
              tone="rose"
              onClick={() => setPage('kanji')}
            />
            <FeatureCard
              icon={BookOpen}
              title="Kho Ngữ Pháp (Bunpo)"
              description="Mẫu câu và cấu trúc N5→N1 chuẩn giáo trình Minna no Nihongo & Somatome."
              action="Xem ngữ pháp"
              tone="blue"
              onClick={() => setPage('bunpo')}
            />
            <FeatureCard
              icon={GraduationCap}
              title="Luyện Thi JLPT"
              description="Ngân hàng đề thi trắc nghiệm bấm giờ, chấm điểm và xem giải thích chi tiết."
              action="Luyện thi ngay"
              tone="violet"
              onClick={() => setPage('jlpt')}
            />
            <FeatureCard
              icon={Video}
              title="Học qua Video AI"
              description="Học trực tiếp từ video với phụ đề Furigana tương tác và luyện Shadowing ASR."
              action="Mở Video AI"
              tone="blue"
              onClick={() => setPage('video')}
            />
            <FeatureCard
              icon={Zap}
              title="Tra Từ Điển & SRS"
              description="Tra cứu từ vựng sâu, lưu thẻ nhớ và ôn tập lặp lại ngắt quãng thông minh."
              action="Tra từ ngay"
              tone="rose"
              onClick={() => setPage('vocabulary')}
            />
          </div>
        </section>
      </div>
    </div>
  )
}

function LearningPanel({
  plan,
  setPage,
  isAuthenticated,
}: {
  plan: ReturnType<typeof useLearningPlan>[0]
  setPage: (page: Page) => void
  isAuthenticated: boolean
}) {
  const language = plan ? LEARNING_LANGUAGES[plan.language] : null
  return (
    <aside className="showcase-learning" aria-label="Tóm tắt lộ trình học">
      <p className="showcase-kicker">LỘ TRÌNH CỦA BẠN</p>
      <article className="showcase-active showcase-active--rose showcase-active--empty">
        <div className="showcase-active__head">
          <span className="showcase-active__code">
            <Languages aria-hidden="true" size={20} />
          </span>
          <div>
            <strong>{language?.label ?? 'Sẵn sàng bắt đầu?'}</strong>
            <small>
              {plan
                ? `Trình độ ${LEARNING_LEVELS[plan.level]}`
                : isAuthenticated
                  ? 'Thiết lập mục tiêu học của bạn'
                  : 'Đăng nhập để mở lộ trình'}
            </small>
          </div>
        </div>
        <p className="showcase-active__empty-copy">
          {plan
            ? `Lộ trình ${language?.native ?? ''} đang chờ dữ liệu tiến độ thực tế.`
            : isAuthenticated
              ? 'Tiếng Nhật đang là lộ trình duy nhất được mở trong giai đoạn hiện tại.'
              : 'Đăng nhập để tạo và lưu lộ trình học của bạn.'}
        </p>
        <div className="showcase-active__actions">
          <Button onClick={() => setPage(isAuthenticated ? (plan ? 'vocabulary' : 'onboarding') : 'login')}>
            {plan ? (
              <>
                <BookOpen aria-hidden="true" size={16} /> Vào bài học
              </>
            ) : isAuthenticated ? (
              <>
                <Zap aria-hidden="true" size={16} /> Thiết lập ngay
              </>
            ) : (
              <>
                <LogIn aria-hidden="true" size={16} /> Đăng nhập
              </>
            )}
          </Button>
          <Button variant="secondary" onClick={() => setPage('review')}>
            Ôn tập SRS
          </Button>
        </div>
      </article>
      <div className="showcase-streak showcase-streak--empty">
        <CircleDashed aria-hidden="true" size={23} />
        <div>
          <strong>Chuỗi học sẽ xuất hiện tại đây</strong>
          <small>Không sử dụng số liệu minh họa</small>
        </div>
      </div>
    </aside>
  )
}

function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  onClick,
}: {
  icon: LucideIcon
  title: string
  description: string
  action: string
  onClick: () => void
}) {
  return (
    <article className="showcase-empty-card">
      <span>
        <Icon aria-hidden="true" size={21} />
      </span>
      <h2>{title}</h2>
      <p>{description}</p>
      <Button variant="ghost" size="sm" onClick={onClick}>
        {action} <ArrowRight aria-hidden="true" size={15} />
      </Button>
    </article>
  )
}

function FeatureCard({
  icon: Icon,
  title,
  description,
  action,
  tone,
  onClick,
}: {
  icon: LucideIcon
  title: string
  description: string
  action: string
  tone: 'rose' | 'blue' | 'violet'
  onClick: () => void
}) {
  return (
    <article className={`showcase-tool showcase-tool--${tone}`}>
      <span>
        <Icon aria-hidden="true" size={28} />
      </span>
      <h2>{title}</h2>
      <p>{description}</p>
      <Button variant="ghost" size="sm" onClick={onClick}>
        {action} <ArrowRight aria-hidden="true" size={15} />
      </Button>
    </article>
  )
}

function SectionHeader({
  title,
  description,
  action,
  onClick,
}: {
  title: string
  description: string
  action: string
  onClick: () => void
}) {
  return (
    <header className="showcase-section__header">
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <Button variant="secondary" onClick={onClick}>
        {action} <ArrowRight aria-hidden="true" size={15} />
      </Button>
    </header>
  )
}
