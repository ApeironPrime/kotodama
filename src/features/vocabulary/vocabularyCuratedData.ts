import type { CurriculumCourseCard } from '../../types/curriculum'
import type { WatojiPalette, WatojiPattern } from './WatojiBookCover'

export type CuratedTrackId = 'core' | 'sprinters' | 'immersion' | 'specialized'

export interface CuratedTrackDef {
  id: CuratedTrackId
  kanji: string
  title: string
  subHeading: string
  description: string
  pedagogyTag: string
  roadmapTip: string
  coverPalette: WatojiPalette
  coverPattern: WatojiPattern
}

export const CURATED_TRACKS: Record<CuratedTrackId, CuratedTrackDef> = {
  core: {
    id: 'core',
    kanji: '基盤',
    title: 'Dòng Cốt Lõi',
    subHeading: 'Xây dựng gốc rễ bài bản & toàn diện',
    description:
      'Học toàn diện hệ thống từ vựng gắn chặt với ngữ pháp chuẩn mực và hội thoại đời sống. Xây dựng gốc rễ ngôn ngữ vững chãi ngay từ những bài học đầu tiên.',
    pedagogyTag: 'Ngữ pháp tích hợp • Giao tiếp nền tảng',
    roadmapTip:
      'Khuyên dùng cho người mới học (N5–N4) để tạo khung tư duy ngôn ngữ tự nhiên trước khi bước vào luyện thi đề.',
    coverPalette: 'aizumi',
    coverPattern: 'seigaiha',
  },
  sprinters: {
    id: 'sprinters',
    kanji: '突破',
    title: 'Dòng Luyện Thi Cấp Tốc',
    subHeading: 'Bứt phá điểm thi theo tuần thực chiến',
    description:
      'Phân bổ theo lộ trình 6–8 tuần nước rút. Tổng hợp từ vựng tần suất cao trong đề thi JLPT kèm mẹo phân biệt bẫy ngữ nghĩa và dạng bài then chốt.',
    pedagogyTag: 'Tần suất thi cử • Chiến lược điểm số',
    roadmapTip: 'Khuyên dùng khi còn 1–2 tháng trước kỳ thi JLPT để tổng ôn có hệ thống và rà soát điểm mù từ vựng.',
    coverPalette: 'shuiro',
    coverPattern: 'asanoha',
  },
  immersion: {
    id: 'immersion',
    kanji: '体得',
    title: 'Dòng Phản Xạ & Ứng Dụng',
    subHeading: 'Khắc sâu qua phản xạ âm thanh & ngữ cảnh',
    description:
      'Ghi nhớ từ vựng qua chuỗi âm thanh và 100% ngữ cảnh câu trọn vẹn. Hiểu cách dùng từ chuẩn sắc thái người bản xứ, xóa bỏ tư duy dịch thô từng từ đơn lẻ.',
    pedagogyTag: 'Phản xạ thính giác • Ngữ cảnh trọn vẹn',
    roadmapTip:
      'Khuyên dùng cho người muốn nghe nói tự nhiên, phản xạ giao tiếp trôi chảy và tích lũy bền vững vào kho nhớ SRS.',
    coverPalette: 'matcha',
    coverPattern: 'shippo',
  },
  specialized: {
    id: 'specialized',
    kanji: '専修',
    title: 'Dòng Chuyên Ngành & Nâng Cao',
    subHeading: 'Thuật ngữ kỹ thuật & Thực chiến công việc',
    description:
      'Vốn từ chuyên môn sâu về phát triển phần mềm (SE/BrSE), kiến trúc hệ thống, thương mại, y tế và kỹ thuật trong môi trường làm việc thực tế với khách hàng Nhật Bản.',
    pedagogyTag: 'Thuật ngữ chuyên sâu • Thực tế dự án',
    roadmapTip:
      'Khuyên dùng cho kỹ sư phần mềm, nhân sự thương mại và người đi làm muốn làm chủ ngôn ngữ công việc chuyên biệt.',
    coverPalette: 'kokutan',
    coverPattern: 'kumiko',
  },
}

export interface CuratedCourseMetadata {
  track: CuratedTrackId
  displayTitle: string
  kanjiTitle: string
  volumeTag: string
  palette: WatojiPalette
  pattern: WatojiPattern
  sealChar: string
  publisher: string
  pedagogicalSubtitle: string
  methodQuote: string
  pacingBadge: string
  levelDisplay: string
  isFeatured: boolean
  variants?: string[] | undefined
}

/**
 * List of redundant scraped course codes to filter out,
 * ensuring zero duplicated Minna or junk cards in the Kyoto bookstore.
 */
const REDUNDANT_SCRAPED_CODES = new Set([
  'mazii-1538111-50-bai-minna-no-nihongo',
  'mazii-5163514-50-bai-minna-no-nihongo-bai-1-50',
  'mazii-5163515-50-bai-minna-no-nihongo-hiragana',
  'mazii-5163543-50-bai-minna-no-nihongo-romaji',
  'minna-nihongo-n5', // Filter redundant duplicate copy, preserving minna-n5-standard master book
  'mazii-576933-mimi-kara-oboeru-n3', // Duplicate of 12-units complete edition
  'mazii-2287378-mimi-kara-oboeru-n2-ban-ay-u-3-524-tu', // Single-unit raw dump of 3,524 words
  'mazii-5163540-mimi-kara-oboeru-n2-13-bai', // Duplicate of 1670871
  'mazii-5163542-soumatome-n3-tuan-1-6-ay-u', // Duplicate of soumatome-goi-n3
  'mazii-526031-tu-vung', // Junk dump
  'mazii-5884956-tu-vung-trung-thu', // Junk dump
  'mazii-5163538-600-tu-tieng-nhat-co-ban', // Redundant basic list
])

/**
 * Maps raw scraped course data to an authentic Japanese editorial book jacket representation.
 */
