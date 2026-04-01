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
  faded?: boolean
}

const sizes = {
  sm: { w: 36,  h: 52,  rankFs: 10, cornerSuit: 8  },
  md: { w: 50,  h: 70,  rankFs: 12, cornerSuit: 10 },
  lg: { w: 62,  h: 88,  rankFs: 14, cornerSuit: 12 },
}

// Crisp, correct suit symbols as unicode — simple and readable
const SUIT_CHAR: Record<string, string> = { S: '♠', H: '♥', D: '♦', C: '♣' }

// Pip grid: [col, row] where col 0=left,1=center,2=right  row 0..4 top→bottom
// flipped=true means rotate 180 (for bottom half pips)
type Pip = [number, number, boolean?]

const PIPS: Record<number, Pip[]> = {
  2:  [[1,0],[1,4,true]],
  3:  [[1,0],[1,2],[1,4,true]],
  4:  [[0,0],[2,0],[0,4,true],[2,4,true]],
  5:  [[0,0],[2,0],[1,2],[0,4,true],[2,4,true]],
  6:  [[0,0],[2,0],[0,2],[2,2],[0,4,true],[2,4,true]],
  7:  [[0,0],[2,0],[0,2],[2,2],[1,1],[0,4,true],[2,4,true]],
  8:  [[0,0],[2,0],[0,1],[2,1],[1,1],[0,3,true],[2,3,true],[1,3,true]],  // ← wait, 8 needs 8 pips
  9:  [[0,0],[2,0],[0,1],[2,1],[1,2],[0,3,true],[2,3,true],[0,4,true],[2,4,true]],
  10: [[0,0],[2,0],[0,1],[2,1],[1,1],[0,3,true],[2,3,true],[1,3,true],[0,4,true],[2,4,true]],
}

// Correct 8-pip layout
PIPS[8] = [[0,0],[2,0],[0,1],[2,1],[0,3,true],[2,3,true],[0,4,true],[2,4,true]]

