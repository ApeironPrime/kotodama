/**
 * Academic & Etymological Kanji Relationship Engine (Hệ Thống Phả Hệ & Liên Kết Hán Tự Chuẩn Mực)
 * 
 * Strict philological & pedagogical rules based on East Asian Hanzi etymology (Lục Thư 六書):
 * 1. Constituent Genealogy (Chiết tự / Hội ý / Cấu thành trực tiếp: Cha - Con)
 * 2. Phonetic Family (Hình thanh đồng thanh bàng: Cùng âm Onyomi)
 * 3. Semantic Antonym (Cặp đối nghĩa triết học nhị nguyên: Trên - Dưới, Sáng - Tối)
 * 4. Semantic Radical Core (Họ bộ thủ mang ý nghĩa cốt lõi sống động: Thủy, Ngôn, Tâm, Thủ, v.v.)
 */

export type KanjiRelationType =
  | 'constituent'     // Chiết tự / Hội ý (Gốc tạo chữ)
  | 'phonetic_family' // Dòng họ thanh bàng (Cùng âm đọc Onyomi)
  | 'antonym'         // Cặp đối nghĩa triết học
  | 'semantic_core'   // Bộ thủ biểu ý cốt lõi thực thụ

export interface KanjiLinkResult {
  targetKanji: string
  relationType: KanjiRelationType
  badgeLabel: string
  color: string
  priority: number // 1 (highest) to 4
}

// ─── 1. ANTONYM PAIRS (Cặp đối nghĩa triết học) ──────────────────────────
const ANTONYM_MAP: Record<string, { partner: string; label: string }> = {
  上: { partner: '下', label: 'Trên ⟷ Dưới' },
  下: { partner: '上', label: 'Dưới ⟷ Trên' },
  左: { partner: '右', label: 'Trái ⟷ Phải' },
  右: { partner: '左', label: 'Phải ⟷ Trái' },
  大: { partner: '小', label: 'Lớn ⟷ Nhỏ' },
  小: { partner: '大', label: 'Nhỏ ⟷ Lớn' },
  明: { partner: '暗', label: 'Sáng ⟷ Tối' },
  暗: { partner: '明', label: 'Tối ⟷ Sáng' },
  前: { partner: '後', label: 'Trước ⟷ Sau' },
  後: { partner: '前', label: 'Sau ⟷ Trước' },
  男: { partner: '女', label: 'Nam ⟷ Nữ' },
  女: { partner: '男', label: 'Nữ ⟷ Nam' },
  多: { partner: '少', label: 'Nhiều ⟷ Ít' },
  少: { partner: '多', label: 'Ít ⟷ Nhiều' },
  出: { partner: '入', label: 'Ra ⟷ Vào' },
  入: { partner: '出', label: 'Vào ⟷ Ra' },
  開: { partner: '閉', label: 'Mở ⟷ Đóng' },
  閉: { partner: '開', label: 'Đóng ⟷ Mở' },
  天: { partner: '地', label: 'Trời ⟷ Đất' },
  地: { partner: '天', label: 'Đất ⟷ Trời' },
  長: { partner: '短', label: 'Dài ⟷ Ngắn' },
  短: { partner: '長', label: 'Ngắn ⟷ Dài' },
  高: { partner: '低', label: 'Cao ⟷ Thấp' },
  低: { partner: '高', label: 'Thấp ⟷ Cao' },
  始: { partner: '終', label: 'Khởi ⟷ Chung' },
  終: { partner: '始', label: 'Chung ⟷ Khởi' },
  買: { partner: '売', label: 'Mua ⟷ Bán' },
  売: { partner: '買', label: 'Bán ⟷ Mua' },
  強: { partner: '弱', label: 'Mạnh ⟷ Yếu' },
  弱: { partner: '強', label: 'Yếu ⟷ Mạnh' },
  新: { partner: '古', label: 'Mới ⟷ Cũ' },
  古: { partner: '新', label: 'Cũ ⟷ Mới' },
  生: { partner: '死', label: 'Sinh ⟷ Tử' },
  死: { partner: '生', label: 'Tử ⟷ Sinh' },
  内: { partner: '外', label: 'Trong ⟷ Ngoài' },
  外: { partner: '内', label: 'Ngoài ⟷ Trong' },
  寒: { partner: '暑', label: 'Lạnh ⟷ Nóng' },
  暑: { partner: '寒', label: 'Nóng ⟷ Lạnh' },
  有: { partner: '無', label: 'Có ⟷ Không' },
  無: { partner: '有', label: 'Không ⟷ Có' },
  勝: { partner: '負', label: 'Thắng ⟷ Thua' },
  負: { partner: '勝', label: 'Thua ⟷ Thắng' },
}

