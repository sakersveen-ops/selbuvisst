'use client'
import { GameState, calcScore } from '@/lib/game'

export default function ScoreBoard({ gameState }: { gameState: GameState }) {
  const rounds = Array.from({ length: 10 - gameState.round + 1 }, (_, i) => 10 - i)

  return (
    <div className="bg-felt2 border border-gold/30 rounded-2xl p-4">
      <h3 className="text-gold font-semibold text-center mb-3">
        Runde {gameState.round} ferdig!
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="text-green-500 text-left pb-2 pr-2">Spiller</th>
              {rounds.map(r => (
                <th key={r} className={`text-center pb-2 px-1 ${r === gameState.round ? 'text-gold' : 'text-green-700'}`}>{r}♣</th>
              ))}
              <th className="text-gold text-center pb-2">Tot</th>
            </tr>
          </thead>
          <tbody>
            {[...gameState.players].sort((a, b) => b.totalScore - a.totalScore).map(p => (
              <tr key={p.id} className="border-t border-green-900">
                <td className="text-card py-2 pr-2 font-semibold whitespace-nowrap">{p.name.split(' ')[0]}</td>
                {rounds.map((r, i) => {
                  const score = gameState.scores[p.id]?.[i]
                  return (
                    <td key={r} className={`text-center py-2 px-1 font-mono ${score === 0 ? 'text-red-500' : 'text-green-300'}`}>
                      {score !== undefined ? score : '-'}
                    </td>
                  )
                })}
                <td className="text-gold font-bold text-center py-2 font-mono">{p.totalScore}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 pt-3 border-t border-green-900">
        <p className="text-green-500 text-xs text-center mb-2">Denne runden</p>
        <div className="flex flex-wrap gap-2 justify-center">
          {gameState.players.map(p => {
            const hit = p.bid === p.tricks
            return (
              <div key={p.id} className={`rounded-lg px-3 py-2 text-center border ${hit ? 'bg-green-900/40 border-green-600' : 'bg-red-900/30 border-red-800'}`}>
                <p className="text-card text-xs">{p.name.split(' ')[0]}</p>
                <p className={`font-bold text-sm ${hit ? 'text-green-400' : 'text-red-400'}`}>
                  {hit ? '+' : '✗'} {p.score}
                </p>
                <p className="text-xs text-gray-500">{p.bid} → {p.tricks}</p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
