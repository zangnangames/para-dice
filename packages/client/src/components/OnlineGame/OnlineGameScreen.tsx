import { useEffect, useState, useRef } from 'react'
import { socket } from '@/lib/socket'
import { useAuthStore } from '@/store/authStore'
import { createInitialGameState } from '@dice-game/core'
import type { Die, GameMode, GameState, RollResult } from '@dice-game/core'
import { PhysicsDice } from '../Simulator/PhysicsDice'
import { MatchIntroScreen } from './MatchIntroScreen'
import { OnlineDraftPhase } from './OnlineDraftPhase'
import { OnlineResultScreen } from './OnlineResultScreen'
import type { RematchStatus } from './OnlineResultScreen'

type Phase =
  | 'joining'                // room:join 전송 후 대기
  | 'match-intro'            // 매칭 인트로 애니메이션
  | 'draft'                  // 드래프트 선택 중
  | 'waiting-opponent-draft' // 내 픽 완료, 상대 대기
  | 'round'                  // 주사위 던지기
  | 'waiting-opponent-roll'  // 내가 던진 후 상대 대기
  | 'round-draw'             // 동점 재대결 대기
  | 'round-result'           // 결과 확인 중
  | 'game-over'              // 게임 종료
  | 'disconnected'           // 상대 연결 끊김

interface Opponent {
  nickname: string
  avatarUrl: string | null
}

interface OnlineGameScreenProps {
  matchId: string
  mode: GameMode
  onExit: () => void
  onRematch: (newMatchId: string) => void
}

