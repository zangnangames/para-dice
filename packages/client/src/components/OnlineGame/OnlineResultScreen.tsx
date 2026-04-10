/**
 * 온라인 게임 종료 후 결과 화면.
 * 재대결 요청 / 대기 / 거절 상태를 UI로 표현한다.
 */

export type RematchStatus =
  | 'idle'          // 아직 아무도 안 누름
  | 'i_requested'   // 내가 요청 → 상대 대기
  | 'opp_requested' // 상대가 먼저 요청, 나는 아직
  | 'declined'      // 한쪽이 거절 / 만료

interface OnlineResultScreenProps {
  winner: 'me' | 'opp'
  myWins: number
  oppWins: number
  opponentNickname: string
  rematchStatus: RematchStatus
  isForfeit?: boolean
  onRematch: () => void
  onCancelRematch: () => void
  onExit: () => void
}

export function OnlineResultScreen({
  winner,
  myWins,
  oppWins,
  opponentNickname,
  rematchStatus,
  isForfeit = false,
  onRematch,
  onCancelRematch,
  onExit,
}: OnlineResultScreenProps) {
  const iWon = winner === 'me'

  return (
    <div style={{
      minHeight: '100%',
      background: iWon
        ? 'linear-gradient(160deg, #f0fdf4 0%, #f8fafc 60%)'
        : 'linear-gradient(160deg, #fff7ed 0%, #f8fafc 60%)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '32px 24px', gap: 0,
      fontFamily: 'system-ui, sans-serif',
    }}>

      {/* 트로피 / 아이콘 */}
      <div style={{ fontSize: 72, lineHeight: 1, marginBottom: 12 }}>
        {iWon ? '🏆' : '😓'}
      </div>

      {/* 결과 텍스트 */}
      <div style={{
        fontSize: 30, fontWeight: 900,
        color: iWon ? '#16a34a' : '#dc2626',
        marginBottom: 6,
      }}>
        {iWon ? '승리!' : '패배'}
      </div>

      {/* 연결 끊김 뱃지 */}
      {isForfeit && iWon && (
        <div style={{
          fontSize: 12, fontWeight: 600, color: '#6b7280',
          background: '#f3f4f6', borderRadius: 8,
          padding: '4px 10px', marginBottom: 10,
        }}>
          상대방이 연결을 끊어 승리했습니다
        </div>
      )}

      {/* 스코어 */}
      <div style={{ fontSize: 14, color: '#64748b', marginBottom: 32, fontWeight: 600 }}>
        나&nbsp;
        <span style={{ fontWeight: 900, color: '#1e293b', fontSize: 18 }}>{myWins}</span>
        &nbsp;:&nbsp;
        <span style={{ fontWeight: 900, color: '#1e293b', fontSize: 18 }}>{oppWins}</span>
        &nbsp;{opponentNickname}
      </div>

      {/* 재대결 상태 표시 */}
      {rematchStatus === 'i_requested' && (
        <StatusBox color="#eff6ff" border="#bfdbfe">
          <InlineSpinner />
          <span style={{ fontSize: 13, color: '#1d4ed8', fontWeight: 600 }}>
            상대방의 응답을 기다리는 중...
          </span>
        </StatusBox>
      )}

      {rematchStatus === 'opp_requested' && (
        <StatusBox color="#fefce8" border="#fde047">
          <span style={{ fontSize: 16 }}>⚡</span>
          <span style={{ fontSize: 13, color: '#854d0e', fontWeight: 700 }}>
            {opponentNickname}이(가) 재대결을 원합니다!
          </span>
        </StatusBox>
      )}

      {rematchStatus === 'declined' && (
        <StatusBox color="#fef2f2" border="#fca5a5">
          <span style={{ fontSize: 16 }}>😶</span>
          <span style={{ fontSize: 13, color: '#991b1b', fontWeight: 600 }}>
            재대결이 취소되었습니다
          </span>
        </StatusBox>
      )}

      {/* 버튼 영역 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 340, marginTop: 20 }}>

        {/* 재대결 요청 중 → 취소 버튼 */}
        {rematchStatus === 'i_requested' && (
          <button onClick={onCancelRematch} style={outlineBtnStyle}>
            요청 취소
          </button>
        )}

        {/* 상대가 먼저 요청했을 때 → 수락 버튼 강조 */}
        {rematchStatus === 'opp_requested' && (
          <button onClick={onRematch} style={{ ...primaryBtnStyle, background: '#f59e0b' }}>
            ⚡ 재대결 수락!
          </button>
        )}

        {/* idle 상태 → 재대결 버튼 (forfeit 승리 시 숨김: 상대가 이미 없음) */}
        {rematchStatus === 'idle' && !isForfeit && (
          <button onClick={onRematch} style={primaryBtnStyle}>
            🔄 재대결
          </button>
        )}

        {/* 홈으로 (declined 제외하고 항상 노출, declined 때는 단독) */}
        <button
          onClick={onExit}
          style={rematchStatus === 'declined' ? primaryBtnStyle : outlineBtnStyle}
        >
          홈으로
        </button>
      </div>
    </div>
  )
}

// ── 내부 공통 UI ────────────────────────────────────────────────

function StatusBox({
  color, border, children,
}: { color: string; border: string; children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '12px 18px', borderRadius: 12,
      background: color, border: `1.5px solid ${border}`,
      marginBottom: 4, width: '100%', maxWidth: 340,
    }}>
      {children}
    </div>
  )
}

function InlineSpinner() {
  return (
    <div style={{
      width: 15, height: 15, borderRadius: '50%', flexShrink: 0,
      border: '2px solid #bfdbfe', borderTop: '2px solid #2563eb',
      animation: 'spin 0.8s linear infinite',
    }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

const primaryBtnStyle: React.CSSProperties = {
  width: '100%', padding: '14px 0', fontSize: 16, fontWeight: 700,
  borderRadius: 12, border: 'none', cursor: 'pointer',
  background: '#2563eb', color: '#fff', fontFamily: 'inherit',
}

const outlineBtnStyle: React.CSSProperties = {
  width: '100%', padding: '13px 0', fontSize: 15, fontWeight: 600,
  borderRadius: 12, border: '1.5px solid #e2e8f0', cursor: 'pointer',
  background: '#fff', color: '#64748b', fontFamily: 'inherit',
}
