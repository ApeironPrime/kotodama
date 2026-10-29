import { describe, it, expect } from 'vitest'
import {
  getKanjiRelationship,
  getMeaningfulLinksForKanji,
} from './kanjiRelationships'

describe('kanjiRelationships - Etymological & Pedagogical Linking', () => {
  describe('1. Constituent Genealogy (Chiết tự / Hội ý / Cha - Con)', () => {
    it('links 木 to 休 with clear constituent role', () => {
      const rel = getKanjiRelationship('木', '休')
      expect(rel).not.toBeNull()
      expect(rel?.relationType).toBe('constituent')
      expect(rel?.badgeLabel).toContain('Người tựa cây nghỉ')
    })

    it('links 休 back to 人 with constituent role', () => {
      const rel = getKanjiRelationship('休', '人')
      expect(rel).not.toBeNull()
      expect(rel?.relationType).toBe('constituent')
      expect(rel?.badgeLabel).toContain('Gốc Nhân')
    })

    it('links 日 to 明 with constituent role', () => {
      const rel = getKanjiRelationship('日', '明')
      expect(rel).not.toBeNull()
      expect(rel?.relationType).toBe('constituent')
      expect(rel?.badgeLabel).toContain('Nhật + Nguyệt')
    })

    it('links 門 to 間 and 聞', () => {
      const rel1 = getKanjiRelationship('門', '間')
      expect(rel1?.badgeLabel).toContain('Nắng lọt qua khe cổng')

      const rel2 = getKanjiRelationship('門', '聞')
      expect(rel2?.badgeLabel).toContain('Áp tai nghe qua cổng')
    })
  })

  describe('2. Antonym Pairs (Cặp đối nghĩa triết học)', () => {
    it('links 上 and 下 with Antonym label', () => {
      const rel1 = getKanjiRelationship('上', '下')
      expect(rel1?.relationType).toBe('antonym')
      expect(rel1?.badgeLabel).toBe('Đối nghĩa: Trên ⟷ Dưới')

      const rel2 = getKanjiRelationship('下', '上')
      expect(rel2?.relationType).toBe('antonym')
      expect(rel2?.badgeLabel).toBe('Đối nghĩa: Dưới ⟷ Trên')
    })

    it('links 左 and 右 with Antonym label', () => {
      const rel = getKanjiRelationship('左', '右')
      expect(rel?.relationType).toBe('antonym')
      expect(rel?.badgeLabel).toBe('Đối nghĩa: Trái ⟷ Phải')
    })

    it('links 明 and 暗 with Antonym label', () => {
      const rel = getKanjiRelationship('明', '暗')
      expect(rel?.relationType).toBe('antonym')
      expect(rel?.badgeLabel).toBe('Đối nghĩa: Sáng ⟷ Tối')
    })
  })

  describe('3. Phonetic Families (Đồng âm Onyomi)', () => {
    it('links 寺 and 時 with shared Onyomi JI', () => {
      const rel = getKanjiRelationship('寺', '時')
      expect(rel?.relationType).toBe('phonetic_family')
      expect(rel?.badgeLabel).toBe('Đồng âm: JI (ジ)')
    })

    it('links 青 and 晴 with shared Onyomi SEI', () => {
      const rel = getKanjiRelationship('青', '晴')
      expect(rel?.relationType).toBe('phonetic_family')
      expect(rel?.badgeLabel).toBe('Đồng âm: SEI (セイ)')
    })
  })

  describe('4. Semantic Radical Clusters (Chỉ liên kết bộ thủ thực sự biểu ý)', () => {
    it('links 水 and 海 with Thủy label', () => {
      const rel = getKanjiRelationship('水', '海')
      expect(rel?.relationType).toBe('semantic_core')
      expect(rel?.badgeLabel).toContain('họ Thủy: Nước')
    })

    it('does NOT link random kanji having accidental radical overlap without semantic connection', () => {
      // e.g. 七 and 万 are both Kangxi radical 一, but must NOT be linked
      const rel = getKanjiRelationship('七', '万')
      expect(rel).toBeNull()
    })
  })

  describe('getMeaningfulLinksForKanji', () => {
    it('finds and sorts top meaningful links by academic priority', () => {
      const candidates = [
        { kanji: '木', index: 0 },
        { kanji: '人', index: 1 },
        { kanji: '七', index: 2 }, // unrelated
        { kanji: '万', index: 3 }, // unrelated
      ]
      const links = getMeaningfulLinksForKanji('休', candidates)
      expect(links.length).toBe(2)
      expect(links[0]?.link.targetKanji).toBe('木')
      expect(links[1]?.link.targetKanji).toBe('人')
    })
  })
})
