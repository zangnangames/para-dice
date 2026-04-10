import { useEffect, useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import { api } from '@/lib/api'

const FACE_COLORS = ['#fef9c3', '#dbeafe', '#dcfce7', '#fee2e2', '#ede9fe', '#fed7aa']

type Tab = 'profile' | 'records'

interface Stats {
  totalWins: number
  totalLosses: number
  currentStreak: number
  maxStreak: number
}

interface MatchRecord {
  id: string
  myResult: 'win' | 'lose'
  playerA: { id: string; nickname: string; avatarUrl: string | null }
  playerB: { id: string; avatarUrl: string | null; nickname: string }
  deckA: { id: string; name: string; dice: Array<{ id: string; faces: number[]; order: number }> }
  deckB: { id: string; name: string; dice: Array<{ id: string; faces: number[]; order: number }> }
  finishedAt: string
  rounds: Array<{ number: number; winnerId: string }>
}

interface ProfileScreenProps {
  onBack: () => void
}

export function ProfileScreen({ onBack }: ProfileScreenProps) {
  const { user, updateUser } = useAuthStore()
  const [tab, setTab] = useState<Tab>('profile')
  const [stats, setStats] = useState<Stats | null>(null)
  const [matches, setMatches] = useState<MatchRecord[]>([])
  const [loadingRecords, setLoadingRecords] = useState(false)
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null)

  // 닉네임 편집 상태
  const [nicknameInput, setNicknameInput] = useState(user?.nickname ?? '')
  const [nicknameSaving, setNicknameSaving] = useState(false)
  const [nicknameError, setNicknameError] = useState('')
  const [nicknameSuccess, setNicknameSuccess] = useState(false)

  // 통계 로드
  useEffect(() => {
    if (!user) return
    api.stats.user(user.userId).then(setStats).catch(() => {})
  }, [user])

  // 대전 기록 로드
  useEffect(() => {
    if (!user || tab !== 'records') return
    setLoadingRecords(true)
    api.stats.matches(user.userId)
      .then(m => { setMatches(m.matches) })
      .catch(() => {})
      .finally(() => setLoadingRecords(false))
  }, [user, tab])

  const handleNicknameSave = async () => {
    if (!nicknameInput.trim()) { setNicknameError('닉네임을 입력해주세요'); return }
    if (nicknameInput.trim().length > 20) { setNicknameError('20자 이하여야 합니다'); return }
    setNicknameError('')
    setNicknameSaving(true)
    try {
      const updated = await api.auth.updateMe(nicknameInput.trim())
      updateUser({ nickname: updated.nickname })
      setNicknameSuccess(true)
      setTimeout(() => setNicknameSuccess(false), 2000)
    } catch (e: any) {
      setNicknameError(e.message ?? '저장 실패')
    } finally {
      setNicknameSaving(false)
    }
  }

  if (!user) return null

  const totalGames = (stats?.totalWins ?? 0) + (stats?.totalLosses ?? 0)
  const winRate = totalGames > 0
    ? Math.round((stats!.totalWins / totalGames) * 1000) / 10
    : null

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', paddingBottom: 48 }}>

      {/* ── 상단 프로필 헤더 ── */}
      <div style={{
        background: 'linear-gradient(135deg, #1d4ed8 0%, #4f46e5 100%)',
        padding: '20px 20px 0',
        position: 'relative',
      }}>
        <button
          onClick={onBack}
          style={{
            background: 'rgba(255,255,255,0.15)', border: 'none', cursor: 'pointer',
            color: '#fff', fontSize: 13, fontWeight: 600, padding: '6px 12px',
            borderRadius: 8, fontFamily: 'inherit', marginBottom: 20,
          }}
        >‹ 홈으로</button>

        {/* 아바타 + 이름 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt="avatar"
              style={{ width: 60, height: 60, borderRadius: '50%', objectFit: 'cover', border: '3px solid rgba(255,255,255,0.4)' }} />
          ) : (
            <div style={{
              width: 60, height: 60, borderRadius: '50%', flexShrink: 0,
              background: 'rgba(255,255,255,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26,
              border: '3px solid rgba(255,255,255,0.3)',
            }}>👤</div>
          )}
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>{user.nickname}</div>
            {stats && (
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>
                {totalGames}판 · 승률 {winRate ?? '-'}%
                {(stats.currentStreak ?? 0) >= 2 && (
                  <span style={{ marginLeft: 8, color: '#fde68a' }}>🔥 {stats.currentStreak}연승</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 탭 */}
        <div style={{ display: 'flex', gap: 4 }}>
          {([['profile', '프로필 편집'], ['records', '통계 · 기록']] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              style={{
                padding: '10px 18px',
                fontSize: 13, fontWeight: 700,
                border: 'none', cursor: 'pointer',
                fontFamily: 'inherit',
                borderRadius: '8px 8px 0 0',
                background: tab === key ? '#f8fafc' : 'transparent',
                color: tab === key ? '#1d4ed8' : 'rgba(255,255,255,0.7)',
                transition: 'all 0.1s',
              }}
            >{label}</button>
          ))}
        </div>
      </div>

      {/* ── 탭 컨텐츠 ── */}
      <div style={{ padding: '20px 16px' }}>

        {/* ════ 프로필 편집 탭 ════ */}
        {tab === 'profile' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* 닉네임 변경 */}
            <Section icon="✏️" title="닉네임">
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <input
                    type="text"
                    value={nicknameInput}
                    onChange={e => { setNicknameInput(e.target.value); setNicknameError(''); setNicknameSuccess(false) }}
                    onKeyDown={e => e.key === 'Enter' && handleNicknameSave()}
                    maxLength={20}
                    placeholder="닉네임 입력 (최대 20자)"
                    style={{
                      width: '100%', padding: '10px 12px',
                      fontSize: 15, fontWeight: 600,
                      borderRadius: 10, fontFamily: 'inherit',
                      border: `1.5px solid ${nicknameError ? '#f87171' : nicknameSuccess ? '#4ade80' : '#e2e8f0'}`,
                      outline: 'none', color: '#1e293b',
                      boxSizing: 'border-box',
                      transition: 'border-color 0.15s',
                    }}
                  />
                  {nicknameError && <div style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>{nicknameError}</div>}
                  {nicknameSuccess && <div style={{ fontSize: 12, color: '#16a34a', marginTop: 4 }}>✓ 저장되었습니다</div>}
                </div>
                <button
                  onClick={handleNicknameSave}
                  disabled={nicknameSaving || nicknameInput.trim() === user.nickname}
                  style={{
                    padding: '10px 16px', borderRadius: 10, border: 'none',
                    background: nicknameSaving || nicknameInput.trim() === user.nickname ? '#e2e8f0' : '#2563eb',
                    color: nicknameSaving || nicknameInput.trim() === user.nickname ? '#94a3b8' : '#fff',
                    fontWeight: 700, fontSize: 13, cursor: 'pointer',
                    fontFamily: 'inherit', flexShrink: 0,
                    transition: 'background 0.15s',
                  }}
                >
                  {nicknameSaving ? '저장 중' : '저장'}
                </button>
              </div>
            </Section>

            {/* 캐릭터 커스터마이징 — 준비 중 */}
            <Section icon="🎨" title="캐릭터 커스터마이징">
              <ComingSoon label="프로필 캐릭터 꾸미기 기능" />
            </Section>

            {/* 뱃지 — 준비 중 */}
            <Section icon="🏅" title="뱃지">
              <ComingSoon label="게임 달성 보상 뱃지 시스템" />
            </Section>

          </div>
        )}

        {/* ════ 통계 · 기록 탭 ════ */}
        {tab === 'records' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* 통계 카드 4개 */}
            {stats ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                  {[
                    { label: '승리', value: stats.totalWins, color: '#16a34a', bg: '#dcfce7' },
                    { label: '패배', value: stats.totalLosses, color: '#dc2626', bg: '#fee2e2' },
                    { label: '승률', value: winRate !== null ? `${winRate}%` : '-', color: '#2563eb', bg: '#dbeafe' },
                    { label: '최고 연승', value: stats.maxStreak, color: '#9333ea', bg: '#f3e8ff' },
                  ].map(({ label, value, color, bg }) => (
                    <div key={label} style={{
                      padding: '14px 16px', borderRadius: 14, background: bg,
                      display: 'flex', flexDirection: 'column', gap: 4,
                    }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color, opacity: 0.7 }}>{label}</span>
                      <span style={{ fontSize: 26, fontWeight: 800, color }}>{value}</span>
                    </div>
                  ))}
                </div>

                {(stats.currentStreak ?? 0) >= 2 && (
                  <div style={{
                    padding: '10px 16px', borderRadius: 10,
                    background: '#fef9c3', border: '1px solid #fde047',
                    fontSize: 13, fontWeight: 600, color: '#854d0e', textAlign: 'center',
                  }}>
                    🔥 현재 {stats.currentStreak}연승 중!
                  </div>
                )}
              </>
            ) : (
              <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: 13, padding: '20px 0' }}>
                불러오는 중...
              </div>
            )}

            {/* 대전 기록 */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 10 }}>대전 기록</div>

              {loadingRecords ? (
                <div style={{ textAlign: 'center', padding: '24px 0', color: '#94a3b8', fontSize: 13 }}>
                  불러오는 중...
                </div>
              ) : matches.length === 0 ? (
                <div style={{ padding: '32px 0', textAlign: 'center', color: '#94a3b8', fontSize: 13, lineHeight: 1.8 }}>
                  아직 대전 기록이 없습니다<br />
                  <span style={{ fontSize: 11 }}>온라인 대전 후 여기에 기록됩니다</span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {matches.map(match => {
                    const isPlayerA = match.playerA.id === user.userId
                    const myPlayer  = isPlayerA ? match.playerA : match.playerB
                    const oppPlayer = isPlayerA ? match.playerB : match.playerA
                    const myDeck    = isPlayerA ? match.deckA : match.deckB
                    const oppDeck   = isPlayerA ? match.deckB : match.deckA
                    const isWin     = match.myResult === 'win'
                    const isExpanded = expandedMatchId === match.id

                    // 라운드 스코어 계산
                    const myWins  = match.rounds.filter(r => r.winnerId === myPlayer.id).length
                    const oppWins = match.rounds.filter(r => r.winnerId === oppPlayer.id).length

                    return (
                      <div key={match.id} style={{
                        borderRadius: 14,
                        background: isWin ? '#f0fdf4' : '#fff1f2',
                        border: `1.5px solid ${isWin ? '#bbf7d0' : '#fecdd3'}`,
                        overflow: 'hidden',
                      }}>
                        {/* ── 카드 헤더 (클릭으로 토글) ── */}
                        <button
                          onClick={() => setExpandedMatchId(prev => prev === match.id ? null : match.id)}
                          style={{
                            width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                            padding: '11px 12px',
                            background: 'none', border: 'none', cursor: 'pointer',
                            textAlign: 'left', fontFamily: 'inherit',
                          }}
                        >
                          {/* 승/패 뱃지 */}
                          <div style={{
                            width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                            background: isWin ? '#16a34a' : '#dc2626',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 13, fontWeight: 900, color: '#fff',
                          }}>
                            {isWin ? '승' : '패'}
                          </div>

                          {/* 중앙 정보 */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                              <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>
                                vs {oppPlayer.nickname}
                              </span>
                              {/* 라운드 스코어 */}
                              <span style={{
                                fontSize: 12, fontWeight: 800,
                                color: isWin ? '#16a34a' : '#dc2626',
                                flexShrink: 0,
                              }}>
                                {myWins} : {oppWins}
                              </span>
                            </div>
                            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {myDeck.name}
                              </span>
                              <span style={{ flexShrink: 0, color: '#cbd5e1' }}>vs</span>
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {oppDeck.name}
                              </span>
                            </div>
                          </div>

                          {/* 날짜 + 화살표 */}
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
                            <span style={{ fontSize: 10, color: '#94a3b8' }}>
                              {match.finishedAt ? new Date(match.finishedAt).toLocaleDateString('ko-KR') : ''}
                            </span>
                            <span style={{ fontSize: 11, color: '#94a3b8' }}>{isExpanded ? '▲' : '▼'}</span>
                          </div>
                        </button>

                        {/* ── 펼쳐진 덱 상세 ── */}
                        {isExpanded && (
                          <div style={{
                            padding: '10px 12px 14px',
                            borderTop: `1px solid ${isWin ? '#bbf7d0' : '#fecdd3'}`,
                            background: isWin ? '#f8fffe' : '#fff8f8',
                            display: 'flex', flexDirection: 'column', gap: 10,
                          }}>
                            <DeckPreview label="내 덱" name={myDeck.name} color="#1d4ed8" dice={myDeck.dice} />
                            <div style={{ height: 1, background: 'rgba(148,163,184,0.15)' }} />
                            <DeckPreview label="상대 덱" name={oppDeck.name} color="#c2410c" dice={oppDeck.dice} />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              <div style={{ marginTop: 12, fontSize: 11, color: '#94a3b8', textAlign: 'center' }}>
                최신 10개 대전 기록만 표시됩니다
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function DeckPreview({ label, name, color, dice }: {
  label: string
  name: string
  color: string
  dice: Array<{ id: string; faces: number[] }>
}) {
  return (
    <div>
      {/* 레이블 + 덱 이름 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{
          fontSize: 10, fontWeight: 800, color: '#fff',
          background: color, padding: '2px 7px', borderRadius: 99,
        }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>{name}</span>
      </div>

      {/* 주사위 목록 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
        {dice.map((die, dieIndex) => (
          <div key={die.id} style={{
            padding: '6px 8px', borderRadius: 10,
            background: '#fff', border: '1px solid rgba(148,163,184,0.2)',
          }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', marginBottom: 4 }}>
              주사위 {dieIndex + 1}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3 }}>
              {[...die.faces].sort((a, b) => b - a).map((face, fi) => (
                <span key={fi} style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  height: 20, borderRadius: 5,
                  background: FACE_COLORS[fi] ?? '#f1f5f9',
                  border: '1px solid rgba(0,0,0,0.07)',
                  fontSize: 10, fontWeight: 800, color: '#1e293b',
                }}>
                  {face}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* 공통 섹션 카드 */
function Section({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div style={{
      borderRadius: 16, background: '#fff',
      border: '1.5px solid #f1f5f9',
      overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '12px 16px',
        borderBottom: '1px solid #f8fafc',
        background: '#fafafa',
      }}>
        <span style={{ fontSize: 16 }}>{icon}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>{title}</span>
      </div>
      <div style={{ padding: '14px 16px' }}>
        {children}
      </div>
    </div>
  )
}

/* 준비 중 플레이스홀더 */
function ComingSoon({ label }: { label: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 14px', borderRadius: 10,
      background: '#f8fafc', border: '1.5px dashed #e2e8f0',
    }}>
      <span style={{ fontSize: 13, color: '#94a3b8' }}>{label}</span>
      <span style={{
        fontSize: 11, fontWeight: 700, color: '#a78bfa',
        background: '#f3e8ff', padding: '3px 8px', borderRadius: 20,
      }}>준비 중</span>
    </div>
  )
}