export function OnlineGameScreen({ matchId, mode: initialMode, onExit, onRematch }: OnlineGameScreenProps) {
  const { user } = useAuthStore()

  const [mode, setMode] = useState<GameMode>(initialMode)
  const [phase, setPhase] = useState<Phase>('joining')
  const [opponent, setOpponent] = useState<Opponent | null>(null)
  const [myStats, setMyStats] = useState<{ totalWins: number; totalLosses: number; currentStreak: number } | null>(null)
  const [opponentStats, setOpponentStats] = useState<{ totalWins: number; totalLosses: number; currentStreak: number } | null>(null)
  const [myDeck, setMyDeck] = useState<Die[]>([])
  const [oppDeck, setOppDeck] = useState<Die[]>([])
  const [myPick, setMyPick] = useState<string[][] | null>(null)
  const [oppPick, setOppPick] = useState<string[][] | null>(null)
  const [gameState, setGameState] = useState<GameState>(createInitialGameState(initialMode))
  const [roundWinners, setRoundWinners] = useState<Array<'me' | 'opp'>>([])
  const [currentRound, setCurrentRound] = useState(1)
  const [lastRolls, setLastRolls] = useState<RollResult[]>([])
  const [lastWinner, setLastWinner] = useState<'me' | 'opp' | null>(null)
  const [rollAttempt, setRollAttempt] = useState(0)
  const [opponentSealed, setOpponentSealed] = useState(false)
  const [opponentRolled, setOpponentRolled] = useState(false)
  const [hasRolled, setHasRolled] = useState(false)
  const [showNextRound, setShowNextRound] = useState(false)
  const [showReroll, setShowReroll] = useState(false)
  const [rematchStatus, setRematchStatus] = useState<RematchStatus>('idle')
  const [opponentDisconnected, setOpponentDisconnected] = useState(false)
  const [isForfeitWin, setIsForfeitWin] = useState(false)
  const draftTimerRef = useRef<ReturnType<typeof setInterval> | null>(null) // 미사용, 하위 호환

  // ── 소켓 이벤트 등록 ─────────────────────────────────────
  useEffect(() => {
    if (!socket.connected) socket.connect()

    socket.on('room:ready', ({ mode: readyMode, opponent: opp, myDeck: md, opponentDeck: od, myStats: ms, opponentStats: os }) => {
      setMode(readyMode ?? initialMode)
      setOpponent(opp)
      setMyDeck(md.dice ?? md)
      setOppDeck(od.dice ?? od)
      setMyStats(ms ?? null)
      setOpponentStats(os ?? null)
      setPhase('match-intro')
    })

    socket.on('room:restore', ({
      mode: restoredMode,
      phase: restoredPhase,
      currentRound,
      gameState: gs,
      myPick: mp,
      oppPick: op,
      roundWinners: restoredRoundWinners,
      lastRolls: restoredLastRolls,
      lastWinner: restoredLastWinner,
      opponentReady,
      hasRolled: restoredHasRolled,
      opponentRolled: restoredOpponentRolled,
    }) => {
      if (restoredMode) setMode(restoredMode)
      if (gs) setGameState(gs)
      if (mp) setMyPick(mp)
      if (op) setOppPick(op)
      setRoundWinners(restoredRoundWinners ?? [])
      setLastRolls(restoredLastRolls ?? [])
      setLastWinner(restoredLastWinner ?? null)
      setCurrentRound(currentRound ?? ((gs?.myWins ?? 0) + (gs?.oppWins ?? 0) + 1))
      setOpponentSealed(!!opponentReady)
      setHasRolled(!!restoredHasRolled)
      setOpponentRolled(!!restoredOpponentRolled)
      setOpponentDisconnected(false)
      setPhase(restoredPhase ?? 'round')
    })

    socket.on('draft:done', ({ myPick: mp, oppPick: op }) => {
      stopDraftTimer()
      setMyPick(mp)
      setOppPick(op)
      setOpponentSealed(false)
      setOpponentDisconnected(false)
      setPhase('round')
      setCurrentRound(1)
    })

    socket.on('draft:timeout', () => {
      stopDraftTimer()
    })

    socket.on('opponent:sealed', () => {
      setOpponentSealed(true)
    })

    socket.on('opponent:rolled', () => {
      setOpponentRolled(true)
    })

    socket.on('round:result', ({ rolls, winner, winnerUserId, gameState: gs }) => {
      const resolvedWinner = winnerUserId
        ? (winnerUserId === user?.userId ? 'me' : 'opp')
        : winner

      setLastRolls(rolls)
      setLastWinner(resolvedWinner)
      setGameState(gs)
      if (!gs.finished) {
        setRoundWinners(prev => [...prev, resolvedWinner])
      }
      setHasRolled(false)
      setOpponentRolled(false)
      setOpponentDisconnected(false)
      setPhase('round-result')
    })

    socket.on('round:draw', ({ rolls }) => {
      setLastRolls(rolls)
      setLastWinner(null)
      setHasRolled(false)
      setOpponentRolled(false)
      setOpponentDisconnected(false)
      setPhase('round-draw')
    })

    socket.on('game:over', ({ winnerUserId, forfeit }: { winnerUserId: string; forfeit?: boolean }) => {
      const iWon = winnerUserId === user?.userId
      setLastWinner(iWon ? 'me' : 'opp')
      if (forfeit) setIsForfeitWin(true)
      setPhase('game-over')
    })

    socket.on('opponent:disconnected', () => {
      setOpponentDisconnected(true)
    })

    socket.on('opponent:reconnected', () => {
      setOpponentDisconnected(false)
    })

    // ── 재대결 이벤트 ──────────────────────────────────────
    socket.on('rematch:requested', () => {
      // 상대가 재대결을 요청함 → 내가 아직 idle이면 opp_requested로
      setRematchStatus(prev => prev === 'idle' ? 'opp_requested' : prev)
    })

    socket.on('rematch:declined', () => {
      setRematchStatus('declined')
    })

    socket.on('rematch:matched', ({ newMatchId }: { newMatchId: string }) => {
      onRematch(newMatchId)
    })

    socket.emit('room:join', { matchId })

    return () => {
      socket.off('room:ready')
      socket.off('room:restore')
      socket.off('draft:done')
      socket.off('draft:timeout')
      socket.off('opponent:sealed')
      socket.off('opponent:rolled')
      socket.off('round:result')
      socket.off('round:draw')
      socket.off('game:over')
      socket.off('opponent:disconnected')
      socket.off('opponent:reconnected')
      socket.off('rematch:requested')
      socket.off('rematch:declined')
      socket.off('rematch:matched')
      stopDraftTimer()
    }
  }, [initialMode, matchId, user?.userId])

  const stopDraftTimer = () => {
    if (draftTimerRef.current) { clearInterval(draftTimerRef.current); draftTimerRef.current = null }
  }

  useEffect(() => {
    if (phase !== 'round-result' || gameState.finished) return

    setShowNextRound(false)

    // 1.8초 후 "Round N 시작" 뱃지 표시
    const t1 = setTimeout(() => setShowNextRound(true), 1800)
    // 2.8초 후 자동으로 다음 라운드 진행
    const t2 = setTimeout(() => handleNextRound(), 2800)

    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [phase, gameState.finished])

  useEffect(() => {
    if (phase !== 'round-draw') return

    setShowReroll(false)
    const t1 = setTimeout(() => setShowReroll(true), 1800)
    const t2 = setTimeout(() => handleReroll(), 2800)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [phase])

  // ── 드래프트 확정 ────────────────────────────────────────
  const handleDraftConfirm = (rounds: string[][]) => {
    socket.emit('draft:pick', { matchId, rounds })
    setMyPick(rounds)
    // phase는 OnlineDraftPhase 내부에서 봉인 완료 UI로 전환
    // draft:done 수신 시 'round'로 전환됨
  }

  const handleDraftTimeout = () => {
    // 서버가 자동 픽 처리 → draft:done 수신까지 대기
  }

  // ── 주사위 물리 결과 (내 die settle 감지) ──────────────────
  const handlePhysicsResult = (myVals: number[], _oppVals: number[]) => {
    if (hasRolled) return
    setHasRolled(true)
    socket.emit('round:roll', { matchId, round: currentRound, values: myVals })
    setPhase('waiting-opponent-roll')
  }

  // ── 다음 라운드 ──────────────────────────────────────────
  const handleNextRound = () => {
    const nextRound = currentRound + 1
    setCurrentRound(nextRound)
    setLastRolls([])
    setLastWinner(null)
    setRollAttempt(a => a + 1)
    setPhase('round')
  }

  const handleReroll = () => {
    setHasRolled(false)
    setOpponentRolled(false)
    setRollAttempt(a => a + 1)
    setPhase('round')
  }

  // ── 재대결 ────────────────────────────────────────────────
  const handleRematchRequest = () => {
    socket.emit('rematch:request', { matchId })
    setRematchStatus(prev => prev === 'opp_requested' ? 'opp_requested' : 'i_requested')
  }

  const handleRematchCancel = () => {
    socket.emit('rematch:cancel', { matchId })
    setRematchStatus('declined')
  }

  // ── 현재 라운드의 주사위 ──────────────────────────────────
  const roundIdx = currentRound - 1
  const myDice = myPick && myDeck.length > 0
    ? myPick[roundIdx].map(id => myDeck.find(d => d.id === id) ?? myDeck[0]).filter(Boolean)
    : null
  const oppDice = oppPick && oppDeck.length > 0
    ? oppPick[roundIdx].map(id => oppDeck.find(d => d.id === id) ?? oppDeck[0]).filter(Boolean)
    : null

  // ─────────────────────────────────────────────────────────
  // 렌더링
  // ─────────────────────────────────────────────────────────

  if (phase === 'joining') {
    return <FullCenter><LoadingSpinner text="게임 연결 중..." /></FullCenter>
  }

  if (phase === 'match-intro' && opponent && user) {
    return (
      <MatchIntroScreen
        me={{
          nickname: user.nickname,
          avatarUrl: user.avatarUrl,
          totalWins: myStats?.totalWins ?? 0,
          totalLosses: myStats?.totalLosses ?? 0,
          currentStreak: myStats?.currentStreak ?? 0,
        }}
        opponent={{
          nickname: opponent.nickname,
          avatarUrl: opponent.avatarUrl,
          totalWins: opponentStats?.totalWins ?? 0,
          totalLosses: opponentStats?.totalLosses ?? 0,
          currentStreak: opponentStats?.currentStreak ?? 0,
        }}
        onDone={() => setPhase('draft')}
      />
    )
  }

  if (phase === 'draft' || phase === 'waiting-opponent-draft') {
    return (
      <div style={{ position: 'relative', height: '100%', fontFamily: 'system-ui, sans-serif' }}>
        <OnlineDraftPhase
          mode={mode}
          myDice={myDeck}
          opponentDice={oppDeck}
          opponentNickname={opponent?.nickname ?? '상대'}
          opponentReady={opponentSealed}
          initialSelectedIds={myPick}
          onConfirm={handleDraftConfirm}
          onTimeout={handleDraftTimeout}
        />
        {opponentDisconnected && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 25,
            background: 'rgba(15,23,42,0.28)',
            backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24,
          }}>
            <div style={{
              width: 'min(88vw, 320px)',
              padding: '18px 20px',
              borderRadius: 18,
              background: 'rgba(255,255,255,0.97)',
              boxShadow: '0 18px 48px rgba(15,23,42,0.22)',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 38, marginBottom: 8 }}>📡</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', marginBottom: 6 }}>
                상대 재접속 대기 중
              </div>
              <div style={{ fontSize: 13, color: '#64748b' }}>
                다시 연결되면 드래프트에서 이어집니다
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  if ((phase === 'round' || phase === 'waiting-opponent-roll' || phase === 'round-result' || phase === 'round-draw') && myDice && oppDice) {
    const isRoundResult = phase === 'round-result'
    const isRoundDraw   = phase === 'round-draw'
    const isRoundWin = lastWinner === 'me'
    const latestRoll = lastRolls[lastRolls.length - 1]

    return (
      <div style={{ position: 'relative', height: '100%' }}>
        <PhysicsDice
          key={rollAttempt}
          myDice={myDice}
          oppDice={oppDice}
          onResult={handlePhysicsResult}
        />

        {/* 상단 스코어 바 */}
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 10,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '10px 20px',
          background: 'rgba(255,255,255,0.88)', backdropFilter: 'blur(6px)',
          borderBottom: '1px solid rgba(0,0,0,0.06)',
        }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#1d4ed8' }}>나</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {[0, 1, 2].map(i => {
              const w = roundWinners[i]
              return (
                <div key={i} style={{
                  width: 28, height: 28, borderRadius: 999,
                  border: '1px solid rgba(148,163,184,0.35)',
                  background: w === 'me' ? 'rgba(219,234,254,0.95)' : w === 'opp' ? 'rgba(255,237,213,0.95)' : 'rgba(248,250,252,0.95)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, color: w === 'me' ? '#2563eb' : w === 'opp' ? '#ea580c' : '#cbd5e1',
                }}>
                  {w === 'me' ? '♔' : w === 'opp' ? '♚' : ''}
                </div>
              )
            })}
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#c2410c' }}>{opponent?.nickname}</span>
        </div>

        {/* 상대 주사위 면 바 */}
        <div style={{
          position: 'fixed', top: 45, left: 0, right: 0, zIndex: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          padding: '5px 16px',
          background: 'rgba(255,247,237,0.88)', backdropFilter: 'blur(6px)',
          borderBottom: '1px solid rgba(249,115,22,0.12)',
          pointerEvents: 'none',
        }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#92400e', marginRight: 2 }}>상대</span>
          {oppDice.map((die) => (
            <div key={die.id} style={{ display: 'flex', gap: 4 }}>
              {[...die.faces].sort((a, b) => b - a).map((face, i) => (
                <div key={i} style={{
                  width: 24, height: 24, borderRadius: 6,
                  background: '#fff7ed', border: '1px solid rgba(148,163,184,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, color: '#9a3412',
                }}>{face}</div>
              ))}
            </div>
          ))}
        </div>

        {/* 내 주사위 면 바 */}
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          padding: '5px 16px',
          background: 'rgba(239,246,255,0.88)', backdropFilter: 'blur(6px)',
          borderTop: '1px solid rgba(59,130,246,0.12)',
          pointerEvents: 'none',
        }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#1e40af', marginRight: 2 }}>나</span>
          {myDice.map((die) => (
            <div key={die.id} style={{ display: 'flex', gap: 4 }}>
              {[...die.faces].sort((a, b) => b - a).map((face, i) => (
                <div key={i} style={{
                  width: 24, height: 24, borderRadius: 6,
                  background: '#eff6ff', border: '1px solid rgba(148,163,184,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, color: '#1e3a8a',
                }}>{face}</div>
              ))}
            </div>
          ))}
        </div>

        {/* 대기 오버레이 */}
        {phase === 'waiting-opponent-roll' && (
          <div style={{
            position: 'fixed', bottom: 34, left: 0, right: 0, zIndex: 20,
            padding: '14px 20px',
            background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(8px)',
            borderTop: '1px solid rgba(0,0,0,0.06)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
          }}>
            {opponentRolled ? (
              <span style={{ fontSize: 14, fontWeight: 700, color: '#16a34a' }}>
                ✓ 상대 완료 — 결과 집계 중...
              </span>
            ) : (
              <>
                <Spinner />
                <span style={{ fontSize: 14, fontWeight: 600, color: '#475569' }}>
                  상대방 던지는 중...
                </span>
              </>
            )}
          </div>
        )}

        {opponentDisconnected && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 25,
            background: 'rgba(15,23,42,0.28)',
            backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24,
          }}>
            <div style={{
              width: 'min(88vw, 320px)',
              padding: '18px 20px',
              borderRadius: 18,
              background: 'rgba(255,255,255,0.97)',
              boxShadow: '0 18px 48px rgba(15,23,42,0.22)',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 38, marginBottom: 8 }}>📡</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', marginBottom: 6 }}>
                상대 재접속 대기 중
              </div>
              <div style={{ fontSize: 13, color: '#64748b' }}>
                연결이 복구되면 현재 라운드에서 이어집니다
              </div>
            </div>
          </div>
        )}

        {isRoundResult && (
          <>
            {/* 배경 블러 */}
            <div style={{
              position: 'fixed', inset: 0, zIndex: 30,
              background: 'rgba(15, 23, 42, 0.45)',
              backdropFilter: 'blur(5px)',
              animation: 'fadeIn 0.2s ease',
            }} />

            {/* 결과 카드 */}
            <div style={{
              position: 'fixed',
              left: '50%', top: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 31,
              width: 'min(88vw, 360px)',
              padding: '24px 20px 20px',
              borderRadius: 22,
              background: 'rgba(255,255,255,0.97)',
              boxShadow: '0 20px 60px rgba(15,23,42,0.3)',
              animation: 'slideUp 0.25s ease',
            }}>

              {/* 결과 헤더 */}
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <div style={{ fontSize: 48, lineHeight: 1, marginBottom: 8 }}>
                  {isRoundWin ? '🎯' : '😓'}
                </div>
                <div style={{
                  fontSize: 20, fontWeight: 900,
                  color: isRoundWin ? '#16a34a' : '#dc2626',
                  marginBottom: 4,
                }}>
                  {isRoundWin ? '라운드 승리!' : '라운드 패배'}
                </div>
                {/* 스코어 뱃지 */}
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 10,
                  padding: '4px 14px', borderRadius: 99,
                  background: '#f1f5f9',
                }}>
                  <span style={{ fontWeight: 900, fontSize: 17, color: '#1d4ed8' }}>{gameState.myWins}</span>
                  <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>:</span>
                  <span style={{ fontWeight: 900, fontSize: 17, color: '#c2410c' }}>{gameState.oppWins}</span>
                </div>
              </div>

              {/* 주사위 눈 결과 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                {lastRolls.map((roll, i) => {
                  const isDraw = roll.result === 'draw'
                  const isWin  = roll.result === 'win'
                  return (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 14px', borderRadius: 12,
                      background: isDraw ? '#fefce8' : isWin ? '#f0fdf4' : '#fff1f2',
                      border: `1.5px solid ${isDraw ? '#fde047' : isWin ? '#86efac' : '#fecdd3'}`,
                    }}>
                      <div style={{ textAlign: 'center', minWidth: 80 }}>
                        <div style={{ fontSize: 9, color: '#94a3b8', marginBottom: 2 }}>나</div>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 4 }}>
                          {roll.myRolls.map((value, idx) => (
                            <div key={idx} style={{
                              width: 28, height: 28, borderRadius: 8, background: '#2563eb',
                              color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 14, fontWeight: 900,
                            }}>{value}</div>
                          ))}
                        </div>
                        <div style={{ fontSize: 22, fontWeight: 900, color: '#1d4ed8', lineHeight: 1 }}>합 {roll.myRoll}</div>
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: isDraw ? '#92400e' : isWin ? '#15803d' : '#be123c' }}>
                        {isDraw ? '⚖️ 동점' : isWin ? '🏆 승' : '💀 패'}
                      </div>
                      <div style={{ textAlign: 'center', minWidth: 80 }}>
                        <div style={{ fontSize: 9, color: '#94a3b8', marginBottom: 2 }}>{opponent?.nickname}</div>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 4 }}>
                          {roll.oppRolls.map((value, idx) => (
                            <div key={idx} style={{
                              width: 28, height: 28, borderRadius: 8, background: '#ea580c',
                              color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 14, fontWeight: 900,
                            }}>{value}</div>
                          ))}
                        </div>
                        <div style={{ fontSize: 22, fontWeight: 900, color: '#c2410c', lineHeight: 1 }}>합 {roll.oppRoll}</div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* 하단: game-over 버튼 or 다음 라운드 뱃지 */}
              {gameState.finished ? (
                <button
                  onClick={() => setPhase('game-over')}
                  style={{
                    width: '100%', padding: '13px 0', fontSize: 15, fontWeight: 700,
                    borderRadius: 12, border: 'none', cursor: 'pointer',
                    background: isRoundWin ? '#16a34a' : '#dc2626', color: '#fff',
                    fontFamily: 'inherit',
                  }}
                >
                  최종 결과 보기 →
                </button>
              ) : (
                <div style={{
                  textAlign: 'center',
                  height: 38,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {showNextRound ? (
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: 8,
                      padding: '7px 20px', borderRadius: 99,
                      background: '#2563eb', color: '#fff',
                      fontSize: 13, fontWeight: 800,
                      animation: 'popIn 0.25s cubic-bezier(0.34,1.56,0.64,1)',
                    }}>
                      <span>Round {currentRound + 1}</span>
                      <span style={{ fontSize: 11, opacity: 0.85 }}>시작!</span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 5 }}>
                      {[0, 1, 2].map(i => (
                        <div key={i} style={{
                          width: 6, height: 6, borderRadius: '50%',
                          background: '#cbd5e1',
                          animation: `dotBounce 1s ease-in-out ${i * 0.18}s infinite`,
                        }} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {/* ── 동점 오버레이 (isRoundResult 블록 밖으로 분리) ── */}
        {isRoundDraw && latestRoll && (
          <>
            {/* 배경 블러 */}
            <div style={{
              position: 'fixed', inset: 0, zIndex: 30,
              background: 'rgba(120, 80, 0, 0.35)',
              backdropFilter: 'blur(5px)',
              animation: 'fadeIn 0.2s ease',
            }} />

            {/* 동점 카드 */}
            <div style={{
              position: 'fixed',
              left: '50%', top: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 31,
              width: 'min(88vw, 320px)',
              padding: '22px 20px 18px',
              borderRadius: 22,
              background: 'rgba(255,255,255,0.97)',
              boxShadow: '0 20px 60px rgba(15,23,42,0.3)',
              animation: 'slideUp 0.25s ease',
            }}>
              <div style={{ textAlign: 'center', marginBottom: 14 }}>
                <div style={{ fontSize: 44, lineHeight: 1, marginBottom: 6 }}>⚖️</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#b45309', marginBottom: 2 }}>동점!</div>
                <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500 }}>같은 주사위로 다시 굴립니다</div>
              </div>

              {/* 눈 결과 */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px', borderRadius: 12,
                background: '#fefce8', border: '1.5px solid #fde047',
                marginBottom: 14,
              }}>
                <div style={{ textAlign: 'center', minWidth: 80 }}>
                  <div style={{ fontSize: 9, color: '#94a3b8', marginBottom: 2 }}>나</div>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 4 }}>
                    {latestRoll.myRolls.map((value, idx) => (
                      <div key={idx} style={{
                        width: 28, height: 28, borderRadius: 8, background: '#2563eb',
                        color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 14, fontWeight: 900,
                      }}>{value}</div>
                    ))}
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: '#1d4ed8', lineHeight: 1 }}>합 {latestRoll.myRoll}</div>
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#92400e' }}>⚖️ 동점</div>
                <div style={{ textAlign: 'center', minWidth: 80 }}>
                  <div style={{ fontSize: 9, color: '#94a3b8', marginBottom: 2 }}>{opponent?.nickname}</div>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 4 }}>
                    {latestRoll.oppRolls.map((value, idx) => (
                      <div key={idx} style={{
                        width: 28, height: 28, borderRadius: 8, background: '#ea580c',
                        color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 14, fontWeight: 900,
                      }}>{value}</div>
                    ))}
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: '#c2410c', lineHeight: 1 }}>합 {latestRoll.oppRoll}</div>
                </div>
              </div>

              {/* 재굴림 뱃지 */}
              <div style={{
                height: 34,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {showReroll ? (
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '6px 18px', borderRadius: 99,
                    background: '#f59e0b', color: '#fff',
                    fontSize: 13, fontWeight: 800,
                    animation: 'popIn 0.25s cubic-bezier(0.34,1.56,0.64,1)',
                  }}>
                    🎲 다시 던지기!
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 5 }}>
                    {[0, 1, 2].map(i => (
                      <div key={i} style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: '#fcd34d',
                        animation: `dotBounce 1s ease-in-out ${i * 0.18}s infinite`,
                      }} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        <style>{`
          @keyframes fadeIn  { from { opacity: 0 } to { opacity: 1 } }
          @keyframes slideUp { from { opacity: 0; transform: translate(-50%, -44%) } to { opacity: 1; transform: translate(-50%, -50%) } }
          @keyframes popIn   { from { opacity: 0; transform: scale(0.7) } to { opacity: 1; transform: scale(1) } }
          @keyframes dotBounce {
            0%, 80%, 100% { transform: translateY(0); opacity: 0.4 }
            40% { transform: translateY(-5px); opacity: 1 }
          }
        `}</style>
      </div>
    )
  }

  if (phase === 'game-over') {
    return (
      <div style={{ height: '100%', background: '#f8fafc', fontFamily: 'system-ui, sans-serif', overflowY: 'auto' }}>
        <OnlineResultScreen
          winner={lastWinner ?? 'opp'}
          myWins={gameState.myWins}
          oppWins={gameState.oppWins}
          opponentNickname={opponent?.nickname ?? '상대'}
          rematchStatus={rematchStatus}
          isForfeit={isForfeitWin}
          onRematch={handleRematchRequest}
          onCancelRematch={handleRematchCancel}
          onExit={() => {
            // 홈으로 갈 때 상대에게 거절 알림
            if (rematchStatus !== 'declined') {
              socket.emit('rematch:cancel', { matchId })
            }
            onExit()
          }}
        />
      </div>
    )
  }

  return <FullCenter><LoadingSpinner text="로딩 중..." /></FullCenter>
}

// ── 공통 UI 헬퍼 ────────────────────────────────────────────

function FullCenter({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#f8fafc', fontFamily: 'system-ui, sans-serif',
    }}>
      {children}
    </div>
  )
}

function LoadingSpinner({ text }: { text: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <Spinner size={36} />
      <div style={{ fontSize: 15, color: '#64748b', fontWeight: 600 }}>{text}</div>
    </div>
  )
}

function Spinner({ size = 20 }: { size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      border: `${size * 0.12}px solid #e2e8f0`,
      borderTop: `${size * 0.12}px solid #2563eb`,
      animation: 'spin 0.8s linear infinite',
    }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
