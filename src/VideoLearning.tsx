import { useState, useRef, useEffect, useCallback } from 'react'

// ─── Icons ─────────────────────────────────────────────────────────────────────

const PlayIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <polygon points="5 3 19 12 5 21 5 3"/>
  </svg>
)
const PauseIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
  </svg>
)
const VolumeIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
  </svg>
)
const FullscreenIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
  </svg>
)
const RepeatIcon = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>
  </svg>
)
const MicIcon = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
  </svg>
)
const BookmarkIcon = ({ filled = false, size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
  </svg>
)
const ZapIcon = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
  </svg>
)
const XIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)
const UploadIcon = ({ size = 48 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
  </svg>
)
const LinkIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
  </svg>
)
const SendIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
)
const BrainIcon = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/>
  </svg>
)
const CheckIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
)
const ChevronDownIcon = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9"/>
  </svg>
)
const EyeOffIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
)
const EyeIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
  </svg>
)
const StarIcon = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
  </svg>
)
const PlusIcon = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
)
const VolumeSmallIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
  </svg>
)
const ClockIcon = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
)

// ─── Types ─────────────────────────────────────────────────────────────────────

interface SubtitleWord {
  text: string
  isJapanese: boolean
}

interface Subtitle {
  id: number
  start: string
  end: string
  startSec: number
  words: SubtitleWord[]
  furigana: string
  vietnamese: string
  bookmarked?: boolean
}

interface VocabWord {
  word: string
  reading: string
  meaning: string
  jlpt: string
  pos: string
  freq: number
  mastery: number
  saved: boolean
}

interface GrammarPattern {
  pattern: string
  meaning: string
  usage: string
  example: string
  difficulty: string
}

// ─── Mock Data ─────────────────────────────────────────────────────────────────

const SUBTITLES: Subtitle[] = [
  {
    id: 1, start: '0:03', end: '0:06', startSec: 3,
    words: [
      { text: '昨日', isJapanese: true },
      { text: '、', isJapanese: false },
      { text: '学校', isJapanese: true },
      { text: 'へ', isJapanese: true },
      { text: '行き', isJapanese: true },
      { text: 'ました', isJapanese: true },
      { text: '。', isJapanese: false },
    ],
    furigana: 'きのう、がっこうへいきました。',
    vietnamese: 'Hôm qua, tôi đã đến trường.',
  },
  {
    id: 2, start: '0:07', end: '0:11', startSec: 7,
    words: [
      { text: '先生', isJapanese: true },
      { text: 'が', isJapanese: true },
      { text: '新しい', isJapanese: true },
      { text: '授業', isJapanese: true },
      { text: 'を', isJapanese: true },
      { text: '始め', isJapanese: true },
      { text: 'ました', isJapanese: true },
      { text: '。', isJapanese: false },
    ],
    furigana: 'せんせいがあたらしいじゅぎょうをはじめました。',
    vietnamese: 'Thầy giáo đã bắt đầu buổi học mới.',
  },
  {
    id: 3, start: '0:12', end: '0:17', startSec: 12,
    words: [
      { text: '日本語', isJapanese: true },
      { text: 'は', isJapanese: true },
      { text: '難しい', isJapanese: true },
      { text: 'けど', isJapanese: true },
      { text: '、', isJapanese: false },
      { text: '面白い', isJapanese: true },
      { text: 'と', isJapanese: true },
      { text: '思い', isJapanese: true },
      { text: 'ます', isJapanese: true },
      { text: '。', isJapanese: false },
    ],
    furigana: 'にほんごはむずかしいけど、おもしろいとおもいます。',
    vietnamese: 'Tiếng Nhật khó nhưng tôi nghĩ nó thú vị.',
  },
  {
    id: 4, start: '0:18', end: '0:23', startSec: 18,
    words: [
      { text: '毎日', isJapanese: true },
      { text: '練習', isJapanese: true },
      { text: 'すれば', isJapanese: true },
      { text: '、', isJapanese: false },
      { text: '必ず', isJapanese: true },
      { text: '上手く', isJapanese: true },
      { text: 'なれる', isJapanese: true },
      { text: 'よ', isJapanese: true },
      { text: '。', isJapanese: false },
    ],
    furigana: 'まいにちれんしゅうすれば、かならずうまくなれるよ。',
    vietnamese: 'Nếu bạn luyện tập mỗi ngày, chắc chắn bạn sẽ giỏi hơn đấy.',
  },
  {
    id: 5, start: '0:24', end: '0:29', startSec: 24,
    words: [
      { text: '諦め', isJapanese: true },
      { text: 'ない', isJapanese: true },
      { text: 'で', isJapanese: true },
      { text: '勉強', isJapanese: true },
      { text: 'し', isJapanese: true },
      { text: 'て', isJapanese: true },
      { text: 'ください', isJapanese: true },
      { text: '。', isJapanese: false },
    ],
    furigana: 'あきらめないでべんきょうしてください。',
    vietnamese: 'Hãy học mà không bỏ cuộc nhé.',
  },
]

const VOCAB_LIST: VocabWord[] = [
  { word: '学校', reading: 'がっこう', meaning: 'trường học', jlpt: 'N5', pos: 'Danh từ', freq: 312, mastery: 80, saved: true },
  { word: '先生', reading: 'せんせい', meaning: 'giáo viên', jlpt: 'N5', pos: 'Danh từ', freq: 287, mastery: 90, saved: true },
  { word: '授業', reading: 'じゅぎょう', meaning: 'buổi học, tiết học', jlpt: 'N4', pos: 'Danh từ', freq: 445, mastery: 55, saved: false },
  { word: '難しい', reading: 'むずかしい', meaning: 'khó, phức tạp', jlpt: 'N5', pos: 'Tính từ -i', freq: 198, mastery: 70, saved: false },
  { word: '面白い', reading: 'おもしろい', meaning: 'thú vị, hấp dẫn', jlpt: 'N5', pos: 'Tính từ -i', freq: 174, mastery: 85, saved: true },
  { word: '練習', reading: 'れんしゅう', meaning: 'luyện tập', jlpt: 'N4', pos: 'Danh từ/Động từ', freq: 389, mastery: 60, saved: false },
  { word: '必ず', reading: 'かならず', meaning: 'chắc chắn, nhất định', jlpt: 'N3', pos: 'Trạng từ', freq: 512, mastery: 30, saved: false },
  { word: '諦める', reading: 'あきらめる', meaning: 'từ bỏ, bỏ cuộc', jlpt: 'N3', pos: 'Động từ', freq: 634, mastery: 20, saved: false },
]

const GRAMMAR_LIST: GrammarPattern[] = [
  {
    pattern: '〜へ行く',
    meaning: 'Đi đến [địa điểm]',
    usage: 'Trợ từ chỉ hướng へ + động từ di chuyển',
    example: '学校へ行きました。',
    difficulty: 'N5',
  },
  {
    pattern: '〜けど〜',
    meaning: 'Mặc dù, nhưng mà (nhẹ hơn でも)',
    usage: 'Nối hai mệnh đề tương phản, sắc thái lịch sự',
    example: '難しいけど、面白いと思います。',
    difficulty: 'N4',
  },
  {
    pattern: '〜すれば〜',
    meaning: 'Điều kiện: nếu [A] thì [B]',
    usage: 'Thân động từ + thể điều kiện ば',
    example: '練習すれば、上手くなれる。',
    difficulty: 'N3',
  },
  {
    pattern: '〜ないでください',
    meaning: 'Xin đừng [làm gì đó]',
    usage: 'Cấu trúc yêu cầu thể て phủ định',
    example: '諦めないでください。',
    difficulty: 'N4',
  },
]

