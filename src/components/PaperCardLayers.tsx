import type { OutgoingCardSnapshot } from '../lib/usePaperCardPhysics'

export function PaperStackUnderlay({
  remainingCount,
  variant = 'kakejiku',
  stack1Ref,
  stack2Ref,
}: {
  remainingCount: number
  variant?: 'kakejiku' | 'srs' | 'kanji'
  stack1Ref: React.RefObject<HTMLDivElement | null>
  stack2Ref: React.RefObject<HTMLDivElement | null>
}) {
  if (remainingCount <= 0) return null
  return (
    <>
      {remainingCount >= 2 && (
        <div
          ref={stack2Ref}
          className={`washi-stack-underlay washi-stack-underlay--2 washi-stack-underlay--${variant}`}
          aria-hidden="true"
        />
      )}
      <div
        ref={stack1Ref}
        className={`washi-stack-underlay washi-stack-underlay--1 washi-stack-underlay--${variant}`}
        aria-hidden="true"
      />
    </>
  )
}

export function OutgoingPaperGhost({
  snapshot,
  variant = 'kakejiku',
  ghostRef,
}: {
  snapshot: OutgoingCardSnapshot | null
  variant?: 'kakejiku' | 'srs' | 'kanji'
  ghostRef: React.RefObject<HTMLDivElement | null>
}) {
  if (!snapshot) return null
  return (
    <div
      key={snapshot.seq}
      ref={ghostRef}
      className={`washi-outgoing-ghost washi-outgoing-ghost--${variant} is-${snapshot.action}`}
      data-ghost-term={snapshot.term}
      aria-hidden="true"
    >
      {variant === 'kakejiku' && <div className="kakejiku-rod kakejiku-rod--top" />}
      <div className="washi-outgoing-ghost__sheet">
        {snapshot.action === 'pass' && <span className="washi-corner-hanko is-stamping" data-seal="済" />}
      </div>
      {variant === 'kakejiku' && <div className="kakejiku-rod kakejiku-rod--bottom" />}
    </div>
  )
}