export default function CardComponent({ card, size = 'md', onClick, disabled, highlight, faceDown, dealDelay = 0, faded }: Props) {
  const s = sizes[size]
  const red = !faceDown && isRedSuit(card.suit)
  const ink = red ? '#c0181a' : '#14143a'
  const suit = card.suit
  const rankNum = parseInt(card.rank)
  const isFace = ['J','Q','K'].includes(card.rank)
  const isAce  = card.rank === 'A'
  const isNum  = !isFace && !isAce

  // pip area inner bounds (excluding corner labels)
  const pad = 4
  const cornerH = s.rankFs + s.cornerSuit + 3
  const pipTop  = pad + cornerH + 4
  const pipBot  = s.h - pad - cornerH - 4
  const pipLeft = pad + 4
  const pipRight= s.w - pad - 4

  const colX = (col: number) => {
    if (col === 0) return pipLeft + s.cornerSuit / 2
    if (col === 2) return pipRight - s.cornerSuit / 2
    return (pipLeft + pipRight) / 2
  }
  const rowY = (row: number) => {
    const t = pipTop, b = pipBot
    // rows 0..4 map to top, upper-mid, center, lower-mid, bottom
    const positions = [t, t+(b-t)*0.27, (t+b)/2, t+(b-t)*0.73, b]
    return positions[row] ?? (t+b)/2
  }

  if (faceDown) {
    return (
      <div className="playing-card face-down card-deal-anim"
        style={{ width:s.w, height:s.h, display:'flex', alignItems:'center', justifyContent:'center',
          flexShrink:0, animationDelay:`${dealDelay}ms`, opacity: faded ? 0.5 : 1, position:'relative' }}>
        <svg width={s.w} height={s.h} viewBox={`0 0 ${s.w} ${s.h}`} style={{position:'absolute',inset:0}}>
          <rect width={s.w} height={s.h} rx="6" fill="#3730a3"/>
          <rect x="2" y="2" width={s.w-4} height={s.h-4} rx="5" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1"/>
          {/* Diamond trellis back pattern */}
          {Array.from({length:8},(_,r)=>Array.from({length:6},(_,c)=>(
            <path key={`${r}-${c}`}
              d={`M${c*10-2} ${r*12+6} L${c*10+3} ${r*12} L${c*10+8} ${r*12+6} L${c*10+3} ${r*12+12}Z`}
              fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="0.6"/>
          )))}
        </svg>
      </div>
    )
  }

  const canClick = !!onClick && !disabled
  const cls = `playing-card${highlight && onClick ? ' playable' : ''}${disabled ? ' dimmed' : ''} card-deal-anim`

  return (
    <button onClick={onClick} disabled={!canClick} className={cls}
      style={{ width:s.w, height:s.h, position:'relative', animationDelay:`${dealDelay}ms`,
        cursor:canClick?'pointer':'default', border:'none', flexShrink:0, padding:0,
        opacity: faded ? 0.45 : 1 }}>

      <svg width={s.w} height={s.h} viewBox={`0 0 ${s.w} ${s.h}`}
        style={{position:'absolute',inset:0}} xmlns="http://www.w3.org/2000/svg">

        {/* ── Top-left corner ── */}
        <text x={pad+1} y={pad+s.rankFs} fontSize={s.rankFs} fontWeight="800"
          fill={ink} fontFamily="Georgia, serif" textAnchor="start">{card.rank}</text>
        <text x={pad+1} y={pad+s.rankFs+s.cornerSuit+1} fontSize={s.cornerSuit}
          fill={ink} fontFamily="serif" textAnchor="start">{SUIT_CHAR[suit]}</text>

        {/* ── Bottom-right corner (rotated) ── */}
        <g transform={`rotate(180,${s.w/2},${s.h/2})`}>
          <text x={pad+1} y={pad+s.rankFs} fontSize={s.rankFs} fontWeight="800"
            fill={ink} fontFamily="Georgia, serif" textAnchor="start">{card.rank}</text>
          <text x={pad+1} y={pad+s.rankFs+s.cornerSuit+1} fontSize={s.cornerSuit}
            fill={ink} fontFamily="serif" textAnchor="start">{SUIT_CHAR[suit]}</text>
        </g>

        {/* ── ACE: single large pip ── */}
        {isAce && (
          <text x={s.w/2} y={s.h/2+s.rankFs*0.9} fontSize={s.rankFs*2.6}
            fill={ink} fontFamily="serif" textAnchor="middle">{SUIT_CHAR[suit]}</text>
        )}

        {/* ── NUMBER CARDS: pip grid ── */}
        {isNum && PIPS[rankNum]?.map(([col, row, flip], i) => {
          const x = colX(col)
          const y = rowY(row)
          const fs = s.cornerSuit * 1.25
          return (
            <text key={i} x={x} y={y + fs*0.38}
              fontSize={fs} fill={ink} fontFamily="serif" textAnchor="middle"
              transform={flip ? `rotate(180,${x},${y})` : undefined}>
              {SUIT_CHAR[suit]}
            </text>
          )
        })}

        {/* ── FACE CARDS ── */}
        {isFace && (() => {
          const cx = s.w/2, cy = s.h/2
          const faceLabel = card.rank  // J, Q, K
          // Ornate border
          return <>
            <rect x="3" y="3" width={s.w-6} height={s.h-6} rx="4"
              fill="none" stroke={ink} strokeWidth="0.5" opacity="0.2"/>

            {/* Large rank centered as main visual */}
            <text x={cx} y={cy-s.rankFs*0.3} fontSize={s.rankFs*3.2} fontWeight="900"
              fill={ink} fontFamily="Georgia, serif" textAnchor="middle" opacity="0.12">{faceLabel}</text>

            {/* Stylised figure: crown + head + body */}
            {/* Crown */}
            { faceLabel === 'K' && <path d={`M${cx-s.w*0.22} ${cy-s.h*0.28} L${cx-s.w*0.22} ${cy-s.h*0.38} L${cx-s.w*0.1} ${cy-s.h*0.32} L${cx} ${cy-s.h*0.42} L${cx+s.w*0.1} ${cy-s.h*0.32} L${cx+s.w*0.22} ${cy-s.h*0.38} L${cx+s.w*0.22} ${cy-s.h*0.28} Z`} fill={ink} opacity="0.75"/> }
            { faceLabel === 'Q' && <path d={`M${cx-s.w*0.2} ${cy-s.h*0.28} Q${cx-s.w*0.22} ${cy-s.h*0.38} ${cx-s.w*0.08} ${cy-s.h*0.34} Q${cx} ${cy-s.h*0.42} Q${cx+s.w*0.08} ${cy-s.h*0.34} Q${cx+s.w*0.22} ${cy-s.h*0.38} ${cx+s.w*0.2} ${cy-s.h*0.28} Z`} fill={ink} opacity="0.75"/> }
            { faceLabel === 'J' && <rect x={cx-s.w*0.12} y={cy-s.h*0.42} width={s.w*0.24} height={s.h*0.1} rx="2" fill={ink} opacity="0.7"/> }

            {/* Head */}
            <circle cx={cx} cy={cy-s.h*0.2} r={s.w*0.12} fill="#f5e6c8" stroke={ink} strokeWidth="0.7" opacity="0.9"/>

            {/* Body */}
            <rect x={cx-s.w*0.18} y={cy-s.h*0.1} width={s.w*0.36} height={s.h*0.15} rx="3" fill={ink} opacity="0.2"/>

            {/* Suit emblem center */}
            <text x={cx} y={cy+s.h*0.08} fontSize={s.rankFs*1.1}
              fill={ink} fontFamily="serif" textAnchor="middle" opacity="0.7">{SUIT_CHAR[suit]}</text>

            {/* Mirrored bottom half */}
            <g transform={`rotate(180,${cx},${cy})`}>
              { faceLabel === 'K' && <path d={`M${cx-s.w*0.22} ${cy-s.h*0.28} L${cx-s.w*0.22} ${cy-s.h*0.38} L${cx-s.w*0.1} ${cy-s.h*0.32} L${cx} ${cy-s.h*0.42} L${cx+s.w*0.1} ${cy-s.h*0.32} L${cx+s.w*0.22} ${cy-s.h*0.38} L${cx+s.w*0.22} ${cy-s.h*0.28} Z`} fill={ink} opacity="0.75"/> }
              { faceLabel === 'Q' && <path d={`M${cx-s.w*0.2} ${cy-s.h*0.28} Q${cx-s.w*0.22} ${cy-s.h*0.38} ${cx-s.w*0.08} ${cy-s.h*0.34} Q${cx} ${cy-s.h*0.42} Q${cx+s.w*0.08} ${cy-s.h*0.34} Q${cx+s.w*0.22} ${cy-s.h*0.38} ${cx+s.w*0.2} ${cy-s.h*0.28} Z`} fill={ink} opacity="0.75"/> }
              { faceLabel === 'J' && <rect x={cx-s.w*0.12} y={cy-s.h*0.42} width={s.w*0.24} height={s.h*0.1} rx="2" fill={ink} opacity="0.7"/> }
              <circle cx={cx} cy={cy-s.h*0.2} r={s.w*0.12} fill="#f5e6c8" stroke={ink} strokeWidth="0.7" opacity="0.9"/>
              <rect x={cx-s.w*0.18} y={cy-s.h*0.1} width={s.w*0.36} height={s.h*0.15} rx="3" fill={ink} opacity="0.2"/>
              <text x={cx} y={cy+s.h*0.08} fontSize={s.rankFs*1.1} fill={ink} fontFamily="serif" textAnchor="middle" opacity="0.7">{SUIT_CHAR[suit]}</text>
            </g>
          </>
        })()}

      </svg>
    </button>
  )
}
