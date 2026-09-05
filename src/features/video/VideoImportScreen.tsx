import { useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, Card } from '../../components/ui'
import { getApiErrorMessage } from '../../lib/apiClient'
import { importYouTubeVideo, listMediaAssets, uploadLocalVideo } from './videoApi'
import type { MediaAsset, UploadProgress } from './videoTypes'
import { ArrowUpFromLine, CheckCircle2, Clock, Film, FolderOpen, Link2, Loader2, Play, Zap } from 'lucide-react'

export default function VideoImportScreen({ onImport }: { onImport: (video: MediaAsset) => void }) {
  const [tab, setTab] = useState<'url' | 'file'>('url')
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState<UploadProgress | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const { data: assetsData, isLoading: isLoadingAssets } = useQuery({
    queryKey: ['video-assets'],
    queryFn: listMediaAssets,
    refetchInterval: (query) => {
      const hasProcessing = query.state.data?.items?.some((i) => i.processingStatus === 'processing')
      return hasProcessing ? 3000 : false
    },
  })

  const importFile = async (file?: File) => {
    if (!file) return
    if (!file.type.startsWith('video/') && !/\.(mp4|webm|mov|ogv)$/i.test(file.name))
      return setError('Vui lòng chọn tệp video MP4, WebM, MOV hoặc OGV.')
    if (file.size > 2 * 1024 ** 3) return setError('Tệp vượt quá giới hạn 2 GB.')
    setError('')
    setProgress({ loaded: 0, total: file.size, percent: 0 })
    setUploading(true)
    try {
      const result = await uploadLocalVideo(file, setProgress)
      onImport(result.asset)
    } catch (uploadError) {
      setError(getApiErrorMessage(uploadError, 'Không thể tải video lên. Vui lòng thử lại.'))
    } finally {
      setUploading(false)
    }
  }
  const importUrl = async () => {
    try {
      const parsed = new URL(url)
      if (!/(^|\.)youtube\.com$|^youtu\.be$/i.test(parsed.hostname))
        return setError('Hiện chỉ hỗ trợ URL YouTube trong chế độ local.')
      setError('')
      setUploading(true)
      const result = await importYouTubeVideo(parsed.toString())
      onImport(result.asset)
    } catch (importError) {
      if (importError instanceof TypeError) setError('Đường dẫn video chưa hợp lệ.')
      else setError(getApiErrorMessage(importError, 'Không thể nhập video YouTube.'))
    } finally {
      setUploading(false)
    }
  }

  const existingItems = assetsData?.items ?? []
  // Deduplicate by title to present unique lessons cleanly
  const uniqueItems = existingItems.filter(
    (item, index, self) =>
      index === self.findIndex((t) => t.title === item.title && t.processingStatus === item.processingStatus)
  )

  return (
    <section
      className="video-import-screen video-import-screen--showcase"
      style={{ maxWidth: '980px', margin: '0 auto' }}
    >
      <div className="video-import-orb video-import-orb--rose" />
      <div className="video-import-orb video-import-orb--violet" />
      <header className="video-import-showcase__header">
        <p className="video-import-showcase__badge">
          <Zap aria-hidden="true" size={15} /> NHẬP VIDEO AI & SHADOWING
        </p>
        <h1>
          Nhập video để bắt đầu
          <br />
          học tiếng Nhật qua immersion
        </h1>
        <p>
          AI sẽ trích xuất bản ghi âm, thêm furigana, dịch phụ đề
          <br />
          và xây dựng bài học từ vựng + ngữ pháp hoàn chỉnh cho bạn.
        </p>
      </header>

      <div className="video-import-showcase__tabs" role="tablist" aria-label="Nguồn video">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'url'}
          className={tab === 'url' ? 'is-active' : ''}
          onClick={() => setTab('url')}
          disabled={uploading}
        >
          <Link2 aria-hidden="true" size={18} /> <span>YouTube / URL</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'file'}
          className={tab === 'file' ? 'is-active' : ''}
          onClick={() => setTab('file')}
          disabled={uploading}
        >
          <FolderOpen aria-hidden="true" size={18} /> <span>Tệp cục bộ</span>
        </button>
      </div>

      {tab === 'url' ? (
        <div className="video-import-showcase__panel">
          <label htmlFor="video-url" className="video-import-showcase__label">
            Đường dẫn video
          </label>
          <div className="video-import-showcase__url-row">
            <Link2 aria-hidden="true" size={19} />
            <input
              id="video-url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              inputMode="url"
            />
            <Button className="video-import-showcase__submit" onClick={() => void importUrl()} disabled={uploading}>
              {uploading ? 'Đang nhập…' : 'Nhập YouTube'}
            </Button>
          </div>
          <p className="video-import-showcase__hint">
            Local: video được tải riêng bằng yt-dlp, rồi xử lý transcript như tệp cục bộ.
          </p>
        </div>
      ) : (
        <button
          type="button"
          className={`video-import-showcase__dropzone${dragging ? ' is-dragging' : ''}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => {
            event.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault()
            setDragging(false)
            void importFile(event.dataTransfer.files[0])
          }}
          disabled={uploading}
        >
          <input
            ref={inputRef}
            type="file"
            accept="video/*"
            hidden
            onChange={(event) => void importFile(event.target.files?.[0])}
          />
          <ArrowUpFromLine aria-hidden="true" size={36} />
          <strong>{uploading ? `Đang tải lên ${progress?.percent ?? 0}%` : 'Kéo thả hoặc chọn video'}</strong>
          <small>{uploading ? 'Không đóng trang cho đến khi tải xong.' : 'MP4, WebM, MOV, OGV · tối đa 2 GB'}</small>
        </button>
      )}
      {error && (
        <p className="video-import-showcase__error" role="alert">
          {error}
        </p>
      )}

      {/* ── Pre-cached & Existing Video Lessons ── */}
      <div style={{ marginTop: '2.5rem', textAlign: 'left', width: '100%' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '1rem',
          }}
        >
          <h2
            style={{
              fontSize: '1.05rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: 'var(--color-text)',
            }}
          >
            <Film size={18} color="var(--rose-400)" />
            BÀI HỌC VIDEO ĐÃ XỬ LÝ & SẴN SÀNG SHADOWING ({uniqueItems.length})
          </h2>
          {isLoadingAssets && <Loader2 size={16} className="animate-spin" color="var(--color-text-muted)" />}
        </div>

        {uniqueItems.length === 0 ? (
          <Card
            style={{
              padding: '1.5rem',
              textAlign: 'center',
              color: 'var(--color-text-muted)',
              fontSize: '0.9rem',
              borderStyle: 'dashed',
            }}
          >
            Chưa có bài học nào. Hãy dán link YouTube ở trên để tạo bài học đầu tiên!
          </Card>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
              gap: '1rem',
            }}
          >
            {uniqueItems.map((item) => {
              const isReady = item.processingStatus === 'ready'
              const isProcessing = item.processingStatus === 'processing' || item.processingStatus === 'draft'

              return (
                <Card
                  key={item.id}
                  style={{
                    padding: '1.1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '0.75rem',
                    cursor: isReady || isProcessing ? 'pointer' : 'default',
                    transition: 'all 0.2s ease',
                    border: isReady ? '1px solid rgba(255, 77, 109, 0.25)' : '1px solid var(--color-border)',
                    background: isReady ? 'rgba(255, 255, 255, 0.02)' : 'transparent',
                  }}
                  onClick={() => {
                    onImport(item)
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--rose-400)'
                    e.currentTarget.style.transform = 'translateY(-2px)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = isReady ? 'rgba(255, 77, 109, 0.25)' : 'var(--color-border)'
                    e.currentTarget.style.transform = 'none'
                  }}
                >
                  <div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.5rem',
                        marginBottom: '0.4rem',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          background:
                            item.sourceType === 'youtube' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                          color: item.sourceType === 'youtube' ? '#f87171' : '#60a5fa',
                        }}
                      >
                        {item.sourceType === 'youtube' ? 'YouTube' : 'Tệp tải lên'}
                      </span>

                      {isReady && (
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            color: '#34d399',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <CheckCircle2 size={13} /> Sẵn sàng học
                        </span>
                      )}
                      {isProcessing && (
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            color: '#fbbf24',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <Clock size={13} className="animate-spin" /> Đang xử lý
                        </span>
                      )}
                    </div>

                    <h3
                      style={{
                        fontSize: '0.92rem',
                        fontWeight: 700,
                        lineHeight: 1.4,
                        color: 'var(--color-text)',
                        margin: 0,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {item.title || 'Video tiếng Nhật'}
                    </h3>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingTop: '0.5rem',
                      borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                    }}
                  >
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Tiếng Nhật (JA)</span>
                    <Button
                      variant={isReady ? 'primary' : 'secondary'}
                      size="sm"
                      style={{ padding: '4px 12px', fontSize: '0.8rem' }}
                      onClick={(e) => {
                        e.stopPropagation()
                        onImport(item)
                      }}
                    >
                      {isReady ? (
                        <>
                          <Play size={13} /> Luyện ngay
                        </>
                      ) : isProcessing ? (
                        <>
                          <Loader2 size={13} className="animate-spin" /> Xem tiến trình
                        </>
                      ) : (
                        'Mở'
                      )}
                    </Button>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
