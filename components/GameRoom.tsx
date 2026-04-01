'use client'
import { useEffect, useState, useCallback, useRef } from 'react'

// ── QR code rendered via QRious CDN lib ──────────────────────────────────────
function QRCodeDisplay({ url }: { url: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!ref.current) return
    ref.current.innerHTML = ''
    const render = () => {
      const canvas = document.createElement('canvas')
      ref.current!.appendChild(canvas)
      // @ts-ignore
      new window.QRious({ element: canvas, value: url, size: 140, backgroundAlpha: 0, foreground: '#16165a', level: 'M' })
    }
    if ((window as any).QRious) {
      render()
    } else {
      const s = document.createElement('script')
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrious/4.0.2/qrious.min.js'
      s.onload = render
      document.head.appendChild(s)
    }
    return () => { if (ref.current) ref.current.innerHTML = '' }
  }, [url])
  return (
    <div ref={ref} style={{
      background:'#fffef5', borderRadius:12, padding:10, display:'inline-flex',
      alignItems:'center', justifyContent:'center',
      boxShadow:'0 4px 20px rgba(0,0,0,0.3)'
    }} />
  )
}
import { createClient } from '@/lib/supabase'
import { GameState, Card, initGame, dealRound, submitBids, playCard, nextRound, drawTrump, SUIT_SYMBOLS, isRedSuit, totalRounds, roundsPlayed, rankValue } from '@/lib/game'
import CardComponent from './CardComponent'
import ScoreBoard from './ScoreBoard'
import RoomLeaderboard from './RoomLeaderboard'

interface Props { roomCode: string; userId: string; userName: string; onLeave: () => void; isGuest?: boolean; qrUrl?: string }

