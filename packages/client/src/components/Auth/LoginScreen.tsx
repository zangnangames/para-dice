const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:3001'

interface LoginScreenProps {
  onGuest: () => void
}

export function LoginScreen({ onGuest }: LoginScreenProps) {
  const handleGoogleLogin = () => {
    window.location.href = `${SERVER_URL}/auth/google`
  }

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(160deg, #eff6ff 0%, #f8fafc 60%, #faf5ff 100%)',
      padding: 24,
    }}>
      {/* 로고 */}
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
        <div style={{ fontSize: 72, marginBottom: 12, filter: 'drop-shadow(0 4px 12px rgba(37,99,235,0.18))' }}>🎲</div>
        <h1 style={{ fontSize: 32, fontWeight: 900, color: '#1e293b', margin: 0, letterSpacing: '-0.5px' }}>
          para.Dice
        </h1>
        <p style={{ fontSize: 14, color: '#64748b', marginTop: 8, lineHeight: 1.6 }}>
          비추이적 주사위로 상대를 꺾는 전략 대전
        </p>
      </div>

      {/* 버튼 영역 */}
      <div style={{
        width: '100%',
        maxWidth: 340,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}>
        {/* Google 로그인 — 메인 버튼 */}
        <button
          onClick={handleGoogleLogin}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            width: '100%',
            padding: '15px 0',
            borderRadius: 14,
            border: 'none',
            background: '#2563eb',
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: 16,
            fontWeight: 700,
            color: '#fff',
            boxShadow: '0 4px 20px rgba(37,99,235,0.35)',
            transition: 'transform 0.1s, box-shadow 0.1s',
          }}
          onMouseOver={e => {
            e.currentTarget.style.transform = 'translateY(-1px)'
            e.currentTarget.style.boxShadow = '0 6px 24px rgba(37,99,235,0.45)'
          }}
          onMouseOut={e => {
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow = '0 4px 20px rgba(37,99,235,0.35)'
          }}
        >
          <svg width="20" height="20" viewBox="0 0 48 48">
            <path fill="#fff" fillOpacity=".9" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#fff" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#fff" fillOpacity=".9" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#fff" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          Google로 로그인
        </button>

        {/* 혜택 안내 */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 16,
          padding: '8px 0',
          fontSize: 11,
          color: '#94a3b8',
          fontWeight: 500,
        }}>
          <span>✓ 전적 기록</span>
          <span>✓ 승률 통계</span>
          <span>✓ 온라인 대전</span>
        </div>

        {/* 구분선 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0' }}>
          <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
          <span style={{ fontSize: 12, color: '#cbd5e1' }}>또는</span>
          <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
        </div>

        {/* 게스트 시작 — 서브 버튼 */}
        <button
          onClick={onGuest}
          style={{
            width: '100%',
            padding: '13px 0',
            borderRadius: 14,
            border: '1.5px solid #e2e8f0',
            background: '#fff',
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: 14,
            fontWeight: 600,
            color: '#64748b',
            transition: 'background 0.15s',
          }}
          onMouseOver={e => (e.currentTarget.style.background = '#f8fafc')}
          onMouseOut={e => (e.currentTarget.style.background = '#fff')}
        >
          로그인 없이 시작
          <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 6 }}>(AI 대전만 · 저장 불가)</span>
        </button>
      </div>
    </div>
  )
}
