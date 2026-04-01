'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import GameRoom from '@/components/GameRoom'
import Leaderboard from '@/components/Leaderboard'

// ── tiny QR via qrcode.js from CDN ──────────────────────────────────────────
function QRCode({ value, size = 140 }: { value: string; size?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!ref.current || !value) return
    ref.current.innerHTML = ''
    // Use QRious library loaded from CDN via script tag
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrious/4.0.2/qrious.min.js'
    script.onload = () => {
      const canvas = document.createElement('canvas')
      ref.current!.appendChild(canvas)
      // @ts-ignore
      new window.QRious({ element: canvas, value, size, backgroundAlpha: 0, foreground: '#16165a', level: 'M' })
    }
    if ((window as any).QRious) {
      const canvas = document.createElement('canvas')
      ref.current.appendChild(canvas)
      // @ts-ignore
      new window.QRious({ element: canvas, value, size, backgroundAlpha: 0, foreground: '#16165a', level: 'M' })
    } else {
      document.head.appendChild(script)
    }
    return () => { if (ref.current) ref.current.innerHTML = '' }
  }, [value, size])
  return (
    <div ref={ref} style={{
      background: '#fffef5', borderRadius: 12, padding: 10,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
    }} />
  )
}

// ── Guest ID stored in localStorage ─────────────────────────────────────────
function getOrCreateGuestId() {
  let id = localStorage.getItem('selbuvisst_guest_id')
  if (!id) { id = 'guest_' + Math.random().toString(36).slice(2, 10); localStorage.setItem('selbuvisst_guest_id', id) }
  return id
}

