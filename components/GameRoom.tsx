'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { GameState, Card, initGame, dealRound, submitBids, playCard, nextRound, SUIT_SYMBOLS, isRedSuit } from '@/lib/game'
import CardComponent from './CardComponent'
import ScoreBoard from './ScoreBoard'

interface Props {
  roomCode: string
  userId: string
  userName: string
  onLeave: () => void
}

export default function GameRoom({ roomCode, userId, userName, onLeave }: Props) {
  const [room, setRoom] = useState<any>(null)
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [myBid, setMyBid] = useState<number | null>(null)
  const [bidsRevealed, setBidsRevealed] = useState(false)
  const [allBidsIn, setAllBidsIn] = useState<Record<string, number>>({})
  const [pendingBid, setPendingBid] = useState<number | null>(null)
  const [showScores, setShowScores] = useState(false)
  const supabase = createClient()

  const isHost = room?.host_id === userId

  const fetchRoom = useCallback(async () => {
    const { data } = await supabase.from('rooms').select('*').eq('code', roomCode).single()
    if (data) {
      setRoom(data)
      if (data.state) setGameState(data.state)
    }
  }, [roomCode, supabase])

  useEffect(() => {
    fetchRoom()
    const channel = supabase
      .channel(`room:${roomCode}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `code=eq.${roomCode}` },
        (payload) => {
          setRoom(payload.new)
          if (payload.new.state) setGameState(payload.new.state)
        })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [roomCode, fetchRoom, supabase])

  async function updateState(newState: GameState) {
    setGameState(newState)
    await supabase.from('rooms').update({ state: newState }).eq('code', roomCode)
    // Save scores to leaderboard if game ends
    if (newState.phase === 'gameEnd') {
      for (const p of newState.players) {
        await supabase.from('scores').insert({
          user_id: p.id,
          player_name: p.name,
          total_score: p.totalScore,
          room_code: roomCode,
          played_at: new Date().toISOString(),
        })
      }
    }
  }

  function startGame() {
    if (!room) return
    const state = dealRound(initGame(room.players))
    updateState(state)
  }

  function submitMyBid() {
    if (pendingBid === null || !gameState) return
    const newAllBids = { ...allBidsIn, [userId]: pendingBid }
    setAllBidsIn(newAllBids)
    setMyBid(pendingBid)

    if (Object.keys(newAllBids).length === gameState.players.length) {
      const newState = submitBids(gameState, newAllBids)
      setBidsRevealed(true)
      setTimeout(() => {
        updateState(newState)
        setBidsRevealed(false)
        setAllBidsIn({})
        setMyBid(null)
        setPendingBid(null)
      }, 2500)
    } else {
      // Store bid in room's bid_staging
      supabase.from('rooms').update({ bid_staging: newAllBids }).eq('code', roomCode)
    }
  }

  useEffect(() => {
    if (!room?.bid_staging || !gameState) return
    const staging = room.bid_staging
    setAllBidsIn(staging)
    if (Object.keys(staging).length === gameState.players.length && !bidsRevealed) {
      const newState = submitBids(gameState, staging)
      setBidsRevealed(true)
      setTimeout(() => {
        updateState(newState)
        setBidsRevealed(false)
        setAllBidsIn({})
        setMyBid(null)
        setPendingBid(null)
        supabase.from('rooms').update({ bid_staging: {} }).eq('code', roomCode)
      }, 2500)
    }
  }, [room?.bid_staging])

  function handlePlayCard(card: Card) {
    if (!gameState) return
    const myPlayer = gameState.players.find(p => p.id === userId)
    if (!myPlayer) return
    const currentPlayer = gameState.players[gameState.currentPlayerIndex]
    if (currentPlayer.id !== userId) return
    const newState = playCard(gameState, userId, card)
    updateState(newState)
  }

  function handleNextRound() {
    if (!gameState) return
    const ns = nextRound(gameState)
    updateState(ns)
    setShowScores(false)
  }

  if (!room) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gold text-xl">Laster rom...</div>
      </div>
    )
  }

  const myPlayer = gameState?.players.find(p => p.id === userId)
  const currentPlayer = gameState ? gameState.players[gameState.currentPlayerIndex] : null
  const isMyTurn = currentPlayer?.id === userId
  const trumpSuit = gameState?.trump?.suit

  // Lobby (no game started)
  if (!gameState) {
    return (
      <div className="min-h-screen p-4">
        <div className="max-w-md mx-auto">
          <button onClick={onLeave} className="text-gold/70 hover:text-gold mb-4">← Lobby</button>
          <div className="bg-felt2 border border-gold/30 rounded-2xl p-6">
            <div className="text-center mb-6">
              <p className="text-green-400 text-sm">Romkode</p>
              <p className="text-4xl font-mono font-bold text-gold tracking-widest">{roomCode}</p>
              <p className="text-green-500 text-xs mt-1">Del denne koden med venner</p>
            </div>
            <h3 className="text-gold text-sm font-semibold mb-3">Spillere ({room.players?.length}/5)</h3>
            <ul className="space-y-2 mb-6">
              {room.players?.map((p: any) => (
                <li key={p.id} className="flex items-center gap-2 bg-felt rounded-lg px-3 py-2">
                  <span className="text-gold">♠</span>
                  <span className="text-card text-sm">{p.name}</span>
                  {p.id === room.host_id && <span className="text-xs text-gold/60 ml-auto">vertskap</span>}
                </li>
              ))}
            </ul>
            {isHost ? (
              <button
                onClick={startGame}
                disabled={!room.players || room.players.length < 2}
                className="w-full bg-gold hover:bg-gold2 disabled:opacity-40 text-felt font-bold py-3 rounded-xl transition-all">
                Start spill ({room.players?.length} spillere)
              </button>
            ) : (
              <p className="text-center text-green-500 text-sm">Venter på at verten starter spillet...</p>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (gameState.phase === 'gameEnd') {
    const sorted = [...gameState.players].sort((a, b) => b.totalScore - a.totalScore)
    return (
      <div className="min-h-screen p-4">
        <div className="max-w-md mx-auto">
          <div className="text-center py-8">
            <div className="text-5xl mb-2">🏆</div>
            <h2 className="text-3xl font-display text-gold">Spillet er over!</h2>
            <p className="text-gold/70 text-lg mt-1">Vinner: {sorted[0].name}</p>
          </div>
          <div className="bg-felt2 border border-gold/30 rounded-2xl p-4 mb-4">
            {sorted.map((p, i) => (
              <div key={p.id} className="flex items-center py-2 border-b border-green-900 last:border-0">
                <span className="text-gold font-bold w-8">{i + 1}.</span>
                <span className="flex-1 text-card">{p.name}</span>
                <span className="text-gold font-mono font-bold">{p.totalScore} p</span>
              </div>
            ))}
          </div>
          <button onClick={onLeave} className="w-full border border-gold/40 hover:border-gold text-gold py-3 rounded-xl">
            Tilbake til lobby
          </button>
        </div>
      </div>
    )
  }

  if (gameState.phase === 'roundEnd' || showScores) {
    return (
      <div className="min-h-screen p-4">
        <div className="max-w-md mx-auto">
          <ScoreBoard gameState={gameState} />
          {isHost && (
            <button onClick={handleNextRound}
              className="w-full bg-gold hover:bg-gold2 text-felt font-bold py-3 rounded-xl mt-4 transition-all">
              Neste runde ({gameState.round - 1} kort) →
            </button>
          )}
          {!isHost && <p className="text-center text-green-500 text-sm mt-4">Venter på at verten starter neste runde...</p>}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <div className="bg-felt2 border-b border-gold/20 px-4 py-3 flex items-center justify-between">
        <div>
          <span className="text-gold font-mono font-bold">{roomCode}</span>
          <span className="text-green-500 text-sm ml-2">· Runde {gameState.round} kort</span>
        </div>
        {trumpSuit && (
          <div className="flex items-center gap-1">
            <span className="text-green-400 text-xs">Trumf:</span>
            <span className={`text-xl ${isRedSuit(trumpSuit) ? 'text-red-400' : 'text-card'}`}>
              {SUIT_SYMBOLS[trumpSuit]}
            </span>
          </div>
        )}
        <button onClick={() => setShowScores(true)} className="text-gold/60 hover:text-gold text-xs">Poeng</button>
      </div>

      {/* Other players */}
      <div className="px-4 py-3 flex gap-2 overflow-x-auto border-b border-green-900">
        {gameState.players.filter(p => p.id !== userId).map(p => (
          <div key={p.id} className={`flex-shrink-0 bg-felt2 rounded-xl px-3 py-2 border ${currentPlayer?.id === p.id ? 'border-gold pulse-gold' : 'border-green-900'}`}>
            <p className="text-card text-xs font-semibold">{p.name}</p>
            <p className="text-green-400 text-xs">{p.hand.length} kort · {p.bid !== null ? `meldt ${p.bid}` : '...'} · {p.tricks} stikk</p>
            <p className="text-gold text-xs font-mono">{p.totalScore} p</p>
          </div>
        ))}
      </div>

      {/* Current trick */}
      <div className="flex-1 flex flex-col items-center justify-center py-4 px-4">
        {gameState.currentTrick.length > 0 && (
          <div className="mb-4">
            <p className="text-green-500 text-xs text-center mb-2">Stikk pågår</p>
            <div className="flex gap-2 justify-center">
              {gameState.currentTrick.map(({ playerId, card }) => {
                const player = gameState.players.find(p => p.id === playerId)
                return (
                  <div key={playerId} className="text-center">
                    <CardComponent card={card} size="md" />
                    <p className="text-green-400 text-xs mt-1">{player?.name?.split(' ')[0]}</p>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Bidding phase */}
        {gameState.phase === 'bidding' && (
          <div className="w-full max-w-sm bg-felt2 border border-gold/30 rounded-2xl p-4">
            {gameState.unseenBid && (
              <div className="bg-amber-900/30 border border-amber-700/50 rounded-lg px-3 py-2 mb-3">
                <p className="text-amber-400 text-sm text-center font-semibold">🙈 By uten å se kortene!</p>
              </div>
            )}
            <p className="text-gold text-sm font-semibold text-center mb-3">Meld stikk</p>
            <div className="flex flex-wrap gap-2 justify-center mb-4">
              {Array.from({ length: gameState.round + 1 }, (_, i) => i).map(n => (
                <button key={n} onClick={() => setPendingBid(n)}
                  className={`w-12 h-12 rounded-xl font-bold text-lg transition-all ${pendingBid === n ? 'bg-gold text-felt scale-110' : 'bg-felt border border-gold/30 text-gold hover:border-gold'}`}>
                  {n}
                </button>
              ))}
            </div>
            {myBid !== null ? (
              <p className="text-center text-green-400 text-sm">
                Du meldte {myBid} · Venter på andre ({Object.keys(allBidsIn).length}/{gameState.players.length})
              </p>
            ) : (
              <button onClick={submitMyBid} disabled={pendingBid === null}
                className="w-full bg-gold hover:bg-gold2 disabled:opacity-40 text-felt font-bold py-3 rounded-xl transition-all">
                Meld {pendingBid !== null ? pendingBid : '?'} stikk
              </button>
            )}
            {bidsRevealed && (
              <div className="mt-3 text-center">
                <p className="text-gold font-semibold">🎴 Alle har meldt!</p>
                {Object.entries(allBidsIn).map(([pid, bid]) => {
                  const p = gameState.players.find(pl => pl.id === pid)
                  return <p key={pid} className="text-green-300 text-sm">{p?.name}: {bid} stikk</p>
                })}
              </div>
            )}
          </div>
        )}

        {gameState.phase === 'playing' && !isMyTurn && (
          <div className="text-center">
            <p className="text-green-400 text-sm">
              {currentPlayer?.name} spiller...
            </p>
            <div className="mt-2 text-xs text-green-600">
              {myPlayer?.bid !== null && `Du meldte ${myPlayer?.bid} · Tatt ${myPlayer?.tricks} stikk`}
            </div>
          </div>
        )}

        {gameState.phase === 'playing' && isMyTurn && gameState.currentTrick.length === 0 && (
          <p className="text-gold text-sm animate-pulse mb-2">Din tur – velg et kort å lede med</p>
        )}
        {gameState.phase === 'playing' && isMyTurn && gameState.currentTrick.length > 0 && (
          <p className="text-gold text-sm animate-pulse mb-2">Din tur</p>
        )}
      </div>

      {/* My hand */}
      <div className="bg-felt2 border-t border-green-900 px-4 py-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-green-500 text-xs">
            {myPlayer?.bid !== null
              ? `Meldt: ${myPlayer.bid} · Tatt: ${myPlayer?.tricks}`
              : 'Din hånd'}
          </p>
          <p className="text-gold text-xs font-mono">{myPlayer?.totalScore} p</p>
        </div>
        <div className="flex gap-1 flex-wrap justify-center">
          {myPlayer?.hand.map((card, i) => {
            const canPlay = gameState.phase === 'playing' && isMyTurn
            const mustFollowSuit = gameState.leadSuit && myPlayer.hand.some(c => c.suit === gameState.leadSuit)
            const isPlayable = canPlay && (!mustFollowSuit || card.suit === gameState.leadSuit)
            return (
              <div key={`${card.suit}${card.rank}`} style={{ animationDelay: `${i * 30}ms` }} className="card-deal">
                <CardComponent
                  card={card}
                  size="lg"
                  onClick={isPlayable ? () => handlePlayCard(card) : undefined}
                  disabled={canPlay && !isPlayable}
                  highlight={isPlayable}
                />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
