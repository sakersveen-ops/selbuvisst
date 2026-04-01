'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

export default function Leaderboard() {
  const [scores, setScores] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function fetchScores() {
      const { data } = await supabase
        .from('scores')
        .select('player_name, total_score, played_at')
        .order('total_score', { ascending: false })
        .limit(20)
      setScores(data || [])
      setLoading(false)
    }
    fetchScores()
  }, [])

  return (
    <div className="bg-felt2 border border-gold/30 rounded-2xl p-6">
      <h2 className="text-gold text-xl font-display text-center mb-4">🏆 Poengtavle</h2>
      {loading ? (
        <p className="text-green-500 text-center text-sm">Laster...</p>
      ) : scores.length === 0 ? (
        <p className="text-green-600 text-center text-sm">Ingen spill spilt ennå</p>
      ) : (
        <table className="w-full">
          <thead>
            <tr>
              <th className="text-green-600 text-left text-xs pb-3">#</th>
              <th className="text-green-600 text-left text-xs pb-3">Spiller</th>
              <th className="text-green-600 text-right text-xs pb-3">Poeng</th>
              <th className="text-green-600 text-right text-xs pb-3">Dato</th>
            </tr>
          </thead>
          <tbody>
            {scores.map((s, i) => (
              <tr key={i} className="border-t border-green-900">
                <td className="py-2 text-gold font-mono text-sm">{i + 1}</td>
                <td className="py-2 text-card text-sm">{s.player_name}</td>
                <td className="py-2 text-gold font-mono font-bold text-right">{s.total_score}</td>
                <td className="py-2 text-green-700 text-xs text-right">
                  {new Date(s.played_at).toLocaleDateString('nb-NO')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