export default function GameRoom({ roomCode, userId, userName, onLeave, isGuest, qrUrl }: Props) {
  const [room, setRoom] = useState<any>(null)
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [myBid, setMyBid] = useState<number | null>(null)
  const [bidsRevealed, setBidsRevealed] = useState(false)
  const [allBidsIn, setAllBidsIn] = useState<Record<string, number>>({})
  const [pendingBid, setPendingBid] = useState<number | null>(null)
  const [sidePanel, setSidePanel] = useState<'none' | 'roundScores' | 'roomBoard' | 'globalBoard'>('none')
  const [showLastTrick, setShowLastTrick] = useState(false)
  const [trickJustResolved, setTrickJustResolved] = useState(false)
  // Lobby settings (host only)
  const [maxPlayers, setMaxPlayers] = useState(4)
  const [maxRounds, setMaxRounds] = useState(10)
  const [spectatorMode, setSpectatorMode] = useState(false)
  const [spectateTarget, setSpectateTarget] = useState<string | null>(null) // which player to focus
  const supabase = createClient()
  const isHost = room?.host_id === userId

  const fetchRoom = useCallback(async () => {
    const { data } = await supabase.from('rooms').select('*').eq('code', roomCode).single()
    if (data) {
      setRoom(data)
      if (data.state) setGameState(data.state)
      if (data.max_players) setMaxPlayers(data.max_players)
      if (data.max_rounds) setMaxRounds(data.max_rounds)
    }
  }, [roomCode, supabase])

  useEffect(() => {
    fetchRoom()
    const ch = supabase.channel(`room:${roomCode}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `code=eq.${roomCode}` }, payload => {
        setRoom(payload.new)
        if (payload.new.state) setGameState(payload.new.state)
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
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

  async function updateLobbySettings(mp: number, mr: number) {
    await supabase.from('rooms').update({ max_players: mp, max_rounds: mr }).eq('code', roomCode)
  }

  function startGame() {
    if (!room) return
    const activePlayers = spectatorMode
      ? room.players.filter((p: any) => p.id !== userId)
      : room.players
    const state = dealRound(initGame(activePlayers, maxRounds, roomCode))
    updateState(state)
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
      const ns = submitBids(gameState, staging)
      setBidsRevealed(true)
      setTimeout(() => {
        updateState(ns); setBidsRevealed(false); setAllBidsIn({}); setMyBid(null); setPendingBid(null)
        supabase.from('rooms').update({ bid_staging: {} }).eq('code', roomCode)
      }, 2800)
    }
  }, [room?.bid_staging])

  function handlePlayCard(card: Card) {
    if (!gameState) return
    if (gameState.players[gameState.currentPlayerIndex].id !== userId) return
    const newState = playCard(gameState, userId, card)
    // If trick just completed (currentTrick went from full → empty), linger 2.5s
    const trickCompleted = newState.currentTrick.length === 0 && gameState.currentTrick.length === gameState.players.length - 1
    if (trickCompleted && newState.phase === 'playing') {
      setTrickJustResolved(true)
      setGameState(newState)
      setTimeout(async () => {
        setTrickJustResolved(false)
        await supabase.from('rooms').update({ state: newState }).eq('code', roomCode)
      }, 2500)
    } else {
      updateState(newState)
    }
  }

  function handleNextRound() {
    if (!gameState) return
    updateState(nextRound(gameState)); setSidePanel('none')
  }

  function handleDrawTrump() {
    if (!gameState || !isHost) return
    updateState(drawTrump(gameState))
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

  // ── LOBBY ──────────────────────────────────────────────────────────────────
  if (!gameState) {
    const players = room.players || []
    const isFull = players.length >= maxPlayers
    return (
      <div style={{minHeight:'100vh',padding:16,position:'relative'}}>
        <div className="orb orb-1" /><div className="orb orb-2" />
        <div style={{maxWidth:460,margin:'0 auto',position:'relative',zIndex:1}}>
          <button onClick={onLeave} className="btn-glass" style={{padding:'8px 18px',fontSize:13,marginBottom:20}}>← Lobby</button>

          {/* Room code hero */}
          <div className="glass float-in" style={{padding:28,marginBottom:12}}>
            <div style={{textAlign:'center',marginBottom:24}}>
              <p className="text-muted" style={{fontSize:11,letterSpacing:'0.2em',textTransform:'uppercase',marginBottom:6}}>Romkode</p>
              <div className="font-display text-gold" style={{fontSize:64,letterSpacing:'0.15em',lineHeight:1,textShadow:'0 4px 24px rgba(245,200,66,0.5)'}}>{roomCode}</div>
              <p className="text-muted" style={{fontSize:12,marginTop:6}}>Del koden eller QR-koden</p>
              {qrUrl && (
                <div style={{marginTop:16,display:'flex',flexDirection:'column',alignItems:'center',gap:8}}>
                  <QRCodeDisplay url={qrUrl} />
                  <p className="text-muted" style={{fontSize:10}}>Skann for å bli med</p>
                </div>
              )}
            </div>

            {/* Host settings */}
            {isHost && (
              <div style={{background:'rgba(245,200,66,0.06)',border:'1px solid rgba(245,200,66,0.2)',borderRadius:14,padding:16,marginBottom:20}}>
                <p className="text-gold" style={{fontSize:11,fontWeight:600,letterSpacing:'0.15em',textTransform:'uppercase',marginBottom:14}}>Spillinnstillinger</p>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
                  {/* Max players */}
                  <div>
                    <p className="text-muted" style={{fontSize:12,marginBottom:8}}>Maks spillere</p>
                    <div style={{display:'flex',gap:4}}>
                      {[2,3,4,5].map(n => (
                        <button key={n} onClick={() => { setMaxPlayers(n); updateLobbySettings(n, maxRounds) }}
                          style={{flex:1,padding:'8px 0',borderRadius:10,border:'none',cursor:'pointer',fontSize:15,fontWeight:700,transition:'all 0.15s',
                            background: maxPlayers===n ? 'linear-gradient(135deg,var(--gold),#e8a820)' : 'rgba(255,255,255,0.08)',
                            color: maxPlayers===n ? 'var(--purple-deep)' : 'rgba(255,248,231,0.6)',
                            transform: maxPlayers===n ? 'scale(1.08)' : 'scale(1)'}}>
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Max rounds */}
                  <div>
                    <p className="text-muted" style={{fontSize:12,marginBottom:8}}>Antall runder</p>
                    <div style={{display:'flex',gap:4}}>
                      {[2,3,5,10].map(n => (
                        <button key={n} onClick={() => { setMaxRounds(n); updateLobbySettings(maxPlayers, n) }}
                          style={{flex:1,padding:'8px 0',borderRadius:10,border:'none',cursor:'pointer',fontSize:15,fontWeight:700,transition:'all 0.15s',
                            background: maxRounds===n ? 'linear-gradient(135deg,var(--gold),#e8a820)' : 'rgba(255,255,255,0.08)',
                            color: maxRounds===n ? 'var(--purple-deep)' : 'rgba(255,248,231,0.6)',
                            transform: maxRounds===n ? 'scale(1.08)' : 'scale(1)'}}>
                          {n}
                        </button>
                      ))}
                    </div>
                    <p className="text-muted" style={{fontSize:10,marginTop:6,textAlign:'center'}}>Kort {maxRounds} → 1</p>
                  </div>
                </div>

                {/* Spectator toggle */}
                <div style={{marginTop:14,paddingTop:14,borderTop:'1px solid rgba(245,200,66,0.15)'}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                    <div>
                      <p className="text-cream" style={{fontSize:13,fontWeight:500}}>Spill som tilskuer</p>
                      <p className="text-muted" style={{fontSize:11,marginTop:2}}>Se alle spillernes kort uten å delta</p>
                    </div>
                    <button onClick={() => setSpectatorMode(m => !m)}
                      style={{width:44,height:26,borderRadius:13,border:'none',cursor:'pointer',transition:'all 0.2s',position:'relative',flexShrink:0,
                        background: spectatorMode ? 'linear-gradient(135deg,var(--gold),#e8a820)' : 'rgba(255,255,255,0.12)'}}>
                      <div style={{position:'absolute',top:3,left: spectatorMode ? 21 : 3,width:20,height:20,borderRadius:'50%',background:'#fff',transition:'left 0.2s',boxShadow:'0 1px 4px rgba(0,0,0,0.3)'}} />
                    </button>
                  </div>
                  {spectatorMode && (
                    <div style={{marginTop:8,padding:'6px 10px',background:'rgba(245,200,66,0.08)',borderRadius:8,display:'flex',alignItems:'center',gap:6}}>
                      <span style={{fontSize:14}}>👁</span>
                      <p className="text-muted" style={{fontSize:11}}>Du starter spillet men deltar ikke. Du ser alle kortene.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Player list */}
            <p className="text-gold" style={{fontSize:11,fontWeight:600,letterSpacing:'0.15em',textTransform:'uppercase',marginBottom:10}}>
              Spillere ({players.length}/{maxPlayers})
            </p>

            {/* Seats */}
            <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:20}}>
              {Array.from({length: maxPlayers}, (_, i) => {
                const p = players[i]
                return p ? (
                  <div key={p.id} className="player-chip" style={{padding:'10px 14px',display:'flex',alignItems:'center',gap:10,opacity:1}}>
                    <div style={{width:32,height:32,borderRadius:'50%',background:'linear-gradient(135deg,var(--purple-bright),var(--purple-mid))',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,flexShrink:0}}>
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-cream" style={{fontSize:14,flex:1}}>{p.name}</span>
                    {p.id === room.host_id && <span className="text-gold" style={{fontSize:11,opacity:0.7}}>vertskap</span>}
                  </div>
                ) : (
                  <div key={`empty-${i}`} style={{padding:'10px 14px',display:'flex',alignItems:'center',gap:10,border:'1px dashed rgba(255,255,255,0.12)',borderRadius:14,opacity:0.4}}>
                    <div style={{width:32,height:32,borderRadius:'50%',border:'1px dashed rgba(255,255,255,0.2)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0}}>＋</div>
                    <span className="text-muted" style={{fontSize:13}}>Ledig plass</span>
                  </div>
                )
              })}
            </div>

            {isHost ? (
              <button onClick={startGame} disabled={players.length < 2} className="btn-gold" style={{width:'100%',padding:16,fontSize:16}}>
                Start spill ({players.length} spillere) →
              </button>
            ) : (
              <p className="text-muted" style={{textAlign:'center',fontSize:13}}>Venter på at verten starter...</p>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── GAME END ──────────────────────────────────────────────────────────────
  if (gameState.phase === 'gameEnd') {
    const sorted = [...gameState.players].sort((a, b) => b.totalScore - a.totalScore)
    return (
      <div style={{minHeight:'100vh',padding:16,position:'relative'}}>
        <div className="orb orb-1" /><div className="orb orb-2" />
        <div style={{maxWidth:460,margin:'0 auto',position:'relative',zIndex:1,paddingTop:32}}>
          <div style={{textAlign:'center',marginBottom:24}}>
            <div style={{fontSize:56,marginBottom:8}}>🏆</div>
            <div className="font-display text-gold" style={{fontSize:44}}>SPILLET ER OVER</div>
            <p className="text-gold-light" style={{fontSize:16,marginTop:4}}>Vinner: {sorted[0].name}</p>
          </div>

          {/* Final podium */}
          <div className="glass float-in" style={{padding:20,marginBottom:12}}>
            {sorted.map((p, i) => (
              <div key={p.id} style={{display:'flex',alignItems:'center',padding:'12px 0',borderBottom: i<sorted.length-1 ? '1px solid rgba(255,255,255,0.07)' : 'none'}}>
                <span className="font-display text-gold" style={{fontSize:28,width:36,opacity: i===0?1:0.5}}>{i+1}</span>
                <div style={{width:36,height:36,borderRadius:'50%',background:'linear-gradient(135deg,var(--purple-bright),var(--purple-mid))',display:'flex',alignItems:'center',justifyContent:'center',marginRight:12,fontSize:14,flexShrink:0}}>
                  {p.name.charAt(0).toUpperCase()}
                </div>
                <span className="text-cream" style={{flex:1,fontSize:15}}>{p.name}</span>
                <span className="font-display text-gold" style={{fontSize:30}}>{p.totalScore}</span>
              </div>
            ))}
          </div>

          {/* Leaderboards */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12}}>
            <button onClick={() => setSidePanel(p => p==='roomBoard' ? 'none' : 'roomBoard')} className="btn-glass" style={{padding:'12px 8px',fontSize:13}}>
              🃏 Romstatistikk
            </button>
            <button onClick={() => setSidePanel(p => p==='globalBoard' ? 'none' : 'globalBoard')} className="btn-glass" style={{padding:'12px 8px',fontSize:13}}>
              🌍 Globalt
            </button>
          </div>

          {sidePanel === 'roomBoard' && <RoomLeaderboard gameState={gameState} style={{marginBottom:12}} />}
          {sidePanel === 'globalBoard' && <GlobalLeaderboardInline style={{marginBottom:12}} />}

          <button onClick={onLeave} className="btn-glass" style={{width:'100%',padding:14}}>Tilbake til lobby</button>
        </div>
      </div>
    )
  }

  // ── ROUND END ─────────────────────────────────────────────────────────────
  if (gameState.phase === 'roundEnd' || sidePanel === 'roundScores') {
    return (
      <div style={{minHeight:'100vh',padding:16,position:'relative'}}>
        <div className="orb orb-1" /><div className="orb orb-2" />
        <div style={{maxWidth:480,margin:'0 auto',position:'relative',zIndex:1,paddingTop:20}}>
          <ScoreBoard gameState={gameState} />

          {/* Round nav */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginTop:10,marginBottom:8}}>
            <button onClick={() => setSidePanel(p => p==='roomBoard'?'none':'roomBoard')} className="btn-glass" style={{padding:'11px 8px',fontSize:13}}>
              🃏 Romstatistikk
            </button>
            <button onClick={() => setSidePanel(p => p==='globalBoard'?'none':'globalBoard')} className="btn-glass" style={{padding:'11px 8px',fontSize:13}}>
              🌍 Globalt
            </button>
          </div>

          {sidePanel === 'roomBoard' && <RoomLeaderboard gameState={gameState} style={{marginBottom:10}} />}
          {sidePanel === 'globalBoard' && <GlobalLeaderboardInline style={{marginBottom:10}} />}

          {isHost ? (
            <button onClick={handleNextRound} className="btn-gold" style={{width:'100%',padding:16,fontSize:16,marginTop:4}}>
              Neste runde — {gameState.round - 1} kort →
            </button>
          ) : (
            <p className="text-muted" style={{textAlign:'center',fontSize:13,marginTop:12}}>Venter på at verten starter neste runde...</p>
          )}
        </div>
      </div>
    )
  }

  // ── SPECTATOR VIEW ────────────────────────────────────────────────────────
  const isSpectator = isHost && (spectatorMode || !gameState.players.find(p => p.id === userId))

  if (isSpectator && gameState.phase !== 'gameEnd' && gameState.phase !== 'roundEnd') {
    const rPlayed = roundsPlayed(gameState)
    const rTotal  = totalRounds(gameState)
    const trumpSuitS = gameState.trump?.suit
    const focusPlayer = spectateTarget
      ? gameState.players.find(p => p.id === spectateTarget)
      : null

    return (
      <div style={{minHeight:'100vh',display:'flex',flexDirection:'column',position:'relative',background:'rgba(0,0,0,0.15)'}}>
        <div className="orb orb-2" style={{opacity:0.2}} />

        {/* Spectator header */}
        <div style={{background:'rgba(0,0,0,0.45)',backdropFilter:'blur(20px)',borderBottom:'1px solid rgba(245,200,66,0.2)',padding:'10px 14px',display:'flex',alignItems:'center',gap:10,position:'relative',zIndex:2}}>
          <button onClick={onLeave} style={{background:'none',border:'none',color:'rgba(255,248,231,0.35)',cursor:'pointer',fontSize:16,padding:0,flexShrink:0}}>←</button>
          <div style={{flex:1}}>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <span className="font-display text-gold" style={{fontSize:20,letterSpacing:'0.1em'}}>{roomCode}</span>
              <span style={{fontSize:10,background:'rgba(245,200,66,0.15)',border:'1px solid rgba(245,200,66,0.35)',borderRadius:6,padding:'2px 7px',color:'var(--gold)',letterSpacing:'0.1em'}}>TILSKUER</span>
            </div>
            <div style={{height:3,background:'rgba(255,255,255,0.1)',borderRadius:2,marginTop:4,overflow:'hidden',maxWidth:120}}>
              <div style={{height:'100%',background:'var(--gold)',borderRadius:2,width:`${(rPlayed/rTotal)*100}%`}} />
            </div>
          </div>
          {trumpSuitS && (
            <div className="trump-badge" style={{display:'flex',alignItems:'center',gap:5,padding:'4px 10px'}}>
              <span className="text-muted" style={{fontSize:10}}>TRUMF</span>
              <span style={{fontSize:20,color: isRedSuit(trumpSuitS)?'#e05252':'var(--cream)'}}>{SUIT_SYMBOLS[trumpSuitS]}</span>
            </div>
          )}
          {/* Toggle back to playing view */}
          <button onClick={() => setSpectatorMode(false)} className="btn-glass"
            style={{padding:'6px 12px',fontSize:11,flexShrink:0,border:'1px solid rgba(245,200,66,0.4)',color:'var(--gold)'}}>
            👁 Av
          </button>
        </div>

        {/* Current trick center */}
        {gameState.currentTrick.length > 0 && (
          <div style={{padding:'12px 14px 0',textAlign:'center',position:'relative',zIndex:1}}>
            <p className="text-muted" style={{fontSize:10,letterSpacing:'0.2em',textTransform:'uppercase',marginBottom:8}}>STIKK PÅGÅR</p>
            <div style={{display:'flex',gap:10,justifyContent:'center'}}>
              {gameState.currentTrick.map(({playerId,card}) => {
                const player = gameState.players.find(p=>p.id===playerId)
                return (
                  <div key={playerId} style={{textAlign:'center'}}>
                    <CardComponent card={card} size="md"/>
                    <p className="text-muted" style={{fontSize:10,marginTop:3}}>{player?.name?.split(' ')[0]}</p>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Player selector tabs */}
        <div style={{padding:'10px 10px 0',display:'flex',gap:6,overflowX:'auto',position:'relative',zIndex:1}}>
          <button onClick={() => setSpectateTarget(null)}
            style={{flexShrink:0,padding:'6px 12px',borderRadius:10,border:'none',cursor:'pointer',fontSize:12,fontWeight:500,transition:'all 0.15s',
              background: !spectateTarget ? 'linear-gradient(135deg,var(--gold),#e8a820)' : 'rgba(255,255,255,0.08)',
              color: !spectateTarget ? 'var(--purple-deep)' : 'rgba(255,248,231,0.6)'}}>
            Alle
          </button>
          {gameState.players.map(p => (
            <button key={p.id} onClick={() => setSpectateTarget(p.id)}
              style={{flexShrink:0,padding:'6px 12px',borderRadius:10,border:'none',cursor:'pointer',fontSize:12,fontWeight:500,transition:'all 0.15s',
                background: spectateTarget===p.id ? 'linear-gradient(135deg,var(--gold),#e8a820)' : 'rgba(255,255,255,0.08)',
                color: spectateTarget===p.id ? 'var(--purple-deep)' : 'rgba(255,248,231,0.6)',
                outline: gameState.players[gameState.currentPlayerIndex]?.id===p.id ? '1px solid var(--gold)' : 'none'}}>
              {p.name.split(' ')[0]}
              {gameState.players[gameState.currentPlayerIndex]?.id===p.id && ' ▶'}
            </button>
          ))}
        </div>

        {/* Hands — all visible */}
        <div style={{flex:1,overflowY:'auto',padding:'12px 10px 24px',position:'relative',zIndex:1}}>
          {(focusPlayer ? [focusPlayer] : gameState.players).map(p => {
            const isTurn = gameState.players[gameState.currentPlayerIndex]?.id === p.id
            const bidDone = p.bid !== null
            return (
              <div key={p.id} style={{marginBottom:14}}>
                {/* Player info bar */}
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6,padding:'8px 12px',borderRadius:12,
                  background: isTurn ? 'rgba(245,200,66,0.1)' : 'rgba(0,0,0,0.2)',
                  border: isTurn ? '1px solid rgba(245,200,66,0.3)' : '1px solid rgba(255,255,255,0.07)'}}>
                  <div style={{width:28,height:28,borderRadius:'50%',background:'linear-gradient(135deg,var(--purple-bright),var(--purple-mid))',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,flexShrink:0}}>
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-cream" style={{flex:1,fontSize:13,fontWeight:500}}>{p.name}</span>
                  {isTurn && <span style={{fontSize:10,color:'var(--gold)',fontWeight:600}}>TUR ▶</span>}
                  <span className="text-muted" style={{fontSize:11}}>{bidDone ? `Meldt: ${p.bid}` : gameState.phase==='bidding' ? '...' : '–'}</span>
                  <span className="text-muted" style={{fontSize:11}}>Stikk: {p.tricks}</span>
                  {/* Trick pile mini */}
                  {p.tricks > 0 && (
                    <div style={{display:'flex',alignItems:'center',gap:3}}>
                      <div style={{position:'relative',height:22,width:Math.min(p.tricks*4+14,38)}}>
                        {Array.from({length:Math.min(p.tricks,4)}).map((_,ti)=>(
                          <div key={ti} style={{position:'absolute',left:ti*Math.min(6,30/Math.max(p.tricks-1,1)),top:0,width:14,height:20,borderRadius:2,
                            background:'linear-gradient(160deg,#fffef5,#e8dfc8)',border:'1px solid rgba(150,120,60,0.4)',boxShadow:'1px 1px 3px rgba(0,0,0,0.35)'}} />
                        ))}
                      </div>
                      <span style={{fontSize:10,fontWeight:700,color:'var(--gold)',fontFamily:'Bebas Neue,sans-serif'}}>×{p.tricks}</span>
                    </div>
                  )}
                  <span className="font-display text-gold" style={{fontSize:18}}>{p.totalScore}</span>
                </div>

                {/* Hand — face up for spectator */}
                <div style={{display:'flex',gap:3,flexWrap:'wrap',paddingLeft:8}}>
                  {[...p.hand].sort((a,b) => {
                    const SO: Record<string,number> = {S:0,H:1,D:2,C:3}
                    const trump = gameState.trump?.suit
                    const aT = a.suit===trump?1:0, bT = b.suit===trump?1:0
                    if (aT!==bT) return aT-bT
                    if (a.suit!==b.suit) return SO[a.suit]-SO[b.suit]
                    return rankValue(a.rank)-rankValue(b.rank)
                  }).map((card,i) => (
                    <CardComponent key={`${p.id}${card.suit}${card.rank}${i}`}
                      card={card} size="sm" dealDelay={i*20} />
                  ))}
                  {gameState.phase === 'bidding' && <span className="text-muted" style={{fontSize:11,alignSelf:'center',marginLeft:4}}>byr...</span>}
                </div>
              </div>
            )
          })}
        </div>

        {/* Spectator bottom bar — bidding reveals */}
        {gameState.phase === 'bidding' && (
          <div style={{background:'rgba(0,0,0,0.4)',backdropFilter:'blur(16px)',borderTop:'1px solid rgba(255,255,255,0.08)',padding:'10px 14px',position:'relative',zIndex:2}}>
            <p className="text-gold" style={{fontSize:11,fontWeight:600,letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:6}}>Bud (skjult til alle har lagt inn)</p>
            <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
              {gameState.players.map(p => (
                <div key={p.id} style={{padding:'5px 10px',borderRadius:8,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)'}}>
                  <span className="text-muted" style={{fontSize:11}}>{p.name.split(' ')[0]}: </span>
                  <span className="text-gold" style={{fontSize:11,fontWeight:700}}>{p.bid !== null ? p.bid : '?'}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── MAIN GAME ─────────────────────────────────────────────────────────────
  const rPlayed = roundsPlayed(gameState)
  const rTotal = totalRounds(gameState)

  return (
    <div style={{minHeight:'100vh',display:'flex',flexDirection:'column',position:'relative'}}>
      <div className="orb orb-2" style={{opacity:0.25}} />

      {/* Header */}
      <div style={{background:'rgba(0,0,0,0.35)',backdropFilter:'blur(20px)',borderBottom:'1px solid rgba(255,255,255,0.08)',padding:'10px 14px',display:'flex',alignItems:'center',gap:10,position:'relative',zIndex:2}}>
        <button onClick={onLeave} style={{background:'none',border:'none',color:'rgba(255,248,231,0.35)',cursor:'pointer',fontSize:16,padding:0,flexShrink:0}}>←</button>
        <div style={{flex:1}}>
          <div style={{display:'flex',alignItems:'baseline',gap:8}}>
            <span className="font-display text-gold" style={{fontSize:20,letterSpacing:'0.1em'}}>{roomCode}</span>
            <span className="text-muted" style={{fontSize:12}}>{gameState.round} kort</span>
          </div>
          {/* Round progress bar */}
          <div style={{height:3,background:'rgba(255,255,255,0.1)',borderRadius:2,marginTop:4,overflow:'hidden',maxWidth:140}}>
            <div style={{height:'100%',background:'var(--gold)',borderRadius:2,width:`${(rPlayed/rTotal)*100}%`,transition:'width 0.5s ease'}} />
          </div>
          <span className="text-muted" style={{fontSize:10,marginTop:1,display:'block'}}>{rPlayed}/{rTotal} runder</span>
        </div>
        {trumpSuit && (
          <div className="trump-badge" style={{display:'flex',alignItems:'center',gap:5,padding:'4px 10px'}}>
            <span className="text-muted" style={{fontSize:10,letterSpacing:'0.1em'}}>TRUMF</span>
            <span style={{fontSize:20,color: isRedSuit(trumpSuit) ? '#e05252' : 'var(--cream)'}}>{SUIT_SYMBOLS[trumpSuit]}</span>
          </div>
        )}
        {isHost && (
          <button onClick={() => setSpectatorMode(true)} className="btn-glass"
            style={{padding:'6px 10px',fontSize:12,flexShrink:0,border:'1px solid rgba(255,255,255,0.15)'}}>
            👁
          </button>
        )}
        <button onClick={() => setSidePanel(p => p!=='none' ? 'none' : 'roomBoard')}
          className="btn-glass" style={{padding:'6px 12px',fontSize:12,flexShrink:0}}>
          📊
        </button>
      </div>

      {/* Side panel overlay */}
      {sidePanel !== 'none' && (sidePanel as string) !== 'roundScores' && (
        <div style={{position:'absolute',top:57,right:0,width:'min(340px,100vw)',zIndex:10,padding:12}}>
          <div style={{display:'flex',gap:6,marginBottom:8}}>
            <button onClick={() => setSidePanel('roomBoard')} className={sidePanel==='roomBoard' ? 'btn-gold' : 'btn-glass'} style={{flex:1,padding:'8px 0',fontSize:12}}>🃏 Romstatistikk</button>
            <button onClick={() => setSidePanel('globalBoard')} className={sidePanel==='globalBoard' ? 'btn-gold' : 'btn-glass'} style={{flex:1,padding:'8px 0',fontSize:12}}>🌍 Globalt</button>
            <button onClick={() => setSidePanel('none')} className="btn-glass" style={{padding:'8px 12px',fontSize:12}}>✕</button>
          </div>
          {sidePanel === 'roomBoard' && <RoomLeaderboard gameState={gameState} />}
          {sidePanel === 'globalBoard' && <GlobalLeaderboardInline />}
        </div>
      )}

      {/* Opponents row with trick piles */}
      <div style={{padding:'10px 10px 0',display:'flex',gap:6,overflowX:'auto',position:'relative',zIndex:1}}>
        {gameState.players.filter(p => p.id !== userId).map(p => (
          <div key={p.id} className={`player-chip${currentPlayer?.id === p.id ? ' active' : ''}`} style={{padding:'8px 12px',flexShrink:0,minWidth:140}}>
            <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:4}}>
              <div style={{width:26,height:26,borderRadius:'50%',background:'linear-gradient(135deg,var(--purple-bright),var(--purple-mid))',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,flexShrink:0}}>
                {p.name.charAt(0).toUpperCase()}
              </div>
              <span className="text-cream" style={{fontSize:12,fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.name.split(' ')[0]}</span>
              {currentPlayer?.id === p.id && <span style={{fontSize:9,color:'var(--gold)',marginLeft:'auto'}}>▶</span>}
            </div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:11}}>
              <span className="text-muted">{p.bid!==null ? `${p.bid}↗` : '...'}</span>
              {/* Trick pile */}
              <div style={{display:'flex',alignItems:'center',gap:5}}>
                {p.tricks > 0 ? (
                  <>
                    <div style={{position:'relative',height:30,width:Math.min(p.tricks*5+20,52),flexShrink:0}}>
                      {Array.from({length:Math.min(p.tricks,5)}).map((_,ti) => (
                        <div key={ti} style={{position:'absolute',left:ti*Math.min(8,44/Math.max(p.tricks-1,1)),top:0,width:20,height:28,borderRadius:3,
                          background:'linear-gradient(160deg,#fffef5,#e8dfc8)',
                          border:'1px solid rgba(150,120,60,0.4)',
                          boxShadow:'1px 2px 4px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.8)'}} />
                      ))}
                    </div>
                    <span style={{fontSize:11,fontWeight:700,color:'var(--gold)',fontFamily:'Bebas Neue,sans-serif',letterSpacing:'0.05em'}}>×{p.tricks}</span>
                  </>
                ) : (
                  <span className="text-muted" style={{fontSize:10}}>—</span>
                )}
              </div>
              <span className="font-display text-gold" style={{fontSize:15}}>{p.totalScore}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Table center */}
      <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:14,position:'relative',zIndex:1}}>

        {/* Last trick viewer modal */}
        {showLastTrick && gameState.lastTrick && (
          <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',backdropFilter:'blur(8px)',zIndex:50,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}
            onClick={() => setShowLastTrick(false)}>
            <div className="glass float-in" style={{padding:24,maxWidth:340,width:'100%'}} onClick={e => e.stopPropagation()}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
                <p className="font-display text-gold" style={{fontSize:22}}>FORRIGE STIKK</p>
                <button onClick={() => setShowLastTrick(false)} className="btn-glass" style={{padding:'6px 12px',fontSize:12}}>✕</button>
              </div>
              {gameState.lastTrickWinnerId && (
                <p className="text-muted" style={{fontSize:12,marginBottom:12,textAlign:'center'}}>
                  Vant av <strong className="text-gold">{gameState.players.find(p=>p.id===gameState.lastTrickWinnerId)?.name}</strong>
                </p>
              )}
              <div style={{display:'flex',gap:10,justifyContent:'center',flexWrap:'wrap'}}>
                {gameState.lastTrick.map(({playerId,card}) => {
                  const player = gameState.players.find(p=>p.id===playerId)
                  const isWinner = playerId === gameState.lastTrickWinnerId
                  return (
                    <div key={playerId} style={{textAlign:'center'}}>
                      <div style={{padding:2,borderRadius:10,border: isWinner ? '2px solid var(--gold)' : '2px solid transparent',boxShadow: isWinner ? '0 0 12px rgba(245,200,66,0.5)' : 'none'}}>
                        <CardComponent card={card} size="md" />
                      </div>
                      <p className="text-muted" style={{fontSize:10,marginTop:4}}>{player?.name?.split(' ')[0]}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* Trump card on table — shown during bidding and playing */}
        {gameState.trumpRevealed && gameState.trump && (gameState.phase === 'bidding' || gameState.phase === 'playing') && gameState.currentTrick.length === 0 && !trickJustResolved && (
          <div style={{textAlign:'center',marginBottom:12}}>
            <p className="text-muted" style={{fontSize:10,letterSpacing:'0.15em',textTransform:'uppercase',marginBottom:6}}>TRUMFKORT</p>
            <div style={{display:'inline-block',animation:'trumpReveal 0.5s cubic-bezier(0.34,1.4,0.64,1) both'}}>
              <CardComponent card={gameState.trump} size="md" />
            </div>
            <p className="text-gold" style={{fontSize:11,marginTop:5,fontWeight:600}}>
              {gameState.trump.suit === 'S' ? '♠ Spar' : gameState.trump.suit === 'H' ? '♥ Hjerter' : gameState.trump.suit === 'D' ? '♦ Ruter' : '♣ Kløver'} er trumf
            </p>
          </div>
        )}

        {/* Current trick — lingers after resolution */}
        {(gameState.currentTrick.length > 0 || trickJustResolved) && (() => {
          const trickToShow = trickJustResolved ? gameState.lastTrick : gameState.currentTrick
          const winnerId = trickJustResolved ? gameState.lastTrickWinnerId : null
          if (!trickToShow || trickToShow.length === 0) return null
          return (
            <div style={{marginBottom:14,textAlign:'center'}}>
              <p className="text-muted" style={{fontSize:10,letterSpacing:'0.2em',textTransform:'uppercase',marginBottom:8}}>
                {trickJustResolved ? 'STIKK TIL ' + (gameState.players.find(p=>p.id===winnerId)?.name?.split(' ')[0] ?? '') : 'STIKK PÅGÅR'}
              </p>
              <div style={{display:'flex',gap:8,justifyContent:'center'}}>
                {trickToShow.map(({ playerId, card }) => {
                  const player = gameState.players.find(p => p.id === playerId)
                  const isWinner = trickJustResolved && playerId === winnerId
                  return (
                    <div key={playerId} style={{textAlign:'center'}}>
                      <div style={{padding:2,borderRadius:10,border: isWinner ? '2px solid var(--gold)' : '2px solid transparent',transition:'border 0.3s',boxShadow: isWinner ? '0 0 16px rgba(245,200,66,0.6)' : 'none'}}>
                        <CardComponent card={card} size="md" />
                      </div>
                      <p className="text-muted" style={{fontSize:10,marginTop:3}}>{player?.name?.split(' ')[0]}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })()}

        {/* ── Drawing phase: deck pile + trump reveal ── */}
        {gameState.phase === 'drawing' && (
          <div className="glass float-in" style={{padding:24,width:'100%',maxWidth:340,textAlign:'center'}}>
            <p className="text-gold" style={{fontSize:12,fontWeight:600,letterSpacing:'0.15em',textTransform:'uppercase',marginBottom:16}}>
              Trekk trumfkort
            </p>

            {/* Deck pile — stacked cards */}
            <div style={{display:'flex',justifyContent:'center',alignItems:'flex-end',gap:24,marginBottom:20}}>
              <div style={{textAlign:'center'}}>
                <p className="text-muted" style={{fontSize:10,letterSpacing:'0.1em',marginBottom:8}}>BUNKE</p>
                {/* Stack of face-down cards */}
                <div style={{position:'relative',width:62,height:88,margin:'0 auto',cursor: isHost ? 'pointer' : 'default'}}
                  onClick={isHost ? handleDrawTrump : undefined}>
                  {Array.from({length:Math.min(gameState.deckPile.length,6)}).map((_,i) => (
                    <div key={i} style={{
                      position:'absolute',
                      left: i*1.5, top: -i*1.5,
                      width:62, height:88, borderRadius:8,
                      background: i===Math.min(gameState.deckPile.length,6)-1
                        ? 'linear-gradient(135deg,#4338ca 0%,#3730a3 100%)'
                        : 'linear-gradient(135deg,#3730a3 0%,#2e27a0 100%)',
                      border:'1px solid rgba(255,255,255,0.15)',
                      boxShadow: i===Math.min(gameState.deckPile.length,6)-1
                        ? '0 4px 16px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.2)'
                        : '0 2px 6px rgba(0,0,0,0.3)',
                      transition:'all 0.2s',
                    }}>
                      {/* back pattern on top card */}
                      {i===Math.min(gameState.deckPile.length,6)-1 && (
                        <svg width="62" height="88" viewBox="0 0 70 100" style={{position:'absolute',inset:0,borderRadius:7}}>
                          <rect width="70" height="100" rx="7" fill="#3730a3"/>
                          <rect x="3" y="3" width="64" height="94" rx="5" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1"/>
                          {Array.from({length:9},(_,r)=>Array.from({length:7},(_,c)=>(
                            <path key={`${r}-${c}`} d={`M${c*11-2} ${r*12+6} L${c*11+3} ${r*12} L${c*11+8} ${r*12+6} L${c*11+3} ${r*12+12}Z`}
                              fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5"/>
                          )))}
                        </svg>
                      )}
                    </div>
                  ))}
                  {gameState.deckPile.length === 0 && (
                    <div style={{width:62,height:88,borderRadius:8,border:'2px dashed rgba(255,255,255,0.15)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                      <span className="text-muted" style={{fontSize:10}}>Tom</span>
                    </div>
                  )}
                  {isHost && gameState.deckPile.length > 0 && (
                    <div style={{position:'absolute',inset:0,borderRadius:8,background:'rgba(245,200,66,0.08)',border:'2px solid rgba(245,200,66,0.3)',
                      display:'flex',alignItems:'center',justifyContent:'center',opacity:0,transition:'opacity 0.2s'}}
                      onMouseOver={e=>(e.currentTarget.style.opacity='1')} onMouseOut={e=>(e.currentTarget.style.opacity='0')}>
                      <span style={{fontSize:11,color:'var(--gold)',fontWeight:600}}>Trekk</span>
                    </div>
                  )}
                </div>
                <p className="text-muted" style={{fontSize:10,marginTop:6}}>{gameState.deckPile.length} kort igjen</p>
              </div>

              {/* Arrow */}
              <div style={{fontSize:20,opacity:0.3,paddingBottom:24}}>→</div>

              {/* Trump card slot */}
              <div style={{textAlign:'center'}}>
                <p className="text-muted" style={{fontSize:10,letterSpacing:'0.1em',marginBottom:8}}>TRUMF</p>
                <div style={{width:62,height:88,borderRadius:8,border:'2px dashed rgba(255,255,255,0.15)',
                  display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.1)'}}>
                  <span className="text-muted" style={{fontSize:11}}>?</span>
                </div>
              </div>
            </div>

            {isHost ? (
              <button onClick={handleDrawTrump} disabled={gameState.deckPile.length===0} className="btn-gold" style={{width:'100%',padding:13}}>
                🂠 Trekk trumfkort
              </button>
            ) : (
              <p className="text-muted" style={{fontSize:12}}>Venter på at verten trekker trumfkort...</p>
            )}
            <p className="text-muted" style={{fontSize:10,marginTop:8,opacity:0.6}}>
              {gameState.deckPile.length} kort igjen i bunken (ikke i spill)
            </p>
          </div>
        )}

        {/* ── Bidding ── */}
        {gameState.phase === 'bidding' && (
          <div className="glass float-in" style={{padding:20,width:'100%',maxWidth:360}}>
            {gameState.unseenBid && (
              <div style={{background:'rgba(245,200,66,0.1)',border:'1px solid rgba(245,200,66,0.25)',borderRadius:10,padding:'8px 14px',marginBottom:14,textAlign:'center'}}>
                <span style={{fontSize:15}}>🙈</span>
                <span className="text-gold" style={{fontSize:12,fontWeight:600,marginLeft:8}}>By uten å se kortene!</span>
              </div>
            )}
            <p className="text-gold" style={{textAlign:'center',fontSize:12,fontWeight:600,letterSpacing:'0.15em',textTransform:'uppercase',marginBottom:14}}>Meld antall stikk</p>
            <div style={{display:'flex',flexWrap:'wrap',gap:7,justifyContent:'center',marginBottom:14}}>
              {Array.from({length: gameState.round + 1}, (_, i) => i).map(n => (
                <button key={n} onClick={() => setPendingBid(n)} className={`bid-btn${pendingBid===n ? ' selected' : ''}`}>{n}</button>
              ))}
            </div>
            {myBid !== null ? (
              <div style={{textAlign:'center'}}>
                <p className="text-gold" style={{fontSize:13,marginBottom:5}}>Du meldte <strong>{myBid}</strong></p>
                <div style={{display:'flex',justifyContent:'center',gap:5,marginBottom:4}}>
                  {gameState.players.map(p => (
                    <div key={p.id} style={{width:7,height:7,borderRadius:'50%',background: allBidsIn[p.id]!==undefined ? 'var(--gold)' : 'rgba(255,255,255,0.18)',transition:'background 0.3s'}} />
                  ))}
                </div>
                <p className="text-muted" style={{fontSize:11}}>Venter ({Object.keys(allBidsIn).length}/{gameState.players.length})</p>
              </div>
            ) : (
              <button onClick={submitMyBid} disabled={pendingBid===null} className="btn-gold" style={{width:'100%',padding:12}}>
                Meld {pendingBid!==null ? pendingBid : '?'} stikk
              </button>
            )}
            {bidsRevealed && (
              <div style={{marginTop:14,padding:14,background:'rgba(245,200,66,0.07)',borderRadius:10,border:'1px solid rgba(245,200,66,0.18)'}}>
                <p className="text-gold" style={{textAlign:'center',fontWeight:600,marginBottom:7,fontSize:14}}>🎴 Alle har meldt!</p>
                {Object.entries(allBidsIn).map(([pid, bid]) => {
                  const p = gameState.players.find(pl => pl.id === pid)
                  return <p key={pid} className="text-muted" style={{fontSize:12,textAlign:'center'}}>{p?.name}: <strong className="text-gold">{bid}</strong></p>
                })}
              </div>
            )}
          </div>
        )}

        {gameState.phase === 'playing' && !isMyTurn && (
          <div style={{textAlign:'center'}}>
            <div className="glass-sm" style={{display:'inline-block',padding:'10px 20px',background:'rgba(0,0,0,0.2)'}}>
              <p className="text-muted" style={{fontSize:12}}>{currentPlayer?.name} spiller...</p>
            </div>
            {myPlayer?.bid !== null && (
              <p className="text-muted" style={{fontSize:11,marginTop:7}}>Du meldte {myPlayer?.bid} · Tatt {myPlayer?.tricks} stikk</p>
            )}
          </div>
        )}

        {gameState.phase === 'playing' && isMyTurn && (
          <div className="glass-sm" style={{padding:'9px 18px',background:'rgba(245,200,66,0.07)',border:'1px solid rgba(245,200,66,0.22)'}}>
            <p className="text-gold" style={{fontSize:12,fontWeight:600,textAlign:'center'}}>
              {gameState.currentTrick.length === 0 ? '⭐ Din tur — velg kort å lede med' : '⭐ Din tur'}
            </p>
          </div>
        )}
      </div>

      {/* My hand */}
      <div style={{background:'rgba(0,0,0,0.38)',backdropFilter:'blur(20px)',borderTop:'1px solid rgba(255,255,255,0.07)',padding:'12px 10px 20px',position:'relative',zIndex:2}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:9,padding:'0 4px'}}>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            {/* My trick pile */}
            {(myPlayer?.tricks ?? 0) > 0 && (
              <div style={{display:'flex',alignItems:'center',gap:5}}>
                <div style={{position:'relative',height:30,width:Math.min((myPlayer?.tricks??0)*5+20,52),flexShrink:0}}>
                  {Array.from({length:Math.min(myPlayer?.tricks??0,5)}).map((_,ti) => (
                    <div key={ti} style={{position:'absolute',left:ti*Math.min(8,44/Math.max((myPlayer?.tricks??1)-1,1)),top:0,width:20,height:28,borderRadius:3,
                      background:'linear-gradient(160deg,#fffef5,#e8dfc8)',
                      border:'1px solid rgba(150,120,60,0.4)',
                      boxShadow:'1px 2px 4px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.8)'}} />
                  ))}
                </div>
                <span style={{fontSize:12,fontWeight:700,color:'var(--gold)',fontFamily:'Bebas Neue,sans-serif',letterSpacing:'0.05em'}}>×{myPlayer?.tricks}</span>
              </div>
            )}
            <p className="text-muted" style={{fontSize:11}}>
              {myPlayer?.bid !== null ? `Meldt: ${myPlayer?.bid} · Tatt: ${myPlayer?.tricks}` : 'Din hånd'}
            </p>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            {/* Last trick button — only show when there IS a last trick */}
            {gameState.lastTrick && gameState.lastTrick.length > 0 && (
              <button onClick={() => setShowLastTrick(true)} className="btn-glass"
                style={{padding:'4px 10px',fontSize:11,borderRadius:8}}>
                Forrige stikk
              </button>
            )}
            {/* Only show score when non-zero */}
            {(myPlayer?.totalScore ?? 0) > 0 && (
              <span className="font-display text-gold" style={{fontSize:22}}>{myPlayer?.totalScore}</span>
            )}
          </div>
        </div>
        <div style={{display:'flex',gap:3,flexWrap:'wrap',justifyContent:'center'}}>
          {[...(myPlayer?.hand ?? [])].sort((a, b) => {
            const SUIT_ORDER: Record<string, number> = { S: 0, H: 1, D: 2, C: 3 }
            const trump = gameState.trump?.suit
            const aTrump = a.suit === trump ? 1 : 0
            const bTrump = b.suit === trump ? 1 : 0
            if (aTrump !== bTrump) return aTrump - bTrump
            if (a.suit !== b.suit) return SUIT_ORDER[a.suit] - SUIT_ORDER[b.suit]
            return rankValue(a.rank) - rankValue(b.rank)
          }).map((card, i) => {
            const canPlay = gameState.phase === 'playing' && isMyTurn
            const mustFollow = gameState.leadSuit && myPlayer!.hand.some(c => c.suit === gameState.leadSuit)
            const isPlayable = canPlay && (!mustFollow || card.suit === gameState.leadSuit)
            return (
              <CardComponent key={`${card.suit}${card.rank}${i}`} card={card} size="lg"
                onClick={isPlayable ? () => handlePlayCard(card) : undefined}
                disabled={canPlay && !isPlayable} highlight={isPlayable} dealDelay={i * 40} />
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Inline global leaderboard (used inside GameRoom) ──────────────────────
function GlobalLeaderboardInline({ style }: { style?: React.CSSProperties }) {
  const [scores, setScores] = useState<any[]>([])
  const supabase = createClient()
  useEffect(() => {
    supabase.from('scores').select('player_name, total_score, played_at').order('total_score', { ascending: false }).limit(10)
      .then(({ data }) => setScores(data || []))
  }, [])
  return (
    <div className="glass" style={{padding:16,...style}}>
      <p className="font-display text-gold" style={{fontSize:22,marginBottom:12,textAlign:'center'}}>GLOBAL TOPPLISTE</p>
      {scores.map((s, i) => (
        <div key={i} style={{display:'flex',alignItems:'center',padding:'7px 0',borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
          <span className="font-display text-gold" style={{fontSize:20,width:28,opacity:i<3?1:0.45}}>{i+1}</span>
          <span className="text-cream" style={{flex:1,fontSize:13}}>{s.player_name}</span>
          <span className="text-muted" style={{fontSize:10,marginRight:10}}>{new Date(s.played_at).toLocaleDateString('nb-NO')}</span>
          <span className="font-display text-gold" style={{fontSize:22}}>{s.total_score}</span>
        </div>
      ))}
      {scores.length === 0 && <p className="text-muted" style={{textAlign:'center',fontSize:12}}>Ingen spill ennå</p>}
    </div>
  )
}