// ─── 2. PHONETIC FAMILIES (Dòng họ thanh bàng cùng âm Onyomi) ────────────
interface PhoneticFamily {
  soundOnyomi: string
  members: string[]
}

const PHONETIC_FAMILIES: PhoneticFamily[] = [
  { soundOnyomi: 'SEI (セイ)', members: ['青', '清', '晴', '静', '精', '情'] },
  { soundOnyomi: 'JI (ジ)', members: ['寺', '時', '持', '待', '詩'] },
  { soundOnyomi: 'SEI (セイ)', members: ['生', '性', '姓', '星'] },
  { soundOnyomi: 'DOU (ドウ)', members: ['同', '洞', '胴', '銅'] },
  { soundOnyomi: 'HOU (ホウ)', members: ['方', '放', '訪', '芳', '房'] },
  { soundOnyomi: 'HOU (ホウ)', members: ['包', '抱', '泡', '胞', '飽'] },
  { soundOnyomi: 'HAN (ハン)', members: ['反', '坂', '版', '板', '飯'] },
  { soundOnyomi: 'KOU (コウ)', members: ['交', '校', '効', '郊'] },
  { soundOnyomi: 'FUN (フン)', members: ['分', '粉', '份', '雰'] },
  { soundOnyomi: 'KO (コ)', members: ['古', '居', '故', '枯', '固', '苦'] },
  { soundOnyomi: 'KA (カ)', members: ['化', '花', '貨', '靴'] },
  { soundOnyomi: 'HAKU (ハク)', members: ['白', '伯', '迫', '拍', '舶', '泊'] },
  { soundOnyomi: 'HEI (ヘイ)', members: ['平', '評', '坪', '秤'] },
  { soundOnyomi: 'MON (モン)', members: ['門', '問', '聞', '悶'] },
  { soundOnyomi: 'CHOU (チョウ)', members: ['丁', '町', '頂', '庁', '訂'] },
  { soundOnyomi: 'KOU (コウ)', members: ['工', '功', '紅', '江', '巧', '項'] },
  { soundOnyomi: 'CHUU (チュウ)', members: ['中', '仲', '沖', '忠'] },
  { soundOnyomi: 'SHU (シュ)', members: ['主', '住', '注', '柱', '駐'] },
  { soundOnyomi: 'SEI (セイ)', members: ['正', '政', '整', '征', '証'] },
  { soundOnyomi: 'BUN (ブン)', members: ['文', '紋', '蚊'] },
  { soundOnyomi: 'RYOU (リョウ)', members: ['良', '朗', '浪', '娘'] },
  { soundOnyomi: 'SEN (セン)', members: ['先', '洗', '銑'] },
  { soundOnyomi: 'KA (カ)', members: ['加', '賀', '架', '嘉'] },
]

// ─── 3. CONSTITUENT GENEALOGY (Chiết tự cha - con & hội ý) ───────────────
interface GenealogyNode {
  kanji: string
  parents: { kanji: string; role: string }[]
  children: { kanji: string; role: string }[]
}

