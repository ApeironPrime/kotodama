import { useQuery } from '@tanstack/react-query'
import { Loader2, Volume2, X } from 'lucide-react'
import { apiPaths, requestApi, type DictionarySearchResult } from '../../lib/apiClient'
import { IconButton } from '../../components/ui'

function speakJapanese(text: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'ja-JP'
  utterance.rate = 0.9
  window.speechSynthesis.speak(utterance)
}

export function DictionaryLookupModal({ keyword, onClose }: { keyword: string; onClose: () => void }) {
  const { data, isLoading, isError } = useQuery<DictionarySearchResult>({
    queryKey: ['dictionary-search', keyword],
    queryFn: () =>
      requestApi<DictionarySearchResult>({
        url: apiPaths.dictionary.search(keyword, 3), // Limit 3 to be fast and compact
      }),
    enabled: Boolean(keyword),
    staleTime: 1000 * 60 * 10,
  })

  const results = data?.results ?? []
  const word = results[0]

  return (
    <div className="ui-modal-backdrop" role="presentation" onMouseDown={onClose} style={{ zIndex: 10000 }}>
      <section
        className="ui-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Từ điển"
        onMouseDown={(event) => event.stopPropagation()}
        style={{ maxWidth: '500px', width: '90vw' }}
      >
        <header className="ui-modal__header">
          <h2 style={{ fontSize: '1rem', color: 'var(--color-text-muted)' }}>TRA CỨU TỪ ĐIỂN</h2>
          <IconButton label="Đóng" onClick={onClose}>
            <X size={20} />
          </IconButton>
        </header>

        <div style={{ padding: '1.25rem', paddingTop: '0.5rem', maxHeight: '70vh', overflowY: 'auto' }}>
          {isLoading ? (
            <div
              style={{ display: 'flex', justifyContent: 'center', padding: '2rem 0', color: 'var(--color-text-muted)' }}
            >
              <Loader2 className="animate-spin" />
            </div>
          ) : isError || !word ? (
            <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--color-text-muted)' }}>
              Không tìm thấy kết quả cho từ này.
            </div>
          ) : (
            <div>
              {/* Header: Word & Reading */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  marginBottom: '1rem',
                }}
              >
                <div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                    {word.reading}
                  </div>
                  <div style={{ fontSize: '2.5rem', fontWeight: 900, lineHeight: 1.2, color: '#e11d48' }}>
                    {word.word}
                  </div>
                  {word.hanViet && (
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: '#2563eb', marginTop: '0.25rem' }}>
                      {word.hanViet}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => speakJapanese(word.word)}
                  style={{
                    background: 'rgba(225, 29, 72, 0.1)',
                    border: 'none',
                    color: '#e11d48',
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <Volume2 size={20} />
                </button>
              </div>

              {/* Meanings */}
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '8px',
                  padding: '1rem',
                }}
              >
                <span
                  style={{
                    background: 'rgba(37, 99, 235, 0.15)',
                    color: '#3b82f6',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    display: 'inline-block',
                    marginBottom: '0.75rem',
                  }}
                >
                  {word.partOfSpeech || 'Danh từ chung'}
                </span>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {word.meanings.map((m, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                      <span style={{ color: '#dc2626', fontSize: '1rem', fontWeight: 900, lineHeight: 1.2 }}>➤</span>
                      <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-text)' }}>{m}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Kanji Breakdown */}
              {word.kanjis && word.kanjis.length > 0 && (
                <div style={{ marginTop: '1rem' }}>
                  <div
                    style={{
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      color: 'var(--color-text-muted)',
                      marginBottom: '0.5rem',
                      textTransform: 'uppercase',
                    }}
                  >
                    Phân tích Hán tự
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {word.kanjis.map((k, idx) => (
                      <div
                        key={idx}
                        style={{
                          background: 'rgba(0,0,0,0.1)',
                          padding: '0.5rem',
                          borderRadius: '6px',
                          border: '1px solid var(--color-border)',
                        }}
                      >
                        <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#2563eb' }}>{k.character}</div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>{k.hanViet}</div>
                        <div
                          style={{
                            fontSize: '0.75rem',
                            color: 'var(--color-text-secondary)',
                            maxWidth: '120px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={k.meaning || undefined}
                        >
                          {k.meaning}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
