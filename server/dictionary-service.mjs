import { existsSync, readFileSync, readdirSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { log, logError } from './logger.mjs'

let DatabaseSync = null
try {
  const sqlite = await import('node:sqlite')
  DatabaseSync = sqlite.DatabaseSync
} catch (error) {
  log('warn', 'dictionary.sqlite-unavailable', { message: error.message })
}


const romajiMap = {
  kya: 'きゃ',
  kyu: 'きゅ',
  kyo: 'きょ',
  sha: 'しゃ',
  shu: 'しゅ',
  sho: 'しょ',
  cha: 'ちゃ',
  chu: 'ちゅ',
  cho: 'ちょ',
  nya: 'にゃ',
  nyu: 'にゅ',
  nyo: 'にょ',
  hya: 'ひゃ',
  hyu: 'ひゅ',
  hyo: 'ひょ',
  mya: 'みゃ',
  myu: 'みゅ',
  myo: 'みょ',
  rya: 'りゃ',
  ryu: 'りゅ',
  ryo: 'りょ',
  gya: 'ぎゃ',
  gyu: 'ぎゅ',
  gyo: 'ぎょ',
  ja: 'じゃ',
  ju: 'じゅ',
  jo: 'じょ',
  jya: 'じゃ',
  jyu: 'じゅ',
  jyo: 'じょ',
  bya: 'びゃ',
  byu: 'びゅ',
  byo: 'びょ',
  pya: 'ぴゃ',
  pyu: 'ぴゅ',
  pyo: 'ぴょ',
  ka: 'か',
  ki: 'き',
  ku: 'く',
  ke: 'け',
  ko: 'こ',
  sa: 'さ',
  shi: 'し',
  si: 'し',
  su: 'す',
  se: 'せ',
  so: 'そ',
  ta: 'た',
  chi: 'ち',
  ti: 'ち',
  tsu: 'つ',
  tu: 'つ',
  te: 'て',
  to: 'と',
  na: 'な',
  ni: 'に',
  nu: 'ぬ',
  ne: 'ね',
  no: 'の',
  ha: 'は',
  hi: 'ひ',
  fu: 'ふ',
  hu: 'ふ',
  he: 'へ',
  ho: 'ほ',
  ma: 'ま',
  mi: 'み',
  mu: 'む',
  me: 'め',
  mo: 'mo',
  ya: 'や',
  yu: 'ゆ',
  yo: 'よ',
  ra: 'ら',
  ri: 'り',
  ru: 'る',
  re: 'れ',
  ro: 'ろ',
  wa: 'わ',
  wo: 'を',
  nn: 'ん',
  n: 'ん',
  ga: 'が',
  gi: 'ぎ',
  gu: 'ぐ',
  ge: 'げ',
  go: 'ご',
  za: 'ざ',
  ji: 'じ',
  zi: 'じ',
  zu: 'ず',
  ze: 'ぜ',
  zo: 'ぞ',
  da: 'だ',
  di: 'ぢ',
  du: 'づ',
  de: 'de',
  do: 'ど',
  ba: 'ば',
  bi: 'び',
  bu: 'ぶ',
  be: 'べ',
  bo: 'ぼ',
  pa: 'ぱ',
  pi: 'ぴ',
  pu: 'ぷ',
  pe: 'ぺ',
  po: 'ぽ',
  a: 'あ',
  i: 'い',
  u: 'う',
  e: 'え',
  o: 'お',
}

export function romajiToHiragana(text) {
  if (!text || typeof text !== 'string') return ''
  let str = text.toLowerCase()
  str = str.replace(/([ksthmyrwgzdbp])\1/g, 'っ$1')
  const keys = Object.keys(romajiMap).sort((a, b) => b.length - a.length)
  for (const k of keys) {
    str = str.replaceAll(k, romajiMap[k])
  }
  return str
}

export function kanaToRomaji(kana) {
  if (!kana) return ''
  const DIGRAPHS = {
    きゃ: 'kya',
    きゅ: 'kyu',
    きょ: 'kyo',
    しゃ: 'sha',
    しゅ: 'shu',
    しょ: 'sho',
    ちゃ: 'cha',
    ちゅ: 'chu',
    ちょ: 'cho',
    にゃ: 'nya',
    にゅ: 'nyu',
    にょ: 'nyo',
    ひゃ: 'hya',
    ひゅ: 'hyu',
    ひょ: 'hyo',
    みゃ: 'mya',
    みゅ: 'myu',
    みょ: 'myo',
    りゃ: 'rya',
    りゅ: 'ryu',
    りょ: 'ryo',
    ぎゃ: 'gya',
    ぎゅ: 'gyu',
    ぎょ: 'gyo',
    じゃ: 'ja',
    じゅ: 'ju',
    じょ: 'jo',
    びゃ: 'bya',
    びゅ: 'byu',
    びょ: 'byo',
    ぴゃ: 'pya',
    ぴゅ: 'pyu',
    ぴょ: 'pyo',
    キャ: 'kya',
    キュ: 'kyu',
    キョ: 'kyo',
    シャ: 'sha',
    シュ: 'shu',
    ショ: 'sho',
    チャ: 'cha',
    チュ: 'chu',
    チョ: 'cho',
    ニャ: 'nya',
    ニュ: 'nyu',
    ニョ: 'nyo',
    ヒャ: 'hya',
    ヒュ: 'hyu',
    ヒョ: 'hyo',
    ミャ: 'mya',
    ミュ: 'myu',
    ミョ: 'myo',
    リャ: 'rya',
    リュ: 'ryu',
    リョ: 'ryo',
    ギャ: 'gya',
    ギュ: 'gyu',
    ギョ: 'gyo',
    ジャ: 'ja',
    ジュ: 'ju',
    ジョ: 'jo',
    ビャ: 'bya',
    ビュ: 'byu',
    ビョ: 'byo',
    ピャ: 'pya',
    ピュ: 'pyu',
    ピョ: 'pyo',
    ファ: 'fa',
    フィ: 'fi',
    フェ: 'fe',
    フォ: 'fo',
    ティ: 'ti',
    ディ: 'di',
    トゥ: 'tu',
    ドゥ: 'du',
    ウィ: 'wi',
    ウェ: 'we',
    ウォ: 'wo',
    ヴァ: 'va',
    ヴィ: 'vi',
    ヴ: 'vu',
    ヴェ: 've',
    ヴォ: 'vo',
    シェ: 'she',
    ジェ: 'je',
    チェ: 'che',
  }
  const MONOGRAPHS = {
    あ: 'a',
    い: 'i',
    う: 'u',
    え: 'e',
    お: 'o',
    か: 'ka',
    き: 'ki',
    く: 'ku',
    け: 'ke',
    こ: 'ko',
    さ: 'sa',
    し: 'shi',
    す: 'su',
    せ: 'se',
    そ: 'so',
    た: 'ta',
    ち: 'chi',
    つ: 'tsu',
    て: 'te',
    と: 'to',
    な: 'na',
    に: 'ni',
    ぬ: 'nu',
    ね: 'ne',
    の: 'no',
    は: 'ha',
    ひ: 'hi',
    ふ: 'fu',
    へ: 'he',
    ほ: 'ho',
    ま: 'ma',
    み: 'mi',
    mu: 'mu',
    め: 'me',
    も: 'mo',
    や: 'ya',
    ゆ: 'yu',
    よ: 'yo',
    ら: 'ra',
    り: 'ri',
    る: 'ru',
    れ: 're',
    ろ: 'ro',
    わ: 'wa',
    を: 'o',
    ん: 'n',
    が: 'ga',
    ぎ: 'gi',
    ぐ: 'gu',
    げ: 'ge',
    ご: 'go',
    ざ: 'za',
    じ: 'ji',
    ず: 'zu',
    ぜ: 'ze',
    ぞ: 'zo',
    だ: 'da',
    ぢ: 'ji',
    づ: 'zu',
    で: 'de',
    ど: 'do',
    ば: 'ba',
    び: 'bi',
    ぶ: 'bu',
    べ: 'be',
    ぼ: 'bo',
    ぱ: 'pa',
    ぴ: 'pi',
    ぷ: 'pu',
    ぺ: 'pe',
    ぽ: 'po',
    ア: 'a',
    イ: 'i',
    ウ: 'u',
    エ: 'e',
    オ: 'o',
    カ: 'ka',
    キ: 'ki',
    ク: 'ku',
    ケ: 'ke',
    コ: 'ko',
    サ: 'sa',
    シ: 'shi',
    ス: 'su',
    セ: 'se',
    ソ: 'so',
    タ: 'ta',
    チ: 'chi',
    ツ: 'tsu',
    テ: 'te',
    ト: 'to',
    ナ: 'na',
    ニ: 'ni',
    ヌ: 'nu',
    ネ: 'ne',
    ノ: 'no',
    ハ: 'ha',
    ヒ: 'hi',
    フ: 'fu',
    ヘ: 'he',
    ホ: 'ho',
    マ: 'ma',
    ミ: 'mi',
    ム: 'mu',
    メ: 'me',
    モ: 'mo',
    ヤ: 'ya',
    ユ: 'yu',
    ヨ: 'yo',
    ラ: 'ra',
    リ: 'ri',
    ル: 'ru',
    レ: 're',
    ロ: 'ro',
    ワ: 'wa',
    ヲ: 'o',
    ン: 'n',
    ガ: 'ga',
    ギ: 'gi',
    グ: 'gu',
    ゲ: 'ge',
    ゴ: 'go',
    ザ: 'za',
    ジ: 'ji',
    ズ: 'zu',
    ゼ: 'ze',
    ゾ: 'zo',
    ダ: 'da',
    ヂ: 'ji',
    ヅ: 'zu',
    デ: 'de',
    ド: 'do',
    バ: 'ba',
    ビ: 'bi',
    ブ: 'bu',
    ベ: 'be',
    ボ: 'bo',
    パ: 'pa',
    ピ: 'pi',
    プ: 'pu',
    ペ: 'pe',
    ポ: 'po',
    ぁ: 'a',
    ぃ: 'i',
    ぅ: 'u',
    ぇ: 'e',
    ぉ: 'o',
    ァ: 'a',
    ィ: 'i',
    ゥ: 'u',
    ェ: 'e',
    ォ: 'o',
    ー: '-',
  }

  let result = ''
  let i = 0
  while (i < kana.length) {
    if (kana[i] === 'っ' || kana[i] === 'ッ') {
      if (i + 1 < kana.length) {
        const nextTwo = kana.slice(i + 1, i + 3)
        const nextOne = kana[i + 1]
        const nextRomaji = DIGRAPHS[nextTwo] || MONOGRAPHS[nextOne] || ''
        if (nextRomaji) {
          result += nextRomaji[0] === 'c' ? 't' : nextRomaji[0]
        }
      }
      i++
      continue
    }

    const two = kana.slice(i, i + 2)
    if (DIGRAPHS[two]) {
      result += DIGRAPHS[two]
      i += 2
      continue
    }

    const one = kana[i]
    if (one === 'ー') {
      const last = result[result.length - 1]
      result += last && 'aeiou'.includes(last) ? last : '-'
      i++
      continue
    }

    if (MONOGRAPHS[one]) {
      result += MONOGRAPHS[one]
      i++
      continue
    }

    result += one
    i++
  }
  return result
}

function isKanji(char) {
  const code = char.charCodeAt(0)
  return (code >= 0x4e00 && code <= 0x9faf) || (code >= 0x3400 && code <= 0x4dbf)
}

function extractKanjis(text) {
  if (!text || typeof text !== 'string') return []
  const set = new Set()
  for (const char of text) {
    if (isKanji(char)) set.add(char)
  }
  return Array.from(set)
}

function unescapeText(str) {
  if (!str) return ''
  return str.replaceAll('\\n', '\n').replaceAll('\\r', '')
}

function cleanOnyomiAndHanViet(onyomiRaw, fallbackHanViet) {
  if (!onyomiRaw) return { hanViet: fallbackHanViet || '', onyomi: '' }
  const tokens = String(onyomiRaw).split(/\s+/)
  const katakana = []
  const hanViet = []

  for (const t of tokens) {
    if (/^[\u30A0-\u30FF\u3040-\u309F・]+$/.test(t)) {
      katakana.push(t)
    } else if (/^[A-ZÀÁẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬĐÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴ]/.test(t)) {
      hanViet.push(t)
    }
  }

  return {
    hanViet: hanViet.join(', ') || fallbackHanViet || '',
    onyomi: katakana.join(' ') || '',
  }
}

const COMMON_KANJI_MEANINGS = {
  学: { hanViet: 'Học', meaning: 'học, học tập; khoa học, trường học' },
  校: { hanViet: 'Hiệu', meaning: 'trường học; in ấn; hiệu đính' },
  名: { hanViet: 'Danh', meaning: 'tên, danh tiếng, danh nghĩa; số lượng người' },
  食: { hanViet: 'Thực', meaning: 'ăn, thức ăn, thực phẩm, dùng bữa' },
  感: { hanViet: 'Cảm', meaning: 'cảm giác, cảm xúc, cảm động; cảm hóa' },
  想: { hanViet: 'Tưởng', meaning: 'tưởng tượng, suy nghĩ, cảm tưởng; lý tưởng' },
  謝: { hanViet: 'Tạ', meaning: 'cảm ơn, biết ơn, tạ lỗi, cảm tạ' },
  印: { hanViet: 'Ấn', meaning: 'con dấu, dấu vết; in ấn, ấn tượng' },
  象: { hanViet: 'Tượng', meaning: 'hình tượng, tượng trưng, hiện tượng; con voi' },
  発: { hanViet: 'Phát', meaning: 'phát xuất, phát biểu, xuất phát, phát triển' },
  表: { hanViet: 'Biểu', meaning: 'mặt ngoài, bề mặt; biểu thị, phát biểu, biểu hiện' },
  連: { hanViet: 'Liên', meaning: 'liên lạc, liền nối, liên tục, liên kết' },
  絡: { hanViet: 'Lạc', meaning: 'liên lạc, kết nối, mạng lưới' },
  案: { hanViet: 'Án', meaning: 'dự án, kế hoạch, phương án, ý kiến, đề án' },
  内: { hanViet: 'Nội', meaning: 'bên trong, trong lòng, nội bộ, nội tâm' },
  先: { hanViet: 'Tiên', meaning: 'trước, đi trước, tiền bối, tổ tiên' },
  生: { hanViet: 'Sinh', meaning: 'sống, sinh ra, cuộc sống, học sinh' },
  勉: { hanViet: 'Miễn', meaning: 'cố sức, gắng gỏi, chăm chỉ' },
  強: { hanViet: 'Cường', meaning: 'mạnh mẽ, kiên cường, vững vàng' },
  時: { hanViet: 'Thời', meaning: 'thời gian, thời khắc, giờ giấc, thời cơ' },
  間: { hanViet: 'Gian', meaning: 'khoảng cách, khoảng thời gian, ở giữa' },
  語: { hanViet: 'Ngữ', meaning: 'ngôn ngữ, lời nói, từ ngữ, kể chuyện' },
  本: { hanViet: 'Bản', meaning: 'gốc rễ, cội nguồn; sách vở; cây cối' },
  日: { hanViet: 'Nhật', meaning: 'mặt trời, ban ngày, ngày tháng; Nhật Bản' },
  人: { hanViet: 'Nhân', meaning: 'con người, người ta' },
  車: { hanViet: 'Xa', meaning: 'xe cộ, bánh xe' },
  水: { hanViet: 'Thủy', meaning: 'nước, chất lỏng' },
  雨: { hanViet: 'Vũ', meaning: 'mưa, cơn mưa' },
  見: { hanViet: 'Kiến', meaning: 'nhìn, xem, trông thấy; ý kiến' },
  行: { hanViet: 'Hành', meaning: 'đi, tiến hành, thực hiện, hành động' },
  来: { hanViet: 'Lai', meaning: 'đến, tới; tương lai' },
  話: { hanViet: 'Thoại', meaning: 'nói chuyện, cuộc trò chuyện, câu chuyện' },
  聞: { hanViet: 'Văn', meaning: 'nghe, nghe thấy; hỏi thăm; tin tức' },
  読: { hanViet: 'Độc', meaning: 'đọc, đọc sách' },
  書: { hanViet: 'Thư', meaning: 'viết, sách vở, văn thư' },
  友: { hanViet: 'Hữu', meaning: 'bạn bè, bằng hữu, thân thiện' },
  達: { hanViet: 'Đạt', meaning: 'đạt được; thông suốt; số nhiều (các bạn)' },
  大: { hanViet: 'Đại', meaning: 'to lớn, rộng lớn, quan trọng' },
  小: { hanViet: 'Tiểu', meaning: 'nhỏ bé, ít ỏi' },
  高: { hanViet: 'Cao', meaning: 'cao ráo, đắt đỏ, cao quý' },
  安: { hanViet: 'An', meaning: 'yên ổn, bình an; giá rẻ' },
  新: { hanViet: 'Tân', meaning: 'mới mẻ, tân tiến' },
  古: { hanViet: 'Cổ', meaning: 'cũ kỹ, cổ xưa' },
  文: { hanViet: 'Văn', meaning: 'văn chương, câu văn, văn học; chữ viết' },
  字: { hanViet: 'Tự', meaning: 'chữ cái, ký tự, văn tự' },
  漢: { hanViet: 'Hán', meaning: 'chữ Hán; sông Hán; đàn ông' },
  気: { hanViet: 'Khí', meaning: 'không khí, khí chất, tinh thần, tâm trạng' },
  体: { hanViet: 'Thể', meaning: 'cơ thể, thân thể, hình thể, thể trạng' },
  国: { hanViet: 'Quốc', meaning: 'quốc gia, đất nước, quê hương' },
  会: { hanViet: 'Hội', meaning: 'gặp gỡ, hội họp, hiệp hội, công ty' },
  社: { hanViet: 'Xã', meaning: 'xã hội, công ty, đền thờ' },
  店: { hanViet: 'Điếm', meaning: 'cửa hàng, tiệm buôn, tiệm ăn' },
  道: { hanViet: 'Đạo', meaning: 'con đường, đạo lý, phương hướng' },
  前: { hanViet: 'Tiền', meaning: 'phía trước, trước đây, tiền bối' },
  後: { hanViet: 'Hậu', meaning: 'phía sau, sau này, hậu bối' },
  左: { hanViet: 'Tả', meaning: 'bên trái' },
  右: { hanViet: 'Hữu', meaning: 'bên phải' },
  上: { hanViet: 'Thượng', meaning: 'phía trên, bên trên, cấp trên' },
  下: { hanViet: 'Hạ', meaning: 'phía dưới, bên dưới, cấp dưới' },
  中: { hanViet: 'Trung', meaning: 'ở giữa, bên trong, trung tâm' },
  外: { hanViet: 'Ngoại', meaning: 'bên ngoài, người ngoài, ngoại quốc' },
  分: { hanViet: 'Phân', meaning: 'phút; phân chia; phần việc' },
  半: { hanViet: 'Bán', meaning: 'một nửa, một nửa giờ (30 phút)' },
  毎: { hanViet: 'Mỗi', meaning: 'mỗi, từng, hàng ngày, hàng tháng' },
  何: { hanViet: 'Hà', meaning: 'cái gì, gì, mấy, bao nhiêu' },
  父: { hanViet: 'Phụ', meaning: 'cha, bố, phụ thân' },
  母: { hanViet: 'Mẫu', meaning: 'mẹ, mẫu thân' },
  子: { hanViet: 'Tử', meaning: 'con cái, đứa trẻ' },
  男: { hanViet: 'Nam', meaning: 'nam giới, con trai, đàn ông' },
  女: { hanViet: 'Nữ', meaning: 'nữ giới, con gái, phụ nữ' },
  目: { hanViet: 'Mục', meaning: 'con mắt, ánh nhìn, mục tiêu' },
  耳: { hanViet: 'Nhĩ', meaning: 'cái tai, lỗ tai' },
  手: { hanViet: 'Thủ', meaning: 'bàn tay, tay nghề' },
  足: { hanViet: 'Túc', meaning: 'bàn chân; đầy đủ, sung túc' },
  心: { hanViet: 'Tâm', meaning: 'trái tim, tâm trí, tấm lòng' },
  力: { hanViet: 'Lực', meaning: 'sức lực, lực lượng, năng lực' },
  天: { hanViet: 'Thiên', meaning: 'trời, bầu trời, thiên nhiên' },
  雪: { hanViet: 'Tuyết', meaning: 'tuyết, băng tuyết' },
  風: { hanViet: 'Phong', meaning: 'gió, phong cách, phong thái' },
  花: { hanViet: 'Hoa', meaning: 'bông hoa, tươi đẹp' },
  木: { hanViet: 'Mộc', meaning: 'cây cối, gỗ' },
  山: { hanViet: 'Sơn', meaning: 'núi non, đồi núi' },
  川: { hanViet: 'Xuyên', meaning: 'dòng sông, sông suối' },
  海: { hanViet: 'Hải', meaning: 'biển cả, đại dương' },
  魚: { hanViet: 'Ngư', meaning: 'con cá, thủy sản' },
  鳥: { hanViet: 'Điểu', meaning: 'con chim, loài chim' },
  犬: { hanViet: 'Khuyển', meaning: 'con chó' },
  猫: { hanViet: 'Miêu', meaning: 'con mèo' },
}

function cleanKanjiMeaning(meaningsRaw, char) {
  if (COMMON_KANJI_MEANINGS[char]) {
    return COMMON_KANJI_MEANINGS[char].meaning
  }

  if (!meaningsRaw) return ''
  const list = Array.isArray(meaningsRaw) ? meaningsRaw : [meaningsRaw]
  for (const m of list) {
    if (typeof m === 'string' && /[àáảãạăắằẳẵặâấầẩẫậđèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵ]/i.test(m)) {
      if (m.includes('#')) {
        const afterSharp = m.split('#')[1] || ''
        let clean = afterSharp
          .replace(/\[\/?b\]/g, '')
          .replace(/<[^>]+>/g, '')
          .replace(/\[[^\]]+\]/g, '')
          .replace(/①|②|③|④|⑤|⑥/g, ' • ')
          .trim()
        clean = clean.split('\n')[0]?.trim() || clean
        return clean
          .slice(0, 100)
          .replace(/\s*•\s*$/, '')
          .trim()
      }
      return m
        .replace(/\[\/?b\]/g, '')
        .replace(/<[^>]+>/g, '')
        .trim()
        .slice(0, 100)
    }
  }

  const first = list[0] ? String(list[0]).trim() : ''
  return first
}

