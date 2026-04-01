'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import GameRoom from '@/components/GameRoom'
import Leaderboard from '@/components/Leaderboard'

export default function Home() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [error, setError] = useState('')
  const [view, setView] = useState<'lobby' | 'game' | 'scores'>('lobby')
  const [roomCode, setRoomCode] = useState('')
  const [joining, setJoining] = useState('')
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => { setUser(data.user); setLoading(false) })
    supabase.auth.onAuthStateChange((_, session) => setUser(session?.user ?? null))
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

  async function createRoom() {
    const code = Math.random().toString(36).substring(2, 7).toUpperCase()
    await supabase.from('rooms').insert({ code, host_id: user.id, host_name: user.user_metadata?.display_name || user.email, players: [{ id: user.id, name: user.user_metadata?.display_name || user.email }], state: null })
    setRoomCode(code); setView('game')
  }

  async function joinRoom(e: React.FormEvent) {
    e.preventDefault()
    const { data, error } = await supabase.from('rooms').select('*').eq('code', joining.toUpperCase()).single()
    if (error || !data) { setError('Rom ikke funnet'); return }
    const players = data.players || []
    if (players.find((p: any) => p.id === user.id)) { setRoomCode(joining.toUpperCase()); setView('game'); return }
    if (players.length >= 5) { setError('Rommet er fullt (maks 5)'); return }
    await supabase.from('rooms').update({ players: [...players, { id: user.id, name: user.user_metadata?.display_name || user.email }] }).eq('code', joining.toUpperCase())
    setRoomCode(joining.toUpperCase()); setView('game')
  }

  if (loading) return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div className="orb orb-1" /><div className="orb orb-2" />
      <div className="font-display text-gold" style={{fontSize:'4rem',letterSpacing:'0.1em',position:'relative',zIndex:1}}>SELBUVISST</div>
    </div>
  )

  if (!user) return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',padding:16,position:'relative'}}>
      <div className="orb orb-1" /><div className="orb orb-2" /><div className="orb orb-3" />
      <div className="float-in" style={{width:'100%',maxWidth:380,position:'relative',zIndex:1}}>
        <div style={{textAlign:'center',marginBottom:32}}>
          <div className="font-display text-gold" style={{fontSize:68,lineHeight:1,letterSpacing:'0.06em',textShadow:'0 4px 32px rgba(245,200,66,0.4)'}}>
            SELBUVISST
          </div>
          <p className="text-muted" style={{fontSize:12,letterSpacing:'0.2em',textTransform:'uppercase',marginTop:4}}>Det norske stikkspillet</p>
          <div style={{display:'flex',justifyContent:'center',gap:12,marginTop:12,fontSize:22,opacity:0.65}}>
            <span>♠</span><span style={{color:'#c0392b'}}>♥</span><span style={{color:'#c0392b'}}>♦</span><span>♣</span>
          </div>
        </div>
        <div className="glass" style={{padding:24}}>
          <div className="glass-sm" style={{display:'flex',padding:4,gap:4,marginBottom:20}}>
            {['Logg inn','Registrer'].map((label, i) => (
              <button key={label} onClick={() => setIsSignUp(i===1)}
                className={i===1===isSignUp ? 'tab-active' : ''}
                style={{flex:1,padding:'9px 0',borderRadius:12,border:'none',cursor:'pointer',fontSize:14,transition:'all 0.2s',background: (i===1)===isSignUp ? undefined : 'transparent',color: (i===1)===isSignUp ? undefined : 'rgba(255,248,231,0.5)'}}>
                {label}
              </button>
            ))}
          </div>
          <form onSubmit={handleAuth} style={{display:'flex',flexDirection:'column',gap:12}}>
            {isSignUp && <input className="input-glass" type="text" placeholder="Ditt navn" value={name} onChange={e=>setName(e.target.value)} required />}
            <input className="input-glass" type="email" placeholder="E-post" value={email} onChange={e=>setEmail(e.target.value)} required />
            <input className="input-glass" type="password" placeholder="Passord" value={password} onChange={e=>setPassword(e.target.value)} required />
            {error && <p style={{color:'#f87171',fontSize:13,textAlign:'center'}}>{error}</p>}
            <button type="submit" className="btn-gold" style={{width:'100%',marginTop:4}}>
              {isSignUp ? 'Opprett konto' : 'Logg inn'} →
            </button>
          </form>
        </div>
        <div className="glass-sm" style={{marginTop:12,padding:16,background:'rgba(0,0,0,0.15)'}}>
          <p className="text-gold" style={{fontSize:11,fontWeight:600,letterSpacing:'0.15em',textTransform:'uppercase',marginBottom:8}}>Slik spiller du</p>
          <p className="text-muted" style={{fontSize:12,lineHeight:1.65}}>
            Meld stikk <strong style={{color:'var(--gold)'}}>samtidig</strong> med fingrene — nøyaktig riktig = <strong style={{color:'var(--gold)'}}>10 + meldt</strong>. For mange? <strong style={{color:'#f87171'}}>0 poeng</strong>. Runde 1 spilles usett!
          </p>
        </div>
      </div>
    </div>
  )

  if (view === 'game') return <GameRoom roomCode={roomCode} userId={user.id} userName={user.user_metadata?.display_name || user.email} onLeave={() => setView('lobby')} />
  if (view === 'scores') return (
    <div style={{minHeight:'100vh',padding:16,position:'relative'}}>
      <div className="orb orb-1" /><div className="orb orb-2" />
      <div style={{maxWidth:640,margin:'0 auto',position:'relative',zIndex:1}}>
        <button onClick={() => setView('lobby')} className="btn-glass" style={{padding:'8px 18px',fontSize:13,marginBottom:16}}>← Tilbake</button>
        <Leaderboard />
      </div>
    </div>
  )

  return (
    <div style={{minHeight:'100vh',padding:16,position:'relative'}}>
      <div className="orb orb-1" /><div className="orb orb-2" /><div className="orb orb-3" />
      <div style={{maxWidth:420,margin:'0 auto',position:'relative',zIndex:1}}>
        <div style={{textAlign:'center',paddingTop:48,paddingBottom:24}}>
          <div className="font-display text-gold" style={{fontSize:52,lineHeight:1,textShadow:'0 4px 24px rgba(245,200,66,0.35)'}}>SELBUVISST</div>
          <p className="text-muted" style={{fontSize:13,marginTop:6}}>
            Hei, <span className="text-gold-light" style={{fontWeight:500}}>{user.user_metadata?.display_name || user.email}</span> 👋
          </p>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          <button onClick={createRoom} className="btn-gold" style={{width:'100%',padding:18,fontSize:17,borderRadius:18}}>♠ Opprett nytt rom</button>
          <div className="glass" style={{padding:20}}>
            <p className="text-gold" style={{fontSize:11,fontWeight:600,letterSpacing:'0.15em',textTransform:'uppercase',marginBottom:12}}>Bli med i rom</p>
            <form onSubmit={joinRoom} style={{display:'flex',gap:8}}>
              <input className="input-glass" type="text" placeholder="KODE" value={joining} onChange={e=>setJoining(e.target.value)}
                style={{textAlign:'center',textTransform:'uppercase',letterSpacing:'0.25em',fontWeight:700,fontSize:20}} maxLength={5} />
              <button type="submit" className="btn-gold" style={{padding:'13px 20px',flexShrink:0}}>↵</button>
            </form>
            {error && <p style={{color:'#f87171',fontSize:12,marginTop:8,textAlign:'center'}}>{error}</p>}
          </div>
          <button onClick={() => setView('scores')} className="btn-glass" style={{width:'100%',padding:14}}>🏆 Poengtavle</button>
          <button onClick={() => supabase.auth.signOut()} style={{background:'none',border:'none',color:'rgba(255,248,231,0.25)',fontSize:12,cursor:'pointer',padding:8,transition:'color 0.2s'}}
            onMouseOver={e=>(e.currentTarget.style.color='rgba(255,248,231,0.5)')} onMouseOut={e=>(e.currentTarget.style.color='rgba(255,248,231,0.25)')}>
            Logg ut
          </button>
        </div>
      </div>
    </div>
  )
}
