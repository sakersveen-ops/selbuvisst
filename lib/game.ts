export type Suit = 'S' | 'H' | 'D' | 'C'
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A'

export interface Card { suit: Suit; rank: Rank }

export interface Player {
  id: string; name: string; hand: Card[]
  bid: number | null; tricks: number; score: number; totalScore: number
}

export interface GameState {
  players: Player[]
  round: number          // current round (counts DOWN from startRound to 1)
  startRound: number     // max cards e.g. 10
  minRound: number       // last round (always 1)
  trump: Card | null
  currentTrick: { playerId: string; card: Card }[]
  leadSuit: Suit | null
  currentPlayerIndex: number
  phase: 'bidding' | 'playing' | 'roundEnd' | 'gameEnd'
  unseenBid: boolean
  scores: { [playerId: string]: number[] }
  roomCode: string
}

const SUITS: Suit[] = ['S', 'H', 'D', 'C']
const RANKS: Rank[] = ['2','3','4','5','6','7','8','9','10','J','Q','K','A']

export const SUIT_SYMBOLS: Record<Suit, string> = { S:'♠', H:'♥', D:'♦', C:'♣' }
export const SUIT_NAMES:   Record<Suit, string> = { S:'Spar', H:'Hjerter', D:'Ruter', C:'Kløver' }

export function isRedSuit(suit: Suit) { return suit === 'H' || suit === 'D' }

export function createDeck(): Card[] {
  return SUITS.flatMap(suit => RANKS.map(rank => ({ suit, rank })))
}

export function shuffle(deck: Card[]): Card[] {
  const d = [...deck]
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]]
  }
  return d
}

export function rankValue(rank: Rank): number { return RANKS.indexOf(rank) }

export function cardBeats(challenger: Card, incumbent: Card, trump: Suit | null, leadSuit: Suit): boolean {
  if (challenger.suit === trump && incumbent.suit !== trump) return true
  if (incumbent.suit === trump && challenger.suit !== trump) return false
  if (challenger.suit !== leadSuit && incumbent.suit !== trump) return false
  if (challenger.suit !== incumbent.suit) return false
  return rankValue(challenger.rank) > rankValue(incumbent.rank)
}

export function calcScore(bid: number, tricks: number): number {
  return bid === tricks ? 10 + bid : 0
}

export function initGame(
  players: { id: string; name: string }[],
  startRound: number,
  roomCode: string
): GameState {
  return {
    players: players.map(p => ({ ...p, hand: [], bid: null, tricks: 0, score: 0, totalScore: 0 })),
    round: startRound,
    startRound,
    minRound: 1,
    trump: null,
    currentTrick: [],
    leadSuit: null,
    currentPlayerIndex: 0,
    phase: 'bidding',
    unseenBid: false,
    scores: Object.fromEntries(players.map(p => [p.id, []])),
    roomCode,
  }
}

export function dealRound(state: GameState): GameState {
  const deck = shuffle(createDeck())
  const n = state.players.length
  const cpp = state.round
  const newPlayers = state.players.map((p, i) => ({
    ...p,
    hand: deck.slice(i * cpp, (i + 1) * cpp),
    bid: null,
    tricks: 0,
  }))
  const trumpCard = deck[n * cpp] || null
  return {
    ...state,
    players: newPlayers,
    trump: trumpCard,
    currentTrick: [],
    leadSuit: null,
    phase: 'bidding',
    unseenBid: state.round === state.minRound,
  }
}

export function submitBids(state: GameState, bids: Record<string, number>): GameState {
  const newPlayers = state.players.map(p => ({ ...p, bid: bids[p.id] ?? p.bid }))
  const highestBidder = [...newPlayers].sort((a, b) => (b.bid ?? 0) - (a.bid ?? 0))[0]
  const startIdx = newPlayers.findIndex(p => p.id === highestBidder.id)
  return { ...state, players: newPlayers, currentPlayerIndex: startIdx, phase: 'playing', currentTrick: [], leadSuit: null }
}

export function playCard(state: GameState, playerId: string, card: Card): GameState {
  const player = state.players.find(p => p.id === playerId)!
  const newHand = player.hand.filter(c => !(c.suit === card.suit && c.rank === card.rank))
  const newPlayers = state.players.map(p => p.id === playerId ? { ...p, hand: newHand } : p)
  const newTrick = [...state.currentTrick, { playerId, card }]
  const leadSuit = state.currentTrick.length === 0 ? card.suit : state.leadSuit

  if (newTrick.length < state.players.length) {
    return { ...state, players: newPlayers, currentTrick: newTrick, leadSuit, currentPlayerIndex: (state.currentPlayerIndex + 1) % state.players.length }
  }

  const trump = state.trump?.suit ?? null
  let winner = newTrick[0]
  for (const play of newTrick.slice(1)) {
    if (cardBeats(play.card, winner.card, trump, leadSuit!)) winner = play
  }
  const resolvedPlayers = newPlayers.map(p => p.id === winner.playerId ? { ...p, tricks: p.tricks + 1 } : p)
  const winnerIdx = resolvedPlayers.findIndex(p => p.id === winner.playerId)

  if (resolvedPlayers[0].hand.length === 0) {
    const scoredPlayers = resolvedPlayers.map(p => {
      const earned = calcScore(p.bid ?? 0, p.tricks)
      return { ...p, score: earned, totalScore: p.totalScore + earned }
    })
    const newScores = { ...state.scores }
    for (const p of scoredPlayers) newScores[p.id] = [...(newScores[p.id] ?? []), p.score]
    const isGameEnd = state.round === state.minRound
    return { ...state, players: scoredPlayers, currentTrick: [], leadSuit: null, phase: isGameEnd ? 'gameEnd' : 'roundEnd', scores: newScores }
  }

  return { ...state, players: resolvedPlayers, currentTrick: [], leadSuit: null, currentPlayerIndex: winnerIdx }
}

export function nextRound(state: GameState): GameState {
  const next = state.round - 1
  if (next < state.minRound) return { ...state, phase: 'gameEnd' }
  return dealRound({ ...state, round: next })
}

// How many rounds remain (including current)
export function roundsPlayed(state: GameState): number {
  return state.startRound - state.round + 1
}
export function totalRounds(state: GameState): number {
  return state.startRound - state.minRound + 1
}
