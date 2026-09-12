import { animePlaybackApi } from './animePlaybackApi'
import type { AnimeDictionaryEntry } from './animePlaybackTypes'

export class AnimeDictionaryLRUCache {
  private cache = new Map<string, AnimeDictionaryEntry>()
  private maxSize: number

  constructor(maxSize: number = 50) {
    this.maxSize = maxSize
  }

  get(key: string): AnimeDictionaryEntry | undefined {
    const val = this.cache.get(key)
    if (val === undefined) return undefined
    // Move key to MRU (end of map)
    this.cache.delete(key)
    this.cache.set(key, val)
    return val
  }

  set(key: string, entry: AnimeDictionaryEntry): void {
    if (this.cache.has(key)) {
      this.cache.delete(key)
    } else if (this.cache.size >= this.maxSize) {
      // Evict least recently used (first key)
      const oldestKey = this.cache.keys().next().value
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey)
      }
    }
    this.cache.set(key, entry)
  }

  has(key: string): boolean {
    return this.cache.has(key)
  }

  get size(): number {
    return this.cache.size
  }

  clear(): void {
    this.cache.clear()
  }

  /**
   * Performs lookup with in-memory LRU cache and bounded fallback search.
   */
  async lookupToken(
    token: { word_id: number | null; surface: string },
    options?: { signal?: AbortSignal }
  ): Promise<AnimeDictionaryEntry> {
    const rawSurface = token.surface.trim()
    const cacheKey = token.word_id ? `id:${token.word_id}` : `surf:${rawSurface}`

    const cached = this.get(cacheKey)
    if (cached) {
      return cached
    }

    // Step 1: If word_id is present, attempt Anime dictionary lookup
    if (token.word_id && token.word_id > 0) {
      try {
        const entry = await animePlaybackApi.fetchDictionaryWord(token.word_id, options)
        this.set(cacheKey, entry)
        return entry
      } catch (err: unknown) {
        const status = (err && typeof err === 'object' && 'status' in err) ? (err as { status: number }).status : undefined
        const code = (err && typeof err === 'object' && 'code' in err) ? (err as { code: string }).code : undefined

        // Only fallback if 404 WORD_NOT_FOUND. Do NOT fallback on 403, 500, network error, or abort.
        if (status !== 404 && code !== 'WORD_NOT_FOUND') {
          throw err
        }
      }
    }

    // Step 2: Fallback once to dictionary search (limit <= 5)
    if (!rawSurface) {
      throw new Error('Không có thông tin từ vựng để tra cứu.')
    }

    const searchRes = await animePlaybackApi.searchDictionaryFallback(rawSurface, 5, options)
    const match = searchRes.results?.[0]
    if (match) {
      const synthesizedEntry: AnimeDictionaryEntry = {
        id: match.id || 0,
        word: match.word || rawSurface,
        reading: match.reading || null,
        pos_vi: match.pos_vi || [],
        jlpt: match.jlpt || null,
        hanviet: match.hanviet || '',
        meanings: match.meanings || [],
        source: 'dictionary_fallback',
        isFallback: true,
      }
      this.set(cacheKey, synthesizedEntry)
      return synthesizedEntry
    }

    const notFoundError = new Error(`Không tìm thấy định nghĩa cho từ '${rawSurface}'.`)
    ;(notFoundError as unknown as { code: string; status: number }).code = 'WORD_NOT_FOUND'
    ;(notFoundError as unknown as { code: string; status: number }).status = 404
    throw notFoundError
  }
}

// Memory-only singleton cache instance for the session
export const animeDictionaryCache = new AnimeDictionaryLRUCache(50)
