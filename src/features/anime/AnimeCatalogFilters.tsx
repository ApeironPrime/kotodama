import { RotateCcw, Search, X } from 'lucide-react'

const JLPT_LEVELS = [
  { id: 'ALL', label: 'Tất cả' },
  { id: 'N5', label: 'N5' },
  { id: 'N4', label: 'N4' },
  { id: 'N3', label: 'N3' },
  { id: 'N2', label: 'N2' },
  { id: 'N1', label: 'N1' },
] as const

interface AnimeCatalogFiltersProps {
  searchQuery: string
  onSearchChange: (value: string) => void
  onSearchClear: () => void
  selectedLevel: string
  onLevelChange: (level: string) => void
  selectedGenre: string
  onGenreChange: (genre: string) => void
  availableGenres: string[]
  onResetFilters?: () => void
}

export function AnimeCatalogFilters({
  searchQuery,
  onSearchChange,
  onSearchClear,
  selectedLevel,
  onLevelChange,
  selectedGenre,
  onGenreChange,
  availableGenres,
  onResetFilters,
}: AnimeCatalogFiltersProps) {
  const hasActiveFilters = Boolean(searchQuery.trim() || selectedLevel !== 'ALL' || selectedGenre !== 'ALL')
  return (
    <section className="anime-filters" aria-label="Bộ lọc danh mục anime">
      <div className="anime-filters__search-bar">
        <label htmlFor="anime-search-input" className="sr-only">
          Tìm kiếm anime
        </label>
        <div className="anime-filters__search-wrapper">
          <Search size={18} className="anime-filters__search-icon" aria-hidden="true" />
          <input
            id="anime-search-input"
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Tìm anime theo tên tiếng Việt, tiếng Nhật..."
            className="anime-filters__search-input"
            aria-label="Tìm kiếm anime"
            autoComplete="off"
            spellCheck="false"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={onSearchClear}
              className="anime-filters__search-clear"
              aria-label="Xóa từ khóa tìm kiếm"
            >
              <X size={16} aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>

      <div className="anime-filters__controls">
        <div className="anime-filters__levels" role="group" aria-label="Lọc theo trình độ JLPT">
          <span className="anime-filters__label">Trình độ:</span>
          <div className="anime-filters__level-pills">
            {JLPT_LEVELS.map((lvl) => {
              const isActive = selectedLevel === lvl.id
              return (
                <button
                  key={lvl.id}
                  type="button"
                  onClick={() => onLevelChange(lvl.id)}
                  className={`anime-filters__level-btn${isActive ? ' is-active' : ''}`}
                  aria-pressed={isActive}
                >
                  {lvl.label}
                </button>
              )
            })}
          </div>
        </div>

        {availableGenres.length > 0 && (
          <div className="anime-filters__genre-wrapper">
            <label htmlFor="anime-genre-select" className="anime-filters__label">
              Thể loại:
            </label>
            <select
              id="anime-genre-select"
              value={selectedGenre}
              onChange={(e) => onGenreChange(e.target.value)}
              className="anime-filters__genre-select"
              aria-label="Lọc theo thể loại"
            >
              <option value="ALL">Tất cả thể loại</option>
              {availableGenres.map((genre) => (
                <option key={genre} value={genre}>
                  {genre}
                </option>
              ))}
            </select>
          </div>
        )}

        {hasActiveFilters && onResetFilters && (
          <button
            type="button"
            onClick={onResetFilters}
            className="anime-filters__reset-btn"
            aria-label="Đặt lại tất cả bộ lọc"
          >
            <RotateCcw size={14} aria-hidden="true" />
            <span>Đặt lại</span>
          </button>
        )}
      </div>
    </section>
  )
}
