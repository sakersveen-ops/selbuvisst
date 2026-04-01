'use client'
import { Card, SUIT_SYMBOLS, isRedSuit } from '@/lib/game'

interface Props {
  card: Card
  size?: 'sm' | 'md' | 'lg'
  onClick?: () => void
  disabled?: boolean
  highlight?: boolean
  faceDown?: boolean
}

const sizes = {
  sm: { w: 'w-9', h: 'h-13', rank: 'text-xs', suit: 'text-sm' },
  md: { w: 'w-12', h: 'h-16', rank: 'text-sm', suit: 'text-base' },
  lg: { w: 'w-14', h: 'h-20', rank: 'text-base', suit: 'text-lg' },
}

export default function CardComponent({ card, size = 'md', onClick, disabled, highlight, faceDown }: Props) {
  const s = sizes[size]
  const red = isRedSuit(card.suit)

  if (faceDown) {
    return (
      <div className={`${s.w} ${s.h} rounded-lg bg-blue-900 border border-blue-700 flex items-center justify-center shadow-md`}
        style={{ minWidth: size === 'lg' ? 56 : size === 'md' ? 48 : 36 }}>
        <span className="text-blue-500 text-lg">🂠</span>
      </div>
    )
  }

  return (
    <button
      onClick={onClick}
      disabled={!onClick || disabled}
      className={`
        ${s.w} rounded-lg bg-card border shadow-md flex flex-col items-start justify-between p-1
        transition-all duration-150 select-none
        ${highlight && onClick ? 'border-gold hover:scale-110 hover:-translate-y-2 cursor-pointer ring-1 ring-gold/50' : ''}
        ${disabled ? 'opacity-40 cursor-not-allowed border-gray-400' : ''}
        ${!highlight && !disabled && onClick ? 'border-gray-300 hover:scale-105 cursor-pointer' : ''}
        ${!onClick ? 'border-gray-200 cursor-default' : ''}
      `}
      style={{ height: size === 'lg' ? 80 : size === 'md' ? 64 : 52, minWidth: size === 'lg' ? 56 : size === 'md' ? 48 : 36 }}
    >
      <div className={`${s.rank} font-bold leading-none ${red ? 'text-red-600' : 'text-gray-900'}`}>
        {card.rank}
      </div>
      <div className={`${s.suit} leading-none self-center ${red ? 'text-red-500' : 'text-gray-800'}`}>
        {SUIT_SYMBOLS[card.suit]}
      </div>
    </button>
  )
}
