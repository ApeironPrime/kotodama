import { Button } from './components/ui'
import HomeInkCanvas from './components/HomeInkCanvas'
import HomeStory from './components/HomeStory'
import HeroCreativeWebGL from './components/HeroCreativeWebGL'
import { useHomeSmoothScroll } from './components/useHomeSmoothScroll'
import { useInkSound } from './components/useInkSound'
import { sumiAudio } from './features/dictionary/sumiAudio'
import 'lenis/dist/lenis.css'
import { LEARNING_LANGUAGES, LEARNING_LEVELS, useLearningPlan } from './features/learning/learningPlan'
import type { Page } from './types/app'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  GraduationCap,
  Sparkles,
  Video,
  Volume2,
  VolumeX,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'
const HERO_VIDEO = '/assets/kotodama-ink-journey.mp4'
const HERO_POSTER = '/assets/ink-journey-poster.jpg'
const HERO_START_FRAME = '/assets/ink-journey-start.jpg'

const COURSE_PREVIEWS = [
  {
    number: '01',
    title: 'Nét chữ đầu tiên',
    japanese: 'はじめの一筆',
    level: 'N5 · Nhập môn',
    description: 'Từ âm thanh đầu tiên đến những lời chào thân thuộc.',
    chapter: 3,
    total: 12,
    scene: 'mountain',
    cover: '/assets/artbook-first-stroke.svg',
  },
  {
    number: '02',
    title: 'Chuyện thường ngày',
    japanese: '日々のことば',
    level: 'N4 · Hội thoại',
    description: 'Để mỗi cuộc gặp gỡ trở thành một dịp dùng tiếng Nhật.',
    chapter: 7,
    total: 16,
    scene: 'bridge',
    cover: '/assets/artbook-everyday.svg',
  },
  {
    number: '03',
    title: 'Đọc giữa những dòng',
    japanese: '読むたびに',
    level: 'N3 · Đọc hiểu',
    description: 'Đi sâu hơn vào câu chữ, sắc thái và câu chuyện.',
    chapter: 2,
    total: 18,
    scene: 'temple',
    cover: '/assets/artbook-between-lines.svg',
  },
] as const