const GENEALOGY_MAP: Record<string, GenealogyNode> = {
  木: {
    kanji: '木',
    parents: [],
    children: [
      { kanji: '林', role: '2 cây thành rừng' },
      { kanji: '森', role: '3 cây thành rừng rậm' },
      { kanji: '休', role: 'Người tựa cây nghỉ' },
      { kanji: '本', role: 'Gốc cây / Nguồn cội' },
      { kanji: '末', role: 'Ngọn cây / Cuối cùng' },
      { kanji: '相', role: 'Mắt nhìn cây' },
      { kanji: '校', role: 'Trường học bằng gỗ' },
      { kanji: '桜', role: 'Cây hoa anh đào' },
    ],
  },
  林: {
    kanji: '林',
    parents: [{ kanji: '木', role: 'Gốc Mộc (Cây)' }],
    children: [{ kanji: '森', role: 'Mở rộng thành rừng rậm' }],
  },
  森: {
    kanji: '森',
    parents: [
      { kanji: '木', role: 'Gốc Mộc (Cây)' },
      { kanji: '林', role: 'Gốc Lâm (Rừng)' },
    ],
    children: [],
  },
  人: {
    kanji: '人',
    parents: [],
    children: [
      { kanji: '休', role: 'Người tựa cây nghỉ' },
      { kanji: '体', role: 'Thân thể (Nhân + Bản)' },
      { kanji: '信', role: 'Lời người đáng tin' },
      { kanji: '化', role: 'Người đứng + ngã biến hóa' },
      { kanji: '仲', role: 'Người ở giữa (bạn bè)' },
      { kanji: '作', role: 'Con người sáng tác' },
      { kanji: '仕', role: 'Người làm việc quan' },
    ],
  },
  休: {
    kanji: '休',
    parents: [
      { kanji: '人', role: 'Gốc Nhân (Người)' },
      { kanji: '木', role: 'Gốc Mộc (Cây)' },
    ],
    children: [],
  },
  日: {
    kanji: '日',
    parents: [],
    children: [
      { kanji: '明', role: 'Nhật + Nguyệt = Tỏa sáng' },
      { kanji: '時', role: 'Mặt trời đo thì giờ' },
      { kanji: '早', role: 'Mặt trời trên ngọn cây (sớm)' },
      { kanji: '間', role: 'Mặt trời rọi qua cổng' },
      { kanji: '晴', role: 'Mặt trời trời quang đãng' },
      { kanji: '星', role: 'Mặt trời sinh vì sao' },
      { kanji: '春', role: 'Mặt trời ấm áp mùa xuân' },
      { kanji: '白', role: 'Tia sáng mặt trời' },
    ],
  },
  月: {
    kanji: '月',
    parents: [],
    children: [
      { kanji: '明', role: 'Nhật + Nguyệt = Tỏa sáng' },
      { kanji: '朝', role: 'Trăng còn sót buổi sớm' },
      { kanji: '期', role: 'Chu kỳ trăng tròn khuyết' },
    ],
  },
  明: {
    kanji: '明',
    parents: [
      { kanji: '日', role: 'Gốc Nhật (Mặt trời)' },
      { kanji: '月', role: 'Gốc Nguyệt (Mặt trăng)' },
    ],
    children: [],
  },
  門: {
    kanji: '門',
    parents: [],
    children: [
      { kanji: '間', role: 'Nắng lọt qua khe cổng' },
      { kanji: '聞', role: 'Áp tai nghe qua cổng' },
      { kanji: '開', role: 'Mở then cổng lớn' },
      { kanji: '閉', role: 'Khép then cổng lại' },
      { kanji: '問', role: 'Miệng hỏi trước cổng' },
    ],
  },
  間: {
    kanji: '間',
    parents: [
      { kanji: '門', role: 'Gốc Môn (Cổng)' },
      { kanji: '日', role: 'Gốc Nhật (Ánh nắng)' },
    ],
    children: [],
  },
  聞: {
    kanji: '聞',
    parents: [
      { kanji: '門', role: 'Gốc Môn (Cổng)' },
      { kanji: '耳', role: 'Gốc Nhĩ (Lỗ tai)' },
    ],
    children: [],
  },
  田: {
    kanji: '田',
    parents: [],
    children: [
      { kanji: '男', role: 'Dùng sức lực trên ruộng' },
      { kanji: '町', role: 'Ruộng chia thành phố phường' },
      { kanji: '思', role: 'Ruộng cày trong tâm trí' },
    ],
  },
  力: {
    kanji: '力',
    parents: [],
    children: [
      { kanji: '男', role: 'Dùng sức lực trên ruộng' },
      { kanji: '動', role: 'Dùng sức làm chuyển động' },
      { kanji: '助', role: 'Bỏ sức giúp đỡ' },
    ],
  },
  男: {
    kanji: '男',
    parents: [
      { kanji: '田', role: 'Gốc Điền (Đồng ruộng)' },
      { kanji: '力', role: 'Gốc Lực (Sức mạnh)' },
    ],
    children: [],
  },
  女: {
    kanji: '女',
    parents: [],
    children: [
      { kanji: '好', role: 'Mẹ yêu con trẻ' },
      { kanji: '安', role: 'Phụ nữ an ổn dưới mái nhà' },
      { kanji: '妻', role: 'Người vợ trong gia đình' },
      { kanji: '妹', role: 'Em gái nhỏ' },
      { kanji: '姉', role: 'Chị gái lớn' },
    ],
  },
  子: {
    kanji: '子',
    parents: [],
    children: [
      { kanji: '好', role: 'Mẹ yêu con trẻ' },
      { kanji: '字', role: 'Con trẻ học chữ dưới mái nhà' },
      { kanji: '学', role: 'Con trẻ học tập' },
    ],
  },
  好: {
    kanji: '好',
    parents: [
      { kanji: '女', role: 'Gốc Nữ (Người phụ nữ)' },
      { kanji: '子', role: 'Gốc Tử (Con trẻ)' },
    ],
    children: [],
  },
  安: {
    kanji: '安',
    parents: [{ kanji: '女', role: 'Gốc Nữ (Phụ nữ an ổn)' }],
    children: [],
  },
  雨: {
    kanji: '雨',
    parents: [],
    children: [
      { kanji: '雪', role: 'Mưa tuyết đọng trắng' },
      { kanji: '雲', role: 'Hơi nước tụ thành mây' },
      { kanji: '電', role: 'Tia chớp giữa cơn mưa' },
      { kanji: '雷', role: 'Sấm sét dội xuống ruộng' },
    ],
  },
  電: {
    kanji: '電',
    parents: [{ kanji: '雨', role: 'Gốc Vũ (Mưa giông)' }],
    children: [],
  },
  雪: {
    kanji: '雪',
    parents: [{ kanji: '雨', role: 'Gốc Vũ (Mưa lạnh)' }],
    children: [],
  },
  言: {
    kanji: '言',
    parents: [],
    children: [
      { kanji: '話', role: 'Lời nói từ đầu lưỡi' },
      { kanji: '語', role: 'Lời ngôn ngữ của ta' },
      { kanji: '読', role: 'Đọc lời văn thành tiếng' },
      { kanji: '信', role: 'Lời người đáng tin cậy' },
      { kanji: '記', role: 'Lời ghi chép lại' },
      { kanji: '詩', role: 'Lời thơ thanh tịnh' },
    ],
  },
  話: {
    kanji: '話',
    parents: [{ kanji: '言', role: 'Gốc Ngôn (Lời nói)' }],
    children: [],
  },
  語: {
    kanji: '語',
    parents: [{ kanji: '言', role: 'Gốc Ngôn (Ngôn từ)' }],
    children: [],
  },
  心: {
    kanji: '心',
    parents: [],
    children: [
      { kanji: '思', role: 'Ruộng cày trong tâm trí' },
      { kanji: '想', role: 'Tâm hướng về cảnh sắc' },
      { kanji: '意', role: 'Tiếng lòng phát ra' },
      { kanji: '感', role: 'Tâm rung động' },
      { kanji: '愛', role: 'Trái tim yêu thương' },
    ],
  },
  思: {
    kanji: '思',
    parents: [
      { kanji: '田', role: 'Gốc Điền (Đồng ruộng)' },
      { kanji: '心', role: 'Gốc Tâm (Tấm lòng)' },
    ],
    children: [],
  },
  山: {
    kanji: '山',
    parents: [],
    children: [{ kanji: '岩', role: 'Đá trên núi thành tảng lớn' }],
  },
  石: {
    kanji: '石',
    parents: [],
    children: [{ kanji: '岩', role: 'Đá trên núi thành tảng lớn' }],
  },
  岩: {
    kanji: '岩',
    parents: [
      { kanji: '山', role: 'Gốc Sơn (Núi non)' },
      { kanji: '石', role: 'Gốc Thạch (Tảng đá)' },
    ],
    children: [],
  },
}

