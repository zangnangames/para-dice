import { useState, useEffect } from 'react'
import { api } from '@/lib/api'

interface RankEntry {
  rank: number
  deckId: string
  deckName: string
  ownerNickname: string
  dice: Array<{ id: string; faces: number[]; order: number }>
  totalGames: number
  wins: number
  losses: number
  winRate: number
}

interface RankingScreenProps {
  onBack: () => void
}

export function RankingScreen({ onBack }: RankingScreenProps) {
  const [list, setList] = useState<RankEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api.stats.rankings()
      .then(data => setList(data as RankEntry[]))
      .catch(() => setError('랭킹을 불러오지 못했습니다'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px 48px' }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button
          onClick={onBack}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 22, color: '#64748b', padding: 0, lineHeight: 1,
          }}
        >‹</button>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#1e293b' }}>덱 승률 랭킹</h2>
          <p style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}>5판 이상 플레이한 덱 · 상위 20개</p>
        </div>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8', fontSize: 14 }}>
          불러오는 중...
        </div>
      )}

      {error && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#ef4444', fontSize: 14 }}>
          {error}
        </div>
      )}

      {!loading && !error && list.length === 0 && (
        <div style={{
          textAlign: 'center', padding: '60px 24px',
          color: '#94a3b8', fontSize: 14, lineHeight: 1.8,
        }}>
          아직 랭킹 데이터가 없습니다.<br />
          5판 이상 플레이한 덱이 생기면 여기에 표시됩니다.
        </div>
      )}

      {!loading && list.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {list.map(entry => (
            <RankCard key={entry.deckId} entry={entry} />
          ))}
        </div>
      )}
    </div>
  )
}

function RankCard({ entry }: { entry: RankEntry }) {
  const medalColor =
    entry.rank === 1 ? '#f59e0b' :
    entry.rank === 2 ? '#94a3b8' :
    entry.rank === 3 ? '#b45309' : null

  const barWidth = Math.round(entry.winRate)

  return (
    <div style={{
      borderRadius: 16,
      background: '#fff',
      border: `1.5px solid ${entry.rank <= 3 ? '#e2e8f0' : '#f1f5f9'}`,
      padding: '14px 16px',
      boxShadow: entry.rank === 1 ? '0 4px 16px rgba(245,158,11,0.12)' : 'none',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* 상위 3위 강조 배경 */}
      {entry.rank <= 3 && (
        <div style={{
          position: 'absolute', inset: 0,
          background: entry.rank === 1
            ? 'linear-gradient(135deg, rgba(245,158,11,0.06) 0%, transparent 60%)'
            : entry.rank === 2
            ? 'linear-gradient(135deg, rgba(148,163,184,0.06) 0%, transparent 60%)'
            : 'linear-gradient(135deg, rgba(180,83,9,0.05) 0%, transparent 60%)',
          pointerEvents: 'none',
        }} />
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, position: 'relative' }}>
        {/* 순위 뱃지 */}
        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: entry.rank <= 3 ? 20 : 15,
          fontWeight: 900,
          background: medalColor ? `${medalColor}18` : '#f8fafc',
          color: medalColor ?? '#94a3b8',
          border: `1.5px solid ${medalColor ? `${medalColor}40` : '#f1f5f9'}`,
        }}>
          {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : entry.rank}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* 덱 이름 + 플레이어 */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: '#1e293b' }}>{entry.deckName}</span>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>by {entry.ownerNickname}</span>
          </div>

          {/* 주사위 면 미리보기 */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 10, flexWrap: 'wrap' }}>
            {entry.dice
              .slice()
              .sort((a, b) => a.order - b.order)
              .map((die, i) => (
                <div key={die.id ?? i} style={{
                  display: 'flex', gap: 2,
                  padding: '2px 6px',
                  borderRadius: 6,
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                }}>
                  {[...die.faces]
                    .sort((a, b) => b - a)
                    .map((f, fi) => (
                      <span key={fi} style={{ fontSize: 11, color: '#475569', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                        {f}
                      </span>
                    ))}
                </div>
              ))}
          </div>

          {/* 승률 바 */}
          <div style={{ marginBottom: 6 }}>
            <div style={{ height: 6, borderRadius: 99, background: '#f1f5f9', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 99,
                width: `${barWidth}%`,
                background: entry.winRate >= 60
                  ? 'linear-gradient(90deg, #16a34a, #4ade80)'
                  : entry.winRate >= 50
                  ? 'linear-gradient(90deg, #2563eb, #60a5fa)'
                  : 'linear-gradient(90deg, #dc2626, #f87171)',
                transition: 'width 0.4s ease',
              }} />
            </div>
          </div>

          {/* 수치 */}
          <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
            <span style={{ fontWeight: 800, color: entry.winRate >= 60 ? '#16a34a' : entry.winRate >= 50 ? '#2563eb' : '#dc2626' }}>
              {entry.winRate}%
            </span>
            <span style={{ color: '#94a3b8' }}>{entry.wins}승 {entry.losses}패</span>
            <span style={{ color: '#cbd5e1' }}>총 {entry.totalGames}판</span>
          </div>
        </div>
      </div>
    </div>
  )
}