export default function HomePage({
  setPage,
  isAuthenticated,
  userName,
}: {
  setPage: (page: Page) => void
  isAuthenticated: boolean
  userName?: string | undefined
}) {
  const [plan] = useLearningPlan()
  const homeRef = useRef<HTMLDivElement>(null)
  const heroRef = useRef<HTMLElement>(null)
  const galleryRef = useRef<HTMLDivElement>(null)
  const sound = useInkSound()
  useHomeSmoothScroll()
  const visiblePlan = isAuthenticated ? plan : null
  const language = visiblePlan ? LEARNING_LANGUAGES[visiblePlan.language] : null
  const ctaPage: Page = isAuthenticated ? (visiblePlan ? 'vocabulary' : 'onboarding') : 'login'
  const firstName = userName?.trim().split(/\s+/).at(-1)

  useLayoutEffect(() => {
    if (galleryRef.current) galleryRef.current.scrollLeft = 0
  }, [])

  useEffect(() => {
    const home = homeRef.current
    const hero = heroRef.current
    if (!home || !hero || !window.matchMedia) return
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (reducedMotion.matches) return

    const reveals = home.querySelectorAll<HTMLElement>('[data-reveal]')
    const observer =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver(
            (entries) => {
              for (const entry of entries) {
                if (entry.isIntersecting) {
                  entry.target.classList.add('is-visible')
                  observer?.unobserve(entry.target)
                }
              }
            },
            { threshold: 0.12, rootMargin: '0px 0px -5% 0px' }
          )
    if (observer) {
      home.classList.add('motion-ready')
      reveals.forEach((element) => observer.observe(element))
    }

    let frame = 0
    const updateScroll = () => {
      frame = 0
      const progress = Math.min(1, Math.max(0, -hero.getBoundingClientRect().top / (hero.offsetHeight * 0.8)))
      hero.style.setProperty('--hero-copy-opacity', String(1 - progress * 0.48))
      hero.style.setProperty('--hero-copy-rise', `${Math.round(progress * -34)}px`)
      hero.style.setProperty('--hero-depth-scroll', `${Math.round(progress * 36)}px`)
      if (sound.enabled) {
        sumiAudio.playBrushFriction()
      }
    }
    const requestScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(updateScroll)
    }
    const updatePointer = (event: PointerEvent) => {
      hero.style.setProperty('--hero-pointer-x', `${((event.clientX / window.innerWidth - 0.5) * 46).toFixed(2)}px`)
      hero.style.setProperty('--hero-pointer-y', `${((event.clientY / window.innerHeight - 0.5) * 26).toFixed(2)}px`)
      hero.style.setProperty('--hero-pointer-nx', (event.clientX / window.innerWidth - 0.5).toFixed(3))
      hero.style.setProperty('--hero-pointer-ny', (event.clientY / window.innerHeight - 0.5).toFixed(3))
    }
    const resetPointer = () => {
      hero.style.setProperty('--hero-pointer-x', '0px')
      hero.style.setProperty('--hero-pointer-y', '0px')
      hero.style.setProperty('--hero-pointer-nx', '0')
      hero.style.setProperty('--hero-pointer-ny', '0')
    }
    updateScroll()
    window.addEventListener('scroll', requestScroll, { passive: true })
    window.addEventListener('resize', requestScroll)
    hero.addEventListener('pointermove', updatePointer)
    hero.addEventListener('pointerleave', resetPointer)
    return () => {
      observer?.disconnect()
      window.removeEventListener('scroll', requestScroll)
      window.removeEventListener('resize', requestScroll)
      hero.removeEventListener('pointermove', updatePointer)
      hero.removeEventListener('pointerleave', resetPointer)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <div className="showcase-home" ref={homeRef}>
      <section className="showcase-hero" ref={heroRef}>
        <div className="showcase-hero__landscape" aria-hidden="true">
          <HeroCreativeWebGL imageSrc={HERO_POSTER} videoSrc={HERO_VIDEO} />
        </div>
        <div className="showcase-hero__veil" aria-hidden="true" />
        <HomeInkCanvas />
        <div className="showcase-hero__paper-grain" aria-hidden="true" />
        <span className="showcase-hero__margin-note" aria-hidden="true">
          言葉に、心を。 / KOTODAMA
        </span>
        <div className="showcase-shell showcase-hero__grid">
          <div className="showcase-hero__copy">
            <p className="showcase-kicker">
              <i /> {isAuthenticated ? `CHÀO ${firstName ?? 'BẠN'}` : 'KOTODAMA'} <span>言霊</span>
            </p>
            <h1>
              Mỗi ngôn từ <span>mở một thế giới.</span>
            </h1>
            <figure className="showcase-hero__mobile-art">
              <img src={HERO_POSTER} alt="Người lữ hành đi qua cầu giữa phong cảnh núi Phú Sĩ vẽ theo lối thủy mặc" />
              <ArtworkVideo mobile />
            </figure>
            <p className="showcase-hero__description">
              Tra từ sâu hơn, học qua video thực tế và xây dựng lộ trình phù hợp với mục tiêu của bạn.
            </p>
            <div className="showcase-hero__actions">
              <Button size="lg" onClick={() => setPage(ctaPage)}>
                <Zap aria-hidden="true" size={17} />{' '}
                {visiblePlan && language
                  ? `Tiếp tục học ${language.label}`
                  : isAuthenticated
                    ? 'Tạo lộ trình của bạn'
                    : 'Đăng nhập để bắt đầu'}
              </Button>
              <Button variant="secondary" size="lg" onClick={() => setPage('video')}>
                <Video aria-hidden="true" size={17} /> Khám phá Video AI
              </Button>
            </div>
          </div>
        </div>
        <a className="showcase-hero__scroll" href="#story">
          <span className="showcase-hero__scroll-line" aria-hidden="true" />
          Cuộn để khám phá
        </a>
        <span className="showcase-hero__folio" aria-hidden="true">
          第一章 <b>—</b> 01 / 03
        </span>
      </section>

      <HomeStory />

      <div id="discover" className="showcase-shell showcase-content">
        <section className="showcase-section showcase-section--journey">
          <SectionHeader
            ordinal="01  /  学びの道"
            title="Lộ trình của bạn"
            description="Bắt đầu từ một nét chữ, tiến từng bước theo nhịp của riêng bạn."
            action={isAuthenticated ? (visiblePlan ? 'Tiếp tục học' : 'Tạo lộ trình') : 'Bắt đầu hành trình'}
            onClick={() => setPage(isAuthenticated ? (visiblePlan ? 'vocabulary' : 'onboarding') : 'login')}
          />
          <div className="showcase-journey">
            <div className="showcase-journey__lead" data-reveal>
              <span className="showcase-journey__glyph" aria-hidden="true">
                道
              </span>
              <p>
                {visiblePlan && language
                  ? `${language.label} · ${LEARNING_LEVELS[visiblePlan.level]} · ${visiblePlan.dailyMinutes} phút mỗi ngày`
                  : 'Một hành trình không cần vội. Mỗi ngày thêm một âm, một nét, một điều mới hiểu.'}
              </p>
              <span className="showcase-journey__signature" aria-hidden="true">
                一歩ずつ · từng bước một
              </span>
            </div>
            <ol className="showcase-journey__steps">
              <li data-reveal>
                <span>一 / 01</span>
                <div>
                  <h3>Chọn đích đến</h3>
                  <p>Đặt mục tiêu và nhịp học vừa với cuộc sống của bạn.</p>
                </div>
              </li>
              <li data-reveal>
                <span>二 / 02</span>
                <div>
                  <h3>Học trong ngữ cảnh</h3>
                  <p>Gặp từ mới qua câu chuyện, hình ảnh và video thực tế.</p>
                </div>
              </li>
              <li data-reveal>
                <span>三 / 03</span>
                <div>
                  <h3>Ghi nhớ theo nhịp</h3>
                  <p>Trở lại đúng lúc với những điều bạn muốn nhớ lâu.</p>
                </div>
              </li>
            </ol>
          </div>
        </section>

        <section className="showcase-section showcase-section--courses">
          <SectionHeader
            ordinal="02  /  学びの書"
            title="Những trang đầu"
            description="Ba hành trình mẫu để bạn hình dung con đường học tiếng Nhật của mình."
            action="Khám phá khóa học"
            onClick={() => setPage('courses')}
          />
          <div className="showcase-course-gallery__sound">
            <button
              type="button"
              aria-pressed={sound.enabled}
              onClick={() => {
                sound.toggle()
                sumiAudio.toggleMute()
                if (!sound.enabled) {
                  sumiAudio.playSuikinkutsu()
                }
              }}
            >
              {sound.enabled ? <Volume2 aria-hidden="true" size={16} /> : <VolumeX aria-hidden="true" size={16} />}
              Âm giấy {sound.enabled ? 'đang bật' : 'đang tắt'}
            </button>
          </div>
          <div className="showcase-course-gallery" data-reveal>
            {COURSE_PREVIEWS.map((course) => (
              <article
                className={`showcase-course-plate showcase-course-plate--${course.scene}`}
                key={course.number}
                onPointerEnter={() => {
                  sound.play()
                  sumiAudio.playSuikinkutsu()
                }}
                onFocus={() => {
                  sound.play()
                  sumiAudio.playSuikinkutsu()
                }}
              >
                <div className="showcase-course-plate__cover">
                  <img src={course.cover} alt="" loading="lazy" />
                  <span className="showcase-course-plate__number">VOL. {course.number}</span>
                  <span className="showcase-course-plate__japanese" aria-hidden="true">
                    {course.japanese}
                  </span>
                </div>
                <div className="showcase-course-plate__caption">
                  <span className="showcase-course-plate__level">{course.level}</span>
                  <h3>{course.title}</h3>
                  <p>{course.description}</p>
                  <div className="showcase-course-plate__progress-copy">
                    <span>Nhịp học minh họa</span>
                    <span>
                      {course.chapter} / {course.total} chặng
                    </span>
                  </div>
                  <div className="showcase-course-plate__progress">
                    <progress
                      value={course.chapter}
                      max={course.total}
                      aria-label={`Tiến độ minh họa: ${course.chapter} trên ${course.total} chặng`}
                    />
                    <span
                      className="showcase-course-plate__brush"
                      aria-hidden="true"
                      style={{ width: `${(course.chapter / course.total) * 100}%` }}
                    />
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setPage('courses')}>
                    Xem hành trình <ArrowRight aria-hidden="true" size={15} />
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="showcase-section showcase-section--tools">
          <header className="showcase-gallery-heading" data-reveal>
            <div>
              <p className="showcase-section__ordinal" aria-hidden="true">
                03 / 探索
              </p>
              <h2>Năm lối vào, một hành trình.</h2>
              <p>Đi theo điều khiến bạn tò mò hôm nay.</p>
            </div>
            <div className="showcase-gallery-controls">
              <button
                type="button"
                aria-label="Xem tính năng trước"
                onClick={() => galleryRef.current?.scrollBy({ left: -340, behavior: 'smooth' })}
              >
                <ArrowLeft aria-hidden="true" size={20} />
              </button>
              <button
                type="button"
                aria-label="Xem tính năng tiếp theo"
                onClick={() => galleryRef.current?.scrollBy({ left: 340, behavior: 'smooth' })}
              >
                <ArrowRight aria-hidden="true" size={20} />
              </button>
            </div>
          </header>
          <div className="showcase-tool-grid" ref={galleryRef} data-reveal>
            <FeatureCard
              decorativeGlyph="書"
              icon={Sparkles}
              number="01"
              title="Kho Hán Tự (Kanji)"
              description="2500+ Chữ Hán phân loại N5→N1 với Âm Hán-Việt, câu chuyện chiết tự và luyện viết nét."
              action="Học Hán Tự"
              onClick={() => setPage('kanji')}
            />
            <FeatureCard
              decorativeGlyph="文"
              icon={BookOpen}
              number="02"
              title="Kho Ngữ Pháp (Bunpo)"
              description="Mẫu câu và cấu trúc N5→N1 chuẩn giáo trình Minna no Nihongo & Somatome."
              action="Xem ngữ pháp"
              onClick={() => setPage('bunpo')}
            />
            <FeatureCard
              decorativeGlyph="試"
              icon={GraduationCap}
              number="03"
              title="Luyện Thi JLPT"
              description="Ngân hàng đề thi trắc nghiệm bấm giờ, chấm điểm và xem giải thích chi tiết."
              action="Luyện thi ngay"
              onClick={() => setPage('jlpt')}
            />
            <FeatureCard
              decorativeGlyph="映"
              icon={Video}
              number="04"
              title="Học qua Video AI"
              description="Học trực tiếp từ video với phụ đề Furigana tương tác và luyện Shadowing ASR."
              action="Mở Video AI"
              onClick={() => setPage('video')}
            />
            <FeatureCard
              decorativeGlyph="辞"
              icon={Zap}
              number="05"
              title="Tra Từ Điển & SRS"
              description="Tra cứu từ vựng sâu, lưu thẻ nhớ và ôn tập lặp lại ngắt quãng thông minh."
              action="Tra từ ngay"
              onClick={() => setPage('vocabulary')}
            />
          </div>
        </section>
      </div>
    </div>
  )
}

function ArtworkVideo({ mobile }: { mobile: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video || !window.matchMedia) return

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const mobileLayout = window.matchMedia('(max-width: 600px)')
    let inView = true

    const syncPlayback = () => {
      const layoutVisible = mobile ? mobileLayout.matches : !mobileLayout.matches
      if (layoutVisible && !reducedMotion.matches && !document.hidden && inView) {
        void video.play().catch(() => undefined)
      } else {
        video.pause()
      }
    }

    const observer =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver(([entry]) => {
            inView = entry?.isIntersecting ?? false
            syncPlayback()
          })
    observer?.observe(video)
    reducedMotion.addEventListener('change', syncPlayback)
    mobileLayout.addEventListener('change', syncPlayback)
    document.addEventListener('visibilitychange', syncPlayback)
    syncPlayback()

    return () => {
      observer?.disconnect()
      reducedMotion.removeEventListener('change', syncPlayback)
      mobileLayout.removeEventListener('change', syncPlayback)
      document.removeEventListener('visibilitychange', syncPlayback)
      video.pause()
    }
  }, [mobile])

  return (
    <video ref={videoRef} muted loop playsInline preload="metadata" poster={HERO_START_FRAME} aria-hidden="true">
      <source src={HERO_VIDEO} type="video/mp4" />
    </video>
  )
}

function FeatureCard({
  decorativeGlyph,
  icon: Icon,
  number,
  title,
  description,
  action,
  onClick,
}: {
  decorativeGlyph: string
  icon: LucideIcon
  number: string
  title: string
  description: string
  action: string
  onClick: () => void
}) {
  return (
    <article className="showcase-tool" onPointerEnter={() => sumiAudio.playSuikinkutsu()}>
      <span className="showcase-tool__glyph" aria-hidden="true">
        {decorativeGlyph}
      </span>
      <div className="showcase-tool__top">
        <span className="showcase-tool__number">{number} / 05</span>
        <span className="showcase-tool__icon">
          <Icon aria-hidden="true" size={22} strokeWidth={1.5} />
        </span>
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      <Button variant="ghost" size="sm" onClick={onClick}>
        {action} <ArrowRight aria-hidden="true" size={15} />
      </Button>
    </article>
  )
}

function SectionHeader({
  ordinal,
  title,
  description,
  action,
  onClick,
}: {
  ordinal: string
  title: string
  description: string
  action: string
  onClick: () => void
}) {
  const headerRef = useRef<HTMLElement>(null)
  const hankoRef = useRef<HTMLDivElement>(null)
  const bleedRef = useRef<HTMLDivElement>(null)

  const sealGlyph = ordinal.includes('01') ? '道' : ordinal.includes('02') ? '書' : '具'

  useEffect(() => {
    const header = headerRef.current
    const hanko = hankoRef.current
    const bleed = bleedRef.current
    if (!header || !hanko || !window.matchMedia) return
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (reducedMotion.matches) return

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.attributeName === 'class' && header.classList.contains('is-visible')) {
          const tl = gsap.timeline()

          // 1. Rapid downward hand thrust (0.22s)
          tl.fromTo(
            hanko,
            { y: -45, scale: 2.2, opacity: 0, filter: 'blur(5px)', rotation: -14 },
            {
              y: 0,
              scale: 1.0,
              opacity: 1,
              filter: 'blur(0px)',
              rotation: -6,
              duration: 0.22,
              ease: 'power3.in',
            }
          )

          // 2. HARD IMPACT & Ink Bloom:
          // Sound strikes at the exact microsecond of impact
          tl.call(() => {
            sumiAudio.playHankoStamp()
          })

          // Compression squash on paper
          tl.to(hanko, {
            scaleX: 1.15,
            scaleY: 0.86,
            y: 1.5,
            duration: 0.05,
            ease: 'power1.out',
          })

          // Vermilion ink bleed ring phì nhẹ ra viền ngoài
          if (bleed) {
            gsap.fromTo(
              bleed,
              { scale: 0.9, opacity: 0.85 },
              { scale: 1.5, opacity: 0, duration: 0.45, ease: 'power2.out' }
            )
          }

          // Header micro tremor
          gsap.fromTo(
            header,
            { y: 1.5 },
            { y: 0, duration: 0.12, ease: 'elastic.out(1.2, 0.3)' }
          )

          // 3. Mechanical Overshoot Rebound (Nảy nhẹ 1.2px rồi mới nằm im!)
          tl.to(hanko, {
            scaleX: 0.96,
            scaleY: 1.04,
            y: -1.2,
            duration: 0.08,
            ease: 'power2.out',
          })

          // 4. Settles firmly onto paper fibers
          tl.to(hanko, {
            scaleX: 1.0,
            scaleY: 1.0,
            y: 0,
            rotation: -5,
            duration: 0.14,
            ease: 'power2.inOut',
          })

          observer.disconnect()
        }
      }
    })
    observer.observe(header, { attributes: true })
    return () => observer.disconnect()
  }, [])

  return (
    <header className="showcase-section__header" data-reveal ref={headerRef}>
      <div className="showcase-section__hanko-wrapper" aria-hidden="true">
        <div ref={bleedRef} className="showcase-section__hanko-bleed" />
        <div ref={hankoRef} className="showcase-section__hanko" title="Ấn triện Kotodama">
          <span>{sealGlyph}</span>
        </div>
      </div>
      <div>
        <span className="showcase-section__ordinal" aria-hidden="true">
          {ordinal}
        </span>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <Button variant="secondary" onClick={onClick}>
        {action} <ArrowRight aria-hidden="true" size={15} />
      </Button>
    </header>
  )
}
