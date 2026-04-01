'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

export default function Leaderboard() {
  const [scores, setScores] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'today' | 'week'>('all')
  const supabase = createClient()

  useEffect(() => {
    async function fetch() {
      setLoading(true)
      let q = supabase.from('scores').select('player_name, total_score, played_at, room_code').order('total_score', { ascending: false })
      if (filter === 'today') {
        const today = new Date(); today.setHours(0,0,0,0)
        q = q.gte('played_at', today.toISOString())
      } else if (filter === 'week') {
        const week = new Date(); week.setDate(week.getDate() - 7)
        q = q.gte('played_at', week.toISOString())
      }
      const { data } = await q.limit(25)
      setScores(data || [])
      setLoading(false)
    }
    fetch()
  }, [filter])

  const medals = ['🥇','🥈','🥉']

  return (
    <div className="glass float-in" style={{padding:24}}>
      <div className="font-display text-gold" style={{fontSize:40,textAlign:'center',marginBottom:4}}>POENGTAVLE</div>
      <p className="text-muted" style={{textAlign:'center',fontSize:11,marginBottom:18,letterSpacing:'0.12em',textTransform:'uppercase'}}>Globalt — Alle spill</p>

      {/* Filter tabs */}
      <div className="glass-sm" style={{display:'flex',padding:4,gap:4,marginBottom:20}}>
        {([['all','Alle tider'],['week','Denne uken'],['today','I dag']] as const).map(([val, label]) => (
          <button key={val} onClick={() => setFilter(val)}
            className={filter===val ? 'tab-active' : ''}
            style={{flex:1,padding:'8px 0',borderRadius:10,border:'none',cursor:'pointer',fontSize:12,transition:'all 0.18s',
              background: filter===val ? undefined : 'transparent',
              color: filter===val ? undefined : 'rgba(255,248,231,0.45)'}}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-muted" style={{textAlign:'center',fontSize:13,padding:'20px 0'}}>Laster...</p>
      ) : scores.length === 0 ? (
        <p className="text-muted" style={{textAlign:'center',fontSize:13,padding:'20px 0'}}>Ingen spill i denne perioden</p>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:0}}>
          {scores.map((s, i) => (
            <div key={i} style={{display:'flex',alignItems:'center',padding:'11px 0',borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
              {i < 3 ? (
                <span style={{fontSize:22,width:38,textAlign:'center'}}>{medals[i]}</span>
              ) : (
                <span className="font-display" style={{fontSize:20,width:38,textAlign:'center',color:'rgba(255,255,255,0.3)'}}>{i+1}</span>
              )}
              <div style={{width:34,height:34,borderRadius:'50%',background:'linear-gradient(135deg,var(--purple-bright),var(--purple-mid))',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,marginRight:10,flexShrink:0}}>
                {s.player_name.charAt(0).toUpperCase()}
              </div>
              <div style={{flex:1}}>
                <p className="text-cream" style={{fontSize:14}}>{s.player_name}</p>
                <p className="text-muted" style={{fontSize:10}}>{s.room_code} · {new Date(s.played_at).toLocaleDateString('nb-NO')}</p>
              </div>
              <span className="font-display text-gold" style={{fontSize:26}}>{s.total_score}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
