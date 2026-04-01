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
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
      setLoading(false)
    })
    supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
    })
  }, [])

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { data: { display_name: name } }
      })
      if (error) setError(error.message)
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
    }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  async function createRoom() {
    const code = Math.random().toString(36).substring(2, 7).toUpperCase()
    const { error } = await supabase.from('rooms').insert({
      code,
      host_id: user.id,
      host_name: user.user_metadata?.display_name || user.email,
      players: [{ id: user.id, name: user.user_metadata?.display_name || user.email }],
      state: null,
    })
    if (!error) {
      setRoomCode(code)
      setView('game')
    }
  }

  async function joinRoom(e: React.FormEvent) {
    e.preventDefault()
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('code', joining.toUpperCase())
      .single()
    if (error || !data) { setError('Rom ikke funnet'); return }
    const players = data.players || []
    if (players.find((p: any) => p.id === user.id)) {
      setRoomCode(joining.toUpperCase())
      setView('game')
      return
    }
    if (players.length >= 5) { setError('Rommet er fullt (maks 5 spillere)'); return }
    const updated = [...players, { id: user.id, name: user.user_metadata?.display_name || user.email }]
    await supabase.from('rooms').update({ players: updated }).eq('code', joining.toUpperCase())
    setRoomCode(joining.toUpperCase())
    setView('game')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gold text-2xl font-display">♠ Laster... ♣</div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="text-6xl mb-2">🃏</div>
            <h1 className="text-4xl font-display text-gold mb-1">Selbuvisst</h1>
            <p className="text-green-300 text-sm">Det norske stikkspillet</p>
          </div>
          <div className="bg-felt2 border border-gold/30 rounded-2xl p-6 shadow-2xl">
            <div className="flex mb-6 bg-felt rounded-lg p-1">
              <button onClick={() => setIsSignUp(false)}
                className={`flex-1 py-2 rounded-md text-sm transition-all ${!isSignUp ? 'bg-gold text-felt font-semibold' : 'text-gold/70'}`}>
                Logg inn
              </button>
              <button onClick={() => setIsSignUp(true)}
                className={`flex-1 py-2 rounded-md text-sm transition-all ${isSignUp ? 'bg-gold text-felt font-semibold' : 'text-gold/70'}`}>
                Registrer
              </button>
            </div>
            <form onSubmit={handleAuth} className="space-y-3">
              {isSignUp && (
                <input
                  type="text" placeholder="Ditt navn" value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full bg-felt border border-gold/40 rounded-lg px-4 py-3 text-card placeholder-green-700 focus:outline-none focus:border-gold"
                  required
                />
              )}
              <input
                type="email" placeholder="E-post" value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-felt border border-gold/40 rounded-lg px-4 py-3 text-card placeholder-green-700 focus:outline-none focus:border-gold"
                required
              />
              <input
                type="password" placeholder="Passord" value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-felt border border-gold/40 rounded-lg px-4 py-3 text-card placeholder-green-700 focus:outline-none focus:border-gold"
                required
              />
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <button type="submit"
                className="w-full bg-gold hover:bg-gold2 text-felt font-bold py-3 rounded-lg transition-colors pulse-gold">
                {isSignUp ? 'Opprett konto' : 'Logg inn'}
              </button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  if (view === 'game') {
    return <GameRoom roomCode={roomCode} userId={user.id} userName={user.user_metadata?.display_name || user.email} onLeave={() => setView('lobby')} />
  }

  if (view === 'scores') {
    return (
      <div className="min-h-screen p-4">
        <div className="max-w-2xl mx-auto">
          <button onClick={() => setView('lobby')} className="text-gold/70 hover:text-gold mb-4">← Tilbake</button>
          <Leaderboard />
        </div>
      </div>
    )
  }

  // Lobby
  return (
    <div className="min-h-screen p-4">
      <div className="max-w-md mx-auto">
        <div className="text-center py-8">
          <div className="text-5xl mb-2">🃏</div>
          <h1 className="text-3xl font-display text-gold">Selbuvisst</h1>
          <p className="text-green-400 text-sm mt-1">Hei, {user.user_metadata?.display_name || user.email}!</p>
        </div>

        <div className="space-y-4">
          <button onClick={createRoom}
            className="w-full bg-gold hover:bg-gold2 text-felt font-bold py-4 rounded-xl text-lg transition-all hover:scale-[1.02]">
            ♠ Opprett nytt rom
          </button>

          <form onSubmit={joinRoom} className="bg-felt2 border border-gold/30 rounded-xl p-4">
            <p className="text-gold text-sm mb-3 font-semibold">Bli med i et rom</p>
            <div className="flex gap-2">
              <input
                type="text" placeholder="Romkode" value={joining}
                onChange={e => setJoining(e.target.value)}
                className="flex-1 bg-felt border border-gold/40 rounded-lg px-4 py-3 text-card placeholder-green-700 focus:outline-none focus:border-gold uppercase tracking-widest text-center font-mono"
                maxLength={5}
              />
              <button type="submit" className="bg-gold/80 hover:bg-gold text-felt font-bold px-5 rounded-lg transition-colors">
                ↵
              </button>
            </div>
            {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
          </form>

          <button onClick={() => setView('scores')}
            className="w-full border border-gold/30 hover:border-gold text-gold py-3 rounded-xl transition-colors">
            🏆 Poengtavle
          </button>

          <button onClick={signOut}
            className="w-full text-green-700 hover:text-green-500 py-2 text-sm transition-colors">
            Logg ut
          </button>
        </div>

        <div className="mt-8 bg-felt2/50 rounded-xl p-4 border border-green-900">
          <h3 className="text-gold text-sm font-semibold mb-2">Regler:</h3>
          <ul className="text-green-300 text-xs space-y-1">
            <li>• Start med 10 kort, ned til 1</li>
            <li>• Meld stikk <strong className="text-gold">samtidig</strong> (fingre frem!)</li>
            <li>• Nøyaktig riktig antall stikk = 10 + meldt</li>
            <li>• For mange eller for få = 0 poeng</li>
            <li>• Runde 1: by usett!</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
