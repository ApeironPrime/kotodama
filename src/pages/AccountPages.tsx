import { accents, backgrounds, type Accent, type Background, type AccountPreferences } from '../lib/theme'
import { useCallback, type CSSProperties, type ReactNode } from 'react'
import PageHeader from '../components/PageHeader'
import { Button, Card, PageShell, Select, Switch } from '../components/ui'
import { usePersistentState } from '../lib/usePersistentState'
import { LogOut, Settings2 } from 'lucide-react'
import { apiPaths, requestApi } from '../lib/apiClient'
import { useAuth } from '../features/auth/authContext'

export function SettingsPage({ onLogout }: { onLogout: () => void }) {
  const { status } = useAuth()
  const [dailyWords, setDailyWords] = usePersistentState('kotodama.settings.daily-words', '20')
  const [reviewLimit, setReviewLimit] = usePersistentState('kotodama.settings.review-limit', '100')
  const [autoPronounce, setAutoPronounce] = usePersistentState('kotodama.settings.auto-pronounce', true)
  const [furigana, setFurigana] = usePersistentState('kotodama.settings.furigana', true)
  const [romaji, setRomaji] = usePersistentState('kotodama.settings.romaji', false)
  const [pitchAccent, setPitchAccent] = usePersistentState('kotodama.settings.pitch-accent', true)
  const [reminders, setReminders] = usePersistentState('kotodama.settings.reminders', false)
  const [streakReminders, setStreakReminders] = usePersistentState('kotodama.settings.streak-reminders', true)
  const [publicProfile, setPublicProfile] = usePersistentState('kotodama.settings.public-profile', false)
  const [analytics, setAnalytics] = usePersistentState('kotodama.settings.analytics', true)
  const [accent, setAccent] = usePersistentState<Accent>('kotodama.settings.accent', 'rose')
  const [background, setBackground] = usePersistentState<Background>('kotodama.settings.background', 'ivory')
  const activeBackground = backgrounds[background] ? background : 'ivory'

  const persistPreference = useCallback(
    (patch: Partial<AccountPreferences>) => {
      if (status !== 'authenticated') return
      void requestApi<AccountPreferences>({ method: 'POST', url: apiPaths.account.preferences, data: patch }).catch(
        () => undefined
      )
    },
    [status]
  )

  return (
    <PageShell width="wide" className="settings-page">
      <PageHeader
        eyebrow="TÙY CHỈNH"
        title="Cài đặt"
        description="Tùy chỉnh nhịp học và giao diện để Kotodama hợp với bạn hơn."
        icon={Settings2}
      />
      <div className="settings-stack">
        <SettingsSection title="Học tập" description="Đặt nhịp độ và cách hiển thị phù hợp với bạn.">
          <SettingsSelect
            label="Mục tiêu từ mới mỗi ngày"
            description="Số từ mới gợi ý trong một ngày học."
            value={dailyWords}
            onChange={(value) => {
              setDailyWords(value)
              persistPreference({ dailyWords: Number(value) })
            }}
            options={[
              ['10', '10 từ'],
              ['20', '20 từ'],
              ['30', '30 từ'],
              ['50', '50 từ'],
            ]}
          />
          <SettingsSelect
            label="Giới hạn ôn tập mỗi ngày"
            description="Giúp phiên ôn tập luôn vừa sức."
            value={reviewLimit}
            onChange={(value) => {
              setReviewLimit(value)
              persistPreference({ reviewLimit: value === 'unlimited' ? 'unlimited' : Number(value) })
            }}
            options={[
              ['50', '50 lượt'],
              ['100', '100 lượt'],
              ['200', '200 lượt'],
              ['unlimited', 'Không giới hạn'],
            ]}
          />
          <SettingsToggle
            label="Tự phát âm"
            description="Tự động phát âm khi mở một từ mới."
            checked={autoPronounce}
            onChange={(value) => {
              setAutoPronounce(value)
              persistPreference({ autoPronounce: value })
            }}
          />
          <SettingsToggle
            label="Hiển thị Furigana"
            description="Hiển thị cách đọc trên chữ Kanji."
            checked={furigana}
            onChange={(value) => {
              setFurigana(value)
              persistPreference({ furigana: value })
            }}
          />
          <SettingsToggle
            label="Hiển thị Romaji"
            description="Hiển thị phiên âm Latinh khi cần."
            checked={romaji}
            onChange={(value) => {
              setRomaji(value)
              persistPreference({ romaji: value })
            }}
          />
          <SettingsToggle
            label="Cao độ (pitch accent)"
            description="Hiện thông tin cao độ cho từ tiếng Nhật."
            checked={pitchAccent}
            onChange={(value) => {
              setPitchAccent(value)
              persistPreference({ pitchAccent: value })
            }}
          />
        </SettingsSection>

        <SettingsSection title="Giao diện" description="Cá nhân hóa sắc thái để Kotodama hợp với bạn hơn.">
          <div className="settings-row">
            <div className="settings-row__copy">
              <h3>Màu nền</h3>
              <p>Chọn sắc thái nền chính cho toàn bộ giao diện.</p>
            </div>
            <div className="background-options" aria-label="Chọn màu nền">
              {(Object.keys(backgrounds) as Background[]).map((key) => (
                <button
                  type="button"
                  className={`background-option ${activeBackground === key ? 'is-active' : ''}`}
                  style={{ '--background-option': backgrounds[key].swatch } as CSSProperties}
                  onClick={() => {
                    setBackground(key)
                    persistPreference({ background: key })
                  }}
                  title={backgrounds[key].label}
                  aria-label={backgrounds[key].label}
                  aria-pressed={activeBackground === key}
                  key={key}
                />
              ))}
            </div>
          </div>
          <div className="settings-row">
            <div className="settings-row__copy">
              <h3>Màu nhấn</h3>
              <p>Màu áp dụng cho thao tác chính và trạng thái đang chọn.</p>
            </div>
            <div className="accent-options" aria-label="Chọn màu nhấn">
              {(Object.keys(accents) as Accent[]).map((key) => (
                <button
                  type="button"
                  className={`accent-option accent-option--${key} ${accent === key ? 'is-active' : ''}`}
                  style={{ '--accent-option': accents[key].base } as CSSProperties}
                  onClick={() => {
                    setAccent(key)
                    persistPreference({ accent: key })
                  }}
                  title={accents[key].label}
                  aria-label={accents[key].label}
                  aria-pressed={accent === key}
                  key={key}
                />
              ))}
            </div>
          </div>
        </SettingsSection>

        <SettingsSection title="Thông báo" description="Các lựa chọn này được lưu trên thiết bị hiện tại.">
          <SettingsToggle
            label="Nhắc học tập"
            description="Nhận lời nhắc cho lịch học bạn đã đặt."
            checked={reminders}
            onChange={(value) => {
              setReminders(value)
              persistPreference({ reminders: value })
            }}
          />
          <SettingsToggle
            label="Duy trì chuỗi ngày"
            description="Nhắc bạn trước khi chuỗi học tập kết thúc."
            checked={streakReminders}
            onChange={(value) => {
              setStreakReminders(value)
              persistPreference({ streakReminders: value })
            }}
          />
        </SettingsSection>

        <SettingsSection title="Quyền riêng tư" description="Bạn luôn kiểm soát dữ liệu hiển thị của mình.">
          <SettingsToggle
            label="Hồ sơ công khai"
            description="Cho phép người khác xem hồ sơ và các huy hiệu của bạn."
            checked={publicProfile}
            onChange={(value) => {
              setPublicProfile(value)
              persistPreference({ publicProfile: value })
            }}
          />
          <SettingsToggle
            label="Dữ liệu cải thiện sản phẩm"
            description="Cho phép sử dụng dữ liệu ẩn danh để cải thiện trải nghiệm."
            checked={analytics}
            onChange={(value) => {
              setAnalytics(value)
              persistPreference({ analytics: value })
            }}
          />
        </SettingsSection>

        <Card padding="lg" className="settings-subscription">
          <div>
            <span className="settings-kicker">GÓI HIỆN TẠI</span>
            <h2>Kotodama Free</h2>
            <p>Các tính năng trả phí chưa được mở trong bản thử nghiệm này.</p>
          </div>
          <Button variant="secondary" disabled>
            Sắp có
          </Button>
        </Card>
        <Card padding="lg" className="settings-danger">
          <div>
            <h2>Vùng cần thận trọng</h2>
            <p>Xóa tài khoản cần được xác nhận qua hệ thống máy chủ.</p>
          </div>
          <Button variant="danger" disabled>
            Xóa tài khoản
          </Button>
        </Card>
        <Card padding="lg" className="settings-logout">
          <div>
            <h2>Phiên đăng nhập</h2>
            <p>Đăng xuất khỏi tài khoản trên thiết bị này.</p>
          </div>
          <Button variant="danger" onClick={onLogout}>
            <LogOut aria-hidden="true" size={16} strokeWidth={2} />
            Đăng xuất
          </Button>
        </Card>
      </div>
    </PageShell>
  )
}

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <Card padding="lg" className="settings-section">
      <div className="settings-section__heading">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </div>
      <div className="settings-section__rows">{children}</div>
    </Card>
  )
}

function SettingsToggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <div className="settings-row">
      <div className="settings-row__copy">
        <h3>{label}</h3>
        <p>{description}</p>
      </div>
      <Switch label={label} checked={checked} onCheckedChange={onChange} />
    </div>
  )
}

function SettingsSelect({
  label,
  description,
  value,
  onChange,
  options,
}: {
  label: string
  description: string
  value: string
  onChange: (value: string) => void
  options: Array<[string, string]>
}) {
  return (
    <div className="settings-row">
      <div className="settings-row__copy">
        <h3>{label}</h3>
        <p>{description}</p>
      </div>
      <Select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </Select>
    </div>
  )
}
