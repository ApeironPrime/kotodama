/**
 * Kanji Decomposition & Radical Network System
 * Maps complex Kanji to their structural components and semantic radicals.
 */

export interface DeconstructedPart {
  glyph: string
  name: string
  meaning: string
  role: 'radical' | 'component' | 'phonetic'
  offsetX: number // relative displacement when exploded
  offsetY: number
}

export interface DeconstructionInfo {
  kanji: string
  hanzi: string
  meaning: string
  story: string
  parts: DeconstructedPart[]
}

// Curated architectural decompositions for quintessential Kanji
export const CURATED_DECONSTRUCTIONS: Record<string, DeconstructionInfo> = {
  休: {
    kanji: '休',
    hanzi: 'HƯU',
    meaning: 'Nghỉ ngơi',
    story: 'Người (亻) tựa lưng vào gốc cây (木) để nghỉ ngơi.',
    parts: [
      { glyph: '亻', name: 'Nhân đứng', meaning: 'Người (người đứng)', role: 'radical', offsetX: -80, offsetY: 0 },
      { glyph: '木', name: 'Mộc', meaning: 'Cây cối', role: 'component', offsetX: 80, offsetY: 0 },
    ],
  },
  明: {
    kanji: '明',
    hanzi: 'MINH',
    meaning: 'Sáng sủa, thông thái',
    story: 'Mặt trời (日) kết hợp với mặt trăng (月) tạo nên ánh sáng rực rỡ.',
    parts: [
      { glyph: '日', name: 'Nhật', meaning: 'Mặt trời, ban ngày', role: 'radical', offsetX: -80, offsetY: 0 },
      { glyph: '月', name: 'Nguyệt', meaning: 'Mặt trăng, ban đêm', role: 'component', offsetX: 80, offsetY: 0 },
    ],
  },
  国: {
    kanji: '国',
    hanzi: 'QUỐC',
    meaning: 'Đất nước, quốc gia',
    story: 'Viên ngọc quý (玉) được bảo vệ an toàn trong 4 bức tường thành bao quanh (囗).',
    parts: [
      { glyph: '囗', name: 'Vi', meaning: 'Tường thành, ranh giới bao quanh', role: 'radical', offsetX: 0, offsetY: -85 },
      { glyph: '玉', name: 'Ngọc', meaning: 'Viên ngọc báu, châu báu', role: 'component', offsetX: 0, offsetY: 75 },
    ],
  },
  森: {
    kanji: '森',
    hanzi: 'SÂM',
    meaning: 'Rừng rậm rạp',
    story: 'Ba cây (木) tụ lại thành rừng rậm mênh mông.',
    parts: [
      { glyph: '木', name: 'Mộc (trên)', meaning: 'Cây vươn cao', role: 'radical', offsetX: 0, offsetY: -85 },
      { glyph: '木', name: 'Mộc (trái)', meaning: 'Cây bên trái', role: 'component', offsetX: -75, offsetY: 70 },
      { glyph: '木', name: 'Mộc (phải)', meaning: 'Cây bên phải', role: 'component', offsetX: 75, offsetY: 70 },
    ],
  },
  林: {
    kanji: '林',
    hanzi: 'LÂM',
    meaning: 'Rừng thưa',
    story: 'Hai cây (木) mọc cạnh nhau thành rừng cây.',
    parts: [
      { glyph: '木', name: 'Mộc', meaning: 'Cây thứ nhất', role: 'radical', offsetX: -75, offsetY: 0 },
      { glyph: '木', name: 'Mộc', meaning: 'Cây thứ hai', role: 'component', offsetX: 75, offsetY: 0 },
    ],
  },
  男: {
    kanji: '男',
    hanzi: 'NAM',
    meaning: 'Nam giới, đàn ông',
    story: 'Người dùng sức lực (力) cày bừa trên đồng ruộng (田) là người đàn ông.',
    parts: [
      { glyph: '田', name: 'Điền', meaning: 'Đồng ruộng', role: 'radical', offsetX: 0, offsetY: -80 },
      { glyph: '力', name: 'Lực', meaning: 'Sức mạnh, cơ bắp', role: 'component', offsetX: 0, offsetY: 80 },
    ],
  },
  間: {
    kanji: '間',
    hanzi: 'GIAN',
    meaning: 'Khoảng cách, thời gian',
    story: 'Ánh mặt trời (日) len qua khe hở của hai cánh cổng (門).',
    parts: [
      { glyph: '門', name: 'Môn', meaning: 'Cánh cổng lớn', role: 'radical', offsetX: 0, offsetY: -85 },
      { glyph: '日', name: 'Nhật', meaning: 'Ánh nắng mặt trời', role: 'component', offsetX: 0, offsetY: 75 },
    ],
  },
  聞: {
    kanji: '聞',
    hanzi: 'VĂN',
    meaning: 'Nghe, hỏi thăm',
    story: 'Áp tai (耳) vào cánh cổng (門) để lắng nghe tiếng vọng.',
    parts: [
      { glyph: '門', name: 'Môn', meaning: 'Cánh cổng', role: 'radical', offsetX: 0, offsetY: -85 },
      { glyph: '耳', name: 'Nhĩ', meaning: 'Cái tai', role: 'component', offsetX: 0, offsetY: 75 },
    ],
  },
  語: {
    kanji: '語',
    hanzi: 'NGỮ',
    meaning: 'Ngôn ngữ, lời nói',
    story: 'Lời nói (言) của năm (五) cái miệng (口) cùng trò chuyện.',
    parts: [
      { glyph: '言', name: 'Ngôn', meaning: 'Lời nói, tiếng nói', role: 'radical', offsetX: -85, offsetY: 0 },
      { glyph: '吾', name: 'Ngô (五+口)', meaning: 'Bản thân, năm cái miệng', role: 'component', offsetX: 80, offsetY: 0 },
    ],
  },
  話: {
    kanji: '話',
    hanzi: 'THOẠI',
    meaning: 'Trò chuyện, đối thoại',
    story: 'Lời nói (言) phát ra từ đầu lưỡi (舌).',
    parts: [
      { glyph: '言', name: 'Ngôn', meaning: 'Lời nói', role: 'radical', offsetX: -80, offsetY: 0 },
      { glyph: '舌', name: 'Thiệt', meaning: 'Chiếc lưỡi', role: 'component', offsetX: 80, offsetY: 0 },
    ],
  },
  時: {
    kanji: '時',
    hanzi: 'THỜI',
    meaning: 'Thời gian, giờ giấc',
    story: 'Mặt trời (日) chiếu bóng xuống ngôi chùa (寺) để đo thời gian.',
    parts: [
      { glyph: '日', name: 'Nhật', meaning: 'Mặt trời', role: 'radical', offsetX: -80, offsetY: 0 },
      { glyph: '寺', name: 'Tự', meaning: 'Ngôi chùa cổ', role: 'component', offsetX: 80, offsetY: 0 },
    ],
  },
  安: {
    kanji: '安',
    hanzi: 'AN',
    meaning: 'An toàn, yên tĩnh, rẻ',
    story: 'Người phụ nữ (女) ở yên ấm dưới mái nhà (宀) thì lòng được bình an.',
    parts: [
      { glyph: '宀', name: 'Miên', meaning: 'Mái nhà che chở', role: 'radical', offsetX: 0, offsetY: -75 },
      { glyph: '女', name: 'Nữ', meaning: 'Người phụ nữ', role: 'component', offsetX: 0, offsetY: 75 },
    ],
  },
  好: {
    kanji: '好',
    hanzi: 'HẢO',
    meaning: 'Thích, tốt đẹp',
    story: 'Người phụ nữ (女) ôm đứa con (子) trong tay là cảnh tượng đẹp đẽ.',
    parts: [
      { glyph: '女', name: 'Nữ', meaning: 'Người mẹ, phụ nữ', role: 'radical', offsetX: -80, offsetY: 0 },
      { glyph: '子', name: 'Tử', meaning: 'Đứa con thơ', role: 'component', offsetX: 80, offsetY: 0 },
    ],
  },
  電: {
    kanji: '電',
    hanzi: 'ĐIỆN',
    meaning: 'Điện lực, tia chớp',
    story: 'Trong cơn mưa (雨), tia chớp uốn lượn lóe sáng xuống cánh đồng (申/电).',
    parts: [
      { glyph: '雨', name: 'Vũ', meaning: 'Cơn mưa từ trời', role: 'radical', offsetX: 0, offsetY: -80 },
      { glyph: '电', name: 'Điện', meaning: 'Tia chớp uốn cong', role: 'component', offsetX: 0, offsetY: 80 },
    ],
  },
  雨: {
    kanji: '雨',
    hanzi: 'VŨ',
    meaning: 'Cơn mưa',
    story: 'Mây trời (一/冂) buông những giọt nước mưa (:::) rơi xuống trần gian.',
    parts: [
      { glyph: '一', name: 'Nhất', meaning: 'Bầu trời cao', role: 'component', offsetX: 0, offsetY: -85 },
      { glyph: '冂', name: 'Quynh', meaning: 'Vòm mây bao phủ', role: 'radical', offsetX: 0, offsetY: -35 },
      { glyph: '::: ', name: 'Thủy giọt', meaning: 'Những hạt mưa rơi', role: 'component', offsetX: 0, offsetY: 65 },
    ],
  },
  桜: {
    kanji: '桜',
    hanzi: 'ANH',
    meaning: 'Hoa anh đào',
    story: 'Cây (木) nở hoa rực rỡ như vương miện (ツ) trên tóc người thiếu nữ (女).',
    parts: [
      { glyph: '木', name: 'Mộc', meaning: 'Thân cây anh đào', role: 'radical', offsetX: -80, offsetY: 0 },
      { glyph: 'ツ', name: 'Đầu hoa', meaning: 'Những cánh hoa nở rộ', role: 'component', offsetX: 75, offsetY: -60 },
      { glyph: '女', name: 'Nữ', meaning: 'Nàng thiếu nữ', role: 'component', offsetX: 75, offsetY: 60 },
    ],
  },
}

