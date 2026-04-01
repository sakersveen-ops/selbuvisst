'use client'
import { Card, isRedSuit } from '@/lib/game'

interface Props {
  card: Card
  size?: 'sm' | 'md' | 'lg'
  onClick?: () => void
  disabled?: boolean
  highlight?: boolean
  faceDown?: boolean
  dealDelay?: number
}

// Pip layouts: [x%, y%] positions for each pip, normalized 0-100
// x=0 left col, x=50 center, x=100 right col
// y=0 top, y=100 bottom
const PIP_LAYOUTS: Record<number, [number, number, boolean?][]> = {
  1:  [[50, 50]],
  2:  [[50, 18], [50, 82, true]],
  3:  [[50, 18], [50, 50], [50, 82, true]],
  4:  [[20, 18], [80, 18], [20, 82, true], [80, 82, true]],
  5:  [[20, 18], [80, 18], [50, 50], [20, 82, true], [80, 82, true]],
  6:  [[20, 18], [80, 18], [20, 50], [80, 50], [20, 82, true], [80, 82, true]],
  7:  [[20, 18], [80, 18], [20, 50], [80, 50], [50, 33], [20, 82, true], [80, 82, true]],
  8:  [[20, 18], [80, 18], [20, 45], [80, 45], [20, 68, true], [80, 68, true], [20, 82, true], [80, 82, true]],
  9:  [[20, 15], [80, 15], [20, 38], [80, 38], [50, 50], [20, 62, true], [80, 62, true], [20, 85, true], [80, 85, true]],
  10: [[20, 15], [80, 15], [50, 27], [20, 38], [80, 38], [20, 62, true], [80, 62, true], [50, 73, true], [20, 85, true], [80, 85, true]],
}

const SUIT_SVG: Record<string, (color: string, size: number) => string> = {
  H: (c, s) => `<svg width="${s}" height="${s}" viewBox="0 0 20 20"><path d="M10 17 C10 17 2 11 2 6 C2 3 4.5 1.5 7 3 C8.5 4 10 6 10 6 C10 6 11.5 4 13 3 C15.5 1.5 18 3 18 6 C18 11 10 17 10 17Z" fill="${c}"/></svg>`,
  D: (c, s) => `<svg width="${s}" height="${s}" viewBox="0 0 20 20"><path d="M10 1 L18 10 L10 19 L2 10 Z" fill="${c}"/></svg>`,
  C: (c, s) => `<svg width="${s}" height="${s}" viewBox="0 0 20 20"><circle cx="10" cy="14" r="3.5" fill="${c}"/><circle cx="6" cy="10" r="3.5" fill="${c}"/><circle cx="14" cy="10" r="3.5" fill="${c}"/><path d="M8 14 L12 14 L12 18 L8 18Z" fill="${c}"/></svg>`,
  S: (c, s) => `<svg width="${s}" height="${s}" viewBox="0 0 20 20"><path d="M10 1 C10 1 2 8 2 12 C2 15 4.5 16.5 7.5 14.5 C6.5 16.5 5.5 18 4 18 L16 18 C14.5 18 13.5 16.5 12.5 14.5 C15.5 16.5 18 15 18 12 C18 8 10 1 10 1Z" fill="${c}"/></svg>`,
}

function SuitPip({ suit, color, sizePx }: { suit: string; color: string; sizePx: number }) {
  const svg = SUIT_SVG[suit]?.(color, sizePx) ?? ''
  return <span dangerouslySetInnerHTML={{ __html: svg }} style={{ display: 'inline-flex', lineHeight: 0 }} />
}

const FACE_LABELS: Record<string, string> = { J: 'J', Q: 'Q', K: 'K' }

const sizes = {
  sm: { w: 38,  h: 56,  rankFs: 9,  pipSize: 8,  cornerRankFs: 8,  cornerSuitFs: 6,  padding: 3 },
  md: { w: 52,  h: 74,  rankFs: 12, pipSize: 11, cornerRankFs: 10, cornerSuitFs: 8,  padding: 4 },
  lg: { w: 64,  h: 90,  rankFs: 14, pipSize: 13, cornerRankFs: 12, cornerSuitFs: 9,  padding: 5 },
}

