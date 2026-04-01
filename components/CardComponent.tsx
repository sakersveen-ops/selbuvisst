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

// Card renders at fixed internal viewBox 70x100 regardless of display size.
// All coordinates below are in that coordinate space.
const VW = 70
const VH = 100

const DISPLAY = {
  sm: { w: 38,  h: 54  },
  md: { w: 50,  h: 72  },
  lg: { w: 62,  h: 88  },
}

// Suit unicode — variation selector forces text glyph not emoji
const S = '\u2660\uFE0E'
const H = '\u2665\uFE0E'
const D = '\u2666\uFE0E'
const C = '\u2663\uFE0E'
const SUIT: Record<string, string> = { S, H, D, C }

// Corner label sizes (in viewBox units)
const RANK_FS = 11   // rank numeral
const CORNER_SUIT_FS = 8  // small suit in corner
const CORNER_X = 4.5
const CORNER_RANK_Y = 13
const CORNER_SUIT_Y = 22

// Pip font size — smaller than corner suits for correct proportion
const PIP_FS = 11

// Pip positions: [x, y] in viewBox coords, centered on pip
// Left col x=17, center x=35, right x=53
// Rows top→bottom: 28, 38, 50, 62, 72
const L = 17, M = 35, R = 53
const T = 28, TM = 38, C_ = 50, BM = 62, B = 72

// Each entry: [x, y, flipped?]  flipped = rotate 180 around pip center
type Pip = [number, number, boolean?]

const PIPS: Record<number, Pip[]> = {
  2:  [[M,T],[M,B,true]],
  3:  [[M,T],[M,C_],[M,B,true]],
  4:  [[L,T],[R,T],[L,B,true],[R,B,true]],
  5:  [[L,T],[R,T],[M,C_],[L,B,true],[R,B,true]],
  6:  [[L,T],[R,T],[L,C_],[R,C_],[L,B,true],[R,B,true]],
  7:  [[L,T],[R,T],[L,C_],[R,C_],[M,TM],[L,B,true],[R,B,true]],
  8:  [[L,T],[R,T],[L,C_],[R,C_],[M,TM],[M,BM,true],[L,B,true],[R,B,true]],
  9:  [[L,T],[R,T],[L,TM],[R,TM],[M,C_],[L,BM,true],[R,BM,true],[L,B,true],[R,B,true]],
  10: [[L,T],[R,T],[L,TM],[R,TM],[M,34],[M,66,true],[L,BM,true],[R,BM,true],[L,B,true],[R,B,true]],
}