import {
  translateRadicalMeaning,
  toCanonicalRadicalGlyph,
  getRadicalVietnameseName,
} from './kanjiRadicalDictionary'

/**
 * Returns deconstruction data for any Kanji. If not in curated list,
 * generates a graceful radical decomposition from its metadata.
 */
export function getKanjiDeconstruction(
  kanji: string,
  summary?: { hanzi?: string; meaning_vi?: string; radical_utf?: string; radical_meaning?: string; story?: string }
): DeconstructionInfo {
  const curated = CURATED_DECONSTRUCTIONS[kanji]
  if (curated) {
    return curated
  }

  const hanzi = summary?.hanzi || 'HÁN TỰ'
  const meaning = summary?.meaning_vi || 'Ý nghĩa Hán tự'
  const rawRad = summary?.radical_utf || '一'
  const rad = toCanonicalRadicalGlyph(rawRad)
  const radName = getRadicalVietnameseName(rad)
  const radMeaning = translateRadicalMeaning(summary?.radical_meaning, rad)
  const story = summary?.story || `Chữ ${kanji} cấu thành từ bộ ${radName} (${rad}) biểu ý ${radMeaning.toLowerCase()}.`

  return {
    kanji,
    hanzi,
    meaning,
    story,
    parts: [
      {
        glyph: rad,
        name: `Bộ thủ ${radName} (${rad})`,
        meaning: radMeaning,
        role: 'radical',
        offsetX: -75,
        offsetY: 0,
      },
      {
        glyph: kanji,
        name: 'Thân chữ',
        meaning: `${hanzi} - ${meaning}`,
        role: 'component',
        offsetX: 75,
        offsetY: 0,
      },
    ],
  }
}

