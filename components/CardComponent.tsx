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
  faded?: boolean
}

const sizes = {
  sm: { w: 36,  h: 52,  rankFs: 10, suitFs: 11, cornerGap: 12 },
  md: { w: 50,  h: 70,  rankFs: 12, suitFs: 14, cornerGap: 15 },
  lg: { w: 62,  h: 88,  rankFs: 14, suitFs: 17, cornerGap: 18 },
}

// Classic suit SVGs — clean bold shapes matching real cards
function suitPath(suit: string, color: string, size: number) {
  const s = size
  switch (suit) {
    case 'H': return `<svg width="${s}" height="${s}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path d="M50 85 C50 85 10 58 10 33 C10 20 20 12 32 16 C40 19 50 30 50 30 C50 30 60 19 68 16 C80 12 90 20 90 33 C90 58 50 85 50 85Z" fill="${color}"/></svg>`
    case 'D': return `<svg width="${s}" height="${s}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path d="M50 5 L93 50 L50 95 L7 50 Z" fill="${color}"/></svg>`
    case 'S': return `<svg width="${s}" height="${s}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path d="M50 8 C50 8 12 42 12 60 C12 72 22 78 34 72 C28 80 24 88 18 92 L82 92 C76 88 72 80 66 72 C78 78 88 72 88 60 C88 42 50 8 50 8Z" fill="${color}"/></svg>`
    case 'C': return `<svg width="${s}" height="${s}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="38" r="20" fill="${color}"/><circle cx="30" cy="58" r="20" fill="${color}"/><circle cx="70" cy="58" r="20" fill="${color}"/><rect x="42" y="62" width="16" height="24" rx="4" fill="${color}"/><rect x="30" y="86" width="40" height="8" rx="3" fill="${color}"/></svg>`
    default: return ''
  }
}

function SuitIcon({ suit, color, size }: { suit: string; color: string; size: number }) {
  return <span dangerouslySetInnerHTML={{ __html: suitPath(suit, color, size) }} style={{ display:'inline-flex', lineHeight:0, flexShrink:0 }} />
}

// Face card illustrated characters — classic chess-piece inspired
function FaceCardArt({ rank, suit, color, w, h }: { rank: string; suit: string; color: string; w: number; h: number }) {
  const cx = w / 2
  const topH = h * 0.5

  // Crown shapes per rank
  const crownPath = rank === 'K'
    ? `M${cx-14} ${topH-22} L${cx-14} ${topH-34} L${cx-8} ${topH-28} L${cx} ${topH-38} L${cx+8} ${topH-28} L${cx+14} ${topH-34} L${cx+14} ${topH-22} Z`
    : rank === 'Q'
    ? `M${cx-12} ${topH-22} Q${cx-14} ${topH-32} ${cx-6} ${topH-30} Q${cx} ${topH-38} Q${cx+6} ${topH-30} Q${cx+14} ${topH-32} ${cx+12} ${topH-22} Z`
    : `M${cx-8} ${topH-22} L${cx-4} ${topH-36} L${cx} ${topH-28} Z` // J: simple hat

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} xmlns="http://www.w3.org/2000/svg" style={{ position:'absolute', inset:0 }}>
      {/* Ornate border */}
      <rect x="3" y="3" width={w-6} height={h-6} rx="5" fill="none" stroke={color} strokeWidth="0.8" opacity="0.25"/>
      <rect x="5" y="5" width={w-10} height={h-10} rx="4" fill="none" stroke={color} strokeWidth="0.5" opacity="0.15"/>

      {/* Top half figure */}
      {/* Body/robe */}
      <ellipse cx={cx} cy={topH - 4} rx={w*0.28} ry={h*0.14} fill={color} opacity="0.18"/>
      <rect x={cx - w*0.2} y={topH - 16} width={w*0.4} height={16} rx="4" fill={color} opacity="0.22"/>

      {/* Head */}
      <circle cx={cx} cy={topH - 26} r={w*0.13} fill="#f5e6c8" stroke={color} strokeWidth="0.8" opacity="0.9"/>

      {/* Crown / hat */}
      <path d={crownPath} fill={color} opacity="0.85"/>

      {/* Suit emblem held */}
      <g transform={`translate(${cx - 6}, ${topH - 18}) scale(0.55)`}>
        <path d={
          suit === 'H' ? 'M11 20C11 20 2 14 2 8C2 5 4.5 3 7 4.5C9 5.5 11 8 11 8C11 8 13 5.5 15 4.5C17.5 3 20 5 20 8C20 14 11 20 11 20Z' :
          suit === 'D' ? 'M11 1L21 11L11 21L1 11Z' :
          suit === 'S' ? 'M11 2C11 2 2 10 2 15C2 18 5 19.5 8 18C7 20 6 21.5 4 22L18 22C16 21.5 15 20 14 18C17 19.5 20 18 20 15C20 10 11 2 11 2Z' :
          'M11 9.5C11 9.5 6 6 8 2C10 0 12 2 11 4C12 2 14 0 16 2C18 6 13 9.5 13 9.5L16 9.5C17 9.5 18 12 16 13L6 13C4 12 5 9.5 6 9.5Z'
        } fill={color}/>
      </g>

      {/* Center suit symbol large */}
      <text x={cx} y={topH + 2} textAnchor="middle" fontSize={w * 0.32} fill={color} opacity="0.12" fontFamily="serif">{
        suit === 'H' ? '♥' : suit === 'D' ? '♦' : suit === 'S' ? '♠' : '♣'
      }</text>

      {/* Bottom half — mirrored */}
      <g transform={`rotate(180, ${cx}, ${h/2})`}>
        <ellipse cx={cx} cy={topH - 4} rx={w*0.28} ry={h*0.14} fill={color} opacity="0.18"/>
        <rect x={cx - w*0.2} y={topH - 16} width={w*0.4} height={16} rx="4" fill={color} opacity="0.22"/>
        <circle cx={cx} cy={topH - 26} r={w*0.13} fill="#f5e6c8" stroke={color} strokeWidth="0.8" opacity="0.9"/>
        <path d={crownPath} fill={color} opacity="0.85"/>
      </g>

      {/* Rank letter centered */}
      <text x={cx} y={h/2 + 5} textAnchor="middle" fontSize={w * 0.22} fontWeight="bold" fill={color} opacity="0.08" fontFamily="Georgia, serif">{rank}</text>
    </svg>
  )
}

