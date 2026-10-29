import React, { useState, useCallback } from 'react'
import { RefreshCw, ArrowUpRight } from 'lucide-react'
import { sumiAudio } from './sumiAudio'

export interface WordOfTheDayCharacter {
  char: string
  hanViet: string
  strokes: number
  radical: string
  meaning: string
}

export interface WordOfTheDayItem {
  kanji: string
  reading: string
  hanViet: string
  romaji: string
  essence: string
  quoteJp: string
  quoteRuby: Array<{ base: string; rt?: string }>
  quoteAuthor: string
  quoteVi: string
  radicals: string
  characters: WordOfTheDayCharacter[]
}

/**
 * Artisan Ink Sound Wave Icon (Thanh âm gợn sóng - 響き)
 * Simulates ripples radiating through serene water / washi ink fibers,
 * replacing the generic software loudspeaker horn with authentic Japanese calligraphic resonance.
 */
function InkSoundWaveIcon({ className, size = 22, isPlaying = false }: { className?: string; size?: number; isPlaying?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* Central Ink Sound Seed (Hạt âm mộc) */}
      <circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none" />
      {/* Harmonic sound ripples imitating water droplets in Suikinkutsu / ink waves */}
      <path
        d="M9 8.5C10.3 9.5 11 10.7 11 12C11 13.3 10.3 14.5 9 15.5"
        className={isPlaying ? 'ink-wave-1' : ''}
      />
      <path
        d="M13.5 6C15.8 7.8 17 9.8 17 12C17 14.2 15.8 16.2 13.5 18"
        strokeOpacity="0.85"
        className={isPlaying ? 'ink-wave-2' : ''}
      />
      <path
        d="M18 3.5C21 5.8 22.5 8.8 22.5 12C22.5 15.2 21 18.2 18 20.5"
        strokeOpacity="0.55"
        className={isPlaying ? 'ink-wave-3' : ''}
      />
    </svg>
  )
}

