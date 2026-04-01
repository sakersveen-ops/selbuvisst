'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { GameState, Card, initGame, dealRound, submitBids, playCard, nextRound, SUIT_SYMBOLS, isRedSuit, totalRounds, roundsPlayed } from '@/lib/game'
import CardComponent from './CardComponent'
import ScoreBoard from './ScoreBoard'
import RoomLeaderboard from './RoomLeaderboard'

interface Props { roomCode: string; userId: string; userName: string; onLeave: () => void }

export default function GameRoom({ roomCode, userId, userName, onLeave }: Props) {
  const [room, setRoom] = useState<any>(null)
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [myBid, setMyBid] = useState<number | null>(null)
  const [bidsRevealed, setBidsRevealed] = useState(false)
  const [allBidsIn, setAllBidsIn] = useState<Record<string, number>>({})
  const [pendingBid, setPendingBid] = useState<number | null>(null)
  const [sidePanel, setSidePanel] = useState<'none' | 'roundScores' | 'roomBoard' | 'globalBoard'>('none')
  // Lobby settings (host only)
  const [maxPlayers, setMaxPlayers] = useState(4)
  const [maxRounds, setMaxRounds] = useState(10)
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
    const state = dealRound(initGame(room.players, maxRounds, roomCode))
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
    updateState(playCard(gameState, userId, card))
  }

  function handleNextRound() {
    if (!gameState) return
    updateState(nextRound(gameState)); setSidePanel('none')
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
              <p className="text-muted" style={{fontSize:12,marginTop:6}}>Del denne koden med venner</p>
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

      {/* Opponents */}
      <div style={{padding:'10px 10px 0',display:'flex',gap:6,overflowX:'auto',position:'relative',zIndex:1}}>
        {gameState.players.filter(p => p.id !== userId).map(p => (
          <div key={p.id} className={`player-chip${currentPlayer?.id === p.id ? ' active' : ''}`} style={{padding:'8px 12px',flexShrink:0,minWidth:130}}>
            <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:3}}>
              <div style={{width:26,height:26,borderRadius:'50%',background:'linear-gradient(135deg,var(--purple-bright),var(--purple-mid))',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,flexShrink:0}}>
                {p.name.charAt(0).toUpperCase()}
              </div>
              <span className="text-cream" style={{fontSize:12,fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.name.split(' ')[0]}</span>
              {currentPlayer?.id === p.id && <span style={{fontSize:9,color:'var(--gold)',marginLeft:'auto'}}>▶</span>}
            </div>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:11}}>
              <span className="text-muted">{p.hand.length}🃏 {p.bid!==null ? `· ${p.bid}↗ · ${p.tricks}✓` : '· ...'}</span>
              <span className="font-display text-gold" style={{fontSize:15}}>{p.totalScore}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Table center */}
      <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:14,position:'relative',zIndex:1}}>
        {/* Current trick */}
        {gameState.currentTrick.length > 0 && (
          <div style={{marginBottom:14,textAlign:'center'}}>
            <p className="text-muted" style={{fontSize:10,letterSpacing:'0.2em',textTransform:'uppercase',marginBottom:8}}>Stikk pågår</p>
            <div style={{display:'flex',gap:8,justifyContent:'center'}}>
              {gameState.currentTrick.map(({ playerId, card }) => {
                const player = gameState.players.find(p => p.id === playerId)
                return (
                  <div key={playerId} style={{textAlign:'center'}}>
                    <CardComponent card={card} size="md" />
                    <p className="text-muted" style={{fontSize:10,marginTop:3}}>{player?.name?.split(' ')[0]}</p>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Bidding */}
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
          <p className="text-muted" style={{fontSize:11}}>
            {myPlayer?.bid !== null ? `Meldt: ${myPlayer?.bid} · Tatt: ${myPlayer?.tricks}` : 'Din hånd'}
          </p>
          <span className="font-display text-gold" style={{fontSize:22}}>{myPlayer?.totalScore}</span>
        </div>
        <div style={{display:'flex',gap:3,flexWrap:'wrap',justifyContent:'center'}}>
          {myPlayer?.hand.map((card, i) => {
            const canPlay = gameState.phase === 'playing' && isMyTurn
            const mustFollow = gameState.leadSuit && myPlayer.hand.some(c => c.suit === gameState.leadSuit)
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
