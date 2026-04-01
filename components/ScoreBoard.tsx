'use client'
import { GameState, totalRounds } from '@/lib/game'

export default function ScoreBoard({ gameState }: { gameState: GameState }) {
  const rTotal = totalRounds(gameState)
  const rounds = Array.from({ length: rTotal }, (_, i) => gameState.startRound - i)

  return (
    <div className="glass float-in" style={{padding:24}}>
      <div className="font-display text-gold" style={{fontSize:34,textAlign:'center',marginBottom:2}}>RUNDE {gameState.round} FERDIG</div>
      <p className="text-muted" style={{textAlign:'center',fontSize:11,marginBottom:20,letterSpacing:'0.1em'}}>
        {gameState.round === gameState.minRound ? 'SISTE RUNDE!' : `${gameState.round - 1} KORT NESTE`}
      </p>

      {/* Per-player result cards */}
      <div style={{display:'flex',flexWrap:'wrap',gap:8,justifyContent:'center',marginBottom:20}}>
        {gameState.players.map(p => {
          const hit = p.bid === p.tricks
          return (
            <div key={p.id} style={{
              padding:'12px 16px', borderRadius:14, minWidth:100, textAlign:'center',
              background: hit ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)',
              border: `1px solid ${hit ? 'rgba(74,222,128,0.28)' : 'rgba(248,113,113,0.22)'}`,
            }}>
              <p className="text-cream" style={{fontSize:12,marginBottom:3}}>{p.name.split(' ')[0]}</p>
              <p style={{fontSize:26,fontWeight:700,fontFamily:'Bebas Neue, sans-serif',lineHeight:1,color: hit ? '#4ade80' : '#f87171'}}>
                {hit ? '+' : '✗'}{p.score}
              </p>
              <p className="text-muted" style={{fontSize:10,marginTop:3}}>{p.bid} meldt → {p.tricks} tatt</p>
            </div>
          )
        })}
      </div>

      {/* Full score table */}
      <div style={{overflowX:'auto'}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:12,minWidth:240}}>
          <thead>
            <tr>
              <th style={{textAlign:'left',paddingBottom:8,color:'rgba(255,248,231,0.4)',fontWeight:400,paddingRight:8}}>Spiller</th>
              {rounds.map(r => (
                <th key={r} style={{textAlign:'center',paddingBottom:8,color: r===gameState.round ? 'var(--gold)' : 'rgba(255,248,231,0.3)',fontWeight: r===gameState.round ? 600 : 400,minWidth:28}}>
                  {r}
                </th>
              ))}
              <th style={{textAlign:'right',paddingBottom:8,color:'var(--gold)',fontWeight:600,paddingLeft:8}}>Tot</th>
            </tr>
          </thead>
          <tbody>
            {[...gameState.players].sort((a,b) => b.totalScore - a.totalScore).map(p => (
              <tr key={p.id} style={{borderTop:'1px solid rgba(255,255,255,0.06)'}}>
                <td style={{padding:'8px 8px 8px 0',color:'var(--cream)',fontSize:13,whiteSpace:'nowrap'}}>{p.name.split(' ')[0]}</td>
                {rounds.map((r, i) => {
                  const s = gameState.scores[p.id]?.[i]
                  return (
                    <td key={r} style={{textAlign:'center',padding:'8px 2px',fontSize:12,fontFamily:'monospace',
                      color: s===undefined ? 'rgba(255,255,255,0.15)' : s===0 ? '#f87171' : '#4ade80'}}>
                      {s!==undefined ? s : '·'}
                    </td>
                  )
                })}
                <td style={{textAlign:'right',fontFamily:'Bebas Neue, sans-serif',fontSize:24,color:'var(--gold)',paddingLeft:8}}>{p.totalScore}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
