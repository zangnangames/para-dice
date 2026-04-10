import { useState, useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'
import { api } from '@/lib/api'
import { socket } from '@/lib/socket'
import { Avatar } from '@/components/common/Avatar'
import { useProfileStore } from '@/store/profileStore'

type HomeAction = 'idle' | 'room-create' | 'room-join' | 'room-matched'

interface HomeScreenProps {
  onDeckEdit: () => void
  onAiTrain: () => void
  onRandomMatch: () => void
  onPrivateMatch: (matchId: string) => void
  onProfile: () => void
  onRanking: () => void
}

interface Stats {
  totalWins: number
  totalLosses: number
  currentStreak: number
  maxStreak: number
}

export function HomeScreen({ onDeckEdit, onAiTrain, onRandomMatch, onPrivateMatch, onProfile, onRanking }: HomeScreenProps) {
  const { user } = useAuthStore()
  const { avatarColor } = useProfileStore()
  const [stats, setStats] = useState<Stats | null>(null)
  const [action, setAction] = useState<HomeAction>('idle')
  const [roomCode, setRoomCode] = useState('')
  const [joinInput, setJoinInput] = useState('')
  const [joinError, setJoinError] = useState('')
  const [roomLoading, setRoomLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [roomExpireSec, setRoomExpireSec] = useState(600)

  useEffect(() => {
    if (!user) return
    api.stats.user(user.userId).then(setStats).catch(() => {})
  }, [user])

  useEffect(() => {
    if (!socket.connected) socket.connect()

    const handleCreated = ({ code }: { code: string }) => {
      setRoomCode(code)
      setRoomLoading(false)
      setRoomExpireSec(600)
      setAction('room-create')
    }

    const handleMatched = ({ matchId }: { matchId: string }) => {
      setRoomLoading(false)
      setAction('room-matched')
      // 1초 "매칭 성사!" 표시 후 이동
      setTimeout(() => onPrivateMatch(matchId), 1000)
    }

    const handleError = ({ message }: { message: string }) => {
      setRoomLoading(false)
      setJoinError(message)
    }

    const handleCancelled = () => {
      setRoomLoading(false)
      setRoomCode('')
      setJoinInput('')
      setJoinError('')
      setCopied(false)
      setAction('idle')
    }

    socket.on('room:created', handleCreated)
    socket.on('room:matched', handleMatched)
    socket.on('room:error', handleError)
    socket.on('room:cancelled', handleCancelled)

    return () => {
      socket.emit('room:cancel')
      socket.off('room:created', handleCreated)
      socket.off('room:matched', handleMatched)
      socket.off('room:error', handleError)
      socket.off('room:cancelled', handleCancelled)
    }
  }, [onPrivateMatch])

  // 방 만들기 대기 중 만료 카운트다운
  useEffect(() => {
    if (action !== 'room-create' || roomLoading) return
    setRoomExpireSec(600)
    const t = setInterval(() => {
      setRoomExpireSec(s => {
        if (s <= 1) {
          clearInterval(t)
          // TTL 만료 — 자동으로 idle 복귀
          setAction('idle')
          setRoomCode('')
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [action, roomLoading])

  const totalGames = (stats?.totalWins ?? 0) + (stats?.totalLosses ?? 0)
  const winRate = totalGames > 0 ? Math.round((stats!.totalWins / totalGames) * 1000) / 10 : null

  const handleCreateRoom = () => {
    setJoinError('')
    setCopied(false)
    setRoomLoading(true)
    setAction('room-create')
    socket.emit('room:create')
  }

  const handleCopyCode = () => {
    if (!roomCode) return
    navigator.clipboard.writeText(roomCode).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {
      // clipboard 실패 시 무시
    })
  }

  const handleJoinRoom = () => {
    if (!/^\d{4}$/.test(joinInput)) { setJoinError('4자리 숫자를 입력하세요'); return }
    setJoinError('')
    setRoomLoading(true)
    socket.emit('room:enter', { code: joinInput })
  }

  const handleCancelRoom = () => {
    socket.emit('room:cancel')
    setRoomLoading(false)
    setRoomCode('')
    setJoinInput('')
    setJoinError('')
    setAction('idle')
  }

  return (
    <div style={{ maxWidth: 420, margin: '0 auto', padding: '20px 16px 40px', display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* ① 내 정보 */}
      <button
        onClick={onProfile}
        style={{
          display: 'flex', alignItems: 'center', gap: 14,
          padding: '14px 16px', borderRadius: 16,
          background: 'linear-gradient(135deg, #1d4ed8 0%, #4f46e5 100%)',
          border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%',
          boxShadow: '0 4px 16px rgba(29,78,216,0.25)',
        }}
      >
        <Avatar avatarUrl={user?.avatarUrl} nickname={user?.nickname ?? '?'} size={48} customColor={avatarColor} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginBottom: 4 }}>{user?.nickname}</div>
          {stats ? (
            <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>
              <span>{stats.totalWins}승 {stats.totalLosses}패</span>
              {winRate !== null && <span>승률 {winRate}%</span>}
              {stats.currentStreak >= 2 && <span style={{ color: '#fde68a' }}>🔥 {stats.currentStreak}연승</span>}
            </div>
          ) : <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>불러오는 중...</div>}
        </div>
        <div style={{ fontSize: 18, color: 'rgba(255,255,255,0.5)' }}>›</div>
      </button>

      {/* ② 덱 편집 */}
      <RowButton icon="🎲" label="덱 편집" sub="주사위 6면 구성 커스텀" color="#475569" bg="#f8fafc" border="#e2e8f0" onClick={onDeckEdit} />

      {/* 구분선 */}
      <div style={{ height: 1, background: '#e2e8f0', margin: '4px 0' }} />

      {/* ③ 랜덤 매칭 */}
      <RowButton icon="⚡" label="랜덤 매칭" sub="즉시 상대 탐색" color="#2563eb" bg="#eff6ff" border="#bfdbfe" onClick={onRandomMatch} />

      {/* ④ 방 만들기 | 방 찾기 */}
      {action === 'idle' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <HalfButton icon="🏠" label="방 만들기" color="#16a34a" bg="#f0fdf4" border="#bbf7d0" onClick={handleCreateRoom} />
          <HalfButton icon="🔍" label="방 찾기" color="#ea580c" bg="#fff7ed" border="#fed7aa" onClick={() => setAction('room-join')} />
        </div>
      )}

      {/* ── 방 만들기 대기 카드 ── */}
      {action === 'room-create' && (
        <div style={{ borderRadius: 16, background: '#f0fdf4', border: '1.5px solid #86efac', overflow: 'hidden' }}>
          {/* 헤더 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px 0' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#15803d' }}>🏠 방 만들기</span>
            {!roomLoading && (
              <span style={{ fontSize: 11, color: '#86efac' }}>
                {Math.floor(roomExpireSec / 60)}:{String(roomExpireSec % 60).padStart(2, '0')} 후 만료
              </span>
            )}
          </div>

          {/* 방 코드 */}
          <div style={{ padding: '10px 14px 4px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              flex: 1,
              fontSize: 44, fontWeight: 900, letterSpacing: 10,
              color: roomLoading ? '#86efac' : '#166534',
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1,
            }}>
              {roomLoading ? '···' : roomCode}
            </div>
            {/* 복사 버튼 */}
            {!roomLoading && roomCode && (
              <button
                onClick={handleCopyCode}
                style={{
                  padding: '8px 14px', borderRadius: 10,
                  border: '1.5px solid #86efac',
                  background: copied ? '#16a34a' : '#fff',
                  color: copied ? '#fff' : '#16a34a',
                  fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  fontFamily: 'inherit', transition: 'all 0.15s', flexShrink: 0,
                }}
              >
                {copied ? '✓ 복사됨' : '복사'}
              </button>
            )}
          </div>

          <div style={{ padding: '4px 14px 10px', fontSize: 12, color: '#16a34a' }}>
            {roomLoading
              ? '방을 생성하고 있습니다...'
              : '상대방이 이 코드를 입력하면 게임이 시작됩니다'}
          </div>

          {/* 대기 인디케이터 */}
          {!roomLoading && (
            <div style={{
              margin: '0 14px 10px',
              padding: '8px 12px', borderRadius: 10,
              background: '#dcfce7', border: '1px solid #bbf7d0',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <WaitingDots color="#16a34a" />
              <span style={{ fontSize: 12, color: '#15803d', fontWeight: 600 }}>상대방 입장 대기 중...</span>
            </div>
          )}

          <div style={{ padding: '0 14px 12px' }}>
            <button onClick={handleCancelRoom} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#86efac', padding: 0 }}>
              취소
            </button>
          </div>
        </div>
      )}

      {/* ── 방 찾기 입력 카드 ── */}
      {action === 'room-join' && (
        <RoomJoinCard
          value={joinInput}
          onChange={v => { setJoinInput(v); setJoinError('') }}
          onSubmit={handleJoinRoom}
          onCancel={handleCancelRoom}
          loading={roomLoading}
          error={joinError}
        />
      )}

      {/* ── 매칭 성사 카드 ── */}
      {action === 'room-matched' && (
        <div style={{
          borderRadius: 16, padding: '20px 16px',
          background: 'linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%)',
          border: '1.5px solid #93c5fd',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
        }}>
          <div style={{ fontSize: 40 }}>⚡</div>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#1d4ed8' }}>매칭 성사!</div>
          <div style={{ fontSize: 13, color: '#64748b' }}>게임을 준비하고 있습니다...</div>
        </div>
      )}

      {/* ⑤ AI 훈련 */}
      <RowButton icon="🤖" label="AI 훈련" sub="AI 상대와 연습" color="#7c3aed" bg="#faf5ff" border="#ddd6fe" onClick={onAiTrain} />

      {/* ⑥ 덱 랭킹 */}
      <RowButton icon="🏆" label="덱 랭킹" sub="전체 플레이어 덱 승률 순위" color="#b45309" bg="#fffbeb" border="#fde68a" onClick={onRanking} />

    </div>
  )
}

/* 방 찾기 — 4자리 개별 박스 입력 */
function RoomJoinCard({ value, onChange, onSubmit, onCancel, loading, error }: {
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  onCancel: () => void
  loading: boolean
  error: string
}) {
  const digits = [0, 1, 2, 3]
  const refs = digits.map(() => ({ current: null as HTMLInputElement | null }))

  const handleDigitChange = (idx: number, raw: string) => {
    const d = raw.replace(/\D/g, '').slice(-1)          // 숫자 1자리만
    const arr = value.padEnd(4, ' ').split('')
    arr[idx] = d || ' '
    const next = arr.join('').replace(/ /g, '')
    onChange(next)
    if (d && idx < 3) {
      refs[idx + 1].current?.focus()
    }
  }

  const handleKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (value[idx]) {
        // 현재 칸 지우기
        const arr = value.padEnd(4, ' ').split('')
        arr[idx] = ' '
        onChange(arr.join('').replace(/ /g, ''))
      } else if (idx > 0) {
        refs[idx - 1].current?.focus()
      }
    }
    if (e.key === 'Enter' && value.length === 4) onSubmit()
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4)
    if (pasted) onChange(pasted)
    e.preventDefault()
  }

  const ready = value.length === 4 && !loading

  return (
    <div style={{
      borderRadius: 16, background: '#fff7ed',
      border: `1.5px solid ${error ? '#f87171' : '#fed7aa'}`,
      padding: '14px 16px',
      display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#c2410c' }}>🔍 방 코드 입력</div>

      {/* 4자리 박스 */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
        {digits.map(i => (
          <input
            key={i}
            ref={r => { refs[i].current = r }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={value[i] ?? ''}
            autoFocus={i === 0}
            onChange={e => handleDigitChange(i, e.target.value)}
            onKeyDown={e => handleKeyDown(i, e)}
            onPaste={handlePaste}
            onFocus={e => e.target.select()}
            style={{
              width: 56, height: 64,
              textAlign: 'center',
              fontSize: 28, fontWeight: 900,
              color: '#9a3412',
              borderRadius: 12,
              border: `2px solid ${error ? '#f87171' : value[i] ? '#ea580c' : '#fed7aa'}`,
              background: value[i] ? '#fff7ed' : '#fff',
              outline: 'none',
              fontFamily: 'inherit',
              transition: 'border-color 0.12s, background 0.12s',
            }}
          />
        ))}
      </div>

      {error && (
        <div style={{ fontSize: 12, color: '#ef4444', textAlign: 'center' }}>⚠️ {error}</div>
      )}

      {/* 입장 버튼 */}
      <button
        onClick={onSubmit}
        disabled={!ready}
        style={{
          width: '100%', padding: '13px 0',
          borderRadius: 12, border: 'none',
          background: ready ? '#ea580c' : '#e2e8f0',
          color: ready ? '#fff' : '#94a3b8',
          fontSize: 15, fontWeight: 700,
          cursor: ready ? 'pointer' : 'not-allowed',
          fontFamily: 'inherit',
          transition: 'background 0.12s, color 0.12s',
        }}
      >
        {loading ? '입장 중...' : '입장 →'}
      </button>

      <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#fdba74', padding: 0, textAlign: 'center' }}>
        취소
      </button>
    </div>
  )
}

/* 전체 너비 행 버튼 */
function RowButton({ icon, label, sub, color, bg, border, onClick }: {
  icon: string; label: string; sub: string; color: string; bg: string; border: string; onClick: () => void
}) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseOver={() => setHover(true)}
      onMouseOut={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '13px 16px', borderRadius: 14,
        background: hover ? bg : '#fff',
        border: `1.5px solid ${hover ? border : '#f1f5f9'}`,
        cursor: 'pointer', textAlign: 'left', width: '100%',
        transition: 'background 0.12s, border-color 0.12s',
        fontFamily: 'inherit',
      }}
    >
      <div style={{ width: 40, height: 40, borderRadius: 11, flexShrink: 0, background: bg, border: `1.5px solid ${border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19 }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color, marginBottom: 1 }}>{label}</div>
        <div style={{ fontSize: 11, color: '#94a3b8' }}>{sub}</div>
      </div>
      <div style={{ fontSize: 16, color: '#cbd5e1' }}>›</div>
    </button>
  )
}

/* 대기 중 점 애니메이션 */
function WaitingDots({ color }: { color: string }) {
  return (
    <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: 5, height: 5, borderRadius: '50%', background: color,
          animation: `dotBounce 1s ease-in-out ${i * 0.2}s infinite`,
        }} />
      ))}
      <style>{`@keyframes dotBounce{0%,80%,100%{transform:translateY(0);opacity:.4}40%{transform:translateY(-4px);opacity:1}}`}</style>
    </div>
  )
}

/* 절반 너비 버튼 (방 만들기 / 방 찾기) */
function HalfButton({ icon, label, color, bg, border, onClick }: {
  icon: string; label: string; color: string; bg: string; border: string; onClick: () => void
}) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseOver={() => setHover(true)}
      onMouseOut={() => setHover(false)}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 8, padding: '16px 8px',
        borderRadius: 14,
        background: hover ? bg : '#fff',
        border: `1.5px solid ${hover ? border : '#f1f5f9'}`,
        cursor: 'pointer', width: '100%',
        transition: 'background 0.12s, border-color 0.12s',
        fontFamily: 'inherit',
      }}
    >
      <div style={{ width: 40, height: 40, borderRadius: 11, background: bg, border: `1.5px solid ${border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19 }}>
        {icon}
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color }}>{label}</div>
    </button>
  )
}
