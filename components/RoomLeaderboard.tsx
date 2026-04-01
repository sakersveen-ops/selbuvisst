'use client'
import { GameState, totalRounds, roundsPlayed } from '@/lib/game'

interface Props {
  gameState: GameState
  style?: React.CSSProperties
}

export default function RoomLeaderboard({ gameState, style }: Props) {
  const sorted = [...gameState.players].sort((a, b) => b.totalScore - a.totalScore)
  const rPlayed = roundsPlayed(gameState)
  const rTotal = totalRounds(gameState)
  const isLive = gameState.phase !== 'gameEnd'

  return (
    <div className="glass" style={{padding:18,...style}}>
      {/* Header */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
        <p className="font-display text-gold" style={{fontSize:24}}>ROMSTATISTIKK</p>
        {isLive && (
          <div style={{display:'flex',alignItems:'center',gap:5}}>
            <div style={{width:6,height:6,borderRadius:'50%',background:'#4ade80',boxShadow:'0 0 6px #4ade80'}} />
            <span className="text-muted" style={{fontSize:10}}>LIVE</span>
          </div>
        )}
      </div>

      {/* Progress */}
      <div style={{marginBottom:14}}>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
          <span className="text-muted" style={{fontSize:11}}>Runder spilt</span>
          <span className="text-gold" style={{fontSize:11,fontWeight:600}}>{rPlayed - (isLive ? 1 : 0)}/{rTotal}</span>
        </div>
        <div style={{height:4,background:'rgba(255,255,255,0.1)',borderRadius:2,overflow:'hidden'}}>
          <div style={{height:'100%',background:'linear-gradient(90deg,var(--purple-bright),var(--gold))',borderRadius:2,width:`${((rPlayed - (isLive?1:0))/rTotal)*100}%`,transition:'width 0.6s ease'}} />
        </div>
      </div>

      {/* Players ranking */}
      <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:16}}>
        {sorted.map((p, i) => {
          const isLeading = i === 0
          return (
            <div key={p.id} style={{
              display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:12,
              background: isLeading ? 'rgba(245,200,66,0.1)' : 'rgba(255,255,255,0.04)',
              border: isLeading ? '1px solid rgba(245,200,66,0.25)' : '1px solid rgba(255,255,255,0.06)',
            }}>
              <span className="font-display" style={{fontSize:22,width:24,color: i===0?'var(--gold)':i===1?'#aaa':i===2?'#cd7f32':'rgba(255,255,255,0.3)'}}>{i+1}</span>
              <div style={{width:30,height:30,borderRadius:'50%',background:'linear-gradient(135deg,var(--purple-bright),var(--purple-mid))',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,flexShrink:0}}>
                {p.name.charAt(0).toUpperCase()}
              </div>
              <div style={{flex:1}}>
                <p className="text-cream" style={{fontSize:13,fontWeight:500}}>{p.name}</p>
                {/* Per-round scores sparkline */}
                <div style={{display:'flex',gap:3,marginTop:3}}>
                  {(gameState.scores[p.id] || []).map((s, ri) => (
                    <div key={ri} style={{
                      width:18, height:18, borderRadius:5, display:'flex',alignItems:'center',justifyContent:'center',
                      background: s===0 ? 'rgba(248,113,113,0.25)' : 'rgba(74,222,128,0.2)',
                      fontSize:9, fontWeight:700,
                      color: s===0 ? '#f87171' : '#4ade80',
                    }}>{s===0?'✗':s}</div>
                  ))}
                  {/* Empty future rounds */}
                  {Array.from({length: rTotal - (gameState.scores[p.id]?.length||0)}, (_,ri) => (
                    <div key={`f${ri}`} style={{width:18,height:18,borderRadius:5,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)'}} />
                  ))}
                </div>
              </div>
              <span className="font-display text-gold" style={{fontSize:26}}>{p.totalScore}</span>
            </div>
          )
        })}
      </div>

      {/* Stats row */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>
        {[
          { label:'Høyeste runde', value: Math.max(0, ...Object.values(gameState.scores).flat()) },
          { label:'Nuller totalt', value: Object.values(gameState.scores).flat().filter(s=>s===0).length },
          { label:'Stikk denne runde', value: gameState.players.reduce((a,p)=>a+p.tricks,0) },
        ].map(stat => (
          <div key={stat.label} style={{background:'rgba(0,0,0,0.2)',borderRadius:10,padding:'10px 8px',textAlign:'center'}}>
            <p className="font-display text-gold" style={{fontSize:22}}>{stat.value}</p>
            <p className="text-muted" style={{fontSize:10,marginTop:2,lineHeight:1.3}}>{stat.label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