// ─── 4. MEANINGFUL RADICAL CLUSTERS (Chỉ áp dụng các bộ thủ biểu ý thực sự) ─
const SEMANTIC_RADICAL_GROUPS: {
  radicals: string[]
  label: string
  validKanji: string[]
}[] = [
  {
    radicals: ['水', '氵'],
    label: 'Cùng họ Thủy: Nước & Dòng chảy',
    validKanji: ['水', '海', '河', '池', '洗', '泳', '波', '涙', '酒', '江', '洋', '液', '涼'],
  },
  {
    radicals: ['言', '讠'],
    label: 'Cùng họ Ngôn: Lời nói & Ngôn ngữ',
    validKanji: ['言', '話', '語', '読', '記', '詩', '論', '説', '訳', '議', '談', '調'],
  },
  {
    radicals: ['心', '忄'],
    label: 'Cùng họ Tâm: Cảm xúc & Tâm trí',
    validKanji: ['心', '思', '想', '意', '感', '情', '愛', '息', '忘', '忙', '恐', '怒'],
  },
  {
    radicals: ['手', '扌'],
    label: 'Cùng họ Thủ: Bàn tay & Hành động',
    validKanji: ['手', '持', '打', '指', '拾', '推', '投', '押', '払', '技'],
  },
  {
    radicals: ['目'],
    label: 'Cùng họ Mục: Con mắt & Cái nhìn',
    validKanji: ['目', '看', '眼', '視', '眠', '着', '見'],
  },
  {
    radicals: ['足', '𧾷'],
    label: 'Cùng họ Túc: Bước chân & Di chuyển',
    validKanji: ['足', '走', '路', '踏', '踊', '跳'],
  },
  {
    radicals: ['食', '飠'],
    label: 'Cùng họ Thực: Ẩm thực & Nuôi dưỡng',
    validKanji: ['食', '飯', '飲', '館', '飽', '飼', '餓'],
  },
]