export const MASTER_WORDS_OF_THE_DAY: WordOfTheDayItem[] = [
  {
    kanji: '一期一会',
    reading: 'いちごいちえ',
    hanViet: 'NHẤT KỲ NHẤT HỘI',
    romaji: 'Ichigo Ichie',
    essence: 'Trân quý khoảnh khắc độc nhất vô nhị giữa cõi nhân sinh.',
    quoteJp: '世の中の人の心も一期一会、ただ一瞬の輝きを愛しむべし。',
    quoteRuby: [
      { base: '世', rt: 'よ' },
      { base: 'の' },
      { base: '中', rt: 'なか' },
      { base: 'の' },
      { base: '人', rt: 'ひと' },
      { base: 'の' },
      { base: '心', rt: 'こころ' },
      { base: 'も' },
      { base: '一', rt: 'いち' },
      { base: '期', rt: 'ご' },
      { base: '一', rt: 'いち' },
      { base: '会', rt: 'え' },
      { base: '、ただ' },
      { base: '一', rt: 'いっ' },
      { base: '瞬', rt: 'しゅん' },
      { base: 'の' },
      { base: '輝', rt: 'かがや' },
      { base: 'きを' },
      { base: '愛', rt: 'お' },
      { base: 'しむべし。' },
    ],
    quoteAuthor: '千利休 · Sen no Rikyū (Trà đạo)',
    quoteVi: 'Lòng người nơi cõi thế cũng là nhất kỳ nhất hội; hãy nâng niu và trân trọng từng khoảnh khắc lóe sáng của đời người.',
    radicals: '一 (Nhất) · 其 (Kỳ) · 会 (Hội)',
    characters: [
      { char: '一', hanViet: 'NHẤT', strokes: 1, radical: 'Bộ Nhất (一)', meaning: 'Khởi đầu nguyên sơ của vạn vật' },
      { char: '期', hanViet: 'KỲ', strokes: 12, radical: 'Bộ Nguyệt (月)', meaning: 'Thời khắc, ước hẹn tuần hoàn' },
      { char: '一', hanViet: 'NHẤT', strokes: 1, radical: 'Bộ Nhất (一)', meaning: 'Duy nhất, không lặp lại trong cõi thế' },
      { char: '会', hanViet: 'HỘI', strokes: 6, radical: 'Bộ Nhân (人)', meaning: 'Gặp gỡ, tao ngộ duyên lành' },
    ],
  },
  {
    kanji: '花鳥風月',
    reading: 'かちょうふうげつ',
    hanViet: 'HOA ĐIỂU PHONG NGUYỆT',
    romaji: 'Kachō Fūgetsu',
    essence: 'Vẻ đẹp tao nhã của bốn mùa và sự hòa điệu cùng thiên nhiên.',
    quoteJp: '目に見えるものすべてに、季節の息吹と詩心が宿る。',
    quoteRuby: [
      { base: '目', rt: 'め' },
      { base: 'に' },
      { base: '見', rt: 'み' },
      { base: 'えるものすべてに、' },
      { base: '季', rt: 'き' },
      { base: '節', rt: 'せつ' },
      { base: 'の' },
      { base: '息', rt: 'い' },
      { base: '吹', rt: 'ぶき' },
      { base: 'と' },
      { base: '詩', rt: 'し' },
      { base: '心', rt: 'ごころ' },
      { base: 'が' },
      { base: '宿', rt: 'やど' },
      { base: 'る。' },
    ],
    quoteAuthor: '松尾芭蕉 · Matsuo Bashō (Thiền sư Haiku)',
    quoteVi: 'Trong vạn vật mà mắt ta ngắm nhìn, thảy đều lắng đọng hơi thở của mùa màng và tâm hồn thi phú.',
    radicals: '艸 (Thảo) · 鳥 (Điểu) · 風 (Phong) · 月 (Nguyệt)',
    characters: [
      { char: '花', hanViet: 'HOA', strokes: 7, radical: 'Bộ Thảo (艸)', meaning: 'Sắc hương rực rỡ của mùa xuân' },
      { char: '鳥', hanViet: 'ĐIỂU', strokes: 11, radical: 'Bộ Điểu (鳥)', meaning: 'Cánh chim trời hạ tự do bay lượn' },
      { char: '風', hanViet: 'PHONG', strokes: 9, radical: 'Bộ Phong (風)', meaning: 'Làn gió thu thanh mát xao xác lá' },
      { char: '月', hanViet: 'NGUYỆT', strokes: 4, radical: 'Bộ Nguyệt (月)', meaning: 'Vầng trăng vằng vặc giữa đêm đông' },
    ],
  },
  {
    kanji: '侘寂',
    reading: 'わびさび',
    hanViet: 'SÁP TỊCH',
    romaji: 'Wabi-Sabi',
    essence: 'Tìm thấy vẻ đẹp thiêng liêng trong sự giản dị và vô thường rạn vỡ.',
    quoteJp: '完全なるものは美にあらず。欠けたる器にこそ月影宿る。',
    quoteRuby: [
      { base: '完', rt: 'かん' },
      { base: '全', rt: 'ぜん' },
      { base: 'なるものは' },
      { base: '美', rt: 'び' },
      { base: 'にあらず。' },
      { base: '欠', rt: 'か' },
      { base: 'けたる' },
      { base: '器', rt: 'うつわ' },
      { base: 'にこそ' },
      { base: '月', rt: 'つき' },
      { base: '影', rt: 'かげ' },
      { base: '宿', rt: 'やど' },
      { base: 'る。' },
    ],
    quoteAuthor: '日本の美意識 · Trực cảm mỹ học Zen',
    quoteVi: 'Những thứ vẹn toàn chưa hẳn đã là cái đẹp tuyệt mỹ. Chính nơi chiếc chén rạn vỡ mới là nơi bóng trăng soi rọi tỏ tường nhất.',
    radicals: '亻(Nhân) · 宀 (Miên) · 叔 (Thúc)',
    characters: [
      { char: '侘', hanViet: 'SÁP', strokes: 8, radical: 'Bộ Nhân (亻)', meaning: 'Đơn sơ, đạm bạc, xa lánh xô bồ' },
      { char: '寂', hanViet: 'TỊCH', strokes: 11, radical: 'Bộ Miên (宀)', meaning: 'Tĩnh lặng, lắng đọng cùng năm tháng' },
    ],
  },
  {
    kanji: '木漏れ日',
    reading: 'こもれび',
    hanViet: 'MỘC LẬU NHẬT',
    romaji: 'Komorebi',
    essence: 'Những tia nắng vàng lọc qua vòm lá râm mát trong ban mai tĩnh lặng.',
    quoteJp: '風渡れば、緑の影に金色の光零る。',
    quoteRuby: [
      { base: '風', rt: 'かぜ' },
      { base: '渡', rt: 'わた' },
      { base: 'れば、' },
      { base: '緑', rt: 'みどり' },
      { base: 'の' },
      { base: '影', rt: 'かげ' },
      { base: 'に' },
      { base: '金', rt: 'きん' },
      { base: '色', rt: 'いろ' },
      { base: 'の' },
      { base: '光', rt: 'ひかり' },
      { base: '零', rt: 'こぼ' },
      { base: 'る。' },
    ],
    quoteAuthor: '樋口一葉 · Higuchi Ichiyō',
    quoteVi: 'Khi làn gió thổi qua, những đốm sáng dát vàng lại khẽ rơi nghiêng trên từng bóng râm mát rượi.',
    radicals: '木 (Mộc) · 水 (Thủy) · 日 (Nhật)',
    characters: [
      { char: '木', hanViet: 'MỘC', strokes: 4, radical: 'Bộ Mộc (木)', meaning: 'Tán cây cổ thụ sum suê bóng mát' },
      { char: '漏', hanViet: 'LẬU', strokes: 14, radical: 'Bộ Thủy (氵)', meaning: 'Giọt rỉ, kẽ hở lọc ánh ban mai' },
      { char: '日', hanViet: 'NHẬT', strokes: 4, radical: 'Bộ Nhật (日)', meaning: 'Vầng thái dương, nguồn sống tự nhiên' },
    ],
  },
  {
    kanji: '心',
    reading: 'こころ',
    hanViet: 'TÂM',
    romaji: 'Kokoro',
    essence: 'Tâm hồn, cảm xúc sâu lắng và bản ngã chân thật của con người.',
    quoteJp: '他人の心を知るには、まず己の心の静寂を聴かねばならぬ。',
    quoteRuby: [
      { base: '他', rt: 'た' },
      { base: '人', rt: 'にん' },
      { base: 'の' },
      { base: '心', rt: 'こころ' },
      { base: 'を' },
      { base: '知', rt: 'し' },
      { base: 'るには、まず' },
      { base: '己', rt: 'おのれ' },
      { base: 'の' },
      { base: '心', rt: 'こころ' },
      { base: 'の' },
      { base: '静', rt: 'せい' },
      { base: '寂', rt: 'じゃく' },
      { base: 'を' },
      { base: '聴', rt: 'き' },
      { base: 'かねばならぬ。' },
    ],
    quoteAuthor: '夏目漱石 · Natsume Sōseki',
    quoteVi: 'Muốn thấu hiểu được lòng người, trước hết phải biết lắng nghe sự tĩnh lặng nơi đáy lòng của chính mình.',
    radicals: '心 (Tâm bộ)',
    characters: [
      { char: '心', hanViet: 'TÂM', strokes: 4, radical: 'Bộ Tâm (心)', meaning: 'Tấm lòng, nguồn cội của mọi trực cảm' },
    ],
  },
  {
    kanji: '夢',
    reading: 'ゆめ',
    hanViet: 'MỘNG',
    romaji: 'Yume',
    essence: 'Giấc mơ, khát vọng và vẻ đẹp huyền ảo giữa cuộc đời phù thế.',
    quoteJp: '夢幻の如く、儚くも美しきこの浮世をゆく。',
    quoteRuby: [
      { base: '夢', rt: 'ゆ' },
      { base: '幻', rt: 'げん' },
      { base: 'の' },
      { base: '如', rt: 'ごと' },
      { base: 'く、' },
      { base: '儚', rt: 'はかな' },
      { base: 'くも' },
      { base: '美', rt: 'うつく' },
      { base: 'しきこの' },
      { base: '浮', rt: 'うき' },
      { base: '世', rt: 'よ' },
      { base: 'をゆく。' },
    ],
    quoteAuthor: '芥川龍之介 · Akutagawa Ryūnosuke',
    quoteVi: 'Tựa như giấc mộng giữa chốn phù hoa, dẫu mong manh ngắn ngủi nhưng vẫn trọn vẹn nét đẹp thiêng liêng.',
    radicals: '夕 (Tịch) · 艸 (Thảo) · 罒 (Võng)',
    characters: [
      { char: '夢', hanViet: 'MỘNG', strokes: 13, radical: 'Bộ Tịch (夕)', meaning: 'Giấc mơ, ảo ảnh tuyệt mỹ của kiếp người' },
    ],
  },
]

