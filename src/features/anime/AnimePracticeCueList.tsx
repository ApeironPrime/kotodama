import React from 'react'
import { Play } from 'lucide-react'
import type { AnimeSubtitleCue } from './animePlaybackTypes'

interface Props {
  cues: AnimeSubtitleCue[]
  selectedCueId: number | null
  mode: 'pronunciation' | 'listening' | 'exercise'
  totalCues: number
  completedCueIds: Set<number>
  onChooseCue: (cue: AnimeSubtitleCue) => void
}

export const AnimePracticeCueList: React.FC<Props> = React.memo(({ cues, selectedCueId, mode, totalCues, completedCueIds, onChooseCue }) => {
  const currentIndex = Math.max(0, cues.findIndex((cue) => cue.cue_id === selectedCueId))
  return <section className="anime-practice-cue-list" aria-label="Danh sách câu luyện tập">
    <div className="anime-practice-cue-list__progress"><strong>Đã hoàn thành {completedCueIds.size}/{totalCues || cues.length}</strong><span>{Math.round(completedCueIds.size / (totalCues || cues.length || 1) * 100)}%</span></div>
    <div className="anime-practice-cue-list__bar"><span style={{ width: `${completedCueIds.size / (totalCues || cues.length || 1) * 100}%` }} /></div>
    <div className="anime-practice-cue-list__heading">Danh sách câu <span>{cues.length} câu</span></div>
    <div className="anime-practice-cue-list__items">{cues.map((cue, index) => <button type="button" key={cue.cue_id} className={`${index === currentIndex ? 'is-current' : ''} ${completedCueIds.has(cue.cue_id) ? 'is-complete' : ''}`} onClick={() => onChooseCue(cue)}>
      <span className="anime-practice-cue-list__index">{index + 1}</span>
      <span className="anime-practice-cue-list__text"><span lang="ja">{mode === 'pronunciation' ? cue.ja : cue.ja?.replace(/\S/g, '＊')}</span><small lang="vi">{cue.vi || 'Chưa có bản dịch'}</small></span>
      <Play size={17} aria-hidden="true" />
    </button>)}</div>
  </section>
})
