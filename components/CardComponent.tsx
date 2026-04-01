'use client'
import { Card, SUIT_SYMBOLS, isRedSuit } from '@/lib/game'

interface Props {
  card: Card
  size?: 'sm' | 'md' | 'lg'
  onClick?: () => void
  disabled?: boolean
  highlight?: boolean
  faceDown?: boolean
  dealDelay?: number
}

const sizes = {
  sm: { width: 36, height: 52, rankSize: 11, suitSize: 14 },
  md: { width: 48, height: 68, rankSize: 13, suitSize: 18 },
  lg: { width: 58, height: 82, rankSize: 15, suitSize: 22 },
}

export default function CardComponent({ card, size = 'md', onClick, disabled, highlight, faceDown, dealDelay = 0 }: Props) {
  const s = sizes[size]
  const red = !faceDown && isRedSuit(card.suit)

  if (faceDown) {
    return (
      <div className="playing-card face-down" style={{ width: s.width, height: s.height, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
        <span style={{ fontSize: s.suitSize, opacity: 0.4, color: 'var(--gold)' }}>✦</span>
      </div>
    )
  }

  const canClick = !!onClick && !disabled
  const cls = `playing-card${highlight && onClick ? ' playable' : ''}${disabled ? ' dimmed' : ''} card-deal-anim`

  return (
    <button
      onClick={onClick}
      disabled={!canClick}
      className={cls}
      style={{
        width: s.width, height: s.height,
        display: 'flex', flexDirection: 'column',
        alignItems: 'flex-start', justifyContent: 'space-between',
        padding: '5px 5px',
        animationDelay: `${dealDelay}ms`,
        cursor: canClick ? 'pointer' : 'default',
        border: 'none',
        flexShrink: 0,
      }}
    >
      <div style={{ fontSize: s.rankSize, fontWeight: 700, lineHeight: 1, color: red ? '#c0392b' : '#1a1a2e', fontFamily: 'DM Sans, sans-serif' }}>
        {card.rank}
      </div>
      <div style={{ fontSize: s.suitSize, lineHeight: 1, color: red ? '#c0392b' : '#1a1a2e', alignSelf: 'center' }}>
        {SUIT_SYMBOLS[card.suit]}
      </div>
      <div style={{ fontSize: s.rankSize, fontWeight: 700, lineHeight: 1, color: red ? '#c0392b' : '#1a1a2e', alignSelf: 'flex-end', transform: 'rotate(180deg)' }}>
        {card.rank}
      </div>
    </button>
  )
}
