import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'

// ── 타입 ──────────────────────────────────────────────────────

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

interface MyDeck {
  id: string
  name: string
  dice: Array<{ id: string; faces: number[]; order: number }>
  stats: {
    totalGames: number
    wins: number
    losses: number
    winRate: number | null
  } | null
}

type Tab = 'my' | 'global'

const FACE_COLORS = ['#fef9c3', '#dbeafe', '#dcfce7', '#fee2e2', '#ede9fe', '#fed7aa']

// ── 메인 스크린 ───────────────────────────────────────────────

interface RankingScreenProps {
  onBack: () => void
}

export function RankingScreen({ onBack }: RankingScreenProps) {
  const { isLoggedIn } = useAuthStore()
  const loggedIn = isLoggedIn()
  const [tab, setTab] = useState<Tab>(loggedIn ? 'my' : 'global')

  const [myDecks, setMyDecks] = useState<MyDeck[]>([])
  const [myLoading, setMyLoading] = useState(false)
  const [myError, setMyError] = useState('')

  const [globalList, setGlobalList] = useState<RankEntry[]>([])
  const [globalLoading, setGlobalLoading] = useState(false)
  const [globalError, setGlobalError] = useState('')

  // 내 덱 통계 로드
  useEffect(() => {
    if (!loggedIn) return
    setMyLoading(true)
    api.decks.list()
      .then(data => setMyDecks(data as MyDeck[]))
      .catch(() => setMyError('덱 목록을 불러오지 못했습니다'))
      .finally(() => setMyLoading(false))
  }, [loggedIn])

  // 전체 랭킹 로드
  useEffect(() => {
    if (tab !== 'global') return
    if (globalList.length > 0) return  // 이미 로드됨
    setGlobalLoading(true)
    api.stats.rankings()
      .then(data => setGlobalList(data as RankEntry[]))
      .catch(() => setGlobalError('랭킹을 불러오지 못했습니다'))
      .finally(() => setGlobalLoading(false))
  }, [tab])

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', paddingBottom: 48, fontFamily: 'system-ui, sans-serif' }}>

      {/* ── 헤더 ── */}
      <div style={{
        background: 'linear-gradient(135deg, #b45309 0%, #92400e 100%)',
        padding: '20px 20px 0',
      }}>
        <button
          onClick={onBack}
          style={{
            background: 'rgba(255,255,255,0.15)', border: 'none', cursor: 'pointer',
            color: '#fff', fontSize: 13, fontWeight: 600, padding: '6px 12px',
            borderRadius: 8, fontFamily: 'inherit', marginBottom: 20,
          }}
        >‹ 홈으로</button>

        <div style={{ fontSize: 22, fontWeight: 900, color: '#fff', marginBottom: 4 }}>🏆 덱 통계</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', marginBottom: 16 }}>
          내 덱 승률 분석 · 전체 플레이어 랭킹
        </div>

        {/* 탭 */}
        <div style={{ display: 'flex', gap: 4 }}>
          {loggedIn && (
            <TabBtn label="내 덱 통계" active={tab === 'my'} onClick={() => setTab('my')} />
          )}
          <TabBtn label="전체 랭킹" active={tab === 'global'} onClick={() => setTab('global')} />
        </div>
      </div>

      {/* ── 내 덱 통계 탭 ── */}
      {tab === 'my' && (
        <div style={{ padding: '16px 16px 0' }}>
          {myLoading && <LoadingState />}
          {myError && <ErrorState msg={myError} />}
          {!myLoading && !myError && myDecks.length === 0 && (
            <EmptyState
              icon="🎲"
              title="저장된 덱이 없습니다"
              sub="덱 빌더에서 덱을 만들고 저장하세요"
            />
          )}
          {!myLoading && myDecks.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {myDecks.map(deck => (
                <MyDeckCard key={deck.id} deck={deck} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── 전체 랭킹 탭 ── */}
      {tab === 'global' && (
        <div style={{ padding: '16px 16px 0' }}>
          <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 12 }}>
            5판 이상 플레이한 덱 · 승률 기준 상위 20개
          </div>
          {globalLoading && <LoadingState />}
          {globalError && <ErrorState msg={globalError} />}
          {!globalLoading && !globalError && globalList.length === 0 && (
            <EmptyState
              icon="🏆"
              title="아직 랭킹 데이터가 없습니다"
              sub="5판 이상 플레이한 덱이 생기면 여기에 표시됩니다"
            />
          )}
          {!globalLoading && globalList.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {globalList.map(entry => (
                <RankCard key={entry.deckId} entry={entry} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── 내 덱 카드 ────────────────────────────────────────────────

function MyDeckCard({ deck }: { deck: MyDeck }) {
  const [expanded, setExpanded] = useState(false)

  const stats = deck.stats
  const totalGames = stats?.totalGames ?? 0
  const wins = stats?.wins ?? 0
  const losses = stats?.losses ?? 0
  const winRate = stats?.winRate ?? null

  const winRateColor =
    winRate === null ? '#94a3b8' :
    winRate >= 60 ? '#16a34a' :
    winRate >= 50 ? '#2563eb' : '#dc2626'

  return (
    <div style={{
      borderRadius: 16, background: '#fff',
      border: '1.5px solid #f1f5f9',
      overflow: 'hidden',
    }}>
      {/* 카드 헤더 (클릭으로 펼치기) */}
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          width: '100%', background: 'none', border: 'none', cursor: 'pointer',
          padding: '14px 16px', textAlign: 'left', fontFamily: 'inherit',
          display: 'flex', alignItems: 'center', gap: 14,
        }}
      >
        {/* 승률 원형 */}
        <WinRateCircle winRate={winRate} totalGames={totalGames} />

        {/* 덱 정보 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#1e293b', marginBottom: 4 }}>
            {deck.name}
          </div>
          <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
            {totalGames === 0 ? (
              <span style={{ color: '#94a3b8' }}>아직 대전 기록 없음</span>
            ) : (
              <>
                <span style={{ color: '#16a34a', fontWeight: 700 }}>{wins}승</span>
                <span style={{ color: '#dc2626', fontWeight: 700 }}>{losses}패</span>
                <span style={{ color: '#94a3b8' }}>총 {totalGames}판</span>
              </>
            )}
          </div>
        </div>

        {/* 승률 수치 + 화살표 */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
          {winRate !== null && (
            <span style={{ fontSize: 20, fontWeight: 900, color: winRateColor, fontVariantNumeric: 'tabular-nums' }}>
              {winRate}%
            </span>
          )}
          <span style={{ fontSize: 12, color: '#cbd5e1' }}>{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {/* 승률 바 */}
      {totalGames > 0 && (
        <div style={{ height: 4, background: '#f1f5f9', marginTop: -4 }}>
          <div style={{
            height: '100%',
            width: `${winRate ?? 0}%`,
            background: winRate !== null && winRate >= 60
              ? 'linear-gradient(90deg, #16a34a, #4ade80)'
              : winRate !== null && winRate >= 50
              ? 'linear-gradient(90deg, #2563eb, #60a5fa)'
              : 'linear-gradient(90deg, #dc2626, #f87171)',
            transition: 'width 0.4s ease',
          }} />
        </div>
      )}

      {/* 펼쳐진 주사위 상세 */}
      {expanded && (
        <div style={{
          borderTop: '1px solid #f8fafc',
          padding: '14px 16px',
          background: '#fafafa',
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            주사위 구성
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
            {[...deck.dice]
              .sort((a, b) => a.order - b.order)
              .map((die, i) => (
                <DieDetailCard key={die.id} die={die} index={i} />
              ))}
          </div>

          {/* 간단한 통계 요약 */}
          {totalGames > 0 && (
            <div style={{
              marginTop: 12, padding: '10px 14px',
              borderRadius: 10, background: '#fff',
              border: '1px solid #e2e8f0',
              display: 'flex', justifyContent: 'space-around',
            }}>
              <StatCell label="승" value={String(wins)} color="#16a34a" />
              <Divider />
              <StatCell label="패" value={String(losses)} color="#dc2626" />
              <Divider />
              <StatCell label="승률" value={winRate !== null ? `${winRate}%` : '-'} color={winRateColor} />
              <Divider />
              <StatCell label="총판" value={String(totalGames)} color="#64748b" />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── 전체 랭킹 카드 ────────────────────────────────────────────

function RankCard({ entry }: { entry: RankEntry }) {
  const [expanded, setExpanded] = useState(false)

  const medalColor =
    entry.rank === 1 ? '#f59e0b' :
    entry.rank === 2 ? '#94a3b8' :
    entry.rank === 3 ? '#b45309' : null

  const winRateColor =
    entry.winRate >= 60 ? '#16a34a' :
    entry.winRate >= 50 ? '#2563eb' : '#dc2626'

  return (
    <div style={{
      borderRadius: 16, background: '#fff',
      border: `1.5px solid ${entry.rank <= 3 ? '#e2e8f0' : '#f1f5f9'}`,
      overflow: 'hidden',
      boxShadow: entry.rank === 1 ? '0 4px 16px rgba(245,158,11,0.12)' : 'none',
      position: 'relative',
    }}>
      {/* 상위 3위 배경 */}
      {entry.rank <= 3 && (
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: entry.rank === 1
            ? 'linear-gradient(135deg, rgba(245,158,11,0.06) 0%, transparent 60%)'
            : entry.rank === 2
            ? 'linear-gradient(135deg, rgba(148,163,184,0.06) 0%, transparent 60%)'
            : 'linear-gradient(135deg, rgba(180,83,9,0.05) 0%, transparent 60%)',
        }} />
      )}

      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          width: '100%', background: 'none', border: 'none', cursor: 'pointer',
          padding: '14px 16px', textAlign: 'left', fontFamily: 'inherit',
          display: 'flex', alignItems: 'center', gap: 12, position: 'relative',
        }}
      >
        {/* 순위 뱃지 */}
        <div style={{
          width: 38, height: 38, borderRadius: 10, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: entry.rank <= 3 ? 22 : 15, fontWeight: 900,
          background: medalColor ? `${medalColor}18` : '#f8fafc',
          color: medalColor ?? '#94a3b8',
          border: `1.5px solid ${medalColor ? `${medalColor}40` : '#f1f5f9'}`,
        }}>
          {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : entry.rank}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: '#1e293b' }}>{entry.deckName}</span>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>by {entry.ownerNickname}</span>
          </div>
          <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
            <span style={{ fontWeight: 800, color: winRateColor }}>{entry.winRate}%</span>
            <span style={{ color: '#94a3b8' }}>{entry.wins}승 {entry.losses}패</span>
            <span style={{ color: '#cbd5e1' }}>총 {entry.totalGames}판</span>
          </div>
        </div>

        <span style={{ fontSize: 12, color: '#cbd5e1', flexShrink: 0 }}>{expanded ? '▲' : '▼'}</span>
      </button>

      {/* 승률 바 */}
      <div style={{ height: 4, background: '#f1f5f9', marginTop: -4 }}>
        <div style={{
          height: '100%', width: `${entry.winRate}%`,
          background: entry.winRate >= 60
            ? 'linear-gradient(90deg, #16a34a, #4ade80)'
            : entry.winRate >= 50
            ? 'linear-gradient(90deg, #2563eb, #60a5fa)'
            : 'linear-gradient(90deg, #dc2626, #f87171)',
          transition: 'width 0.4s ease',
        }} />
      </div>

      {/* 펼쳐진 주사위 상세 */}
      {expanded && (
        <div style={{
          borderTop: '1px solid #f8fafc', padding: '14px 16px', background: '#fafafa',
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            주사위 구성
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
            {[...entry.dice]
              .sort((a, b) => a.order - b.order)
              .map((die, i) => (
                <DieDetailCard key={die.id} die={die} index={i} />
              ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── 주사위 상세 카드 ──────────────────────────────────────────

function DieDetailCard({ die, index }: { die: { faces: number[] }; index: number }) {
  const sorted = [...die.faces].sort((a, b) => b - a)
  const total = die.faces.reduce((s, f) => s + f, 0)
  const max = sorted[0]
  const min = sorted[sorted.length - 1]
  const avg = (die.faces.reduce((s, f) => s + f, 0) / 6).toFixed(1)

  return (
    <div style={{
      borderRadius: 12, background: '#fff',
      border: '1.5px solid #e2e8f0',
      padding: '10px 12px',
    }}>
      {/* 헤더 */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8,
      }}>
        <span style={{
          fontSize: 10, fontWeight: 800, color: '#fff',
          background: '#475569', padding: '2px 7px', borderRadius: 99,
        }}>주사위 {index + 1}</span>
        <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>합 {total}</span>
      </div>

      {/* 면 격자 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, marginBottom: 8 }}>
        {sorted.map((f, fi) => (
          <span key={fi} style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            height: 24, borderRadius: 6,
            background: FACE_COLORS[fi] ?? '#f1f5f9',
            border: '1px solid rgba(0,0,0,0.07)',
            fontSize: 12, fontWeight: 800, color: '#1e293b',
          }}>{f}</span>
        ))}
      </div>

      {/* 최대/최소/평균 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#94a3b8' }}>
        <span>최대 <strong style={{ color: '#1e293b' }}>{max}</strong></span>
        <span>최소 <strong style={{ color: '#1e293b' }}>{min}</strong></span>
        <span>평균 <strong style={{ color: '#1e293b' }}>{avg}</strong></span>
      </div>
    </div>
  )
}

// ── 승률 원형 인디케이터 ──────────────────────────────────────

function WinRateCircle({ winRate, totalGames }: { winRate: number | null; totalGames: number }) {
  const size = 52
  const stroke = 4
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const dash = winRate !== null ? (winRate / 100) * circ : 0

  const color =
    winRate === null ? '#e2e8f0' :
    winRate >= 60 ? '#16a34a' :
    winRate >= 50 ? '#2563eb' : '#dc2626'

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f1f5f9" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.4s ease' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 10, fontWeight: 800, color: totalGames === 0 ? '#cbd5e1' : color,
      }}>
        {totalGames === 0 ? '-' : `${winRate}%`}
      </div>
    </div>
  )
}

// ── 공통 서브 컴포넌트 ─────────────────────────────────────────

function TabBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '10px 18px', fontSize: 13, fontWeight: 700,
        border: 'none', cursor: 'pointer', fontFamily: 'inherit',
        borderRadius: '8px 8px 0 0',
        background: active ? '#f8fafc' : 'transparent',
        color: active ? '#b45309' : 'rgba(255,255,255,0.7)',
        transition: 'all 0.1s',
      }}
    >{label}</button>
  )
}

function StatCell({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <span style={{ fontSize: 16, fontWeight: 900, color }}>{value}</span>
      <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>{label}</span>
    </div>
  )
}

function Divider() {
  return <div style={{ width: 1, background: '#f1f5f9', alignSelf: 'stretch' }} />
}

function LoadingState() {
  return (
    <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8', fontSize: 14 }}>
      불러오는 중...
    </div>
  )
}

function ErrorState({ msg }: { msg: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 0', color: '#ef4444', fontSize: 14 }}>
      {msg}
    </div>
  )
}

function EmptyState({ icon, title, sub }: { icon: string; title: string; sub: string }) {
  return (
    <div style={{
      textAlign: 'center', padding: '60px 24px',
      color: '#94a3b8', fontSize: 14, lineHeight: 1.8,
    }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>{icon}</div>
      <div style={{ fontWeight: 700, color: '#475569', marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 12 }}>{sub}</div>
    </div>
  )
}