export function getCuratedCourseMetadata(course: CurriculumCourseCard): CuratedCourseMetadata {
  const code = (course.course_code || '').toLowerCase()
  const title = (course.title || '').toLowerCase()
  const level = (course.level || '').toUpperCase()

  // 1. Level display text with authentic Japanese nuance
  const levelMap: Record<string, string> = {
    N5: 'N5 • Sơ cấp',
    N4: 'N4 • Sơ trung cấp',
    N3: 'N3 • Trung cấp',
    N2: 'N2 • Trung thượng cấp',
    N1: 'N1 • Cao cấp',
    SE: 'Chuyên ngành',
    A1: 'A1 • Nhập môn',
    A2: 'A2 • Nhập môn',
  }
  const levelDisplay = levelMap[level] || `${level} • Giáo trình chuẩn`

  // 2. Identify curriculum types
  const isMinna = code.includes('minna') || title.includes('minna') || title.includes('50 bài minna')
  const isMimiKara = code.includes('mimi') || title.includes('mimi') || title.includes('mimikara')
  const isSoumatome = code.includes('soumatome') || code.includes('somatome') || title.includes('soumatome')
  const isSpeedMaster = code.includes('speed-master') || title.includes('speed master')
  const isTango = code.includes('tango') || title.includes('tango')
  const isItCourse =
    title.includes('cntt') ||
    title.includes('công nghệ thông tin') ||
    /\b(it|se|brse)\b/i.test(title) ||
    code.includes('cntt') ||
    code.includes('-it-') ||
    code.endsWith('-it')

  const isImmersionTopic =
    title.includes('từ láy') ||
    code.includes('tu-lay') ||
    title.includes('đời sống') ||
    code.includes('oi-song') ||
    title.includes('nấu ăn') ||
    code.includes('nau-an') ||
    title.includes('rau củ') ||
    code.includes('rau-cu') ||
    title.includes('giao tiếp cơ bản') ||
    code.includes('giao-tiep') ||
    title.includes('lớp học') ||
    code.includes('lop-hoc') ||
    title.includes('gia đình') ||
    code.includes('gia-inh') ||
    title.includes('tính cách') ||
    code.includes('tinh-cach') ||
    title.includes('sở thích') ||
    code.includes('so-thich') ||
    title.includes('âm nhạc') ||
    code.includes('am-nhac')

  const isSpecializedSubject =
    (level === 'SE' && !isMinna && !isMimiKara && !isImmersionTopic) ||
    isItCourse ||
    title.includes('y khoa') ||
    title.includes('y tế') ||
    title.includes('y học') ||
    title.includes('cơ khí') ||
    title.includes('thương mại') ||
    title.includes('kinh doanh') ||
    title.includes('ngân hàng') ||
    title.includes('pháp luật') ||
    title.includes('xây dựng') ||
    title.includes('ô tô') ||
    title.includes('điện tử') ||
    title.includes('khách sạn') ||
    title.includes('kế toán') ||
    title.includes('may mặc') ||
    title.includes('thực phẩm') ||
    title.includes('xuất nhập khẩu') ||
    title.includes('ngành điện') ||
    title.includes('nhà hàng') ||
    title.includes('hành chính') ||
    title.includes('nhân sự') ||
    title.includes('giáo dục')

  // 3. Assign Track
  let track: CuratedTrackId = 'core'
  if (
    isMinna ||
    title === 'từ vựng n5' ||
    title === 'từ vựng n4' ||
    code.includes('tu-vung-n5') ||
    code.includes('tu-vung-n4') ||
    code.includes('sekai')
  ) {
    track = 'core'
  } else if (
    isMimiKara ||
    isImmersionTopic ||
    isTango ||
    code.includes('pho-tu') ||
    title.includes('phó từ') ||
    code.includes('ong-tu') ||
    title.includes('động từ')
  ) {
    track = 'immersion'
  } else if (isSpecializedSubject) {
    track = 'specialized'
  } else if (
    isSoumatome ||
    isSpeedMaster ||
    code.includes('de-thi') ||
    title.includes('đề thi') ||
    code.includes('tettei') ||
    code.includes('jlpt-n') ||
    title.startsWith('jlpt')
  ) {
    track = 'sprinters'
  } else if (level === 'N5' || level === 'N4' || level === 'A1' || level === 'A2') {
    track = 'core'
  } else {
    track = 'sprinters'
  }

  // 4. Default Cover & Book Jacket Configuration
  let displayTitle = course.title
  let kanjiTitle = '日本語'
  let volumeTag = level || '全'
  let palette: WatojiPalette = 'aizumi'
  let pattern: WatojiPattern = 'seigaiha'
  let sealChar = '言'
  let publisher = 'Kotodama Bunko • 言霊文庫'
  let pedagogicalSubtitle = 'Giáo trình từ vựng tiêu chuẩn biên soạn theo chuẩn năng lực JLPT.'
  let methodQuote = 'Học từ vựng gắn liền với ngữ cảnh tự nhiên và lưu trữ dài hạn qua chu trình ôn tập ngắt quãng.'
  let pacingBadge = `${course.unit_count} bài học • Tự học linh hoạt`
  let isFeatured = false
  let variants: string[] | undefined = undefined

  // 5. Tailored Book Identity & Pedagogical Philosophy (Zero mechanical boilerplate copy)
  if (isMinna) {
    displayTitle = course.title
    kanjiTitle = 'みんなの日本語'
    volumeTag = level === 'N4' ? '初中級' : '初級'
    palette = level === 'N4' ? 'kon' : 'aizumi'
    pattern = 'seigaiha'
    sealChar = '基'
    publisher = '3A Corporation · スリーエーネットワーク'
    pedagogicalSubtitle = 'Bộ giáo trình kinh điển bài bản nhất cho người mới bắt đầu'
    methodQuote =
      'Bản ngã của ngữ pháp và từ vựng hội tụ qua từng tình huống đời thường. Học đến đâu, ứng dụng ngay đến đó để thẩm thấu tự nhiên.'
    pacingBadge = `${course.unit_count || 50} bài học trọn bộ • Nền tảng cốt lõi`
    isFeatured = code === 'minna-n5-standard' || (code.includes('minna') && level === 'N5')
    variants = ['Bản Chuẩn (Kanji & Nghĩa)', 'Bản Hiragana Thuần', 'Bản Romaji Nhập môn']
  } else if (isMimiKara) {
    if (code.includes('5163539') || (level === 'N3' && course.unit_count > 1)) {
      displayTitle = 'Mimi Kara Oboeru N3 (Trọn Bộ 12 Chuyên Đề Phản Xạ)'
    } else if (code.includes('1670871') || (level === 'N2' && course.unit_count > 1)) {
      displayTitle = 'Mimi Kara Oboeru N2 (Trọn Bộ 13 Chuyên Đề Phản Xạ)'
    } else if (level === 'N1') {
      displayTitle = 'Mimi Kara Oboeru N1 (Vốn Từ Nâng Cao Phản Xạ)'
    } else {
      displayTitle = course.title
    }
    kanjiTitle = '耳から覚える'
    volumeTag = level || '中級'
    palette = 'matcha'
    pattern = 'shippo'
    sealChar = '得'
    publisher = 'ALC Press · アルク出版'
    pedagogicalSubtitle = 'Khắc sâu từ vựng qua phản xạ thính giác và cụm liên kết tự nhiên'
    methodQuote =
      'Khắc sâu qua tai trước khi nhìn bằng mắt. Nạp từ vựng theo chuỗi collocation hoàn chỉnh để biến tri thức thụ động thành phản xạ giao tiếp tức thì.'
    pacingBadge = `${course.unit_count} chương phản xạ • Âm thanh bản xứ`
    isFeatured = true
  } else if (isSoumatome) {
    displayTitle = course.title
    kanjiTitle = '総まとめ'
    volumeTag = level || '対策'
    palette = 'shuiro'
    pattern = 'asanoha'
    sealChar = '破'
    publisher = 'Ask Publishing · アスク出版'
    pedagogicalSubtitle = 'Bứt phá điểm thi theo cấu trúc 6 tuần thực chiến'
    methodQuote =
      'Chiến thuật phân bổ theo tuần: bóc tách các cặp từ đồng âm, làm sáng tỏ bẫy ngữ nghĩa thường gặp trong ma trận đề thi JLPT.'
    pacingBadge = '6 tuần nước rút • 2 trang mỗi ngày'
    isFeatured = true
  } else if (isTango) {
    displayTitle = `Tango ${level || 'N3'} (2,000 Từ vựng Thiết yếu Kèm Ví dụ)`
    kanjiTitle = '日本語単語'
    volumeTag = level || '中級'
    palette = 'matcha'
    pattern = 'shippo'
    sealChar = '語'
    publisher = 'Asahi Shuppan · 朝日出版社'
    pedagogicalSubtitle = 'Ghi nhớ bản chất qua 100% câu ví dụ ngữ cảnh thực tế'
    methodQuote =
      'Tuyệt đối không học từ vựng trần trụi. 100% mục từ gắn liền với câu văn hoàn chỉnh biểu đạt chính xác sắc thái người bản xứ.'
    pacingBadge = `${course.term_count.toLocaleString()} từ • Ngữ cảnh tự nhiên`
    isFeatured = false
  } else if (isSpeedMaster) {
    displayTitle = `Speed Master Từ vựng Cấp Tốc ${level}`
    kanjiTitle = '速習マスター'
    volumeTag = '速達'
    palette = 'benigara'
    pattern = 'asanoha'
    sealChar = '速'
    publisher = 'J-Research Press · ジェイ・リサーチ'
    pedagogicalSubtitle = 'Tổng duyệt từ vựng then chốt với tốc độ phản xạ cao'
    methodQuote =
      'Lọc sạch các từ vựng xuất hiện dày đặc nhất trong ngân hàng đề thi 10 năm qua, tối ưu hóa thời gian ôn tập trước giờ G.'
    pacingBadge = `${course.unit_count} bài • Trọng tâm đề thi`
  } else if (title.includes('từ láy') || code.includes('tu-lay')) {
    displayTitle = 'Từ Láy Tượng Hình & Tượng Thanh Tiếng Nhật (Gitaigo & Giongo)'
    kanjiTitle = '擬音擬態'
    volumeTag = '語感'
    palette = 'matcha'
    pattern = 'kasumi'
    sealChar = '響'
    publisher = 'Kotodama Linguistic Notes'
    pedagogicalSubtitle = 'Cảm nhận âm thanh và hình thái biểu cảm độc đáo trong văn hóa Nhật'
    methodQuote =
      'Nắm bắt nhịp điệu và hình tượng hóa cảm xúc qua hệ thống từ tượng thanh và tượng hình phong phú của văn hóa Nhật.'
    pacingBadge = `${course.term_count.toLocaleString()} từ • Sắc thái biểu cảm`
  } else if (title.includes('đời sống') || code.includes('oi-song')) {
    displayTitle = 'Từ Vựng Sinh Hoạt Gia Đình & Đời Sống Thường Nhật'
    kanjiTitle = '日常家庭'
    volumeTag = '生活'
    palette = 'matcha'
    pattern = 'shippo'
    sealChar = '和'
    publisher = 'Kotodama Life Series'
    pedagogicalSubtitle = 'Vốn từ thực tế cho đời sống hàng ngày và bài trí nhà cửa'
    methodQuote =
      'Bước vào đời sống thường nhật của một gia đình Nhật Bản: từ vật dụng sinh hoạt đến thói quen hàng ngày.'
    pacingBadge = `${course.term_count.toLocaleString()} từ • Sinh hoạt đời thường`
  } else if (title.includes('giao tiếp cơ bản') || code.includes('giao-tiep')) {
    displayTitle = 'Tiếng Nhật Giao Tiếp Sinh Hoạt Thường Ngày'
    kanjiTitle = '日常会話'
    volumeTag = '会話'
    palette = 'matcha'
    pattern = 'kasumi'
    sealChar = '話'
    publisher = 'Kotodama Communication Press'
    pedagogicalSubtitle = 'Khẩu ngữ và các mẫu câu phản xạ giao tiếp tự nhiên trong cuộc sống'
    methodQuote =
      'Thực hành các mẫu câu phản xạ tự nhiên giúp xóa bỏ rào cản ngại ngùng khi bắt chuyện cùng người bản xứ.'
    pacingBadge = `${course.term_count.toLocaleString()} từ • Phản xạ giao tiếp`
  } else if (title.includes('tettei') || code.includes('tettei')) {
    displayTitle = 'Nihongo Tettei Drill N1 (Luyện Thi Chuyên Sâu)'
    kanjiTitle = '徹底ドリル'
    volumeTag = 'N1'
    palette = 'shuiro'
    pattern = 'asanoha'
    sealChar = '徹'
    publisher = 'Kotodama Exam Archives'
    pedagogicalSubtitle = 'Luyện đề chuyên sâu và bẻ khóa các cấu trúc từ vựng đánh đố cấp độ N1'
    methodQuote = 'Rèn giũa khả năng phân biệt từ vựng tinh vi ở cấp độ cao nhất thông qua các bài tập chuyên sâu.'
    pacingBadge = `${course.term_count.toLocaleString()} từ • Luyện thi N1 chuyên sâu`
  } else if (title === 'từ vựng n4' || code.includes('tu-vung-n4')) {
    displayTitle = 'Vốn Từ Thực Hành Cấp Độ N4 (Sơ Trung Cấp)'
    kanjiTitle = '実用単語'
    volumeTag = 'N4'
    palette = 'aizumi'
    pattern = 'seigaiha'
    sealChar = '実'
    publisher = 'Kotodama Editorial Board'
    pedagogicalSubtitle = 'Mở rộng vốn từ sơ trung cấp gắn liền với hội thoại đời sống'
    methodQuote =
      'Liên kết từ vựng với các ngữ cảnh giao tiếp tự nhiên, chuẩn bị nền tảng ngữ nghĩa vững chắc trước khi tiến lên trung cấp.'
    pacingBadge = `${course.term_count.toLocaleString()} từ • Sơ trung cấp thực hành`
  } else if (title === 'từ vựng n5' || code.includes('tu-vung-n5')) {
    displayTitle = 'Vốn Từ Cốt Lõi Nhập Môn Cấp Độ N5'
    kanjiTitle = '基礎単語'
    volumeTag = 'N5'
    palette = 'aizumi'
    pattern = 'seigaiha'
    sealChar = '基'
    publisher = 'Kotodama Editorial Board'
    pedagogicalSubtitle = 'Vốn từ khởi đầu thiết yếu cho người mới bắt đầu làm quen tiếng Nhật'
    methodQuote = 'Xây dựng viên gạch đầu tiên với những từ ngữ thiết yếu nhất trong sinh hoạt và học tập hàng ngày.'
    pacingBadge = `${course.term_count.toLocaleString()} từ • Nhập môn cốt lõi`
  } else if (title === 'jlpt n4' || code.includes('jlpt-n4')) {
    displayTitle = 'Từ Vựng Trọng Tâm Ôn Thi JLPT N4'
    kanjiTitle = '試験対策'
    volumeTag = 'N4'
    palette = 'kon'
    pattern = 'asanoha'
    sealChar = '策'
    publisher = 'Kotodama Exam Archives'
    pedagogicalSubtitle = 'Kho từ vựng then chốt bám sát chuẩn kiến thức kỳ thi N4'
    methodQuote = 'Bám sát ma trận câu hỏi JLPT N4, củng cố nhanh vốn từ cần thiết để vượt qua kỳ thi năng lực.'
    pacingBadge = `${course.term_count.toLocaleString()} từ • Ôn thi N4`
  } else if (title === 'jlpt n5' || code.includes('jlpt-n5')) {
    displayTitle = 'Từ Vựng Trọng Tâm Ôn Thi JLPT N5'
    kanjiTitle = '試験対策'
    volumeTag = 'N5'
    palette = 'kon'
    pattern = 'asanoha'
    sealChar = '策'
    publisher = 'Kotodama Exam Archives'
    pedagogicalSubtitle = 'Kho từ vựng nền tảng bám sát chuẩn kiến thức kỳ thi N5'
    methodQuote = 'Tổng hợp đầy đủ vốn từ vựng nền tảng thường gặp nhất trong các đề thi năng lực cấp độ N5.'
    pacingBadge = `${course.term_count.toLocaleString()} từ • Ôn thi N5`
  } else if (title.includes('tiếng nhật cntt') || course.title === 'Tiếng Nhật CNTT (SE IT)') {
    displayTitle = 'Tiếng Nhật CNTT (SE IT)'
    kanjiTitle = '情報技術'
    volumeTag = 'SE'
    palette = 'kokutan'
    pattern = 'kumiko'
    sealChar = '修'
    publisher = 'Kotodama IT Engineering Press · 技術書院'
    pedagogicalSubtitle = 'Hệ thống thuật ngữ kỹ thuật phần mềm, Agile & Spec dự án thực tế'
    methodQuote =
      'Làm chủ ngôn ngữ kiến trúc hệ thống, quy trình phát triển Agile và khả năng trao đổi trực tiếp với Tech Lead Nhật Bản không qua phiên dịch.'
    pacingBadge = `${course.unit_count} chuyên đề • SE & BrSE thực chiến`
    isFeatured = true
  } else if (title.includes('tiếng nhật công nghệ thông tin') || code.includes('cong-nghe-thong-tin')) {
    displayTitle = 'Tiếng Nhật Công Nghệ Thông Tin (Nhập Môn Cơ Bản)'
    kanjiTitle = '情報基礎'
    volumeTag = 'IT'
    palette = 'kokutan'
    pattern = 'kumiko'
    sealChar = '情'
    publisher = 'Kotodama IT Engineering Press · 技術書院'
    pedagogicalSubtitle = 'Khái niệm tin học, phần cứng, phần mềm và mạng căn bản'
    methodQuote =
      'Làm quen với các thuật ngữ công nghệ thông tin cơ sở phục vụ cho học tập và giao tiếp kỹ thuật khởi đầu.'
    pacingBadge = `${course.unit_count} bài • Nhập môn IT`
  } else if (code.includes('0004-cntt') || title.includes('0004') || title.includes('it 2')) {
    displayTitle = 'Nhật ngữ Kỹ thuật Phần mềm (Software Engineering Japanese)'
    kanjiTitle = '情報技術'
    volumeTag = '開発'
    palette = 'kokutan'
    pattern = 'kumiko'
    sealChar = '修'
    publisher = 'Kotodama IT Engineering Press · 技術書院'
    pedagogicalSubtitle = 'Hệ thống thuật ngữ kỹ thuật phần mềm, Agile & Spec dự án thực tế'
    methodQuote =
      'Làm chủ ngôn ngữ kiến trúc hệ thống, quy trình phát triển Agile và khả năng trao đổi trực tiếp với Tech Lead Nhật Bản không qua phiên dịch.'
    pacingBadge = `${course.unit_count} chuyên đề • SE & BrSE thực chiến`
    isFeatured = true
  } else if (code.includes('it-senmon') || title.includes('chuyen sau')) {
    displayTitle = 'Thuật ngữ Kỹ sư Hệ thống & An ninh Mạng (IT Senmon)'
    kanjiTitle = '専門用語'
    volumeTag = '設計'
    palette = 'kokutan'
    pattern = 'kumiko'
    sealChar = '修'
    publisher = 'Kotodama IT Engineering Press · 技術書院'
    pedagogicalSubtitle = 'Thuật ngữ bảo mật, hạ tầng đám mây và kỹ thuật DevOps'
    methodQuote =
      'Tiếp cận ngôn ngữ kỹ thuật chuẩn mực phục vụ bảo trì hệ thống, cấu hình máy chủ và phân tích rủi ro an ninh thông tin.'
    pacingBadge = `${course.unit_count} bài học • Kỹ sư chuyên môn`
  } else if (title.includes('học từ vựng tiếng nhật chuyên ngành công nghệ thông tin')) {
    displayTitle = 'Giao tiếp Dự án & Spec Kỹ thuật (IT Project Japanese)'
    kanjiTitle = 'IT開発'
    volumeTag = '実務'
    palette = 'kokutan'
    pattern = 'kumiko'
    sealChar = '実'
    publisher = 'Kotodama IT Engineering Press · 技術書院'
    pedagogicalSubtitle = 'Giao tiếp dự án, giải thích yêu cầu nghiệp vụ và viết tài liệu kỹ thuật'
    methodQuote =
      'Làm chủ các mẫu câu hội thoại thường ngày trong dự án phần mềm: từ daily meeting, demo sprint đến thương thảo spec với khách hàng.'
    pacingBadge = `${course.unit_count} bài • Giao tiếp kỹ thuật`
  } else if (title.includes('cntt') || title.includes('it')) {
    displayTitle = 'Thuật Ngữ Chuyên Ngành CNTT & Phần Mềm'
    kanjiTitle = '情報技術'
    volumeTag = 'SE'
    palette = 'kokutan'
    pattern = 'kumiko'
    sealChar = '修'
    publisher = 'Kotodama IT Engineering Press · 技術書院'
    pedagogicalSubtitle = 'Hệ thống thuật ngữ kỹ thuật phần mềm & spec dự án thực tế'
    methodQuote =
      'Trau dồi từ vựng công nghệ, cấu trúc lệnh, thiết kế hệ thống và trao đổi kỹ thuật tự tin với đồng nghiệp Nhật.'
    pacingBadge = `${course.unit_count} chuyên đề • SE & BrSE thực chiến`
    isFeatured = true
  } else if (
    title.includes('y tế') ||
    title.includes('y khoa') ||
    title.includes('y học') ||
    title.includes('ieu-duong')
  ) {
    if (title.includes('ieu-duong') || title.includes('y tế')) {
      displayTitle = 'Nhật ngữ Điều dưỡng & Chăm sóc Người cao tuổi (Kaigo)'
      kanjiTitle = '介護医療'
      volumeTag = '看護'
    } else {
      displayTitle = 'Nhật ngữ Lâm sàng & Chẩn đoán Y khoa (Medical Japanese)'
      kanjiTitle = '臨床医学'
      volumeTag = '診療'
    }
    palette = 'aizumi'
    pattern = 'shippo'
    sealChar = '仁'
    publisher = 'Kotodama Medical Series · 医療出版'
    pedagogicalSubtitle = 'Thuật ngữ lâm sàng & giao tiếp người bệnh chuẩn mực y đức'
    methodQuote =
      'Chuẩn mực y đức và sự chính xác tuyệt đối trong giao tiếp lâm sàng, giải thích bệnh trạng và quy trình chăm sóc điều dưỡng.'
    pacingBadge = `${course.unit_count} bài học • Tiêu chuẩn bệnh viện Nhật`
  } else if (title.includes('kinh doanh') || title.includes('thuong-mai') || title.includes('thương mại')) {
    displayTitle = 'Nhật ngữ Thương mại, Kính ngữ & Văn hóa Doanh nghiệp'
    kanjiTitle = '商業実務'
    volumeTag = '敬語'
    palette = 'kuri'
    pattern = 'seigaiha'
    sealChar = '商'
    publisher = 'Kotodama Business Academy · 商業研究会'
    pedagogicalSubtitle = 'Tiếng Nhật thương mại, văn phong công sở & ứng xử đối tác'
    methodQuote =
      'Làm chủ nghệ thuật Keigo chuẩn xác trong đàm phán, viết email thương mại trang trọng và ứng xử văn hóa công sở Nhật Bản.'
    pacingBadge = `${course.unit_count} bài • Kính ngữ & Thương mại`
  } else if (
    title.includes('ngan-hang') ||
    title.includes('ke-toan') ||
    title.includes('ngân hàng') ||
    title.includes('kế toán')
  ) {
    displayTitle = 'Tài chính Ngân hàng & Kế toán Doanh nghiệp Nhật Bản'
    kanjiTitle = '金融会計'
    volumeTag = '財務'
    palette = 'kokutan'
    pattern = 'kumiko'
    sealChar = '金'
    publisher = 'Kotodama Finance Series'
    pedagogicalSubtitle = 'Hệ thống thuật ngữ kiểm toán, bảng cân đối & thủ tục ngân hàng'
    methodQuote =
      'Thuật ngữ tài chính kế toán chuẩn xác phục vụ trực tiếp cho báo cáo thuế, thẩm định tín dụng và kiểm toán doanh nghiệp.'
    pacingBadge = `${course.unit_count} bài học • Nghiệp vụ tài chính`
  } else if (title.includes('xuat-nhap-khau') || title.includes('xuất nhập khẩu')) {
    displayTitle = 'Nghiệp vụ Xuất nhập khẩu & Vận tải Logistics Quốc tế'
    kanjiTitle = '貿易物流'
    volumeTag = '通関'
    palette = 'kon'
    pattern = 'seigaiha'
    sealChar = '通'
    publisher = 'Kotodama Logistics Institute'
    pedagogicalSubtitle = 'Vốn từ hải quan, chứng từ vận đơn Incoterms & kho bãi'
    methodQuote =
      'Vận hành thủ tục thông quan, xử lý vận đơn và giao dịch chuỗi cung ứng bằng tiếng Nhật chuyên ngành chuẩn mực.'
    pacingBadge = `${course.unit_count} chuyên đề • Thực hành hải quan`
  } else if (title.includes('co-khi') || title.includes('cơ khí')) {
    displayTitle = 'Cơ khí Chế tạo, Gia công & Vận hành Máy móc CNC'
    kanjiTitle = '機械製造'
    volumeTag = '工学'
    palette = 'kokutan'
    pattern = 'kumiko'
    sealChar = '技'
    publisher = 'Kotodama Monodukuri Press'
    pedagogicalSubtitle = 'Bản vẽ kỹ thuật, an toàn xưởng chế tạo & tinh thần Monodukuri'
    methodQuote =
      'Nắm vững chỉ dẫn thao tác kỹ thuật, quy định bảo hộ và ngôn ngữ sản xuất chính xác tại các nhà máy công nghiệp Nhật Bản.'
    pacingBadge = `${course.unit_count} bài • Kỹ thuật nhà xưởng`
  } else if (title.includes('ien-tu') || title.includes('điện tử')) {
    displayTitle = 'Kỹ thuật Điện tử & Vi mạch Bán dẫn Nhật Bản'
    kanjiTitle = '電子工学'
    volumeTag = '回路'
    palette = 'kokutan'
    pattern = 'kumiko'
    sealChar = '電'
    publisher = 'Kotodama Tech Series'
    pedagogicalSubtitle = 'Linh kiện bán dẫn, sơ đồ mạch điện & kiểm thử chất lượng'
    methodQuote =
      'Thuật ngữ vi mạch, bảng mạch in và quy trình kiểm soát chất lượng (QA/QC) trong chuỗi sản xuất công nghệ cao.'
    pacingBadge = `${course.unit_count} bài • Bán dẫn & Vi mạch`
  } else if (
    title.includes('khach-san') ||
    title.includes('nha-hang') ||
    title.includes('du-lich') ||
    title.includes('du lịch')
  ) {
    displayTitle = 'Nghiệp vụ Nhà hàng, Khách sạn & Nghệ thuật Omotenashi'
    kanjiTitle = '接客観光'
    volumeTag = '接待'
    palette = 'matcha'
    pattern = 'kasumi'
    sealChar = '和'
    publisher = 'Kotodama Hospitality'
    pedagogicalSubtitle = 'Nghệ thuật hiếu khách Omotenashi & quy chuẩn phục vụ cao cấp'
    methodQuote =
      'Thấm nhuần tinh thần phụng sự tận tụy, từ ngữ chào đón khách tinh tế và xử lý tình huống phát sinh chuẩn mực khách sạn 5 sao.'
    pacingBadge = `${course.unit_count} bài • Phục vụ chuyên nghiệp`
  } else if (title.includes('rau củ') || code.includes('rau-cu')) {
    displayTitle = 'Vốn Từ Nông Nghiệp, Thực Vật & Rau Củ Quả Nhật Bản'
    kanjiTitle = '青果農園'
    volumeTag = '食材'
    palette = 'matcha'
    pattern = 'kasumi'
    sealChar = '果'
    publisher = 'Kotodama Culinary Institute'
    pedagogicalSubtitle = 'Hệ thống tên gọi rau củ quả, nông sản và phân loại thực vật'
    methodQuote =
      'Mở rộng vốn từ về nông sản sạch, kỹ thuật canh tác và các loại rau củ quả đặc trưng trong ẩm thực Nhật.'
    pacingBadge = `${course.term_count.toLocaleString()} từ • Nông sản & Thực vật`
  } else if (title.includes('nấu ăn') || code.includes('nau-an')) {
    displayTitle = 'Nghệ Thuật Ẩm Thực, Kỹ Thuật Nấu Ăn & Gia Vị Washoku'
    kanjiTitle = '日本料理'
    volumeTag = '調理'
    palette = 'kuri'
    pattern = 'shippo'
    sealChar = '味'
    publisher = 'Kotodama Culinary Institute'
    pedagogicalSubtitle = 'Kỹ thuật chế biến, dụng cụ bếp và gia vị truyền thống Washoku'
    methodQuote =
      'Thấu hiểu văn hóa ẩm thực Nhật Bản (Washoku) qua tên gọi dụng cụ bếp, phương pháp nêm nếm và thao tác chế biến tinh tế.'
    pacingBadge = `${course.term_count.toLocaleString()} từ • Nghệ thuật Washoku`
  } else if (title.includes('lớp học') || code.includes('lop-hoc')) {
    displayTitle = 'Từ Vựng Sư Phạm & Giao Tiếp Trong Lớp Học Tiếng Nhật'
    kanjiTitle = '教室会話'
    volumeTag = '学術'
    palette = 'aizumi'
    pattern = 'kumiko'
    sealChar = '学'
    publisher = 'Kotodama Academy Press'
    pedagogicalSubtitle = 'Chỉ dẫn giáo viên, dụng cụ học tập và tương tác giảng đường'
    methodQuote =
      'Nắm vững các khẩu lệnh trong lớp, tương tác tự tin giữa thầy và trò trong môi trường học thuật Nhật Bản.'
    pacingBadge = `${course.term_count.toLocaleString()} từ • Tương tác giảng đường`
  } else if (title.includes('xây dựng') || code.includes('xay-dung')) {
    displayTitle = 'Kỹ Thuật Xây Dựng, Thi Công & Kiến Trúc Công Trình'
    kanjiTitle = '建築施工'
    volumeTag = '工学'
    palette = 'kokutan'
    pattern = 'kumiko'
    sealChar = '建'
    publisher = 'Kotodama Construction Series'
    pedagogicalSubtitle = 'Bản vẽ xây dựng, an toàn lao động và kỹ thuật thi công Nhật Bản'
    methodQuote =
      'Nắm vững ngôn ngữ kỹ thuật tại công trường, quy chuẩn an toàn lao động và các thuật ngữ kiến trúc Nhật Bản.'
    pacingBadge = `${course.term_count.toLocaleString()} từ • Kỹ thuật công trường`
  } else if (title.includes('ô tô') || code.includes('o-to')) {
    displayTitle = 'Kỹ Thuật Ô Tô, Động Cơ & Bảo Dưỡng Cơ Giới Nhật Bản'
    kanjiTitle = '自動車工'
    volumeTag = '整備'
    palette = 'kokutan'
    pattern = 'kumiko'
    sealChar = '車'
    publisher = 'Kotodama Automotive Press'
    pedagogicalSubtitle = 'Cấu tạo động cơ ô tô, dây chuyền lắp ráp và chẩn đoán bảo trì'
    methodQuote =
      'Làm chủ các thuật ngữ kỹ thuật ô tô chuẩn Nhật từ quy trình bảo dưỡng định kỳ đến cấu tạo động cơ hiện đại.'
    pacingBadge = `${course.term_count.toLocaleString()} từ • Chế tạo ô tô`
  } else if (title.includes('pháp luật') || code.includes('phap-luat')) {
    displayTitle = 'Nhật Ngữ Pháp Lý, Soạn Thảo Hợp Đồng & Luật Doanh Nghiệp'
    kanjiTitle = '法律法務'
    volumeTag = '契約'
    palette = 'kokutan'
    pattern = 'seigaiha'
    sealChar = '法'
    publisher = 'Kotodama Legal Research'
    pedagogicalSubtitle = 'Thuật ngữ luật học, soạn thảo điều khoản và đàm phán hợp đồng'
    methodQuote =
      'Sử dụng chuẩn xác các thuật ngữ pháp lý và văn phong hợp đồng tiếng Nhật trong giao dịch thương mại quốc tế.'
    pacingBadge = `${course.term_count.toLocaleString()} từ • Pháp lý doanh nghiệp`
  } else if (title.includes('hành chính') || title.includes('nhân sự') || code.includes('nhan-su')) {
    displayTitle = 'Quản Trị Nhân Sự, Chế Độ Đãi Ngộ & Hành Chính Doanh Nghiệp'
    kanjiTitle = '人事労務'
    volumeTag = '総務'
    palette = 'kuri'
    pattern = 'seigaiha'
    sealChar = '人'
    publisher = 'Kotodama Business Academy'
    pedagogicalSubtitle = 'Quy chế làm việc, thủ tục lao động và bảo hiểm xã hội Nhật Bản'
    methodQuote =
      'Làm chủ ngôn ngữ quản trị nhân sự, quy định hợp đồng lao động và phúc lợi theo tiêu chuẩn công ty Nhật.'
    pacingBadge = `${course.term_count.toLocaleString()} từ • Quản trị nhân sự`
  } else if (title.includes('may mặc') || code.includes('may-mac')) {
    displayTitle = 'Ngành May Mặc, Thiết Kế Thời Trang & Công Nghiệp Dệt May'
    kanjiTitle = '縫製繊維'
    volumeTag = '服飾'
    palette = 'matcha'
    pattern = 'shippo'
    sealChar = '織'
    publisher = 'Kotodama Textile Press'
    pedagogicalSubtitle = 'Chất liệu vải sợi, kỹ thuật may rập và quy chuẩn kiểm tra đường may'
    methodQuote =
      'Vốn từ chuyên ngành về sợi vải dệt, thiết kế rập mẫu và tiêu chuẩn kiểm phẩm nghiêm ngặt của ngành dệt may Nhật.'
    pacingBadge = `${course.term_count.toLocaleString()} từ • Công nghiệp may mặc`
  } else if (title.includes('thực phẩm') || code.includes('thuc-pham')) {
    displayTitle = 'Công Nghệ Thực Phẩm, Chế Biến & Tiêu Chuẩn Vệ Sinh HACCP'
    kanjiTitle = '食品加工'
    volumeTag = '衛生'
    palette = 'matcha'
    pattern = 'shippo'
    sealChar = '食'
    publisher = 'Kotodama Food Science'
    pedagogicalSubtitle = 'Dây chuyền chế biến, kiểm định vi sinh và vệ sinh an toàn thực phẩm'
    methodQuote =
      'Thấu hiểu quy trình an toàn thực phẩm, tiêu chuẩn tiệt trùng và thuật ngữ dây chuyền chế biến xuất khẩu Nhật Bản.'
    pacingBadge = `${course.term_count.toLocaleString()} từ • Tiêu chuẩn HACCP`
  } else if (title.includes('ngành điện') || code.includes('nganh-ien')) {
    displayTitle = 'Kỹ Thuật Điện Công Nghiệp & Mạng Lưới Truyền Tải Điện'
    kanjiTitle = '電気設備'
    volumeTag = '電力'
    palette = 'kokutan'
    pattern = 'kumiko'
    sealChar = '電'
    publisher = 'Kotodama Engineering Series'
    pedagogicalSubtitle = 'Sơ đồ tủ điện, quy chuẩn an toàn cao thế và thiết bị đóng cắt'
    methodQuote = 'Nắm vững thuật ngữ an toàn điện, đo kiểm dòng áp và lắp đặt hệ thống điện công nghiệp tại Nhật.'
    pacingBadge = `${course.term_count.toLocaleString()} từ • Kỹ thuật điện áp`
  } else if (title.includes('giáo dục') || code.includes('giao-duc')) {
    displayTitle = 'Nhật Ngữ Sư Phạm, Tâm Lý Học Đường & Giáo Dục Trẻ Nhỏ'
    kanjiTitle = '教育心理'
    volumeTag = '育英'
    palette = 'matcha'
    pattern = 'kasumi'
    sealChar = '育'
    publisher = 'Kotodama Education Press'
    pedagogicalSubtitle = 'Phương pháp sư phạm, tương tác phụ huynh và giáo dục mầm non'
    methodQuote =
      'Hiểu rõ các thuật ngữ giáo dục, phương pháp tương tác nuôi dưỡng tiềm năng của trẻ theo triết lý giáo dục Nhật.'
    pacingBadge = `${course.term_count.toLocaleString()} từ • Triết lý giáo dục Nhật`
  } else if (title.includes('tính cách') || code.includes('tinh-cach')) {
    displayTitle = 'Từ Vựng Miêu Tả Tâm Lý, Tính Cách & Nhân Cách Con Người'
    kanjiTitle = '性格人物'
    volumeTag = '心理'
    palette = 'aizumi'
    pattern = 'kasumi'
    sealChar = '心'
    publisher = 'Kotodama Psychological Notes'
    pedagogicalSubtitle = 'Phân loại tính cách, cảm xúc nội tâm và diện mạo phong thái'
    methodQuote =
      'Phác họa tinh tế tâm lý và tính cách nhân vật thông qua kho từ vựng biểu cảm giàu hình tượng của tiếng Nhật.'
    pacingBadge = `${course.term_count.toLocaleString()} từ • Sắc thái tính cách`
  } else if (title.includes('sở thích') || code.includes('so-thich')) {
    displayTitle = 'Từ Vựng Sở Thích, Thú Vui Giải Trí & Văn Hóa Nghệ Thuật'
    kanjiTitle = '趣味娯楽'
    volumeTag = '文芸'
    palette = 'matcha'
    pattern = 'kasumi'
    sealChar = '楽'
    publisher = 'Kotodama Cultural Notes'
    pedagogicalSubtitle = 'Thể thao, nghệ thuật, âm nhạc và những đam mê trong đời sống'
    methodQuote =
      'Chia sẻ đam mê và sở thích bằng tiếng Nhật một cách sống động, tự nhiên trong các buổi trò chuyện thân mật.'
    pacingBadge = `${course.term_count.toLocaleString()} từ • Thú vui & Nghệ thuật`
  } else if (title.includes('âm nhạc') || code.includes('am-nhac')) {
    displayTitle = 'Thuật Ngữ Âm Nhạc, Nhạc Cụ & Lý Thuyết Âm Thanh Nhật Bản'
    kanjiTitle = '音楽芸術'
    volumeTag = '音律'
    palette = 'aizumi'
    pattern = 'kasumi'
    sealChar = '音'
    publisher = 'Kotodama Arts Foundation'
    pedagogicalSubtitle = 'Nhạc lý, dàn hợp xướng, nhạc cụ truyền thống và hiện đại'
    methodQuote = 'Hòa mình vào thế giới âm giai, nhạc cụ dân tộc và các thuật ngữ biểu diễn âm nhạc chuyên nghiệp.'
    pacingBadge = `${course.term_count.toLocaleString()} từ • Nghệ thuật âm thanh`
  } else if (title.includes('gia đình') || code.includes('gia-inh')) {
    displayTitle = 'Xưng Hô Thân Tộc, Mối Quan Hệ Gia Đình & Họ Hàng Nhật Bản'
    kanjiTitle = '親族家族'
    volumeTag = '家系'
    palette = 'kuri'
    pattern = 'shippo'
    sealChar = '家'
    publisher = 'Kotodama Cultural Series'
    pedagogicalSubtitle = 'Phân biệt xưng hô tôn kính với người ngoài và khiêm nhường trong nhà'
    methodQuote = 'Nắm vững quy tắc xưng hô Uchi-Soto khi nhắc đến các thành viên trong gia đình với đối tác bên ngoài.'
  } else if (title.includes('phó từ') || code.includes('pho-tu')) {
    displayTitle = 'Bí quyết Sử dụng 100 Phó từ Tinh tế Nhất Tiếng Nhật'
    kanjiTitle = '副詞精選'
    volumeTag = '語感'
    palette = 'aizumi'
    pattern = 'kasumi'
    sealChar = '微'
    publisher = 'Kotodama Linguistic Notes'
    pedagogicalSubtitle = 'Làm chủ sắc thái tinh tế quyết định chất tự nhiên của câu văn'
    methodQuote =
      'Phó từ quyết định độ mềm mại và tinh tế của lời nói. Nắm vững cảm xúc tiềm ẩn trong từng phó từ để nói tiếng Nhật như người bản xứ.'
    pacingBadge = '100 phó từ tinh tuyển • Tinh chỉnh ngữ cảm'
  } else if (title.includes('tự động từ') || title.includes('tha động từ') || code.includes('ong-tu')) {
    displayTitle = 'Bản chất Cặp Tự động từ & Tha động từ (Phần 1 - 2)'
    kanjiTitle = '自他動詞'
    volumeTag = '文法'
    palette = 'benigara'
    pattern = 'shippo'
    sealChar = '動'
    publisher = 'Kotodama Grammar Series'
    pedagogicalSubtitle = 'Phân định dứt khoát ranh giới giữa hành động chủ ý và biến chuyển khách quan'
    methodQuote =
      'Xóa bỏ hoàn toàn lỗi nhầm lẫn trợ từ を và が — hiểu rõ bản chất tri giác của người Nhật khi nhìn nhận thế giới xung quanh.'
    pacingBadge = 'Phân biệt bản chất • Quy tắc chuyển hóa'
  } else if (code.includes('sekai') || title.includes('sekai')) {
    displayTitle = 'Giáo trình Sekai N5 (Nhập môn Trực quan)'
    kanjiTitle = '世界日本語'
    volumeTag = '入門'
    palette = 'aizumi'
    pattern = 'kasumi'
    sealChar = '新'
    publisher = 'Sekai Nihongo Project'
    pedagogicalSubtitle = 'Tiếp cận tiếng Nhật tự nhiên qua các tình huống đời sống gần gũi'
    methodQuote =
      'Xây dựng cảm hứng học tập ban đầu qua hình ảnh trực quan và hội thoại ngắn, gỡ bỏ sự bỡ ngỡ khi bắt đầu làm quen chữ viết.'
    pacingBadge = `${course.unit_count} bài • Trực quan sinh động`
  } else if (title.includes('đề thi') || code.includes('de-thi') || code.includes('hinxu')) {
    displayTitle = `Ngân hàng Từ vựng Xuất hiện Thực tế trong Đề thi ${level}`
    kanjiTitle = '過去問語彙'
    volumeTag = '実戦'
    palette = 'shuiro'
    pattern = 'asanoha'
    sealChar = '験'
    publisher = 'Kotodama Exam Archives'
    pedagogicalSubtitle = 'Thống kê tần suất xuất hiện thực tế từ các kỳ thi JLPT chính thức'
    methodQuote =
      'Học trúng trọng tâm đề thi thật. Không lãng phí thời gian vào từ hiếm gặp, tập trung tuyệt đối vào nhóm từ quyết định điểm đậu.'
    pacingBadge = 'Thực chiến đề thi • Trúng trọng tâm'
  } else if (title.includes('tuyển chọn') || code.includes('vocab-n')) {
    displayTitle = `Từ vựng Trọng tâm Tinh tuyển Cấp độ ${level}`
    kanjiTitle = '必修単語'
    volumeTag = level
    palette = level === 'N1' || level === 'N2' ? 'shuiro' : 'aizumi'
    pattern = 'seigaiha'
    sealChar = '選'
    publisher = 'Kotodama Editorial Board'
    pedagogicalSubtitle = `Cô đọng vốn từ cốt lõi không thể bỏ qua của kỳ thi JLPT ${level}`
    methodQuote =
      'Hệ thống hóa vốn từ cốt lõi thành các cụm tri thức cô đọng, phục vụ tối đa cho việc nạp nhanh vào kho nhớ dài hạn SRS.'
    pacingBadge = `${course.term_count.toLocaleString()} từ • Trọng tâm rút gọn`
  }

  return {
    track,
    displayTitle,
    kanjiTitle,
    volumeTag,
    palette,
    pattern,
    sealChar,
    publisher,
    pedagogicalSubtitle,
    methodQuote,
    pacingBadge,
    levelDisplay,
    isFeatured,
    variants,
  }
}