interface DictionaryWordOfTheDayProps {
  onSearch: (word: string) => void
  onSpeak?: (text: string) => void
}

export function DictionaryWordOfTheDay({ onSearch, onSpeak }: DictionaryWordOfTheDayProps) {
  // Default to day of month so each day has a natural word, while allowing user cycling
  const initialIndex = () => {
    try {
      const today = new Date().getDate()
      return today % MASTER_WORDS_OF_THE_DAY.length
    } catch {
      return 0
    }
  }

  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [isHankoPressed, setIsHankoPressed] = useState(false)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)

  const fallbackWord = MASTER_WORDS_OF_THE_DAY[0] as WordOfTheDayItem
  const current: WordOfTheDayItem = MASTER_WORDS_OF_THE_DAY[currentIndex] ?? fallbackWord

  const handleCycleWord = useCallback(() => {
    try {
      sumiAudio.playSuikinkutsu()
    } catch {
      // ignore
    }
    setIsTransitioning(true)
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % MASTER_WORDS_OF_THE_DAY.length)
      setIsTransitioning(false)
    }, 180)
  }, [])

  const handleHankoClick = useCallback(() => {
    try {
      sumiAudio.playHankoStamp()
    } catch {
      // ignore
    }
    setIsHankoPressed(true)
    setTimeout(() => setIsHankoPressed(false), 360)
  }, [])

  const handleSpeak = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      setIsSpeaking(true)
      setTimeout(() => setIsSpeaking(false), 1400)
      if (onSpeak) {
        onSpeak(current.kanji)
      } else if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
        const utterance = new SpeechSynthesisUtterance(current.kanji)
        utterance.lang = 'ja-JP'
        utterance.rate = 0.88
        utterance.onend = () => setIsSpeaking(false)
        utterance.onerror = () => setIsSpeaking(false)
        window.speechSynthesis.speak(utterance)
      }
    },
    [current.kanji, onSpeak]
  )

  const handleKanjiHover = useCallback(() => {
    try {
      sumiAudio.playBrushFriction()
    } catch {
      // ignore
    }
  }, [])

  return (
    <article
      className="wotd-stage"
      aria-label="Tác phẩm thư pháp - Từ của ngày"
    >
      {/* Decorative Faint Guideline */}
      <div className="wotd-stage__guideline" aria-hidden="true" />

      {/* Top Bar: Eyebrow, Ready Indicator, and Refined Thin Cycle Action */}
      <header className="wotd-stage__header">
        <div className="wotd-stage__eyebrow-group">
          <span className="wotd-stage__hanko-mark" aria-hidden="true">
            典
          </span>
          <span className="wotd-stage__eyebrow-text">
            <span>Sẵn sàng tra cứu</span>
            <span className="wotd-stage__sep">·</span>
            <span>本日の名言</span>
          </span>
        </div>
        <div className="wotd-stage__header-actions">
          <button
            type="button"
            className="wotd-stage__cycle-btn"
            onClick={handleCycleWord}
            aria-label="Đổi câu danh ngôn thư pháp khác"
            title="Khám phá tuyệt phẩm từ ngữ khác"
          >
            <RefreshCw
              size={12}
              strokeWidth={1.3}
              className={`wotd-stage__cycle-icon ${isTransitioning ? 'wotd-spin' : ''}`}
              aria-hidden="true"
            />
            <span>Đổi chữ ngẫu hứng</span>
          </button>
        </div>
      </header>

      {/* Centerpiece Stage: Perfectly Balanced 2-Column Spread */}
      <div className={`wotd-stage__body ${isTransitioning ? 'is-fading' : ''}`}>
        {/* Left Column: Typographic Monument & Literary Quote */}
        <div className="wotd-stage__primary-col">
          <div className="wotd-stage__hero">
            <div className="wotd-stage__glyph-row">
              <h2
                className="wotd-stage__glyph"
                onMouseEnter={handleKanjiHover}
                title={`Chữ Hán: ${current.kanji} (${current.hanViet})`}
              >
                {current.kanji}
              </h2>
              <button
                type="button"
                className={`wotd-stage__audio-btn ${isSpeaking ? 'is-speaking' : ''}`}
                onClick={handleSpeak}
                aria-label={`Nghe thanh âm ${current.kanji}`}
                title="Lắng nghe thanh âm Kotodama (Phát âm tiếng Nhật)"
              >
                <InkSoundWaveIcon size={21} isPlaying={isSpeaking} />
              </button>
            </div>

            <div className="wotd-stage__meta-row">
              <span className="wotd-stage__ruby">{current.reading}</span>
              <span className="wotd-stage__sep">·</span>
              <span className="wotd-stage__romaji">{current.romaji}</span>
              <span className="wotd-stage__sep">·</span>
              <span className="wotd-stage__hanviet">〔{current.hanViet}〕</span>
            </div>

            <p className="wotd-stage__essence">{current.essence}</p>
          </div>

          {/* Literary Quote Card with Furigana (Open, hairline vermilion left rule) */}
          <blockquote className="wotd-stage__quote-card">
            <div className="wotd-stage__quote-jp" lang="ja">
              {current.quoteRuby.map((token, i) => (
                <React.Fragment key={i}>
                  {token.rt ? (
                    <ruby>
                      {token.base}
                      <rt>{token.rt}</rt>
                    </ruby>
                  ) : (
                    <span>{token.base}</span>
                  )}
                </React.Fragment>
              ))}
            </div>
            <footer className="wotd-stage__quote-footer">
              <cite className="wotd-stage__quote-author">— {current.quoteAuthor}</cite>
              <p className="wotd-stage__quote-vi">“{current.quoteVi}”</p>
            </footer>
          </blockquote>
        </div>

        {/* Right Column: Chiết Tự Anatomy, Radical Constellation & Living Hanko */}
        <div className="wotd-stage__secondary-col">
          <div className="wotd-stage__etymology-panel">
            <div className="wotd-stage__etymology-header">
              <span className="wotd-stage__etymology-seal" aria-hidden="true">解</span>
              <span className="wotd-stage__etymology-title">BẢN ĐỒ CHIẾT TỰ</span>
              <span className="wotd-stage__etymology-dot" aria-hidden="true">·</span>
              <span className="wotd-stage__etymology-sub">Cấu trúc tự vị</span>
            </div>

            <div className="wotd-stage__etymology-list">
              {current.characters.map((ch, idx) => (
                <div
                  key={`${ch.char}-${idx}`}
                  className="wotd-stage__etymology-item"
                  onMouseEnter={handleKanjiHover}
                >
                  <div className="wotd-stage__etymology-char-badge" title={`${ch.char} · ${ch.strokes} nét`}>
                    <span>{ch.char}</span>
                  </div>
                  <div className="wotd-stage__etymology-info">
                    <div className="wotd-stage__etymology-row-top">
                      <strong className="wotd-stage__etymology-hanviet">{ch.hanViet}</strong>
                      <span className="wotd-stage__etymology-meta">{ch.strokes} nét · {ch.radical}</span>
                    </div>
                    <p className="wotd-stage__etymology-meaning">{ch.meaning}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="wotd-stage__radicals-summary">
              <span className="wotd-stage__radicals-label">Bộ thủ cấu thành:</span>
              <span className="wotd-stage__radicals-val">{current.radicals}</span>
            </div>
          </div>

          {/* Borderless Actions & Living Breathing Red Hanko Seal */}
          <div className="wotd-stage__footer-actions">
            <button
              type="button"
              className="wotd-stage__explore-link"
              onClick={() => onSearch(current.kanji)}
              title={`Tra cứu chi tiết chữ ${current.kanji}`}
            >
              <span className="wotd-stage__explore-seal" aria-hidden="true">檢</span>
              <span className="wotd-stage__explore-text">Tra cứu từ này</span>
              <ArrowUpRight size={14} className="wotd-stage__explore-arrow" aria-hidden="true" />
            </button>

            {/* The Living Breathing Red Hanko Seal */}
            <button
              type="button"
              className={`wotd-stage__living-hanko ${isHankoPressed ? 'is-pressed' : ''}`}
              onClick={handleHankoClick}
              title="Ấn triện Kotodama (Nhấp để dập con dấu)"
              aria-label="Ấn triện đỏ Kotodama (Nhấp để nghe âm thanh dập dấu gỗ)"
            >
              <span className="wotd-stage__hanko-inner">言霊</span>
              <span className="wotd-stage__hanko-pulse" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </article>
  )
}
