import { useState, useEffect } from 'react'
import { DeckBuilder } from './components/DeckBuilder/DeckBuilder'
import { Simulator } from './components/Simulator/Simulator'
import { LoginScreen } from './components/Auth/LoginScreen'
import { AuthCallback } from './components/Auth/AuthCallback'
import { ProfileScreen } from './components/Profile/ProfileScreen'
import { HomeScreen } from './components/Home/HomeScreen'
import { RankingScreen } from './components/Ranking/RankingScreen'
import { MatchmakingScreen } from './components/Matchmaking/MatchmakingScreen'
import { OnlineGameScreen } from './components/OnlineGame/OnlineGameScreen'
import { useAuthStore } from './store/authStore'
import { socket } from './lib/socket'

type Screen =
  | 'home'
  | 'deck-edit'
  | 'simulator'
  | 'profile'
  | 'ranking'
  | 'matchmaking'
  | 'online-game'   // Phase 3 후속 (방 입장 후 게임)

export default function App() {
  const { isLoggedIn, logout } = useAuthStore()
  const [screen, setScreen] = useState<Screen>('home')
  const [guestMode, setGuestMode] = useState(false)
  const [currentMatchId, setCurrentMatchId] = useState<string | null>(null)
  const [kickedMsg, setKickedMsg] = useState<string | null>(null)
  const [isAuthCallback, setIsAuthCallback] = useState(() =>
    window.location.pathname === '/auth/callback' ||
    window.location.search.includes('token=')
  )

  // ── 다른 기기/탭 접속으로 강제 종료 처리 ──────────────────
  useEffect(() => {
    const handleKicked = ({ reason }: { reason: string }) => {
      socket.disconnect()
      setCurrentMatchId(null)
      setScreen('home')
      setKickedMsg(reason)
    }
    socket.on('kicked', handleKicked)
    return () => { socket.off('kicked', handleKicked) }
  }, [])

  // ── 강제 종료 배너 ────────────────────────────────────────
  const KickedBanner = kickedMsg ? (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
      background: '#ef4444', color: '#fff',
      padding: '12px 16px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      fontSize: 13, fontWeight: 600, fontFamily: 'system-ui, sans-serif',
      boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
    }}>
      <span>⚠️ {kickedMsg}</span>
      <button
        onClick={() => setKickedMsg(null)}
        style={{
          background: 'rgba(255,255,255,0.2)', border: 'none', cursor: 'pointer',
          color: '#fff', fontSize: 12, fontWeight: 700,
          padding: '4px 10px', borderRadius: 6, fontFamily: 'inherit',
        }}
      >닫기</button>
    </div>
  ) : null

  // OAuth 콜백 처리 (URL 기반이 아닌 state 기반으로 관리해 토큰 노출 방지)
  if (isAuthCallback) {
    return (
      <div style={{ height: '100%', background: '#fff', fontFamily: 'system-ui, sans-serif' }}>
        {KickedBanner}
        <AuthCallback
          onSuccess={() => { setIsAuthCallback(false); setGuestMode(false); setScreen('home') }}
          onError={() => { setIsAuthCallback(false) }}
        />
      </div>
    )
  }

  // 미로그인 + 게스트 아님 → 첫 화면
  if (!isLoggedIn() && !guestMode) {
    return (
      <div style={{ height: '100%', background: '#fff', fontFamily: 'system-ui, sans-serif' }}>
        {KickedBanner}
        <LoginScreen onGuest={() => { setGuestMode(true); setScreen('simulator') }} />
      </div>
    )
  }

  const loggedIn = isLoggedIn()

  // 풀스크린 화면들 (헤더 없음)
  if (screen === 'simulator') {
    return (
      <div style={{ height: '100%', background: '#fff', fontFamily: 'system-ui, sans-serif' }}>
        {KickedBanner}
        <Simulator onBack={() => setScreen('home')} />
      </div>
    )
  }

  if (screen === 'matchmaking') {
    return (
      <div style={{ height: '100%', background: '#fff', fontFamily: 'system-ui, sans-serif' }}>
        {KickedBanner}
        <MatchmakingScreen
          onMatched={(matchId) => {
            setCurrentMatchId(matchId)
            setScreen('online-game')
          }}
          onCancel={() => setScreen('home')}
        />
      </div>
    )
  }

  if (screen === 'online-game' && currentMatchId) {
    return (
      <div style={{ height: '100%', background: '#fff', fontFamily: 'system-ui, sans-serif' }}>
        {KickedBanner}
        <OnlineGameScreen
          key={currentMatchId}
          matchId={currentMatchId}
          onExit={() => { setCurrentMatchId(null); setScreen('home') }}
          onRematch={(newMatchId) => setCurrentMatchId(newMatchId)}
        />
      </div>
    )
  }

  return (
    <div style={{
      height: '100%', background: '#f8fafc',
      fontFamily: 'system-ui, sans-serif',
      display: 'flex', flexDirection: 'column',
    }}>
      {KickedBanner}
      {/* 헤더 */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px',
        background: '#fff',
        borderBottom: '1px solid #f1f5f9',
        flexShrink: 0,
      }}>
        <button
          onClick={() => setScreen('home')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 900, fontSize: 17, color: '#1e293b', padding: 0 }}
        >
          🎲 para.Dice
        </button>

        {loggedIn ? (
          <button
            onClick={logout}
            style={{
              background: 'none', border: '1px solid #e2e8f0', cursor: 'pointer',
              fontSize: 12, color: '#94a3b8', padding: '4px 10px', borderRadius: 6,
              fontFamily: 'inherit',
            }}
          >로그아웃</button>
        ) : (
          <button
            onClick={() => setGuestMode(false)}
            style={{
              background: '#2563eb', border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 700, color: '#fff',
              padding: '6px 12px', borderRadius: 8, fontFamily: 'inherit',
            }}
          >로그인</button>
        )}
      </header>

      {/* 콘텐츠 */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {screen === 'home' && loggedIn && (
          <HomeScreen
            onDeckEdit={() => setScreen('deck-edit')}
            onAiTrain={() => setScreen('simulator')}
            onRandomMatch={() => setScreen('matchmaking')}
            onPrivateMatch={(matchId) => {
              setCurrentMatchId(matchId)
              setScreen('online-game')
            }}
            onProfile={() => setScreen('profile')}
            onRanking={() => setScreen('ranking')}
          />
        )}

        {screen === 'home' && !loggedIn && (
          <div style={{ maxWidth: 420, margin: '0 auto', padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>게스트 모드</div>
            <GuestMenuButton icon="🤖" label="AI 훈련" sub="AI 상대와 연습 (저장 안됨)" onClick={() => setScreen('simulator')} />
            <GuestMenuButton icon="🎲" label="덱 편집" sub="주사위 6면 구성 커스텀" onClick={() => setScreen('deck-edit')} />
          </div>
        )}

        {screen === 'deck-edit' && (
          <DeckBuilder onDone={() => setScreen('home')} />
        )}

        {screen === 'profile' && loggedIn && (
          <ProfileScreen onBack={() => setScreen('home')} />
        )}

        {screen === 'ranking' && (
          <RankingScreen onBack={() => setScreen('home')} />
        )}
      </div>
    </div>
  )
}

function GuestMenuButton({ icon, label, sub, onClick }: { icon: string; label: string; sub: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '14px 16px', borderRadius: 14,
        background: '#fff', border: '1.5px solid #f1f5f9',
        cursor: 'pointer', textAlign: 'left', width: '100%',
        fontFamily: 'inherit',
      }}
    >
      <div style={{
        width: 42, height: 42, borderRadius: 12, flexShrink: 0,
        background: '#f8fafc', border: '1.5px solid #e2e8f0',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
      }}>{icon}</div>
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 12, color: '#94a3b8' }}>{sub}</div>
      </div>
    </button>
  )
}