/**
 * Find exact, pedagogical, scholarly relationship between sourceKanji and targetKanji.
 * Returns null if they do not have a genuine etymological or semantic link.
 */
export function getKanjiRelationship(
  sourceKanji: string,
  targetKanji: string
): KanjiLinkResult | null {
  if (!sourceKanji || !targetKanji || sourceKanji === targetKanji) return null

  // ─── 1. Check Constituent Genealogy (Priority 1) ───────────────────────
  const geneSource = GENEALOGY_MAP[sourceKanji]
  if (geneSource) {
    // Is target a direct child?
    const child = geneSource.children.find((c) => c.kanji === targetKanji)
    if (child) {
      return {
        targetKanji,
        relationType: 'constituent',
        badgeLabel: child.role,
        color: '#C23A2B', // Chu Sa Red
        priority: 1,
      }
    }
    // Is target a direct parent?
    const parent = geneSource.parents.find((p) => p.kanji === targetKanji)
    if (parent) {
      return {
        targetKanji,
        relationType: 'constituent',
        badgeLabel: parent.role,
        color: '#C23A2B',
        priority: 1,
      }
    }
  }

  // Cross check if target lists source as parent
  const geneTarget = GENEALOGY_MAP[targetKanji]
  if (geneTarget) {
    const parent = geneTarget.parents.find((p) => p.kanji === sourceKanji)
    if (parent) {
      return {
        targetKanji,
        relationType: 'constituent',
        badgeLabel: parent.role,
        color: '#C23A2B',
        priority: 1,
      }
    }
  }

  // ─── 2. Check Semantic Antonyms (Priority 2) ───────────────────────────
  const antonym = ANTONYM_MAP[sourceKanji]
  if (antonym && antonym.partner === targetKanji) {
    return {
      targetKanji,
      relationType: 'antonym',
      badgeLabel: `Đối nghĩa: ${antonym.label}`,
      color: '#4F46E5', // Deep Indigo
      priority: 2,
    }
  }

  // ─── 3. Check Phonetic Families (Priority 3) ───────────────────────────
  for (const fam of PHONETIC_FAMILIES) {
    if (fam.members.includes(sourceKanji) && fam.members.includes(targetKanji)) {
      return {
        targetKanji,
        relationType: 'phonetic_family',
        badgeLabel: `Đồng âm: ${fam.soundOnyomi}`,
        color: '#D97706', // Golden Amber
        priority: 3,
      }
    }
  }

  // ─── 4. Check Meaningful Radical Clusters (Priority 4) ─────────────────
  for (const group of SEMANTIC_RADICAL_GROUPS) {
    if (group.validKanji.includes(sourceKanji) && group.validKanji.includes(targetKanji)) {
      return {
        targetKanji,
        relationType: 'semantic_core',
        badgeLabel: group.label,
        color: '#0284C7', // Oceanic Blue / Ink
        priority: 4,
      }
    }
  }

  return null
}

/**
 * Get all valid, purposeful links for a given source Kanji within a candidate set.
 * Returns up to maxLinks (default 4) sorted by philological priority.
 */
export function getMeaningfulLinksForKanji(
  sourceKanji: string,
  candidates: { kanji: string; index: number }[],
  maxLinks: number = 4
): { index: number; link: KanjiLinkResult }[] {
  const results: { index: number; link: KanjiLinkResult }[] = []

  for (const c of candidates) {
    if (c.kanji === sourceKanji) continue
    const link = getKanjiRelationship(sourceKanji, c.kanji)
    if (link) {
      results.push({ index: c.index, link })
    }
  }

  // Sort by priority (1: Constituent > 2: Antonym > 3: Phonetic > 4: Semantic Radical)
  results.sort((a, b) => a.link.priority - b.link.priority)

  return results.slice(0, maxLinks)
}