/**
 * Elemental micro-physics categorization for semantic particle reactions
 */
export type SemanticElement = 'rain' | 'fire' | 'wind' | 'wood' | 'celestial' | 'heart' | 'earth' | 'water' | 'none'

export function getSemanticElement(kanji: string): SemanticElement {
  if (['雨', '雪', '雲', '雷', '電', '霜', '霧'].includes(kanji)) return 'rain'
  if (['水', '川', '海', '泳', '洗', '波', '洋', '江', '池', '湖', '流'].includes(kanji)) return 'water'
  if (['火', '炎', '炭', '焼', '灯', '煙', '熱', '照', '燃'].includes(kanji)) return 'fire'
  if (['風', '気', '嵐', '飛', '羽', '翼', '吹'].includes(kanji)) return 'wind'
  if (['木', '林', '森', '花', '草', '竹', '本', '枝', '葉', '松', '植', '桜'].includes(kanji)) return 'wood'
  if (['日', '月', '星', '光', '明', '晴', '朝', '夕', '夜'].includes(kanji)) return 'celestial'
  if (['心', '愛', '思', '感', '情', '志', '想', '態', '忘'].includes(kanji)) return 'heart'
  if (['土', '石', '岩', '山', '地', '田', '畑'].includes(kanji)) return 'earth'
  return 'none'
}