// Caching DB for high quality Mazii & Vietnamese definitions
function getCacheDb() {
  if (!DatabaseSync) return null
  const cacheDir = path.resolve('data')
  if (!existsSync(cacheDir)) mkdirSync(cacheDir, { recursive: true })
  const db = new DatabaseSync(path.join(cacheDir, 'mazii_cache.db'))
  db.exec(`
    CREATE TABLE IF NOT EXISTS cached_words (
      query TEXT PRIMARY KEY,
      data_json TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS cached_kanjis (
      character TEXT PRIMARY KEY,
      data_json TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `)
  return db
}

const SPECIAL_READINGS = {
  何時: 'なんじ',
  午前: 'ごぜん',
  午後: 'ごご',
  '9時': 'くじ',
  '1時': 'いちじ',
  '2時': 'にじ',
  '3時': 'さんじ',
  '4時': 'よじ',
  '5時': 'ごじ',
  '6時': 'ろくじ',
  '7時': 'しちじ',
  '8時': 'はちじ',
  '10時': 'じゅうじ',
  '11時': 'じゅういちじ',
  '12時': 'じゅうにじ',
  '9時半': 'くじはん',
  半: 'はん',
  時: 'じ',
  分: 'ふん',
  秒: 'びょう',
  時間: 'じかん',
  今日: 'きょう',
  明日: 'あした',
  昨日: 'きのう',
  今年: 'ことし',
  去年: 'きょねん',
  来年: 'らいねん',
  今回: 'こんかい',
  次回: 'じかい',
  日本語: 'にほんご',
  英語: 'えいご',
  勉強: 'べんきょう',
  学習: 'がくしゅう',
  習慣: 'しゅうかん',
  大切: 'たいせつ',
  友達: 'ともだち',
  自然: 'しぜん',
  話す: 'はなす',
  聞く: 'きく',
  読む: 'よむ',
  書く: 'かく',
}