export default function Home() {
  const [user, setUser] = useState<any>(null)          // null = not logged in
  const [guestUser, setGuestUser] = useState<any>(null) // {id, name} for guests
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'guest'>('login')
  const [guestName, setGuestName] = useState('')
  const [error, setError] = useState('')
  const [view, setView] = useState<'lobby' | 'game' | 'scores'>('lobby')
  const [roomCode, setRoomCode] = useState('')
  const [joining, setJoining] = useState('')
  const [showQR, setShowQR] = useState(false)
  const [qrUrl, setQrUrl] = useState('')
  const supabase = createClient()

  const effectiveUser = user ?? guestUser
  const isGuest = !user && !!guestUser
  const displayName = isGuest ? guestUser.name : (user?.user_metadata?.display_name || user?.email || '')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => { setUser(data.user); setLoading(false) })
    supabase.auth.onAuthStateChange((_, session) => setUser(session?.user ?? null))
    // Restore guest session
    const savedGuest = localStorage.getItem('selbuvisst_guest')
    if (savedGuest) { try { setGuestUser(JSON.parse(savedGuest)) } catch {} }
  }, [])

  // Check URL for room code (QR scan redirect)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const code = params.get('room')
    if (code) { setJoining(code.toUpperCase()); setLoading(false) }
  }, [])

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault(); setError('')
    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password, options: { data: { display_name: name } } })
      if (error) setError(error.message)
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
    }
  }

  async function handleGuestLogin(e: React.FormEvent) {
    e.preventDefault(); setError('')
    if (!guestName.trim()) { setError('Skriv inn et navn'); return }
    const guest = { id: getOrCreateGuestId(), name: guestName.trim() }
    localStorage.setItem('selbuvisst_guest', JSON.stringify(guest))
    setGuestUser(guest)
  }

  function signOut() {
    if (isGuest) {
      localStorage.removeItem('selbuvisst_guest')
      setGuestUser(null)
    } else {
      supabase.auth.signOut()
    }
  }

  async function createRoom() {
    if (!effectiveUser) return
    const code = Math.random().toString(36).substring(2, 7).toUpperCase()
    await supabase.from('rooms').insert({
      code, host_id: effectiveUser.id,
      host_name: displayName,
      players: [{ id: effectiveUser.id, name: displayName }],
      state: null,
    })
    const url = `${window.location.origin}${window.location.pathname}?room=${code}`
    setQrUrl(url)
    setRoomCode(code); setView('game')
  }

  async function joinRoom(e?: React.FormEvent, codeOverride?: string) {
    e?.preventDefault()
    const code = (codeOverride ?? joining).toUpperCase()
    if (!effectiveUser || !code) return
    const { data, error } = await supabase.from('rooms').select('*').eq('code', code).single()
    if (error || !data) { setError('Rom ikke funnet'); return }
    const players = data.players || []
    if (players.find((p: any) => p.id === effectiveUser.id)) { setRoomCode(code); setView('game'); return }
    if (players.length >= (data.max_players ?? 5)) { setError('Rommet er fullt'); return }
    await supabase.from('rooms').update({ players: [...players, { id: effectiveUser.id, name: displayName }] }).eq('code', code)
    const url = `${window.location.origin}${window.location.pathname}?room=${code}`
    setQrUrl(url)
    setRoomCode(code); setView('game')
  }

  // Auto-join if URL has ?room=CODE and user is logged in
  useEffect(() => {
    if (!effectiveUser || !joining || view === 'game') return
    joinRoom(undefined, joining)
  }, [effectiveUser, joining])

  if (loading) return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div className="orb orb-1" /><div className="orb orb-2" />
      <div className="font-display text-gold" style={{fontSize:'4rem',letterSpacing:'0.1em',position:'relative',zIndex:1}}>SELBUVISST</div>
    </div>
  )

  // ── AUTH SCREEN ──────────────────────────────────────────────────────────
  if (!effectiveUser) return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',padding:16,position:'relative'}}>
      <div className="orb orb-1" /><div className="orb orb-2" /><div className="orb orb-3" />
      <div className="float-in" style={{width:'100%',maxWidth:380,position:'relative',zIndex:1}}>
        <div style={{textAlign:'center',marginBottom:28}}>
          <div className="font-display text-gold" style={{fontSize:64,lineHeight:1,letterSpacing:'0.06em',textShadow:'0 4px 32px rgba(245,200,66,0.4)'}}>
            SELBUVISST
          </div>
          <p className="text-muted" style={{fontSize:12,letterSpacing:'0.2em',textTransform:'uppercase',marginTop:4}}>Det norske stikkspillet</p>
          <div style={{display:'flex',justifyContent:'center',gap:12,marginTop:10,fontSize:20,opacity:0.6}}>
            <span>♠</span><span style={{color:'#c0392b'}}>♥</span><span style={{color:'#c0392b'}}>♦</span><span>♣</span>
          </div>
        </div>

        {/* Mode tabs */}
        <div className="glass-sm" style={{display:'flex',padding:4,gap:4,marginBottom:14}}>
          {(['login','guest'] as const).map(mode => (
            <button key={mode} onClick={() => { setAuthMode(mode); setError('') }}
              className={authMode===mode ? 'tab-active' : ''}
              style={{flex:1,padding:'9px 0',borderRadius:10,border:'none',cursor:'pointer',fontSize:13,transition:'all 0.2s',
                background:authMode===mode?undefined:'transparent',color:authMode===mode?undefined:'rgba(255,248,231,0.45)'}}>
              {mode==='login' ? '🔑 Logg inn / Registrer' : '👤 Spill som gjest'}
            </button>
          ))}
        </div>

        <div className="glass" style={{padding:22}}>
          {authMode === 'guest' ? (
            <form onSubmit={handleGuestLogin} style={{display:'flex',flexDirection:'column',gap:12}}>
              <p className="text-muted" style={{fontSize:12,textAlign:'center',lineHeight:1.6}}>
                Spill uten konto. Poengtavlen teller ikke gjestespill.
              </p>
              <input className="input-glass" type="text" placeholder="Ditt navn" value={guestName}
                onChange={e => setGuestName(e.target.value)} required maxLength={20} />
              {error && <p style={{color:'#f87171',fontSize:13,textAlign:'center'}}>{error}</p>}
              <button type="submit" className="btn-gold" style={{width:'100%'}}>
                Spill som gjest →
              </button>
            </form>
          ) : (
            <>
              <div className="glass-sm" style={{display:'flex',padding:3,gap:3,marginBottom:16}}>
                {['Logg inn','Registrer'].map((label, i) => (
                  <button key={label} onClick={() => setIsSignUp(i===1)}
                    className={i===1===isSignUp ? 'tab-active' : ''}
                    style={{flex:1,padding:'8px 0',borderRadius:9,border:'none',cursor:'pointer',fontSize:13,transition:'all 0.18s',
                      background:(i===1)===isSignUp?undefined:'transparent',color:(i===1)===isSignUp?undefined:'rgba(255,248,231,0.45)'}}>
                    {label}
                  </button>
                ))}
              </div>
              <form onSubmit={handleAuth} style={{display:'flex',flexDirection:'column',gap:11}}>
                {isSignUp && <input className="input-glass" type="text" placeholder="Ditt navn" value={name} onChange={e=>setName(e.target.value)} required />}
                <input className="input-glass" type="email" placeholder="E-post" value={email} onChange={e=>setEmail(e.target.value)} required />
                <input className="input-glass" type="password" placeholder="Passord" value={password} onChange={e=>setPassword(e.target.value)} required />
                {error && <p style={{color:'#f87171',fontSize:13,textAlign:'center'}}>{error}</p>}
                <button type="submit" className="btn-gold" style={{width:'100%',marginTop:2}}>
                  {isSignUp ? 'Opprett konto' : 'Logg inn'} →
                </button>
              </form>
            </>
          )}
        </div>

        <div className="glass-sm" style={{marginTop:10,padding:14,background:'rgba(0,0,0,0.15)'}}>
          <p className="text-gold" style={{fontSize:10,fontWeight:600,letterSpacing:'0.15em',textTransform:'uppercase',marginBottom:7}}>Slik spiller du</p>
          <p className="text-muted" style={{fontSize:11,lineHeight:1.65}}>
            Meld stikk <strong style={{color:'var(--gold)'}}>samtidig</strong> — nøyaktig riktig = <strong style={{color:'var(--gold)'}}>10 + meldt</strong>. For mange? <strong style={{color:'#f87171'}}>0 poeng</strong>.
          </p>
        </div>
      </div>
    </div>
  )

  if (view === 'game') return (
    <GameRoom roomCode={roomCode} userId={effectiveUser.id} userName={displayName}
      isGuest={isGuest} qrUrl={qrUrl} onLeave={() => setView('lobby')} />
  )

  if (view === 'scores') return (
    <div style={{minHeight:'100vh',padding:16,position:'relative'}}>
      <div className="orb orb-1" /><div className="orb orb-2" />
      <div style={{maxWidth:640,margin:'0 auto',position:'relative',zIndex:1}}>
        <button onClick={() => setView('lobby')} className="btn-glass" style={{padding:'8px 18px',fontSize:13,marginBottom:16}}>← Tilbake</button>
        <Leaderboard />
      </div>
    </div>
  )

  // ── LOBBY ────────────────────────────────────────────────────────────────
  return (
    <div style={{minHeight:'100vh',padding:16,position:'relative'}}>
      <div className="orb orb-1" /><div className="orb orb-2" /><div className="orb orb-3" />
      <div style={{maxWidth:420,margin:'0 auto',position:'relative',zIndex:1}}>
        <div style={{textAlign:'center',paddingTop:40,paddingBottom:20}}>
          <div className="font-display text-gold" style={{fontSize:50,lineHeight:1,textShadow:'0 4px 24px rgba(245,200,66,0.35)'}}>SELBUVISST</div>
          <p className="text-muted" style={{fontSize:12,marginTop:5}}>
            Hei, <span className="text-gold-light" style={{fontWeight:500}}>{displayName}</span>
            {isGuest && <span style={{fontSize:10,marginLeft:6,opacity:0.5}}>(gjest)</span>}
            {' '}👋
          </p>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {!isGuest && (
            <button onClick={createRoom} className="btn-gold" style={{width:'100%',padding:17,fontSize:16,borderRadius:18}}>
              ♠ Opprett nytt rom
            </button>
          )}
          {isGuest && (
            <div style={{background:'rgba(245,200,66,0.07)',border:'1px solid rgba(245,200,66,0.2)',borderRadius:14,padding:'10px 16px',textAlign:'center'}}>
              <p className="text-muted" style={{fontSize:12}}>Gjester kan bli med i rom, men ikke opprette nye.</p>
            </div>
          )}

          <div className="glass" style={{padding:18}}>
            <p className="text-gold" style={{fontSize:10,fontWeight:600,letterSpacing:'0.15em',textTransform:'uppercase',marginBottom:10}}>Bli med i rom</p>
            <form onSubmit={joinRoom} style={{display:'flex',gap:8}}>
              <input className="input-glass" type="text" placeholder="KODE" value={joining} onChange={e=>setJoining(e.target.value)}
                style={{textAlign:'center',textTransform:'uppercase',letterSpacing:'0.25em',fontWeight:700,fontSize:19}} maxLength={5} />
              <button type="submit" className="btn-gold" style={{padding:'12px 18px',flexShrink:0}}>↵</button>
            </form>
            {error && <p style={{color:'#f87171',fontSize:12,marginTop:7,textAlign:'center'}}>{error}</p>}
          </div>

          {!isGuest && (
            <button onClick={() => setView('scores')} className="btn-glass" style={{width:'100%',padding:13}}>🏆 Poengtavle</button>
          )}

          <button onClick={signOut} style={{background:'none',border:'none',color:'rgba(255,248,231,0.22)',fontSize:12,cursor:'pointer',padding:8,transition:'color 0.2s'}}
            onMouseOver={e=>(e.currentTarget.style.color='rgba(255,248,231,0.5)')} onMouseOut={e=>(e.currentTarget.style.color='rgba(255,248,231,0.22)')}>
            {isGuest ? 'Bytt til konto / annet navn' : 'Logg ut'}
          </button>
        </div>
      </div>
    </div>
  )
}