const WORD_DETAIL: Record<string, { furigana: string; romaji: string; meaning: string; jlpt: string; pos: string; pitch: string; collocations: string[]; example: string }> = {
  '昨日': { furigana: 'きのう', romaji: 'kinō', meaning: 'hôm qua', jlpt: 'N5', pos: 'Danh từ (thời gian)', pitch: 'HLL', collocations: ['昨日の夜', '昨日から', '昨日まで'], example: '昨日は雨でした。' },
  '学校': { furigana: 'がっこう', romaji: 'gakkō', meaning: 'trường học', jlpt: 'N5', pos: 'Danh từ', pitch: 'LHH', collocations: ['学校へ行く', '学校の友達', '学校帰り'], example: '毎日学校へ行きます。' },
  '先生': { furigana: 'せんせい', romaji: 'sensei', meaning: 'giáo viên, thầy giáo', jlpt: 'N5', pos: 'Danh từ', pitch: 'LHH', collocations: ['先生に聞く', '先生の話', '先生方'], example: '先生はとても優しいです。' },
  '新しい': { furigana: 'あたらしい', romaji: 'atarashii', meaning: 'mới, tươi mới', jlpt: 'N5', pos: 'Tính từ -い', pitch: 'LHHHL', collocations: ['新しい車', '新しい友達', '新しく始める'], example: '新しい本を買いました。' },
  '日本語': { furigana: 'にほんご', romaji: 'nihongo', meaning: 'tiếng Nhật', jlpt: 'N5', pos: 'Danh từ', pitch: 'LHHL', collocations: ['日本語を勉強する', '日本語で話す'], example: '日本語を毎日練習します。' },
  '難しい': { furigana: 'むずかしい', romaji: 'muzukashii', meaning: 'khó, phức tạp', jlpt: 'N5', pos: 'Tính từ -い', pitch: 'LHHHHL', collocations: ['難しい問題', '難しく考える'], example: '漢字は難しいです。' },
  '面白い': { furigana: 'おもしろい', romaji: 'omoshiroi', meaning: 'thú vị, hài hước', jlpt: 'N5', pos: 'Tính từ -い', pitch: 'LHHHL', collocations: ['面白い映画', '面白い話'], example: 'この本はとても面白い。' },
  '勉強': { furigana: 'べんきょう', romaji: 'benkyō', meaning: 'học tập, nghiên cứu', jlpt: 'N5', pos: 'Danh từ / Động từ する', pitch: 'LHH', collocations: ['勉強する', '勉強になる', '勉強中'], example: '毎日日本語を勉強しています。' },
  '練習': { furigana: 'れんしゅう', romaji: 'renshū', meaning: 'luyện tập, thực hành', jlpt: 'N4', pos: 'Danh từ / Động từ する', pitch: 'LHH', collocations: ['練習する', '練習問題', '毎日練習'], example: '毎日発音を練習しています。' },
  '必ず': { furigana: 'かならず', romaji: 'kanarazu', meaning: 'chắc chắn, nhất định', jlpt: 'N3', pos: 'Trạng từ', pitch: 'LHHL', collocations: ['必ず来る', '必ず守る'], example: '明日必ず電話します。' },
  '諦め': { furigana: 'あきらめ', romaji: 'akirame', meaning: 'từ bỏ (dạng thân)', jlpt: 'N3', pos: 'Thân động từ', pitch: 'LHHL', collocations: ['諦めない', '諦めずに', '諦めが悪い'], example: '絶対に諦めないよ。' },
}

const processingSteps = [
  { label: 'Trích xuất âm thanh lời nói', icon: '🎙️' },
  { label: 'Tạo bản ghi âm tiếng Nhật', icon: '📝' },
  { label: 'Thêm furigana', icon: '振' },
  { label: 'Dịch sang tiếng Việt', icon: '🇻🇳' },
  { label: 'Phân đoạn câu', icon: '✂️' },
  { label: 'Trích xuất từ vựng', icon: '📚' },
  { label: 'Phân tích ngữ pháp', icon: '🔬' },
  { label: 'Lưu bài học', icon: '💾' },
]

// ─── Processing Screen ─────────────────────────────────────────────────────────

