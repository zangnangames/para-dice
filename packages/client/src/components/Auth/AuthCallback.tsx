import { useEffect, useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import { api } from '@/lib/api'

interface AuthCallbackProps {
  onSuccess: () => void
  onError: () => void
}

export function AuthCallback({ onSuccess, onError }: AuthCallbackProps) {
  const [status, setStatus] = useState<'loading' | 'error'>('loading')
  const login = useAuthStore(s => s.login)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('token')
    if (!token) { setStatus('error'); onError(); return }

    // 토큰 임시 저장 후 /auth/me 호출로 유저 정보 획득
    localStorage.setItem('dice-auth', JSON.stringify({ state: { token } }))

    api.auth.me()
      .then(user => {
        login(token, {
          userId: user.id,
          nickname: user.nickname,
          avatarUrl: user.avatarUrl,
        })
        // URL 파라미터 제거
        window.history.replaceState({}, '', '/')
        onSuccess()
      })
      .catch(() => {
        localStorage.removeItem('dice-auth')
        setStatus('error')
        onError()
      })
  }, [])

  if (status === 'error') {
    return (
      <div style={{ padding: 32, textAlign: 'center' }}>
        <p style={{ color: '#dc2626' }}>로그인에 실패했습니다. 다시 시도해주세요.</p>
      </div>
    )
  }

  return (
    <div style={{
      height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ textAlign: 'center', color: '#64748b' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🎲</div>
        <p>로그인 중...</p>
      </div>
    </div>
  )
}