export default function CardComponent({ card, size = 'md', onClick, disabled, highlight, faceDown, dealDelay = 0 }: Props) {
  const s = sizes[size]
  const red = !faceDown && isRedSuit(card.suit)
  const color = red ? '#cc1f1f' : '#1a1a2e'
  const rankNum = parseInt(card.rank)
  const isFace = isNaN(rankNum)
  const pips = !isFace && PIP_LAYOUTS[rankNum] ? PIP_LAYOUTS[rankNum] : []

  const canClick = !!onClick && !disabled
  const cls = `playing-card${highlight && onClick ? ' playable' : ''}${disabled ? ' dimmed' : ''} card-deal-anim`

  if (faceDown) {
    return (
      <div className="playing-card face-down card-deal-anim"
        style={{ width: s.w, height: s.h, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, animationDelay: `${dealDelay}ms` }}>
        <span style={{ fontSize: s.pipSize + 2, opacity: 0.4, color: 'var(--gold)' }}>✦</span>
      </div>
    )
  }

  // Inner pip area dimensions (excluding padding and corner labels)
  const cornerH = s.cornerRankFs + s.cornerSuitFs + 2
  const pipAreaTop = s.padding + cornerH + 2
  const pipAreaBot = s.h - s.padding - cornerH - 2
  const pipAreaH = pipAreaBot - pipAreaTop
  const pipAreaLeft = s.padding + 2
  const pipAreaW = s.w - (s.padding + 2) * 2

  return (
    <button
      onClick={onClick}
      disabled={!canClick}
      className={cls}
      style={{
        width: s.w, height: s.h,
        position: 'relative',
        animationDelay: `${dealDelay}ms`,
        cursor: canClick ? 'pointer' : 'default',
        border: 'none',
        flexShrink: 0,
        padding: 0,
      }}
    >
      {/* Top-left corner */}
      <div style={{ position: 'absolute', top: s.padding, left: s.padding, display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1 }}>
        <span style={{ fontSize: s.cornerRankFs, fontWeight: 800, color, fontFamily: 'Georgia, serif', lineHeight: 1 }}>{card.rank}</span>
        <SuitPip suit={card.suit} color={color} sizePx={s.cornerSuitFs + 2} />
      </div>

      {/* Bottom-right corner (rotated) */}
      <div style={{ position: 'absolute', bottom: s.padding, right: s.padding, display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1, transform: 'rotate(180deg)' }}>
        <span style={{ fontSize: s.cornerRankFs, fontWeight: 800, color, fontFamily: 'Georgia, serif', lineHeight: 1 }}>{card.rank}</span>
        <SuitPip suit={card.suit} color={color} sizePx={s.cornerSuitFs + 2} />
      </div>

      {/* Center: pips or face label */}
      {isFace ? (
        // Face card: big letter centered
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: s.rankFs * 2.2, fontWeight: 900, color, fontFamily: 'Georgia, serif', lineHeight: 1 }}>
            {FACE_LABELS[card.rank] ?? card.rank}
          </span>
        </div>
      ) : card.rank === 'A' ? (
        // Ace: single large pip centered
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <SuitPip suit={card.suit} color={color} sizePx={Math.round(s.h * 0.38)} />
        </div>
      ) : (
        // Number cards: pip grid
        <div style={{ position: 'absolute', top: pipAreaTop, left: pipAreaLeft, width: pipAreaW, height: pipAreaH }}>
          {pips.map(([xPct, yPct, flip], idx) => {
            const x = (xPct / 100) * pipAreaW - (s.pipSize / 2)
            const y = (yPct / 100) * pipAreaH - (s.pipSize / 2)
            return (
              <div key={idx} style={{
                position: 'absolute',
                left: x, top: y,
                transform: flip ? 'rotate(180deg)' : undefined,
                display: 'inline-flex',
              }}>
                <SuitPip suit={card.suit} color={color} sizePx={s.pipSize} />
              </div>
            )
          })}
        </div>
      )}
    </button>
  )
}