export default function CardComponent({ card, size = 'md', onClick, disabled, highlight, faceDown, dealDelay = 0, faded }: Props) {
  const s = sizes[size]
  const red = !faceDown && isRedSuit(card.suit)
  const color = red ? '#b91c1c' : '#1e1b4b'
  const isFace = ['J','Q','K'].includes(card.rank)
  const isAce = card.rank === 'A'

  if (faceDown) {
    return (
      <div className="playing-card face-down card-deal-anim"
        style={{ width:s.w, height:s.h, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, animationDelay:`${dealDelay}ms`, opacity: faded ? 0.5 : 1 }}>
        {/* Classic card back pattern */}
        <svg width={s.w-4} height={s.h-4} viewBox="0 0 50 70" xmlns="http://www.w3.org/2000/svg">
          <rect x="0" y="0" width="50" height="70" rx="4" fill="#4338ca" opacity="0.9"/>
          <rect x="2" y="2" width="46" height="66" rx="3" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1"/>
          {/* diamond grid pattern */}
          {[...Array(5)].map((_,row) => [...Array(4)].map((_,col) => (
            <path key={`${row}-${col}`} d={`M${6+col*12} ${7+row*14} L${12+col*12} ${14+row*14} L${6+col*12} ${21+row*14} L${0+col*12} ${14+row*14}Z`}
              fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="0.7"/>
          )))}
          <text x="25" y="40" textAnchor="middle" fontSize="14" fill="rgba(255,255,255,0.15)" fontFamily="serif">✦</text>
        </svg>
      </div>
    )
  }

  const canClick = !!onClick && !disabled
  const cls = `playing-card${highlight && onClick ? ' playable' : ''}${disabled ? ' dimmed' : ''} card-deal-anim`

  return (
    <button onClick={onClick} disabled={!canClick} className={cls}
      style={{ width:s.w, height:s.h, position:'relative', animationDelay:`${dealDelay}ms`,
        cursor: canClick ? 'pointer' : 'default', border:'none', flexShrink:0, padding:0, opacity: faded ? 0.45 : 1 }}>

      {/* Face card art fills the card */}
      {isFace && <FaceCardArt rank={card.rank} suit={card.suit} color={color} w={s.w} h={s.h} />}

      {/* Ace: big center pip */}
      {isAce && (
        <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <SuitIcon suit={card.suit} color={color} size={Math.round(s.h * 0.42)} />
        </div>
      )}

      {/* Top-left corner */}
      <div style={{ position:'absolute', top:4, left:4, display:'flex', flexDirection:'column', alignItems:'center', lineHeight:1, gap:1 }}>
        <span style={{ fontSize:s.rankFs, fontWeight:800, color, fontFamily:'Georgia, serif', lineHeight:1 }}>{card.rank}</span>
        <SuitIcon suit={card.suit} color={color} size={s.suitFs} />
      </div>

      {/* Bottom-right corner — rotated */}
      <div style={{ position:'absolute', bottom:4, right:4, display:'flex', flexDirection:'column', alignItems:'center', lineHeight:1, gap:1, transform:'rotate(180deg)' }}>
        <span style={{ fontSize:s.rankFs, fontWeight:800, color, fontFamily:'Georgia, serif', lineHeight:1 }}>{card.rank}</span>
        <SuitIcon suit={card.suit} color={color} size={s.suitFs} />
      </div>
    </button>
  )
}
