'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { GameState, Card, initGame, dealRound, submitBids, playCard, nextRound, SUIT_SYMBOLS, isRedSuit } from '@/lib/game'
import CardComponent from './CardComponent'
import ScoreBoard from './ScoreBoard'

interface Props { roomCode: string; userId: string; userName: string; onLeave: () => void }

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
    if (data) { setRoom(data); if (data.state) setGameState(data.state) }
  }, [roomCode, supabase])

  useEffect(() => {
    fetchRoom()
    const channel = supabase.channel(`room:${roomCode}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `code=eq.${roomCode}` }, (payload) => {
        setRoom(payload.new); if (payload.new.state) setGameState(payload.new.state)
      }).subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [roomCode, fetchRoom, supabase])

  async function updateState(newState: GameState) {
    setGameState(newState)
    await supabase.from('rooms').update({ state: newState }).eq('code', roomCode)
    if (newState.phase === 'gameEnd') {
      for (const p of newState.players) {
        await supabase.from('scores').insert({ user_id: p.id, player_name: p.name, total_score: p.totalScore, room_code: roomCode, played_at: new Date().toISOString() })
      }
    }
  }

  function startGame() {
    if (!room) return
    updateState(dealRound(initGame(room.players)))
  }

  async function submitMyBid() {
    if (pendingBid === null || !gameState) return
    const newAllBids = { ...allBidsIn, [userId]: pendingBid }
    setAllBidsIn(newAllBids); setMyBid(pendingBid)
    if (Object.keys(newAllBids).length === gameState.players.length) {
      const newState = submitBids(gameState, newAllBids)
      setBidsRevealed(true)
      setTimeout(() => { updateState(newState); setBidsRevealed(false); setAllBidsIn({}); setMyBid(null); setPendingBid(null) }, 2800)
    } else {
      await supabase.from('rooms').update({ bid_staging: newAllBids }).eq('code', roomCode)
    }
  }

  useEffect(() => {
    if (!room?.bid_staging || !gameState) return
    const staging = room.bid_staging
    setAllBidsIn(staging)
    if (Object.keys(staging).length === gameState.players.length && !bidsRevealed) {
      const newState = submitBids(gameState, staging)
      setBidsRevealed(true)
      setTimeout(() => { updateState(newState); setBidsRevealed(false); setAllBidsIn({}); setMyBid(null); setPendingBid(null); supabase.from('rooms').update({ bid_staging: {} }).eq('code', roomCode) }, 2800)
    }
  }, [room?.bid_staging])

  function handlePlayCard(card: Card) {
    if (!gameState) return
    const currentPlayer = gameState.players[gameState.currentPlayerIndex]
    if (currentPlayer.id !== userId) return
    updateState(playCard(gameState, userId, card))
  }

  function handleNextRound() {
    if (!gameState) return
    updateState(nextRound(gameState)); setShowScores(false)
  }

  if (!room) return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div className="orb orb-1" />
      <div className="font-display text-gold" style={{fontSize:32,position:'relative',zIndex:1}}>Laster rom...</div>
    </div>
  )

  const myPlayer = gameState?.players.find(p => p.id === userId)
  const currentPlayer = gameState ? gameState.players[gameState.currentPlayerIndex] : null
  const isMyTurn = currentPlayer?.id === userId
  const trumpSuit = gameState?.trump?.suit

  // ── LOBBY ──
  if (!gameState) return (
    <div style={{minHeight:'100vh',padding:16,position:'relative'}}>
      <div className="orb orb-1" /><div className="orb orb-2" />
      <div style={{maxWidth:420,margin:'0 auto',position:'relative',zIndex:1}}>
        <button onClick={onLeave} className="btn-glass" style={{padding:'8px 18px',fontSize:13,marginBottom:20}}>← Tilbake</button>
        <div className="glass float-in" style={{padding:28}}>
          <div style={{textAlign:'center',marginBottom:24}}>
            <p className="text-muted" style={{fontSize:11,letterSpacing:'0.2em',textTransform:'uppercase',marginBottom:6}}>Romkode</p>
            <div className="font-display text-gold" style={{fontSize:64,letterSpacing:'0.15em',lineHeight:1,textShadow:'0 4px 24px rgba(245,200,66,0.5)'}}>{roomCode}</div>
            <p className="text-muted" style={{fontSize:12,marginTop:6}}>Del denne koden med venner</p>
          </div>

          <p className="text-gold" style={{fontSize:11,fontWeight:600,letterSpacing:'0.15em',textTransform:'uppercase',marginBottom:12}}>
            Spillere ({room.players?.length}/5)
          </p>
          <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:20}}>
            {room.players?.map((p: any, i: number) => (
              <div key={p.id} className="player-chip" style={{padding:'10px 14px',display:'flex',alignItems:'center',gap:10,animationDelay:`${i*80}ms`}} >
                <div style={{width:32,height:32,borderRadius:'50%',background:'linear-gradient(135deg,var(--purple-bright),var(--purple-mid))',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,flexShrink:0}}>
                  {p.name.charAt(0).toUpperCase()}
                </div>
                <span className="text-cream" style={{fontSize:14}}>{p.name}</span>
                {p.id === room.host_id && <span className="text-gold" style={{fontSize:11,marginLeft:'auto',opacity:0.7}}>vertskap</span>}
              </div>
            ))}
          </div>

          {isHost ? (
            <button onClick={startGame} disabled={!room.players || room.players.length < 2} className="btn-gold" style={{width:'100%',padding:16,fontSize:16}}>
              Start spill →
            </button>
          ) : (
            <p className="text-muted" style={{textAlign:'center',fontSize:13}}>Venter på at verten starter...</p>
          )}
        </div>
      </div>
    </div>
  )

  // ── GAME END ──
  if (gameState.phase === 'gameEnd') {
    const sorted = [...gameState.players].sort((a, b) => b.totalScore - a.totalScore)
    return (
      <div style={{minHeight:'100vh',padding:16,position:'relative'}}>
        <div className="orb orb-1" /><div className="orb orb-2" />
        <div style={{maxWidth:420,margin:'0 auto',position:'relative',zIndex:1,paddingTop:40}}>
          <div style={{textAlign:'center',marginBottom:28}}>
            <div style={{fontSize:64,marginBottom:8}}>🏆</div>
            <div className="font-display text-gold" style={{fontSize:44}}>SPILLET ER OVER</div>
            <p className="text-gold-light" style={{fontSize:18,marginTop:4}}>Vinner: {sorted[0].name}</p>
          </div>
          <div className="glass float-in" style={{padding:20,marginBottom:12}}>
            {sorted.map((p, i) => (
              <div key={p.id} style={{display:'flex',alignItems:'center',padding:'12px 0',borderBottom: i<sorted.length-1 ? '1px solid rgba(255,255,255,0.08)' : 'none'}}>
                <span className="font-display text-gold" style={{fontSize:28,width:36}}>{i+1}</span>
                <div style={{width:36,height:36,borderRadius:'50%',background:'linear-gradient(135deg,var(--purple-bright),var(--purple-mid))',display:'flex',alignItems:'center',justifyContent:'center',marginRight:12,flexShrink:0}}>
                  {p.name.charAt(0).toUpperCase()}
                </div>
                <span className="text-cream" style={{flex:1,fontSize:15}}>{p.name}</span>
                <span className="font-display text-gold" style={{fontSize:28}}>{p.totalScore}</span>
              </div>
            ))}
          </div>
          <button onClick={onLeave} className="btn-glass" style={{width:'100%',padding:14}}>Tilbake til lobby</button>
        </div>
      </div>
    )
  }

  // ── ROUND END / SCORES ──
  if (gameState.phase === 'roundEnd' || showScores) return (
    <div style={{minHeight:'100vh',padding:16,position:'relative'}}>
      <div className="orb orb-1" /><div className="orb orb-2" />
      <div style={{maxWidth:480,margin:'0 auto',position:'relative',zIndex:1,paddingTop:20}}>
        <ScoreBoard gameState={gameState} />
        <div style={{marginTop:12}}>
          {isHost ? (
            <button onClick={handleNextRound} className="btn-gold" style={{width:'100%',padding:16,fontSize:16}}>
              Neste runde — {gameState.round - 1} kort →
            </button>
          ) : (
            <p className="text-muted" style={{textAlign:'center',fontSize:13}}>Venter på at verten starter neste runde...</p>
          )}
        </div>
      </div>
    </div>
  )

  // ── MAIN GAME ──
  return (
    <div style={{minHeight:'100vh',display:'flex',flexDirection:'column',position:'relative'}}>
      <div className="orb orb-2" style={{opacity:0.3}} />

      {/* Header */}
      <div style={{background:'rgba(0,0,0,0.3)',backdropFilter:'blur(20px)',borderBottom:'1px solid rgba(255,255,255,0.08)',padding:'12px 16px',display:'flex',alignItems:'center',justifyContent:'space-between',position:'relative',zIndex:2}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <button onClick={onLeave} style={{background:'none',border:'none',color:'rgba(255,248,231,0.4)',cursor:'pointer',fontSize:16,padding:0}}>←</button>
          <div>
            <span className="font-display text-gold" style={{fontSize:22,letterSpacing:'0.1em'}}>{roomCode}</span>
            <span className="text-muted" style={{fontSize:12,marginLeft:8}}>Runde {gameState.round} kort</span>
          </div>
        </div>
        {trumpSuit && (
          <div className="trump-badge" style={{display:'flex',alignItems:'center',gap:6}}>
            <span className="text-muted" style={{fontSize:11}}>TRUMF</span>
            <span style={{fontSize:22, color: isRedSuit(trumpSuit) ? '#e05252' : 'var(--cream)'}}>{SUIT_SYMBOLS[trumpSuit]}</span>
          </div>
        )}
        <button onClick={() => setShowScores(true)} className="btn-glass" style={{padding:'6px 14px',fontSize:12}}>Poeng</button>
      </div>

      {/* Opponents */}
      <div style={{padding:'12px 12px 0',display:'flex',gap:8,overflowX:'auto',position:'relative',zIndex:1}}>
        {gameState.players.filter(p => p.id !== userId).map(p => (
          <div key={p.id} className={`player-chip ${currentPlayer?.id === p.id ? 'active' : ''}`} style={{padding:'10px 14px',flexShrink:0,minWidth:140}}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
              <div style={{width:28,height:28,borderRadius:'50%',background:'linear-gradient(135deg,var(--purple-bright),var(--purple-mid))',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,flexShrink:0}}>
                {p.name.charAt(0).toUpperCase()}
              </div>
              <span className="text-cream" style={{fontSize:13,fontWeight:500}}>{p.name.split(' ')[0]}</span>
              {currentPlayer?.id === p.id && <span style={{fontSize:10,color:'var(--gold)',marginLeft:'auto'}}>↻</span>}
            </div>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:12}}>
              <span className="text-muted">{p.hand.length}🃏 · {p.bid !== null ? `meldt ${p.bid}` : '...'} · ${p.tricks} stikk</span>
              <span className="font-display text-gold" style={{fontSize:16}}>{p.totalScore}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Table / center */}
      <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'16px',position:'relative',zIndex:1}}>

        {/* Current trick */}
        {gameState.currentTrick.length > 0 && (
          <div style={{marginBottom:16,textAlign:'center'}}>
            <p className="text-muted" style={{fontSize:11,letterSpacing:'0.15em',textTransform:'uppercase',marginBottom:10}}>Stikk pågår</p>
            <div style={{display:'flex',gap:10,justifyContent:'center'}}>
              {gameState.currentTrick.map(({ playerId, card }) => {
                const player = gameState.players.find(p => p.id === playerId)
                return (
                  <div key={playerId} style={{textAlign:'center'}}>
                    <CardComponent card={card} size="md" />
                    <p className="text-muted" style={{fontSize:11,marginTop:4}}>{player?.name?.split(' ')[0]}</p>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Bidding phase */}
        {gameState.phase === 'bidding' && (
          <div className="glass float-in" style={{padding:24,width:'100%',maxWidth:380}}>
            {gameState.unseenBid && (
              <div style={{background:'rgba(245,200,66,0.1)',border:'1px solid rgba(245,200,66,0.3)',borderRadius:12,padding:'10px 16px',marginBottom:16,textAlign:'center'}}>
                <span style={{fontSize:16}}>🙈</span>
                <span className="text-gold" style={{fontSize:13,fontWeight:600,marginLeft:8}}>By uten å se kortene!</span>
              </div>
            )}
            <p className="text-gold" style={{textAlign:'center',fontSize:13,fontWeight:600,letterSpacing:'0.15em',textTransform:'uppercase',marginBottom:16}}>Meld antall stikk</p>
            <div style={{display:'flex',flexWrap:'wrap',gap:8,justifyContent:'center',marginBottom:16}}>
              {Array.from({length: gameState.round + 1}, (_, i) => i).map(n => (
                <button key={n} onClick={() => setPendingBid(n)}
                  className={`bid-btn${pendingBid === n ? ' selected' : ''}`}>
                  {n}
                </button>
              ))}
            </div>
            {myBid !== null ? (
              <div style={{textAlign:'center'}}>
                <p className="text-gold" style={{fontSize:14,marginBottom:6}}>Du meldte <strong>{myBid}</strong></p>
                <p className="text-muted" style={{fontSize:12}}>Venter... ({Object.keys(allBidsIn).length}/{gameState.players.length})</p>
                <div style={{display:'flex',justifyContent:'center',gap:6,marginTop:8}}>
                  {gameState.players.map(p => (
                    <div key={p.id} style={{width:8,height:8,borderRadius:'50%',background: allBidsIn[p.id] !== undefined ? 'var(--gold)' : 'rgba(255,255,255,0.2)',transition:'background 0.3s'}} />
                  ))}
                </div>
              </div>
            ) : (
              <button onClick={submitMyBid} disabled={pendingBid === null} className="btn-gold" style={{width:'100%',padding:14}}>
                Meld {pendingBid !== null ? pendingBid : '?'} stikk
              </button>
            )}
            {bidsRevealed && (
              <div style={{marginTop:16,padding:16,background:'rgba(245,200,66,0.08)',borderRadius:12,border:'1px solid rgba(245,200,66,0.2)'}}>
                <p className="text-gold" style={{textAlign:'center',fontWeight:600,marginBottom:8}}>🎴 Alle har meldt!</p>
                {Object.entries(allBidsIn).map(([pid, bid]) => {
                  const p = gameState.players.find(pl => pl.id === pid)
                  return <p key={pid} className="text-muted" style={{fontSize:13,textAlign:'center'}}>{p?.name}: <strong className="text-gold">{bid}</strong></p>
                })}
              </div>
            )}
          </div>
        )}

        {gameState.phase === 'playing' && !isMyTurn && (
          <div style={{textAlign:'center'}}>
            <div className="glass-sm" style={{display:'inline-block',padding:'12px 24px',background:'rgba(0,0,0,0.2)'}}>
              <p className="text-muted" style={{fontSize:13}}>{currentPlayer?.name} spiller...</p>
            </div>
            {myPlayer?.bid !== null && (
              <p className="text-muted" style={{fontSize:12,marginTop:8}}>Du meldte {myPlayer?.bid} · Tatt {myPlayer?.tricks} stikk</p>
            )}
          </div>
        )}

        {gameState.phase === 'playing' && isMyTurn && (
          <div className="glass-sm" style={{padding:'10px 20px',background:'rgba(245,200,66,0.08)',border:'1px solid rgba(245,200,66,0.25)',marginBottom:8}}>
            <p className="text-gold" style={{fontSize:13,fontWeight:600,textAlign:'center'}}>
              {gameState.currentTrick.length === 0 ? '⭐ Din tur — velg kort å lede med' : '⭐ Din tur'}
            </p>
          </div>
        )}
      </div>

      {/* My hand */}
      <div style={{background:'rgba(0,0,0,0.35)',backdropFilter:'blur(20px)',borderTop:'1px solid rgba(255,255,255,0.08)',padding:'14px 12px 20px',position:'relative',zIndex:2}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10,padding:'0 4px'}}>
          <p className="text-muted" style={{fontSize:12}}>
            {myPlayer?.bid !== null ? `Meldt: ${myPlayer?.bid} · Tatt: ${myPlayer?.tricks}` : 'Din hånd'}
          </p>
          <span className="font-display text-gold" style={{fontSize:22}}>{myPlayer?.totalScore}</span>
        </div>
        <div style={{display:'flex',gap:4,flexWrap:'wrap',justifyContent:'center'}}>
          {myPlayer?.hand.map((card, i) => {
            const canPlay = gameState.phase === 'playing' && isMyTurn
            const mustFollow = gameState.leadSuit && myPlayer.hand.some(c => c.suit === gameState.leadSuit)
            const isPlayable = canPlay && (!mustFollow || card.suit === gameState.leadSuit)
            return (
              <CardComponent
                key={`${card.suit}${card.rank}${i}`}
                card={card} size="lg"
                onClick={isPlayable ? () => handlePlayCard(card) : undefined}
                disabled={canPlay && !isPlayable}
                highlight={isPlayable}
                dealDelay={i * 40}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}