function ProcessingScreen({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (step < processingSteps.length) {
      const t = setTimeout(() => setStep(s => s + 1), 600)
      return () => clearTimeout(t)
    } else {
      const t = setTimeout(() => { setDone(true) }, 400)
      return () => clearTimeout(t)
    }
  }, [step])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '70vh', padding: 40 }}>
      <div style={{ width: 480, maxWidth: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🤖</div>
          <h2 style={{ fontSize: 24, fontWeight: 700, color: '#EAEAE0', marginBottom: 8, letterSpacing: '-0.02em' }}>AI đang phân tích video của bạn</h2>
          <p style={{ fontSize: 14, color: 'rgba(234,234,224,0.45)' }}>Thường mất 30–60 giây cho video 10 phút</p>
        </div>

        <div style={{ background: '#171722', borderRadius: 20, border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
          {processingSteps.map((s, i) => {
            const isActive = i === step - 1 && !done
            const isDone = i < step
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '14px 20px',
                borderBottom: i < processingSteps.length - 1 ? '1px solid #F5F4F0' : 'none',
                background: isActive ? '#FFFBF0' : 'white',
                transition: 'background 0.3s ease',
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: isDone ? '#E8F5E9' : isActive ? '#FFF8E1' : '#F5F4F0',
                  border: `1.5px solid ${isDone ? '#A5D6A7' : isActive ? '#FFE082' : '#ECEAE4'}`,
                  transition: 'all 0.3s ease',
                  fontSize: typeof s.icon === 'string' && s.icon.length > 2 ? 13 : 16,
                  fontFamily: "'Noto Sans JP', sans-serif",
                  color: isDone ? '#2E7D32' : '#8C8679',
                }}>
                  {isDone ? <CheckIcon size={15} /> : s.icon}
                </div>
                <span style={{ fontSize: 14, fontWeight: isDone ? 600 : 400, color: isDone ? '#252320' : isActive ? '#635E54' : '#B5B0A3', flex: 1, transition: 'all 0.3s ease' }}>
                  {s.label}
                </span>
                {isActive && (
                  <div style={{ display: 'flex', gap: 4 }}>
                    {[0, 1, 2].map(d => (
                      <div key={d} style={{
                        width: 5, height: 5, borderRadius: '50%', background: '#E65100',
                        animation: `pulse 1.2s ease-in-out ${d * 0.2}s infinite`,
                      }} />
                    ))}
                  </div>
                )}
                {isDone && <span style={{ fontSize: 11, color: '#4CAF50', fontWeight: 600 }}>Xong</span>}
              </div>
            )
          })}
        </div>

        <div style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: 'rgba(234,234,224,0.45)' }}>Tiến độ</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#FF7D9D' }}>{Math.round((step / processingSteps.length) * 100)}%</span>
          </div>
          <div style={{ height: 8, background: 'rgba(255,255,255,0.04)', borderRadius: 100, overflow: 'hidden' }}>
            <div style={{ height: '100%', background: 'linear-gradient(90deg, #E53935, #FF7043)', borderRadius: 100, width: `${(step / processingSteps.length) * 100}%`, transition: 'width 0.5s ease' }} />
          </div>
        </div>

        {done && (
          <button
            onClick={onDone}
            style={{ marginTop: 28, width: '100%', padding: '14px 0', background: 'linear-gradient(135deg, #FF4D6D, #C2185B)', color: 'white', border: 'none', borderRadius: 14, fontSize: 15, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 16px rgba(255,77,109,0.35)', transition: 'all 0.15s ease', letterSpacing: '-0.01em' }}
          >
            ✨ Mở bài học
          </button>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  )
}

// ─── Import Screen ─────────────────────────────────────────────────────────────

function ImportScreen({ onImport }: { onImport: () => void }) {
  const [url, setUrl] = useState('')
  const [dragging, setDragging] = useState(false)
  const [tab, setTab] = useState<'url' | 'upload'>('url')

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px' }}>
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 16px', background: 'rgba(255,77,109,0.15)', borderRadius: 100, marginBottom: 16 }}>
          <ZapIcon size={12} />
          <span style={{ fontSize: 11, fontWeight: 700, color: '#FF7D9D', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Nhập Video AI</span>
        </div>
        <h1 style={{ fontSize: 36, fontWeight: 700, color: '#EAEAE0', letterSpacing: '-0.03em', marginBottom: 12, lineHeight: 1.2 }}>
          Nhập video để bắt đầu<br />học tiếng Nhật qua immersion
        </h1>
        <p style={{ fontSize: 15, color: 'rgba(234,234,224,0.45)', lineHeight: 1.6 }}>
          AI sẽ trích xuất bản ghi âm, thêm furigana, dịch phụ đề<br />và xây dựng bài học từ vựng + ngữ pháp hoàn chỉnh cho bạn.
        </p>
      </div>

      {/* Tab switcher */}
      <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 4, gap: 4, marginBottom: 24 }}>
        {[{ id: 'url', label: '🔗  YouTube / URL' }, { id: 'upload', label: '📁  Tệp cục bộ' }].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as 'url' | 'upload')}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, transition: 'all 0.15s ease',
              background: tab === t.id ? 'rgba(255,255,255,0.1)' : 'transparent',
              color: tab === t.id ? '#EAEAE0' : 'rgba(234,234,224,0.4)',
              boxShadow: tab === t.id ? '0 1px 4px rgba(0,0,0,0.3)' : 'none',
            }}
          >{t.label}</button>
        ))}
      </div>

      {tab === 'url' ? (
        <div style={{ background: '#171722', borderRadius: 20, border: '1px solid rgba(255,255,255,0.08)', padding: 28, boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'rgba(234,234,224,0.55)', display: 'block', marginBottom: 8 }}>Đường dẫn video</label>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <div style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'rgba(234,234,224,0.35)' }}>
                  <LinkIcon size={15} />
                </div>
                <input
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  style={{ width: '100%', paddingLeft: 42, paddingRight: 16, paddingTop: 12, paddingBottom: 12, background: '#09090F', border: '1.5px solid #ECEAE4', borderRadius: 12, fontSize: 14, color: 'rgba(234,234,224,0.85)', outline: 'none', fontFamily: 'Inter, sans-serif', transition: 'border-color 0.15s ease' }}
                  onFocus={e => { e.target.style.borderColor = '#E53935' }}
                  onBlur={e => { e.target.style.borderColor = '#ECEAE4' }}
                />
              </div>
              <button
                onClick={onImport}
                style={{ padding: '12px 24px', background: 'linear-gradient(135deg, #E53935, #FF5722)', color: 'white', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '0 3px 12px rgba(229,57,53,0.25)' }}
              >
                Phân tích với AI
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'rgba(234,234,224,0.35)', alignSelf: 'center' }}>Thử mẫu:</span>
            {['Cuộc sống hàng ngày ở Nhật', 'Vlog Tokyo N4', 'Clip Anime N3'].map(s => (
              <button key={s} onClick={onImport} style={{ padding: '5px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 100, fontSize: 12, fontWeight: 500, color: 'rgba(234,234,224,0.55)', cursor: 'pointer' }}>{s}</button>
            ))}
          </div>
        </div>
      ) : (
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); onImport() }}
          style={{
            background: dragging ? 'rgba(255,77,109,0.12)' : '#171722',
            border: `2px dashed ${dragging ? '#FF4D6D' : 'rgba(255,255,255,0.18)'}`,
            borderRadius: 20, padding: '48px 28px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
            cursor: 'pointer', transition: 'all 0.2s ease',
          }}
          onClick={onImport}
        >
          <div style={{ color: dragging ? '#FF7D9D' : 'rgba(234,234,224,0.45)', transition: 'color 0.2s ease' }}>
            <UploadIcon size={52} />
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#EAEAE0', marginBottom: 6 }}>Kéo và thả video vào đây</div>
            <div style={{ fontSize: 13, color: 'rgba(234,234,224,0.45)' }}>Hỗ trợ MP4, MOV, MKV, AVI · tối đa 2GB</div>
          </div>
          <button style={{ padding: '10px 28px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 10, fontSize: 14, fontWeight: 600, color: '#EAEAE0', cursor: 'pointer' }}>
            Chọn tệp
          </button>
        </div>
      )}

      {/* Feature highlights */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginTop: 28 }}>
        {[
          { icon: '📝', title: 'Bản ghi AI', desc: 'Nhận dạng giọng nói tự động được tinh chỉnh cho tiếng Nhật' },
          { icon: '🎯', title: 'Nhấn để học', desc: 'Chạm vào bất kỳ từ nào để phân tích sâu tức thì' },
          { icon: '🎤', title: 'Chế độ shadowing', desc: 'Luyện phát âm với chấm điểm AI' },
        ].map(f => (
          <div key={f.title} style={{ padding: '16px 18px', background: '#171722', borderRadius: 14, border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>{f.icon}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(234,234,224,0.85)', marginBottom: 4 }}>{f.title}</div>
            <div style={{ fontSize: 12, color: 'rgba(234,234,224,0.45)', lineHeight: 1.6 }}>{f.desc}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Word Popup ────────────────────────────────────────────────────────────────

function WordPopup({ word, onClose }: { word: string; onClose: () => void }) {
  const detail = WORD_DETAIL[word]
  const [saved, setSaved] = useState(false)
  if (!detail) return null

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(20,19,16,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: 440, maxHeight: '90vh', overflowY: 'auto', background: '#171722', borderRadius: 24, boxShadow: '0 24px 80px rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)', animation: 'popIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
      >
        {/* Header */}
        <div style={{ padding: '24px 24px 0', position: 'relative' }}>
          <button onClick={onClose} style={{ position: 'absolute', right: 18, top: 18, background: 'rgba(255,255,255,0.04)', border: 'none', borderRadius: 8, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'rgba(234,234,224,0.45)' }}>
            <XIcon size={14} />
          </button>
          <div style={{ fontFamily: "'Noto Sans JP', sans-serif", fontSize: 52, fontWeight: 300, color: '#EAEAE0', lineHeight: 1, marginBottom: 6 }}>{word}</div>
          <div style={{ fontFamily: "'Noto Sans JP', sans-serif", fontSize: 16, color: 'rgba(234,234,224,0.45)', marginBottom: 4, letterSpacing: '0.04em' }}>{detail.furigana}</div>
          <div style={{ fontSize: 14, color: 'rgba(234,234,224,0.35)', fontStyle: 'italic', marginBottom: 16 }}>{detail.romaji}</div>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 16 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 100, fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', background: 'rgba(255,77,109,0.15)', color: '#FF7D9D' }}>JLPT {detail.jlpt}</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 100, fontSize: 11, fontWeight: 600, background: '#E3F2FD', color: '#1565C0' }}>{detail.pos}</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 100, fontSize: 11, fontWeight: 600, background: '#FFF8E1', color: '#E65100' }}>
              Pitch: {detail.pitch}
            </span>
          </div>
        </div>

        {/* Meaning */}
        <div style={{ margin: '0 24px 0', padding: '14px 18px', background: 'linear-gradient(135deg, #FFEBEE, #FFF5F5)', borderRadius: 12, border: '1px solid #FFCDD2' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#FF7D9D', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Ý nghĩa</div>
          <div style={{ fontSize: 17, fontWeight: 700, color: '#EAEAE0' }}>{detail.meaning}</div>
        </div>

        {/* Collocations */}
        <div style={{ padding: '16px 24px 0' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(234,234,224,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Cụm từ thông dụng</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {detail.collocations.map(c => (
              <span key={c} style={{ padding: '5px 13px', background: 'rgba(255,255,255,0.04)', borderRadius: 100, fontSize: 13, fontFamily: "'Noto Sans JP', sans-serif", color: '#3D3A33', border: '1px solid rgba(255,255,255,0.08)' }}>{c}</span>
            ))}
          </div>
        </div>

        {/* Example */}
        <div style={{ padding: '16px 24px 0' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(234,234,224,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Câu ví dụ</div>
          <div style={{ padding: '12px 16px', background: '#09090F', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ fontFamily: "'Noto Sans JP', sans-serif", fontSize: 15, color: 'rgba(234,234,224,0.85)', marginBottom: 6 }}>{detail.example}</div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ padding: '20px 24px', display: 'flex', gap: 10 }}>
          <button
            onClick={() => setSaved(s => !s)}
            style={{ flex: 1, padding: '11px 0', background: saved ? '#E8F5E9' : 'linear-gradient(135deg, #E53935, #FF5722)', color: saved ? '#2E7D32' : 'white', border: saved ? '1.5px solid #A5D6A7' : 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s ease' }}
          >
            {saved ? '✓ Đã lưu vào từ vựng' : '+ Lưu vào từ vựng'}
          </button>
          <button style={{ padding: '11px 18px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, fontSize: 14, fontWeight: 600, color: 'rgba(234,234,224,0.55)', cursor: 'pointer' }}>
            <VolumeSmallIcon size={15} />
          </button>
          <button style={{ padding: '11px 18px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, fontSize: 13, fontWeight: 600, color: 'rgba(234,234,224,0.55)', cursor: 'pointer' }}>
            Ôn sau
          </button>
        </div>
      </div>
      <style>{`@keyframes popIn { from { opacity:0; transform:scale(0.92) translateY(8px); } to { opacity:1; transform:scale(1) translateY(0); } }`}</style>
    </div>
  )
}

// ─── Video Player ──────────────────────────────────────────────────────────────

function VideoPlayer({ shadowing, onWordClick, activeSubIndex }: { shadowing: boolean; onWordClick: (word: string) => void; activeSubIndex: number }) {
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(18)
  const [speed, setSpeed] = useState(1)
  const [loopSub, setLoopSub] = useState(false)
  const [autoPause, setAutoPause] = useState(true)
  const [volume, setVolume] = useState(80)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const totalSec = 90

  useEffect(() => {
    if (playing) {
      intervalRef.current = setInterval(() => setProgress(p => Math.min(p + 0.5, totalSec)), 500)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [playing])

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

  // Waveform bars
  const waveHeights = [3,5,8,12,16,20,15,10,7,14,22,18,12,8,5,10,17,22,15,9,6,13,20,16,11,7,14,19,13,8,4,11,18,23,16,10,6,14,21,15,9,5,12,19,14,8,5,10,16,20,13,7,4,11,17,22,15,9,5,13,20,16,10,6]

  return (
    <div style={{ background: '#0F0E0C', borderRadius: 18, overflow: 'hidden', border: '1px solid #2A2826' }}>
      {/* Video frame */}
      <div style={{ position: 'relative', aspectRatio: '16/9', background: 'linear-gradient(180deg, #1A1917 0%, #0F0E0C 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {/* Simulated video content */}
        <img
          src="https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=900&h=506&fit=crop&auto=format"
          alt="Tokyo street scene for Japanese learning"
          style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.85 }}
        />

        {/* Subtitle overlay */}
        <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', textAlign: 'center', width: '88%' }}>
          <div style={{ display: 'inline-block', background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', borderRadius: 12, padding: '10px 18px' }}>
            <div style={{ fontFamily: "'Noto Sans JP', sans-serif", fontSize: 20, color: 'white', fontWeight: 400, lineHeight: 1.4 }}>
              {SUBTITLES[activeSubIndex % SUBTITLES.length].words.map((w, i) => (
                w.isJapanese ? (
                  <span
                    key={i}
                    onClick={() => onWordClick(w.text)}
                    style={{ cursor: 'pointer', borderRadius: 4, padding: '1px 2px', transition: 'background 0.1s ease' }}
                    onMouseEnter={e => { (e.target as HTMLElement).style.background = 'rgba(229,57,53,0.6)' }}
                    onMouseLeave={e => { (e.target as HTMLElement).style.background = 'transparent' }}
                  >{w.text}</span>
                ) : (
                  <span key={i} style={{ color: 'rgba(255,255,255,0.7)' }}>{w.text}</span>
                )
              ))}
            </div>
            <div style={{ fontFamily: "'Noto Sans JP', sans-serif", fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 4, letterSpacing: '0.03em' }}>
              {SUBTITLES[activeSubIndex % SUBTITLES.length].furigana}
            </div>
          </div>
        </div>

        {/* Center play/pause overlay */}
        {!playing && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <button
              onClick={() => setPlaying(true)}
              style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(229,57,53,0.9)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', boxShadow: '0 4px 24px rgba(229,57,53,0.4)', backdropFilter: 'blur(4px)' }}
            >
              <PlayIcon size={22} />
            </button>
          </div>
        )}

        {/* Shadowing badge */}
        {shadowing && (
          <div style={{ position: 'absolute', top: 14, right: 14, padding: '6px 14px', background: 'rgba(229,57,53,0.9)', backdropFilter: 'blur(8px)', borderRadius: 100, fontSize: 12, fontWeight: 700, color: 'white', display: 'flex', alignItems: 'center', gap: 6 }}>
            <MicIcon size={12} /> Đang Shadowing
          </div>
        )}
        {autoPause && (
          <div style={{ position: 'absolute', top: 14, left: 14, padding: '5px 12px', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', borderRadius: 100, fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>
            Tự dừng BẬT
          </div>
        )}
      </div>

      {/* Waveform timeline */}
      <div style={{ padding: '10px 16px 6px', background: '#1A1917' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 28, marginBottom: 4, cursor: 'pointer' }}
          onClick={e => {
            const rect = e.currentTarget.getBoundingClientRect()
            const ratio = (e.clientX - rect.left) / rect.width
            setProgress(Math.round(ratio * totalSec))
          }}>
          {waveHeights.map((h, i) => {
            const pos = (i / waveHeights.length) * totalSec
            const isPast = pos <= progress
            return (
              <div key={i} style={{ flex: 1, background: isPast ? '#E53935' : '#3A3836', borderRadius: 2, height: h, minWidth: 3, transition: 'background 0.1s ease' }} />
            )
          })}
        </div>

        {/* Subtitle markers */}
        <div style={{ position: 'relative', height: 6, marginBottom: 6 }}>
          {SUBTITLES.map(s => (
            <div key={s.id} style={{ position: 'absolute', left: `${(s.startSec / totalSec) * 100}%`, top: 0, width: 24, height: 6, background: '#E53935', opacity: 0.6, borderRadius: 3 }} />
          ))}
          <div style={{ position: 'absolute', left: `${(progress / totalSec) * 100}%`, top: -4, width: 14, height: 14, background: '#171722', borderRadius: '50%', border: '2px solid #E53935', transform: 'translateX(-50%)', boxShadow: '0 0 8px rgba(229,57,53,0.4)' }} />
        </div>
      </div>

      {/* Controls */}
      <div style={{ padding: '8px 16px 14px', background: '#1A1917', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={() => setPlaying(p => !p)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: 8, transition: 'background 0.1s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#2A2826' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
          {playing ? <PauseIcon size={18} /> : <PlayIcon size={18} />}
        </button>

        <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'rgba(255,255,255,0.5)', whiteSpace: 'nowrap' }}>{formatTime(progress)} / {formatTime(totalSec)}</span>

        <div style={{ flex: 1 }} />

        {/* Volume */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <VolumeIcon size={14} />
          <input type="range" min={0} max={100} value={volume} onChange={e => setVolume(Number(e.target.value))}
            style={{ width: 64, accentColor: '#E53935' }} />
        </div>

        {/* Speed */}
        <div style={{ display: 'flex', gap: 2 }}>
          {[0.75, 1, 1.25, 1.5].map(s => (
            <button key={s} onClick={() => setSpeed(s)} style={{ padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, border: 'none', cursor: 'pointer', background: speed === s ? '#E53935' : '#2A2826', color: speed === s ? 'white' : 'rgba(255,255,255,0.5)', transition: 'all 0.12s ease' }}>{s}x</button>
          ))}
        </div>

        <button onClick={() => setLoopSub(l => !l)} title="Loop subtitle" style={{ background: loopSub ? '#E53935' : '#2A2826', border: 'none', borderRadius: 7, padding: '5px 8px', color: loopSub ? 'white' : 'rgba(255,255,255,0.5)', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'all 0.12s ease' }}>
          <RepeatIcon size={14} />
        </button>
        <button onClick={() => setAutoPause(a => !a)} style={{ padding: '4px 10px', background: autoPause ? '#2A3828' : '#2A2826', border: `1px solid ${autoPause ? '#4CAF50' : 'transparent'}`, borderRadius: 7, fontSize: 11, fontWeight: 600, color: autoPause ? '#69F0AE' : 'rgba(255,255,255,0.5)', cursor: 'pointer', transition: 'all 0.12s ease', whiteSpace: 'nowrap' }}>
          Tự dừng
        </button>
        <button style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
          <FullscreenIcon size={15} />
        </button>
      </div>
    </div>
  )
}

// ─── Subtitle Card ─────────────────────────────────────────────────────────────

function SubtitleCard({ sub, active, onWordClick, listeningMode, onBookmark }: {
  sub: Subtitle
  active: boolean
  onWordClick: (word: string) => void
  listeningMode: { hideJp: boolean; hideFurigana: boolean; hideVi: boolean; revealedIds: Set<number> }
  onBookmark: (id: number) => void
}) {
  const [bookmarked, setBookmarked] = useState(sub.bookmarked || false)
  const [revealedJp, setRevealedJp] = useState(false)
  const [revealedFuri, setRevealedFuri] = useState(false)
  const [revealedVi, setRevealedVi] = useState(false)
  const isRevealed = listeningMode.revealedIds.has(sub.id)

  const showJp = !listeningMode.hideJp || revealedJp || isRevealed
  const showFuri = !listeningMode.hideFurigana || revealedFuri || isRevealed
  const showVi = !listeningMode.hideVi || revealedVi || isRevealed

  return (
    <div style={{ padding: '16px 18px', borderRadius: 14, border: `1.5px solid ${active ? '#E53935' : '#ECEAE4'}`, background: active ? '#FFFBF9' : 'white', transition: 'all 0.2s ease', boxShadow: active ? '0 2px 12px rgba(229,57,53,0.1)' : 'none' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'rgba(234,234,224,0.35)', fontWeight: 500 }}>{sub.start} – {sub.end}</span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(234,234,224,0.35)', display: 'flex', alignItems: 'center', padding: 4 }}>
            <VolumeSmallIcon size={13} />
          </button>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(234,234,224,0.35)', display: 'flex', alignItems: 'center', padding: 4 }}>
            <BrainIcon size={13} />
          </button>
          <button
            onClick={() => { setBookmarked(b => !b); onBookmark(sub.id) }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: bookmarked ? '#E53935' : '#B5B0A3', display: 'flex', alignItems: 'center', padding: 4 }}
          >
            <BookmarkIcon filled={bookmarked} size={13} />
          </button>
        </div>
      </div>

      {/* Japanese */}
      {showJp ? (
        <div style={{ fontFamily: "'Noto Sans JP', sans-serif", fontSize: 17, color: '#EAEAE0', lineHeight: 1.6, marginBottom: 4, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {sub.words.map((w, i) =>
            w.isJapanese ? (
              <span key={i} onClick={() => onWordClick(w.text)} style={{ cursor: 'pointer', borderRadius: 5, padding: '0 2px', transition: 'background 0.1s ease' }}
                onMouseEnter={e => { (e.target as HTMLElement).style.background = '#FFEBEE' }}
                onMouseLeave={e => { (e.target as HTMLElement).style.background = 'transparent' }}>
                {w.text}
              </span>
            ) : <span key={i} style={{ color: 'rgba(234,234,224,0.45)' }}>{w.text}</span>
          )}
        </div>
      ) : (
        <button onClick={() => setRevealedJp(true)} style={{ fontSize: 13, color: '#FF7D9D', fontWeight: 600, background: 'rgba(255,77,109,0.15)', border: 'none', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
          <EyeIcon size={13} /> Hiện tiếng Nhật
        </button>
      )}

      {/* Furigana */}
      {showFuri ? (
        <div style={{ fontFamily: "'Noto Sans JP', sans-serif", fontSize: 11, color: 'rgba(234,234,224,0.45)', letterSpacing: '0.04em', marginBottom: 6 }}>{sub.furigana}</div>
      ) : listeningMode.hideFurigana && (
        <button onClick={() => setRevealedFuri(true)} style={{ fontSize: 11, color: 'rgba(234,234,224,0.45)', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
          <EyeIcon size={11} /> Hiện cách đọc
        </button>
      )}

      {/* Vietnamese */}
      {showVi ? (
        <div style={{ fontSize: 13, color: 'rgba(234,234,224,0.55)', fontStyle: 'italic' }}>{sub.vietnamese}</div>
      ) : (
        <button onClick={() => setRevealedVi(true)} style={{ fontSize: 12, color: 'rgba(234,234,224,0.45)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
          <EyeIcon size={12} /> Hiện bản dịch
        </button>
      )}
    </div>
  )
}

// ─── Shadowing Panel ───────────────────────────────────────────────────────────

function ShadowingPanel({ sub, onContinue }: { sub: Subtitle; onContinue: () => void }) {
  const [recording, setRecording] = useState(false)
  const [score, setScore] = useState<number | null>(null)
  const waveRef = useRef<HTMLDivElement>(null)

  const startRecord = () => {
    setRecording(true)
    setScore(null)
    setTimeout(() => {
      setRecording(false)
      setScore(Math.floor(Math.random() * 20) + 75)
    }, 3000)
  }

  return (
    <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 80, background: 'rgba(20,19,16,0.95)', backdropFilter: 'blur(16px)', borderTop: '1px solid #2A2826', padding: '20px 32px' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#E53935', animation: 'pulseDot 1s ease-in-out infinite' }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: 'white', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Chế độ Shadowing</span>
          </div>
          <button onClick={onContinue} style={{ padding: '8px 20px', background: '#E53935', color: 'white', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            Tiếp tục →
          </button>
        </div>

        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontFamily: "'Noto Sans JP', sans-serif", fontSize: 24, color: 'white', marginBottom: 4 }}>
            {sub.words.map((w, i) => <span key={i}>{w.text}</span>)}
          </div>
          <div style={{ fontFamily: "'Noto Sans JP', sans-serif", fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>{sub.furigana}</div>
        </div>

        {/* Waveform animation */}
        <div ref={waveRef} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, height: 40, marginBottom: 16 }}>
          {Array.from({ length: 40 }).map((_, i) => (
            <div key={i} style={{
              width: 4, borderRadius: 2,
              background: recording ? '#E53935' : 'rgba(255,255,255,0.2)',
              height: recording ? `${Math.random() * 32 + 4}px` : '4px',
              transition: recording ? 'height 0.1s ease' : 'height 0.3s ease',
              animation: recording ? `waveBar 0.${3 + (i % 5)}s ease-in-out infinite alternate` : 'none',
            }} />
          ))}
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'center' }}>
          <button style={{ padding: '10px 20px', background: '#2A2826', border: '1px solid #3A3836', borderRadius: 10, fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)', cursor: 'pointer' }}>
            <RepeatIcon size={13} /> Nghe lại
          </button>
          <button
            onClick={startRecord}
            style={{ padding: '12px 28px', background: recording ? '#C62828' : '#E53935', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, boxShadow: recording ? '0 0 0 4px rgba(229,57,53,0.3)' : 'none', transition: 'all 0.2s ease' }}
          >
            <MicIcon size={15} />
            {recording ? 'Đang ghi...' : 'Ghi âm'}
          </button>
          {score !== null && (
            <div style={{ padding: '10px 20px', background: score >= 85 ? '#1B3A1F' : '#3A1A1A', border: `1px solid ${score >= 85 ? '#4CAF50' : '#E53935'}`, borderRadius: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 22, fontWeight: 800, color: score >= 85 ? '#69F0AE' : '#FF7043' }}>{score}</span>
              <div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Điểm</div>
                <div style={{ fontSize: 12, color: score >= 85 ? '#A5D6A7' : '#FFCCBC', fontWeight: 600 }}>{score >= 85 ? 'Xuất sắc!' : 'Tiếp tục luyện tập'}</div>
              </div>
            </div>
          )}
        </div>
      </div>
      <style>{`
        @keyframes pulseDot { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        @keyframes waveBar { from { height: 4px; } to { height: 32px; } }
      `}</style>
    </div>
  )
}

// ─── Right Panel Tabs ──────────────────────────────────────────────────────────

type PanelTab = 'transcript' | 'vocabulary' | 'grammar' | 'notes' | 'bookmarks' | 'chat'

function RightPanel({ subtitles, onWordClick, listeningMode, bookmarkedIds, onBookmark, activeSubIndex }: {
  subtitles: Subtitle[]
  onWordClick: (word: string) => void
  listeningMode: { hideJp: boolean; hideFurigana: boolean; hideVi: boolean; revealedIds: Set<number> }
  bookmarkedIds: Set<number>
  onBookmark: (id: number) => void
  activeSubIndex: number
}) {
  const [tab, setTab] = useState<PanelTab>('transcript')
  const [vocabFilter, setVocabFilter] = useState('all')
  const [chatMsg, setChatMsg] = useState('')
  const [chatHistory, setChatHistory] = useState<{ role: 'ai' | 'user'; text: string }[]>([
    { role: 'ai', text: "Xin chào! Tôi là gia sư AI của bạn cho video này. Hãy hỏi về bất kỳ câu, điểm ngữ pháp hoặc từ nào — tôi sẽ giải thích bằng ví dụ từ những gì bạn vừa xem." }
  ])
  const [note, setNote] = useState('')

  const tabs: { id: PanelTab; label: string }[] = [
    { id: 'transcript', label: 'Phụ đề' },
    { id: 'vocabulary', label: 'Từ vựng' },
    { id: 'grammar', label: 'Ngữ pháp' },
    { id: 'notes', label: 'Ghi chú' },
    { id: 'bookmarks', label: 'Đã lưu' },
    { id: 'chat', label: 'AI Chat' },
  ]

  const filteredVocab = vocabFilter === 'all' ? VOCAB_LIST : VOCAB_LIST.filter(v =>
    v.jlpt === vocabFilter.toUpperCase() || v.pos.toLowerCase().includes(vocabFilter) ||
    (vocabFilter === 'động từ' && v.pos.toLowerCase().includes('verb')) ||
    (vocabFilter === 'danh từ' && v.pos.toLowerCase().includes('noun')) ||
    (vocabFilter === 'tính từ' && v.pos.toLowerCase().includes('adj'))
  )

  const sendChat = () => {
    if (!chatMsg.trim()) return
    const q = chatMsg
    setChatMsg('')
    setChatHistory(h => [...h,
      { role: 'user' as const, text: q },
      { role: 'ai' as const, text: `Câu hỏi hay! Trong ngữ cảnh video này, "${q.slice(0, 30)}..." có liên quan đến một cấu trúc ngữ pháp tiếng Nhật quan trọng. Hãy để tôi phân tích bằng ví dụ từ những gì bạn đã xem...` }
    ])
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0D0D15', borderLeft: '1px solid rgba(255,255,255,0.07)' }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', overflowX: 'auto', borderBottom: '1px solid rgba(255,255,255,0.07)', background: '#13131C', scrollbarWidth: 'none' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '12px 14px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
            color: tab === t.id ? '#FF7D9D' : 'rgba(234,234,224,0.4)',
            borderBottom: `2px solid ${tab === t.id ? '#FF4D6D' : 'transparent'}`,
            transition: 'all 0.15s ease',
          }}>{t.label}</button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10, scrollbarWidth: 'thin' }}>

        {tab === 'transcript' && subtitles.map((sub, i) => (
          <SubtitleCard
            key={sub.id} sub={sub} active={i === activeSubIndex % SUBTITLES.length}
            onWordClick={onWordClick} listeningMode={listeningMode}
            onBookmark={onBookmark}
          />
        ))}

        {tab === 'vocabulary' && (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingBottom: 8 }}>
              {['all', 'N5', 'N4', 'N3', 'động từ', 'danh từ', 'tính từ'].map(f => (
                <button key={f} onClick={() => setVocabFilter(f)} style={{
                  padding: '4px 12px', borderRadius: 100, border: `1.5px solid ${vocabFilter === f ? '#E53935' : '#ECEAE4'}`,
                  background: vocabFilter === f ? '#FFEBEE' : 'white', color: vocabFilter === f ? '#E53935' : '#8C8679',
                  fontSize: 11, fontWeight: 700, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.04em',
                  transition: 'all 0.12s ease',
                }}>{f.toUpperCase()}</button>
              ))}
            </div>
            {filteredVocab.map(v => (
              <div key={v.word} style={{ padding: '14px 16px', background: '#171722', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer' }}
                onClick={() => onWordClick(v.word)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <div>
                    <span style={{ fontFamily: "'Noto Sans JP', sans-serif", fontSize: 18, color: '#EAEAE0', marginRight: 8 }}>{v.word}</span>
                    <span style={{ fontFamily: "'Noto Sans JP', sans-serif", fontSize: 12, color: 'rgba(234,234,224,0.45)' }}>{v.reading}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 5 }}>
                    <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, background: 'rgba(255,77,109,0.15)', color: '#FF7D9D' }}>{v.jlpt}</span>
                    {v.saved && <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, background: 'rgba(16,185,129,0.15)', color: '#2E7D32' }}>Đã lưu</span>}
                  </div>
                </div>
                <div style={{ fontSize: 13, color: 'rgba(234,234,224,0.55)', marginBottom: 8 }}>{v.meaning}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 10, color: 'rgba(234,234,224,0.35)', fontWeight: 600 }}>THÀNH THẠO</span>
                  <div style={{ flex: 1, height: 5, background: 'rgba(255,255,255,0.04)', borderRadius: 100, overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: v.mastery > 70 ? '#4CAF50' : v.mastery > 40 ? '#FF9800' : '#E53935', width: `${v.mastery}%`, borderRadius: 100 }} />
                  </div>
                  <span style={{ fontSize: 10, color: 'rgba(234,234,224,0.45)', fontWeight: 600 }}>{v.mastery}%</span>
                </div>
              </div>
            ))}
          </>
        )}

        {tab === 'grammar' && GRAMMAR_LIST.map((g, i) => (
          <div key={i} style={{ padding: '16px 18px', background: '#171722', borderRadius: 14, border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div style={{ fontFamily: "'Noto Sans JP', sans-serif", fontSize: 17, fontWeight: 600, color: '#FF7D9D' }}>{g.pattern}</div>
              <span style={{ padding: '3px 10px', borderRadius: 100, fontSize: 10, fontWeight: 700, background: 'rgba(255,77,109,0.15)', color: '#FF7D9D' }}>{g.difficulty}</span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'rgba(234,234,224,0.85)', marginBottom: 6 }}>{g.meaning}</div>
            <div style={{ fontSize: 13, color: 'rgba(234,234,224,0.55)', marginBottom: 10, lineHeight: 1.6 }}>{g.usage}</div>
            <div style={{ padding: '10px 14px', background: '#09090F', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ fontFamily: "'Noto Sans JP', sans-serif", fontSize: 14, color: 'rgba(234,234,224,0.85)' }}>{g.example}</div>
            </div>
          </div>
        ))}

        {tab === 'notes' && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(234,234,224,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Ghi chú cá nhân</div>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Viết ghi chú về bài học này... Hỗ trợ **in đậm**, *nghiêng* và - danh sách."
              style={{ width: '100%', minHeight: 220, background: '#171722', border: '1.5px solid #ECEAE4', borderRadius: 12, padding: '14px 16px', fontSize: 13.5, color: '#3D3A33', resize: 'vertical', outline: 'none', fontFamily: 'Inter, sans-serif', lineHeight: 1.7, transition: 'border-color 0.15s ease' }}
              onFocus={e => { e.target.style.borderColor = '#E53935' }}
              onBlur={e => { e.target.style.borderColor = '#ECEAE4' }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button style={{ flex: 1, padding: '10px', background: '#E53935', color: 'white', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Lưu ghi chú</button>
              <button style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.04)', color: 'rgba(234,234,224,0.55)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                <BrainIcon size={13} /> Tóm tắt AI
              </button>
            </div>
          </div>
        )}

        {tab === 'bookmarks' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {SUBTITLES.filter(s => bookmarkedIds.has(s.id)).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'rgba(234,234,224,0.35)' }}>
                <BookmarkIcon size={28} />
                <div style={{ marginTop: 12, fontSize: 14, fontWeight: 500 }}>Chưa có mục đã lưu</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>Nhấn biểu tượng bookmark trên bất kỳ phụ đề nào</div>
              </div>
            ) : SUBTITLES.filter(s => bookmarkedIds.has(s.id)).map(sub => (
              <div key={sub.id} style={{ padding: '14px 16px', background: '#171722', borderRadius: 12, border: '1.5px solid #FFCDD2' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                  <ClockIcon size={12} />
                  <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'rgba(234,234,224,0.45)' }}>{sub.start}</span>
                  <span style={{ color: '#FF7D9D', marginLeft: 'auto' }}><BookmarkIcon filled size={13} /></span>
                </div>
                <div style={{ fontFamily: "'Noto Sans JP', sans-serif", fontSize: 15, color: 'rgba(234,234,224,0.85)', marginBottom: 4 }}>{sub.words.map(w => w.text).join('')}</div>
                <div style={{ fontSize: 12, color: 'rgba(234,234,224,0.55)', fontStyle: 'italic' }}>{sub.vietnamese}</div>
              </div>
            ))}
          </div>
        )}

        {tab === 'chat' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 12 }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0, overflowY: 'auto' }}>
              {chatHistory.map((m, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  {m.role === 'ai' && (
                    <div style={{ width: 26, height: 26, borderRadius: 8, background: 'linear-gradient(135deg, #FF4D6D, #C2185B)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', flexShrink: 0, marginRight: 8, marginTop: 2 }}>
                      <BrainIcon size={12} />
                    </div>
                  )}
                  <div style={{ maxWidth: '80%', padding: '10px 14px', borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px', background: m.role === 'user' ? '#FF4D6D' : 'rgba(255,255,255,0.07)', color: m.role === 'user' ? 'white' : 'rgba(234,234,224,0.8)', fontSize: 13, lineHeight: 1.7, border: m.role === 'ai' ? '1px solid rgba(255,255,255,0.1)' : 'none' }}>
                    {m.text}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
              <input
                value={chatMsg}
                onChange={e => setChatMsg(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendChat()}
                placeholder="Hỏi về câu hoặc ngữ pháp..."
                style={{ flex: 1, background: '#171722', border: '1.5px solid #ECEAE4', borderRadius: 10, padding: '9px 12px', fontSize: 13, outline: 'none', fontFamily: 'Inter, sans-serif', color: 'rgba(234,234,224,0.85)', transition: 'border-color 0.15s ease' }}
                onFocus={e => { e.target.style.borderColor = '#E53935' }}
                onBlur={e => { e.target.style.borderColor = '#ECEAE4' }}
              />
              <button onClick={sendChat} style={{ width: 36, height: 36, background: '#E53935', border: 'none', borderRadius: 10, color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <SendIcon size={13} />
              </button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {['Giải thích câu này', 'Tại sao dùng は?', 'Thêm ví dụ', 'Dịch nghĩa đen'].map(s => (
                <button key={s} onClick={() => { setChatMsg(s); }} style={{ padding: '4px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 100, fontSize: 11, fontWeight: 500, color: 'rgba(234,234,224,0.55)', cursor: 'pointer' }}>{s}</button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Video Learning Page ──────────────────────────────────────────────────

export default function VideoLearning() {
  const [stage, setStage] = useState<'import' | 'processing' | 'player'>('import')
  const [selectedWord, setSelectedWord] = useState<string | null>(null)
  const [shadowing, setShadowing] = useState(false)
  const [activeSubIndex, setActiveSubIndex] = useState(2)
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<number>>(new Set())
  const [listeningMode, setListeningMode] = useState({
    hideJp: false,
    hideFurigana: false,
    hideVi: false,
    revealedIds: new Set<number>(),
  })

  const handleWordClick = useCallback((word: string) => {
    if (WORD_DETAIL[word]) setSelectedWord(word)
  }, [])

  const handleBookmark = useCallback((id: number) => {
    setBookmarkedIds(s => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }, [])

  const toggleListeningHide = (key: 'hideJp' | 'hideFurigana' | 'hideVi') => {
    setListeningMode(m => ({ ...m, [key]: !m[key] }))
  }

  if (stage === 'import') return <ImportScreen onImport={() => setStage('processing')} />
  if (stage === 'processing') return <ProcessingScreen onDone={() => setStage('player')} />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)', overflow: 'hidden', background: '#09090F' }}>
      {/* Top lesson bar */}
      <div style={{ padding: '10px 20px', background: '#13131C', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: '#09090F', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            <img src="https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=72&h=72&fit=crop&auto=format" alt="Video thumbnail" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#EAEAE0' }}>Cuộc sống hàng ngày ở Tokyo — Vlog tiếng Nhật</div>
            <div style={{ fontSize: 11, color: 'rgba(234,234,224,0.45)' }}>1:32 · JLPT N4-N3 · 47 từ vựng · 8 ngữ pháp</div>
          </div>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Listening mode controls */}
          <div style={{ display: 'flex', gap: 4, padding: '4px 6px', background: 'rgba(255,255,255,0.04)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)' }}>
            <span style={{ fontSize: 11, color: 'rgba(234,234,224,0.45)', fontWeight: 600, alignSelf: 'center', paddingRight: 4 }}>Ẩn:</span>
            {[
              { key: 'hideJp' as const, label: 'JP', title: 'Ẩn tiếng Nhật' },
              { key: 'hideFurigana' as const, label: 'ふり', title: 'Ẩn Furigana' },
              { key: 'hideVi' as const, label: 'VN', title: 'Ẩn tiếng Việt' },
            ].map(item => (
              <button key={item.key} title={item.title} onClick={() => toggleListeningHide(item.key)} style={{ padding: '4px 10px', borderRadius: 7, fontSize: 11, fontWeight: 700, border: 'none', cursor: 'pointer', background: listeningMode[item.key] ? '#FF4D6D' : 'rgba(255,255,255,0.07)', color: listeningMode[item.key] ? 'white' : 'rgba(234,234,224,0.45)', transition: 'all 0.12s ease', fontFamily: item.key === 'hideFurigana' ? "'Noto Sans JP', sans-serif" : 'Inter, sans-serif' }}>
                {listeningMode[item.key] ? <EyeOffIcon size={11} /> : item.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShadowing(s => !s)}
            style={{ padding: '8px 16px', background: shadowing ? '#FF4D6D' : 'rgba(255,255,255,0.06)', border: `1.5px solid ${shadowing ? '#FF4D6D' : 'rgba(255,255,255,0.1)'}`, borderRadius: 10, fontSize: 12, fontWeight: 700, color: shadowing ? 'white' : 'rgba(234,234,224,0.55)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.15s ease' }}
          >
            <MicIcon size={13} /> Shadowing
          </button>

          <button style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, fontSize: 12, fontWeight: 600, color: 'rgba(234,234,224,0.55)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <StarIcon size={13} /> Ôn tập
          </button>
        </div>
      </div>

      {/* Main layout */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 340px', overflow: 'hidden', minHeight: 0 }}>
        {/* Left: video + subtitles */}
        <div style={{ overflowY: 'auto', padding: '20px 20px 80px', display: 'flex', flexDirection: 'column', gap: 16, scrollbarWidth: 'thin' }}>
          <VideoPlayer shadowing={shadowing} onWordClick={handleWordClick} activeSubIndex={activeSubIndex} />

          {/* Subtitle timeline title */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(234,234,224,0.45)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Dòng thời gian phụ đề · {SUBTITLES.length} câu
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {SUBTITLES.map((_, i) => (
                <button key={i} onClick={() => setActiveSubIndex(i)} style={{ width: 24, height: 24, borderRadius: 7, border: 'none', cursor: 'pointer', background: i === activeSubIndex % SUBTITLES.length ? '#E53935' : '#F5F4F0', color: i === activeSubIndex % SUBTITLES.length ? 'white' : '#8C8679', fontSize: 10, fontWeight: 700, transition: 'all 0.12s' }}>{i + 1}</button>
              ))}
            </div>
          </div>

          {/* Subtitle cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {SUBTITLES.map((sub, i) => (
              <SubtitleCard
                key={sub.id} sub={sub}
                active={i === activeSubIndex % SUBTITLES.length}
                onWordClick={handleWordClick} listeningMode={listeningMode}
                onBookmark={handleBookmark}
              />
            ))}
          </div>
        </div>

        {/* Right panel */}
        <RightPanel
          subtitles={SUBTITLES} onWordClick={handleWordClick}
          listeningMode={listeningMode} bookmarkedIds={bookmarkedIds}
          onBookmark={handleBookmark} activeSubIndex={activeSubIndex}
        />
      </div>

      {/* Word popup */}
      {selectedWord && (
        <WordPopup word={selectedWord} onClose={() => setSelectedWord(null)} />
      )}

      {/* Shadowing panel */}
      {shadowing && (
        <ShadowingPanel
          sub={SUBTITLES[activeSubIndex % SUBTITLES.length]}
          onContinue={() => { setActiveSubIndex(i => (i + 1) % SUBTITLES.length) }}
        />
      )}
    </div>
  )
}
