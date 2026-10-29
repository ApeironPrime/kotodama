import { describe, expect, it } from 'vitest'
import { explanationToPlainText } from './explanationText'

describe('explanationToPlainText', () => {
  it('formats legacy block and list markup without exposing tags', () => {
    expect(explanationToPlainText('<p>Đáp án đúng</p><ul><li>A sai</li><li>B đúng</li></ul>')).toBe(
      'Đáp án đúng\n• A sai\n• B đúng'
    )
  })

  it('decodes entities as plain text and keeps markup-like text safe', () => {
    expect(explanationToPlainText('<p>A &amp; B: &lt;script&gt;x&lt;/script&gt; &#26085;</p>')).toBe(
      'A & B: <script>x</script> 日'
    )
  })

  it('leaves ordinary explanations unchanged', () => {
    expect(explanationToPlainText('「全部売れました」は「全て売り切れた」の意味です。')).toBe(
      '「全部売れました」は「全て売り切れた」の意味です。'
    )
  })
})