function resolveFuriganaReading(word, stmtMasterExact, stmtExact) {
  if (SPECIAL_READINGS[word]) return SPECIAL_READINGS[word]
  if (/^(\d+)時$/.test(word)) return 'じ'
  if (stmtMasterExact) {
    try {
      const match = stmtMasterExact.get(word, word)
      if (match?.reading) {
        return match.reading.split(/[\s\t、,]+/)[0] || null
      }
    } catch {}
  }
  if (stmtExact) {
    try {
      const match = stmtExact.get(word, word)
      if (match?.reading) {
        return match.reading.split(/[\s\t、,]+/)[0] || null
      }
    } catch {}
  }
  return null
}

export function createDictionaryService(dbPath) {
  if (!DatabaseSync) {
    log('warn', 'dictionary.sqlite-unavailable', { dbPath })
    return {
      available: false,
      search: () => [],
      getWordDetail: () => null,
      getKanjiDetail: () => null,
    }
  }
  if (!dbPath || !existsSync(dbPath)) {
    log('warn', 'dictionary.database-missing', { dbPath })
    return {
      available: false,
      search: () => [],
      getWordDetail: () => null,
      getKanjiDetail: () => null,
    }
  }

  let db
  try {
    db = new DatabaseSync(dbPath, { readOnly: true })
    log('info', 'dictionary.connected', { dbPath })
  } catch (error) {
    logError('dictionary.connection-failed', error, { dbPath })
    return {
      available: false,
      search: () => [],
      getWordDetail: () => null,
      getKanjiDetail: () => null,
    }
  }

  let cacheDb
  try {
    cacheDb = getCacheDb()
  } catch {}

  const stmtGetCachedWord = cacheDb?.prepare('SELECT data_json FROM cached_words WHERE query = ? LIMIT 1')
  const stmtSetCachedWord = cacheDb?.prepare(
    'INSERT OR REPLACE INTO cached_words (query, data_json, updated_at) VALUES (?, ?, ?)'
  )
  const _stmtGetCachedKanji = cacheDb?.prepare('SELECT data_json FROM cached_kanjis WHERE character = ? LIMIT 1')
  const _stmtSetCachedKanji = cacheDb?.prepare(
    'INSERT OR REPLACE INTO cached_kanjis (character, data_json, updated_at) VALUES (?, ?, ?)'
  )

  // Master Dictionary DB (pre-normalized, verified data with binary collation index)
  let masterDb = null
  let stmtMasterExact = null
  let stmtMasterPrefixWord = null
  let stmtMasterPrefixReading = null
  let stmtMasterRelated = null
  let stmtMasterVietnamese = null
  try {
    const masterPath = path.resolve('data/master_dictionary.db')
    if (existsSync(masterPath)) {
      masterDb = new DatabaseSync(masterPath, { readOnly: true })
      stmtMasterExact = masterDb.prepare(`
        SELECT word, reading, han_viet, jlpt, pos, meanings, examples
        FROM words
        WHERE word = ? OR reading = ?
      `)
      stmtMasterPrefixWord = masterDb.prepare(`
        SELECT word, reading, han_viet, jlpt, pos, meanings, examples
        FROM words
        WHERE word GLOB ? AND word != ?
        LIMIT ?
      `)
      stmtMasterPrefixReading = masterDb.prepare(`
        SELECT word, reading, han_viet, jlpt, pos, meanings, examples
        FROM words
        WHERE reading GLOB ? AND reading != ?
        LIMIT ?
      `)
      stmtMasterRelated = masterDb.prepare(`
        SELECT word, reading, han_viet, meanings
        FROM words
        WHERE word GLOB ? AND word != ?
        LIMIT 5
      `)
      stmtMasterVietnamese = masterDb.prepare(`
        SELECT word, reading, han_viet, jlpt, pos, meanings, examples
        FROM words
        WHERE meanings LIKE ?
        LIMIT ?
      `)
      const count = masterDb.prepare('SELECT COUNT(*) as c FROM words WHERE verified = 1').get()
      log('info', 'dictionary.master-db-loaded', { path: masterPath, verifiedWords: count.c })
    }
  } catch {}

  // Online Fetch from Mazii for pure Vietnamese definitions & examples
  async function fetchMaziiOnline(query, type = 'word') {
    try {
      const res = await fetch('https://mazii.net/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        body: JSON.stringify({
          dict: 'javi',
          type,
          query,
          limit: 5,
        }),
        signal: AbortSignal.timeout(3500),
      })
      if (!res.ok) return null
      const data = await res.json()
      return data.data || data.results || null
    } catch {
      return null
    }
  }

  // Load Curated Shards Examples
  const curatedExamples = new Map()
  try {
    const shardsDir = path.resolve(path.dirname(dbPath), '../aanime_scraper/dictionary/shards')
    if (existsSync(shardsDir)) {
      const files = readdirSync(shardsDir).filter((f) => f.endsWith('.json'))
      for (const file of files) {
        try {
          const data = JSON.parse(readFileSync(path.join(shardsDir, file), 'utf8'))
          for (const item of Object.values(data)) {
            if (item.word && Array.isArray(item.examples) && item.examples.length > 0) {
              curatedExamples.set(
                item.word,
                item.examples.map((e) => ({
                  sentenceJp: e.ja,
                  furigana: e.reading || null,
                  sentenceVi: e.vi,
                }))
              )
            }
          }
        } catch {}
      }
    }
  } catch {}

  // Load Kanji Dic
  const kanjiMap = new Map()
  try {
    const kanjiBankPath = path.resolve(
      path.dirname(dbPath),
      'data/full_dictionary_database/kanjidic_vietnamese/kanji_bank_1.json'
    )
    if (existsSync(kanjiBankPath)) {
      const bankData = JSON.parse(readFileSync(kanjiBankPath, 'utf8'))
      for (const item of bankData) {
        if (Array.isArray(item) && item.length >= 5) {
          const char = item[0]
          const onyomiRaw = item[1]
          const kunyomiRaw = item[2]
          const meaningsRaw = item[4] || []
          const meta = item[5] || {}

          const { hanViet, onyomi } = cleanOnyomiAndHanViet(onyomiRaw, COMMON_KANJI_MEANINGS[char]?.hanViet)

          let jlpt = meta.jlpt ? `N${meta.jlpt}` : null
          if (meta.jlpt === '4') jlpt = 'N5'
          else if (meta.jlpt === '3') jlpt = 'N4'
          else if (meta.jlpt === '2') jlpt = 'N3/N2'
          else if (meta.jlpt === '1') jlpt = 'N1'

          const viMeaning = cleanKanjiMeaning(meaningsRaw, char)

          kanjiMap.set(char, {
            character: char,
            hanViet: COMMON_KANJI_MEANINGS[char]?.hanViet || hanViet || null,
            onyomi: onyomi || null,
            kunyomi: kunyomiRaw ? String(kunyomiRaw).replaceAll(' ', ', ') : null,
            jlpt,
            strokeCount: meta.strokes ? Number(meta.strokes) : null,
            meaning: viMeaning || null,
          })
        }
      }
    }
  } catch {}

  const stmtExact = db.prepare(`
    SELECT id, word, reading, romaji, han_viet, jlpt_level, part_of_speech, meaning
    FROM tuvung
    WHERE word = ? OR reading = ? OR word = ? OR reading = ?
    ORDER BY CASE WHEN word = ? THEN 0 WHEN reading = ? THEN 1 ELSE 2 END, LENGTH(word) ASC
    LIMIT ?
  `)

  const stmtPrefix = db.prepare(`
    SELECT id, word, reading, romaji, han_viet, jlpt_level, part_of_speech, meaning
    FROM tuvung
    WHERE word LIKE ? OR reading LIKE ? OR word LIKE ? OR reading LIKE ?
    ORDER BY LENGTH(word) ASC
    LIMIT ?
  `)

  const stmtMeaning = db.prepare(`
    SELECT id, word, reading, romaji, han_viet, jlpt_level, part_of_speech, meaning
    FROM tuvung
    WHERE meaning LIKE ?
    ORDER BY LENGTH(word) ASC
    LIMIT ?
  `)

  const stmtKanji = db.prepare(`
    SELECT id, character, han_viet, onyomi, kunyomi, jlpt_level, stroke_count, radical, meaning
    FROM hantu
    WHERE character = ?
    LIMIT 1
  `)

  const stmtExamples = db.prepare(`
    SELECT sentence_jp, furigana, sentence_vi
    FROM maucau
    WHERE sentence_jp LIKE ? AND sentence_vi != ''
    LIMIT ?
  `)

  function enrichKanji(wordText) {
    const kanjiChars = extractKanjis(wordText)
    const list = []
    for (const char of kanjiChars) {
      if (COMMON_KANJI_MEANINGS[char]) {
        const k = COMMON_KANJI_MEANINGS[char]
        const base = kanjiMap.get(char) || {}
        list.push({
          character: char,
          hanViet: k.hanViet,
          onyomi: base.onyomi || null,
          kunyomi: base.kunyomi || null,
          jlpt: base.jlpt || null,
          strokeCount: base.strokeCount || null,
          meaning: k.meaning,
        })
        continue
      }

      if (kanjiMap.has(char)) {
        list.push(kanjiMap.get(char))
      } else {
        const row = stmtKanji.get(char)
        if (row) {
          const { hanViet, onyomi } = cleanOnyomiAndHanViet(row.onyomi, row.han_viet)
          list.push({
            character: row.character,
            hanViet: hanViet || row.han_viet || null,
            onyomi: onyomi || null,
            kunyomi: row.kunyomi || null,
            jlpt: row.jlpt_level || null,
            strokeCount: row.stroke_count || null,
            meaning: cleanKanjiMeaning(row.meaning, char),
          })
        }
      }
    }
    return list
  }

  function getRelatedWords(wordText) {
    if (stmtMasterRelated) {
      try {
        const rows = stmtMasterRelated.all(wordText + '*', wordText)
        if (rows.length > 0) {
          return rows.map((r) => {
            let meaning = ''
            try {
              const parsed = JSON.parse(r.meanings || '[]')
              meaning = parsed[0] || ''
            } catch {}
            return {
              word: r.word,
              reading: r.reading,
              hanViet: r.han_viet || null,
              meaning,
            }
          })
        }
      } catch {}
    }
    return []
  }

  function parseRawMeaning(raw) {
    if (!raw) return { hanViet: null, viMeanings: [] }
    const text = unescapeText(raw)
    const lines = text.split('\n')

    let hanViet = null
    const hvMatch = text.match(
      /[\u3040-\u309F\u30A0-\u30FF]+\s+([A-ZÀÁẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬĐÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴ\s,]+)(?:;|$|\n)/
    )
    if (hvMatch) {
      hanViet = hvMatch[1].trim().replace(/,\s*$/, '')
    }

    const viMeanings = []

    for (const line of lines) {
      const l = line.trim()
      if (!l) continue

      if (l.startsWith('-') || l.startsWith('@')) {
        let clean = l
          .replace(/^@[^\s-]+\s*-?\s*/, '')
          .replace(/^-\s*/, '')
          .trim()

        const matchTag = clean.match(/^\{([^}]+)\}(?:,\s*(.+))?/)
        if (matchTag && matchTag[2]) {
          const parts = matchTag[2]
            .split(/[;]/)
            .map((p) => p.trim())
            .filter((p) => p.length > 1 && !p.startsWith('(') && !p.startsWith('{'))
          for (const p of parts) {
            if (!viMeanings.includes(p)) viMeanings.push(p)
          }
        } else if (!matchTag) {
          clean = clean.replace(/^[,\s;]+/, '').replace(/[.\s;]+$/, '')
          if (clean.length > 1 && !clean.startsWith('{')) {
            const parts = clean
              .split(/[;]/)
              .map((p) => p.trim())
              .filter((p) => p.length > 1)
            for (const p of parts) {
              if (!viMeanings.includes(p)) viMeanings.push(p)
            }
          }
        }
      }
    }

    return { hanViet, viMeanings: viMeanings.slice(0, 5) }
  }

  function formatWord(row, includeExtras = true) {
    if (!row) return null
    const parsed = parseRawMeaning(row.meaning)
    const kanjis = enrichKanji(row.word)

    let hanViet = parsed.hanViet || row.han_viet
    if (!hanViet && kanjis.length > 0) {
      const hvParts = kanjis.map((k) => k.hanViet).filter(Boolean)
      if (hvParts.length > 0) hanViet = hvParts.join(' ')
    }

    let jlpt = row.jlpt_level
    if (!jlpt && kanjis.length > 0) {
      const jlpts = kanjis.map((k) => k.jlpt).filter(Boolean)
      if (jlpts.length > 0) jlpt = jlpts[0]
    }

    let examples = []
    let relatedWords = []
    if (includeExtras) {
      if (curatedExamples.has(row.word)) {
        examples = curatedExamples.get(row.word)
      } else {
        const sampleRows = stmtExamples.all(`%${row.word}%`, 4)
        examples = sampleRows.map((e) => ({
          sentenceJp: e.sentence_jp,
          furigana: e.furigana || null,
          sentenceVi: e.sentence_vi,
        }))
      }
      relatedWords = getRelatedWords(row.word)
    }

    return {
      id: row.id,
      word: row.word,
      reading: row.reading,
      romaji: row.romaji,
      hanViet: hanViet || null,
      jlpt: jlpt || null,
      partOfSpeech: row.part_of_speech || 'Danh từ chung',
      meanings: parsed.viMeanings,
      rawMeaning: row.meaning,
      kanjis,
      relatedWords,
      examples,
    }
  }

  return {
    available: true,
    async search(keyword, { limit = 20, jlpt = null } = {}) {
      const raw = String(keyword ?? '').trim()
      if (!raw) return []

      // Dedup helper - normalizes separators and removes substring duplicates
      function dedupMeanings(arr) {
        if (!Array.isArray(arr)) return []
        // First, split any entries that contain ; or , into individual parts
        const expanded = []
        for (const item of arr) {
          const parts = String(item)
            .split(/[;,]/)
            .map((s) => s.trim())
            .filter(Boolean)
          for (const p of parts) expanded.push(p)
        }
        // Deduplicate
        const seen = new Set()
        return expanded.filter((item) => {
          const norm = item
            .toLowerCase()
            .replace(/[.,;:\s]+$/g, '')
            .replace(/\s+/g, ' ')
          if (!norm || norm.length < 1 || seen.has(norm)) return false
          // Check substring containment
          for (const existing of seen) {
            if (existing.includes(norm) || norm.includes(existing)) return false
          }
          seen.add(norm)
          return true
        })
      }

      // ── Priority 1: Master Dictionary DB (pre-normalized, verified, ultra-fast indexed) ──
      if (masterDb) {
        try {
          const queries = [raw]
          const hiragana = romajiToHiragana(raw)
          if (hiragana && hiragana !== raw) {
            queries.push(hiragana)
          }

          const seen = new Set()
          const masterRows = []

          function addRows(rows) {
            for (const r of rows) {
              if (seen.has(r.word)) continue
              seen.add(r.word)
              masterRows.push(r)
              if (masterRows.length >= limit) return true
            }
            return false
          }

          // 1. Exact matches for raw & hiragana
          for (const q of queries) {
            if (addRows(stmtMasterExact.all(q, q))) break
          }

          // 2. Prefix word matches
          if (masterRows.length < limit) {
            for (const q of queries) {
              if (addRows(stmtMasterPrefixWord.all(q + '*', q, limit - masterRows.length))) break
            }
          }

          // 3. Prefix reading matches
          if (masterRows.length < limit) {
            for (const q of queries) {
              if (addRows(stmtMasterPrefixReading.all(q + '*', q, limit - masterRows.length))) break
            }
          }

          // 4. Meaning / Vietnamese search fallback if no Japanese matches
          if (masterRows.length === 0 && raw.length >= 2) {
            addRows(stmtMasterVietnamese.all(`%${raw}%`, limit))
          }

          if (masterRows.length > 0) {
            return masterRows.map((r, idx) => ({
              id: 2000000 + idx,
              word: r.word,
              reading: r.reading,
              romaji: null,
              hanViet: r.han_viet || null,
              jlpt: r.jlpt || null,
              partOfSpeech: r.pos || 'Danh từ',
              meanings: dedupMeanings(JSON.parse(r.meanings || '[]')),
              kanjis: enrichKanji(r.word),
              relatedWords: getRelatedWords(r.word),
              examples: JSON.parse(r.examples || '[]').map((e) => ({
                sentenceJp: e.jp,
                furigana: e.furigana || null,
                sentenceVi: e.vi,
              })),
            }))
          }
        } catch {}
      }

      // ── Priority 2: Cache ──
      if (stmtGetCachedWord) {
        try {
          const cached = stmtGetCachedWord.get(raw)
          if (cached?.data_json) {
            const parsed = JSON.parse(cached.data_json)
            if (Array.isArray(parsed) && parsed.length > 0) {
              return parsed.map((item) => ({
                ...item,
                meanings: dedupMeanings(item.meanings),
                kanjis: item.kanjis && item.kanjis.length > 0 ? item.kanjis : enrichKanji(item.word),
                relatedWords:
                  item.relatedWords && item.relatedWords.length > 0 ? item.relatedWords : getRelatedWords(item.word),
                jlpt: item.jlpt ? String(item.jlpt).replace(/^N+/, 'N') : null,
              }))
            }
          }
        } catch {}
      }

      // ── Priority 3: Online Mazii API ──
      const onlineData = await fetchMaziiOnline(raw, 'word')
      if (onlineData && Array.isArray(onlineData) && onlineData.length > 0) {
        const enrichedResults = onlineData.map((item, idx) => {
          const allMeans = []
          for (const m of item.means || []) {
            if (m.mean) {
              for (const part of m.mean
                .split(/[;,]/)
                .map((s) => s.trim())
                .filter(Boolean)) {
                allMeans.push(part)
              }
            }
          }
          if (item.short_mean) {
            for (const part of item.short_mean
              .split(/[;,]/)
              .map((s) => s.trim())
              .filter(Boolean)) {
              allMeans.push(part)
            }
          }

          const examples = []
          for (const m of item.means || []) {
            for (const ex of m.examples || []) {
              examples.push({
                sentenceJp: ex.content,
                furigana: ex.transcription || null,
                sentenceVi: ex.mean,
              })
            }
          }

          const kanjis = enrichKanji(item.word)
          const rawLvl = item.level?.[0] ? String(item.level[0]).replace(/^N+/, '') : null

          return {
            id: idx + 1000000,
            word: item.word,
            reading: item.phonetic || item.word,
            romaji: null,
            hanViet: item.han || null,
            jlpt: rawLvl ? `N${rawLvl}` : null,
            partOfSpeech: item.means?.[0]?.kind || 'Danh từ chung',
            meanings: dedupMeanings(allMeans).slice(0, 5),
            kanjis,
            relatedWords: getRelatedWords(item.word),
            examples: examples.slice(0, 4),
          }
        })

        // Save to cache
        if (stmtSetCachedWord) {
          try {
            stmtSetCachedWord.run(raw, JSON.stringify(enrichedResults), Date.now())
          } catch {}
        }

        return enrichedResults
      }

      // ── Priority 4: Fallback local SQLite (vnjpdict.db raw) ──
      const hiragana = romajiToHiragana(raw)
      const boundedLimit = Math.min(50, Math.max(1, limit))
      const seen = new Set()
      const results = []

      // 1. Exact match
      const exactRows = stmtExact.all(raw, raw, hiragana, hiragana, raw, raw, boundedLimit)
      for (const row of exactRows) {
        if (!seen.has(row.id)) {
          seen.add(row.id)
          const formatted = formatWord(row, true)
          if (formatted) {
            formatted.meanings = dedupMeanings(formatted.meanings)
            results.push(formatted)
          }
        }
      }

      // 2. Prefix match
      if (results.length < boundedLimit) {
        const prefixRows = stmtPrefix.all(
          `${raw}%`,
          `${raw}%`,
          `${hiragana}%`,
          `${hiragana}%`,
          boundedLimit - results.length
        )
        for (const row of prefixRows) {
          if (!seen.has(row.id)) {
            seen.add(row.id)
            const formatted = formatWord(row, true)
            if (formatted) {
              formatted.meanings = dedupMeanings(formatted.meanings)
              results.push(formatted)
            }
          }
        }
      }

      // 3. Meaning match
      if (results.length < boundedLimit && !extractKanjis(raw).length) {
        const meaningRows = stmtMeaning.all(`%${raw}%`, boundedLimit - results.length)
        for (const row of meaningRows) {
          if (!seen.has(row.id)) {
            seen.add(row.id)
            const formatted = formatWord(row, true)
            if (formatted) {
              formatted.meanings = dedupMeanings(formatted.meanings)
              results.push(formatted)
            }
          }
        }
      }

      if (jlpt) {
        return results.filter((item) => item.jlpt === jlpt)
      }

      return results
    },

    async getWordDetail(wordText) {
      const res = await this.search(wordText, { limit: 1 })
      return res[0] || null
    },

    getKanjiDetail(char) {
      const c = String(char ?? '')
        .trim()
        .charAt(0)
      if (!c) return null
      if (COMMON_KANJI_MEANINGS[c]) {
        const k = COMMON_KANJI_MEANINGS[c]
        const base = kanjiMap.get(c) || {}
        return {
          character: c,
          hanViet: k.hanViet,
          onyomi: base.onyomi || null,
          kunyomi: base.kunyomi || null,
          jlpt: base.jlpt || null,
          strokeCount: base.strokeCount || null,
          meaning: k.meaning,
        }
      }
      if (kanjiMap.has(c)) return kanjiMap.get(c)
      const row = stmtKanji.get(c)
      if (!row) return null
      const { hanViet, onyomi } = cleanOnyomiAndHanViet(row.onyomi, row.han_viet)
      return {
        character: row.character,
        hanViet: COMMON_KANJI_MEANINGS[c]?.hanViet || hanViet || row.han_viet,
        onyomi: onyomi || null,
        kunyomi: row.kunyomi,
        jlpt: row.jlpt_level,
        strokeCount: row.stroke_count,
        radical: row.radical,
        meaning: cleanKanjiMeaning(row.meaning, c),
      }
    },

    async enrichSegments(segments) {
      if (!Array.isArray(segments) || segments.length === 0) return segments
      const segmenter =
        typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
          ? new Intl.Segmenter('ja', { granularity: 'word' })
          : null

      const DEPENDENT_PARTICLES = new Set([
        'は',
        'が',
        'を',
        'に',
        'で',
        'と',
        'も',
        'へ',
        'から',
        'まで',
        'より',
        'や',
        'か',
        'ね',
        'よ',
        'な',
        'の',
        'ば',
        'けど',
        'のに',
        'ので',
        'て',
        'た',
        'だ',
        'です',
        'ます',
        'ない',
        'たい',
        'らしい',
        'よう',
        'そう',
        'れる',
        'られる',
        'せる',
        'させる',
        'ぬ',
        'ず',
        'べき',
        'さん',
        'くん',
        'ちゃん',
        'たち',
        '的',
        '化',
      ])

      for (const segment of segments) {
        if (!segment?.textJa) continue

        // 1. Generate furigana & tokens if not present
        if (!segment.textFurigana) {
          const text = segment.textJa.trim()
          const words = segmenter ? Array.from(segmenter.segment(text)).map((s) => s.segment) : [text]
          const htmlParts = []
          const enrichedTokens = []
          for (const word of words) {
            if (/[\u4e00-\u9faf]/u.test(word)) {
              const rawReading = resolveFuriganaReading(word, stmtMasterExact, stmtExact)
              enrichedTokens.push({ surface: word, reading: rawReading })
              if (rawReading) {
                htmlParts.push(`<ruby>${word}<rt>${rawReading}</rt></ruby>`)
              } else {
                htmlParts.push(word)
              }
            } else {
              enrichedTokens.push({ surface: word, reading: null })
              htmlParts.push(word)
            }
          }
          segment.textFurigana = htmlParts.join('')
          if (!segment.tokens || segment.tokens.length === 0) {
            segment.tokens = enrichedTokens
          }
        }

        // 2. Generate Bunsetsu Chunks & Romaji
        try {
          const text = segment.textJa.trim()
          const words =
            segment.tokens && segment.tokens.length > 0
              ? segment.tokens
              : segmenter
                ? Array.from(segmenter.segment(text)).map((s) => ({ surface: s.segment, reading: s.segment }))
                : [{ surface: text, reading: text }]

          const groups = []
          let currentGroup = []
          for (const w of words) {
            const surface = (w.surface || '').trim()
            if (!surface) continue
            const isParticle =
              DEPENDENT_PARTICLES.has(surface) || /^[はがをにへとでもからまでよりやかねよなどのてただ]$/u.test(surface)

            if (currentGroup.length === 0) {
              currentGroup.push(w)
            } else if (isParticle) {
              currentGroup.push(w)
            } else {
              groups.push(currentGroup)
              currentGroup = [w]
            }
          }
          if (currentGroup.length > 0) groups.push(currentGroup)

          const segDuration = Math.max(100, (segment.endMs || 1000) - (segment.startMs || 0))
          const totalChars = words.reduce((sum, u) => sum + (u.surface?.length || 0), 0) || 1
          let cumulativeChars = 0

          segment.chunks = groups.map((grp, idx) => {
            const chunkText = grp.map((u) => u.surface).join('')
            const chunkReading = grp.map((u) => u.reading || u.surface).join('')
            const romaji = kanaToRomaji(chunkReading)

            const tokensWithStart = grp.filter((u) => typeof u.startMs === 'number' && u.startMs > 0)
            const tokensWithEnd = grp.filter((u) => typeof u.endMs === 'number' && u.endMs > 0)

            let startMs = segment.startMs || 0
            let endMs = segment.endMs || startMs + 1000

            if (tokensWithStart.length > 0 && tokensWithEnd.length > 0) {
              startMs = Math.max(segment.startMs || 0, tokensWithStart[0].startMs)
              endMs = Math.min(segment.endMs || startMs + 1000, tokensWithEnd[tokensWithEnd.length - 1].endMs)
            } else {
              const grpChars = chunkText.length
              const startProg = cumulativeChars / totalChars
              const endProg = (cumulativeChars + grpChars) / totalChars
              startMs = Math.round((segment.startMs || 0) + segDuration * startProg)
              endMs = Math.round((segment.startMs || 0) + segDuration * endProg)
              cumulativeChars += grpChars
            }

            return {
              id: `${segment.id || 'seg'}_chunk_${idx}`,
              sequenceNo: idx + 1,
              text: chunkText,
              reading: chunkReading,
              romaji,
              startMs,
              endMs: Math.max(startMs + 100, endMs),
            }
          })

          segment.textRomaji = segment.chunks.map((c) => c.romaji).join(' ')
        } catch {
          // Gracefully continue
        }

        // 3. Translate to Vietnamese if missing
        if (!segment.textVi) {
          try {
            const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=ja&tl=vi&dt=t&q=${encodeURIComponent(segment.textJa)}`
            const res = await fetch(url, { signal: AbortSignal.timeout(4000) })
            if (res.ok) {
              const data = await res.json()
              segment.textVi = data[0]?.map((item) => item[0]).join('') || null
            }
          } catch {
            // Keep going gracefully without failing transcription
          }
        }
      }
      return segments
    },
  }
}