function CardSVG({ card, ink }: { card: Card; ink: string }) {
  const suit = card.suit
  const sym = SUIT[suit]
  const rankNum = parseInt(card.rank)
  const isFace = ['J','Q','K'].includes(card.rank)
  const isAce  = card.rank === 'A'
  const isNum  = !isFace && !isAce

  return (
    <>
      {/* ── Top-left corner ── */}
      <text x={CORNER_X} y={CORNER_RANK_Y} fontSize={RANK_FS} fontWeight="800"
        fill={ink} fontFamily="Georgia,serif" textAnchor="start" dominantBaseline="auto">{card.rank}</text>
      <text x={CORNER_X} y={CORNER_SUIT_Y} fontSize={CORNER_SUIT_FS}
        fill={ink} fontFamily="serif" textAnchor="start" dominantBaseline="auto">{sym}</text>

      {/* ── Bottom-right corner (rotated 180°) ── */}
      <g transform={`rotate(180,${VW/2},${VH/2})`}>
        <text x={CORNER_X} y={CORNER_RANK_Y} fontSize={RANK_FS} fontWeight="800"
          fill={ink} fontFamily="Georgia,serif" textAnchor="start" dominantBaseline="auto">{card.rank}</text>
        <text x={CORNER_X} y={CORNER_SUIT_Y} fontSize={CORNER_SUIT_FS}
          fill={ink} fontFamily="serif" textAnchor="start" dominantBaseline="auto">{sym}</text>
      </g>

      {/* ── ACE: single large centre pip ── */}
      {isAce && (
        <text x={VW/2} y={VH/2+14} fontSize={36} fill={ink}
          fontFamily="serif" textAnchor="middle" dominantBaseline="auto">{sym}</text>
      )}

      {/* ── NUMBER CARDS: pip grid ── */}
      {isNum && (PIPS[rankNum] ?? []).map(([px, py, flip], i) => (
        <text key={i}
          x={px} y={py + PIP_FS * 0.38}
          fontSize={PIP_FS} fill={ink}
          fontFamily="serif" textAnchor="middle" dominantBaseline="auto"
          transform={flip ? `rotate(180,${px},${py})` : undefined}>
          {sym}
        </text>
      ))}

      {/* ── FACE CARDS ── */}
      {isFace && (() => {
        const cx = VW / 2
        const topCY = VH * 0.30
        const botCY = VH * 0.70

        // Crown shape per rank
        const crown = (cy: number, flip: boolean) => {
          const base = flip ? cy + VH*0.08 : cy - VH*0.08
          const tip  = flip ? cy + VH*0.18 : cy - VH*0.18
          const mid  = flip ? cy + VH*0.13 : cy - VH*0.13
          return card.rank === 'K'
            ? `M${cx-12} ${base} L${cx-12} ${tip} L${cx-5} ${mid} L${cx} ${tip-4*(flip?-1:1)} L${cx+5} ${mid} L${cx+12} ${tip} L${cx+12} ${base} Z`
            : card.rank === 'Q'
            ? `M${cx-11} ${base} Q${cx-13} ${tip} ${cx-5} ${mid} Q${cx} ${tip-3*(flip?-1:1)} Q${cx+5} ${mid} Q${cx+13} ${tip} ${cx+11} ${base} Z`
            : `M${cx-8} ${base} L${cx-8} ${mid} L${cx+8} ${mid} L${cx+8} ${base} Z`
        }

        return <>
          {/* Ornate border line */}
          <rect x="4" y="4" width={VW-8} height={VH-8} rx="3"
            fill="none" stroke={ink} strokeWidth="0.6" opacity="0.18"/>

          {/* Top figure */}
          <path d={crown(topCY, false)} fill={ink} opacity="0.8"/>
          <circle cx={cx} cy={topCY + (card.rank==='J'?4:2)} r={7}
            fill="#f5e6c8" stroke={ink} strokeWidth="0.8" opacity="0.95"/>
          <rect x={cx-8} y={topCY+10} width={16} height={10} rx="2" fill={ink} opacity="0.18"/>
          <text x={cx} y={topCY+24} fontSize={9} fill={ink}
            fontFamily="serif" textAnchor="middle" opacity="0.8">{sym}</text>
          <text x={cx} y={topCY+11} fontSize={6} fontWeight="bold"
            fill={ink} fontFamily="Georgia,serif" textAnchor="middle" opacity="0.6">{card.rank}</text>

          {/* Bottom figure (mirrored) */}
          <g transform={`rotate(180,${cx},${VH/2})`}>
            <path d={crown(topCY, false)} fill={ink} opacity="0.8"/>
            <circle cx={cx} cy={topCY+(card.rank==='J'?4:2)} r={7}
              fill="#f5e6c8" stroke={ink} strokeWidth="0.8" opacity="0.95"/>
            <rect x={cx-8} y={topCY+10} width={16} height={10} rx="2" fill={ink} opacity="0.18"/>
            <text x={cx} y={topCY+24} fontSize={9} fill={ink}
              fontFamily="serif" textAnchor="middle" opacity="0.8">{sym}</text>
            <text x={cx} y={topCY+11} fontSize={6} fontWeight="bold"
              fill={ink} fontFamily="Georgia,serif" textAnchor="middle" opacity="0.6">{card.rank}</text>
          </g>

          {/* Centre suit pip */}
          <text x={cx} y={VH/2+5} fontSize={13} fill={ink}
            fontFamily="serif" textAnchor="middle" opacity="0.15">{sym}</text>
        </>
      })()}
    </>
  )
}

export default function CardComponent({
  card, size = 'md', onClick, disabled, highlight, faceDown, dealDelay = 0, faded
}: Props) {
  const d = DISPLAY[size]
  const red = !faceDown && isRedSuit(card.suit)
  const ink = red ? '#c41a1a' : '#16165a'

  const canClick = !!onClick && !disabled
  const cls = `playing-card${highlight && onClick ? ' playable' : ''}${disabled ? ' dimmed' : ''} card-deal-anim`

  if (faceDown) {
    return (
      <div className={`playing-card face-down card-deal-anim`}
        style={{ width:d.w, height:d.h, flexShrink:0, animationDelay:`${dealDelay}ms`,
          opacity:faded?0.5:1, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <svg width={d.w} height={d.h} viewBox={`0 0 ${VW} ${VH}`} xmlns="http://www.w3.org/2000/svg">
          <rect width={VW} height={VH} rx="5" fill="#3730a3"/>
          <rect x="2" y="2" width={VW-4} height={VH-4} rx="4"
            fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="1"/>
          {/* Classic card-back diamond trellis */}
          {Array.from({length:12},(_,r)=>Array.from({length:8},(_,c)=>(
            <path key={`${r}-${c}`}
              d={`M${c*10-3} ${r*10+5} L${c*10+2} ${r*10} L${c*10+7} ${r*10+5} L${c*10+2} ${r*10+10}Z`}
              fill="none" stroke="rgba(255,255,255,0.13)" strokeWidth="0.5"/>
          )))}
        </svg>
      </div>
    )
  }

  return (
    <button onClick={onClick} disabled={!canClick} className={cls}
      style={{ width:d.w, height:d.h, position:'relative', animationDelay:`${dealDelay}ms`,
        cursor:canClick?'pointer':'default', border:'none', flexShrink:0, padding:0,
        opacity:faded?0.45:1 }}>
      <svg width={d.w} height={d.h} viewBox={`0 0 ${VW} ${VH}`}
        style={{position:'absolute',inset:0,display:'block'}}
        xmlns="http://www.w3.org/2000/svg">
        <CardSVG card={card} ink={ink} />
      </svg>
    </button>
  )
}