/**
 * Curates and deduplicates the raw course list from backend,
 * removing scraped duplicates and consolidating Minna into 1 Master Edition.
 */
export function curateCatalogCourses(rawCourses: CurriculumCourseCard[]): Array<{
  course: CurriculumCourseCard
  meta: CuratedCourseMetadata
}> {
  // 1. Filter out redundant scraped duplicate codes
  const filtered = rawCourses.filter((course) => {
    const code = course.course_code.toLowerCase()
    if (REDUNDANT_SCRAPED_CODES.has(code)) return false
    return true
  })

  // 2. Map with enriched metadata
  const mapped = filtered.map((course) => {
    const meta = getCuratedCourseMetadata(course)
    return {
      course: {
        ...course,
        // Override raw scraper title with curated human title
        title: meta.displayTitle,
      },
      meta,
    }
  })

  // 3. Guarantee exactly 1 featured book per track with Kyoto bookstore curation priority
  const PREFERRED_FEATURED: Record<
    CuratedTrackId,
    (item: { course: CurriculumCourseCard; meta: CuratedCourseMetadata }) => boolean
  > = {
    core: (item) => item.course.course_code.toLowerCase() === 'minna-n5-standard',
    sprinters: (item) => {
      const code = item.course.course_code.toLowerCase()
      return (
        code.includes('soumatome-goi-n3') ||
        code.includes('soumatome-n3-vocab') ||
        (code.includes('soumatome') && item.course.level === 'N3')
      )
    },
    immersion: (item) => {
      const code = item.course.course_code.toLowerCase()
      return code.includes('5163539')
    },
    specialized: (item) => {
      const code = item.course.course_code.toLowerCase()
      const title = item.course.title.toLowerCase()
      return (
        code.includes('0004-cntt') ||
        code.includes('cntt') ||
        title.includes('kỹ thuật phần mềm') ||
        title.includes('se it')
      )
    },
  }

  for (const trackId of ['core', 'sprinters', 'immersion', 'specialized'] as CuratedTrackId[]) {
    const trackItems = mapped.filter((item) => item.meta.track === trackId)
    if (trackItems.length === 0) continue

    const preferred =
      trackItems.find(PREFERRED_FEATURED[trackId]) || trackItems.find((item) => item.meta.isFeatured) || trackItems[0]

    for (const item of trackItems) {
      item.meta.isFeatured = item === preferred
    }
  }

  return mapped
}
