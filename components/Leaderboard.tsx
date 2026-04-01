'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

export default function Leaderboard() {
  const [scores, setScores] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    supabase.from('scores').select('player_name, total_score, played_at').order('total_score', { ascending: false }).limit(20)
      .then(({ data }) => { setScores(data || []); setLoading(false) })
  }, [])

  return (
    <div className="glass float-in" style={{padding:24}}>
      <div className="font-display text-gold" style={{fontSize:40,textAlign:'center',marginBottom:4}}>POENGTAVLE</div>
      <p className="text-muted" style={{textAlign:'center',fontSize:12,marginBottom:20,letterSpacing:'0.1em'}}>ALLE TIDER</p>

      {loading ? (
        <p className="text-muted" style={{textAlign:'center',fontSize:13}}>Laster...</p>
      ) : scores.length === 0 ? (
        <p className="text-muted" style={{textAlign:'center',fontSize:13}}>Ingen spill spilt ennå</p>
      ) : scores.map((s, i) => (
        <div key={i} style={{display:'flex',alignItems:'center',padding:'12px 0',borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
          <span className="font-display text-gold" style={{fontSize:26,width:40,opacity: i<3 ? 1 : 0.5}}>{i+1}</span>
          {i === 0 && <span style={{marginRight:8,fontSize:18}}>🏆</span>}
          {i === 1 && <span style={{marginRight:8,fontSize:18}}>🥈</span>}
          {i === 2 && <span style={{marginRight:8,fontSize:18}}>🥉</span>}
          {i > 2 && <div style={{width:36,height:36,borderRadius:'50%',background:'linear-gradient(135deg,var(--purple-bright),var(--purple-mid))',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,marginRight:8,flexShrink:0}}>{s.player_name.charAt(0).toUpperCase()}</div>}
          <span className="text-cream" style={{flex:1,fontSize:15}}>{s.player_name}</span>
          <span className="text-muted" style={{fontSize:11,marginRight:12}}>{new Date(s.played_at).toLocaleDateString('nb-NO')}</span>
          <span className="font-display text-gold" style={{fontSize:26}}>{s.total_score}</span>
        </div>
      ))}
    </div>
  )
}
