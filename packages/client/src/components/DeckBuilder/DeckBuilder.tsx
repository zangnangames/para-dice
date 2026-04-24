import { useState } from 'react'
import { decodeDeckCode, encodeDeckCode } from '@dice-game/core'
import { useDeckStore } from '@/store/deckStore'
import { useAuthStore } from '@/store/authStore'
import { api } from '@/lib/api'
import { DieCube } from './DieCube'

interface DeckBuilderProps {
  onDone: () => void
}

export function DeckBuilder({ onDone }: DeckBuilderProps) {
  const { deck, isValid, updateFace, replaceDeckFaces, setName, serverId, setServerId } = useDeckStore()
  const { isLoggedIn } = useAuthStore()
  const loggedIn = isLoggedIn()

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [deckCodeInput, setDeckCodeInput] = useState('')
  const [deckCodeMessage, setDeckCodeMessage] = useState('')

  const handleSave = async () => {
    if (!isValid) return
    setError('')

    if (!loggedIn) {
      // 게스트: 그냥 홈으로
      onDone()
      return
    }

    setSaving(true)
    try {
      const dicePayload = deck.dice.map(d => ({ faces: [...d.faces] }))

      if (serverId) {
        try {
          // 기존 덱 업데이트 시도
          await api.decks.update(serverId, deck.name, dicePayload)
        } catch (updateErr: any) {
          // 404: 서버에 덱이 없음(삭제됐거나 다른 계정) → 새로 생성
          if (updateErr.message?.includes('Not found') || updateErr.message?.includes('404')) {
            setServerId(null)
            const created = await api.decks.create(deck.name, dicePayload) as any
            setServerId(created.id)
          } else {
            throw updateErr
          }
        }
      } else {
        // 새 덱 생성
        const created = await api.decks.create(deck.name, dicePayload) as any
        setServerId(created.id)
      }
      onDone()
    } catch (e: any) {
      setError(e.message ?? '저장에 실패했습니다')
    } finally {
      setSaving(false)
    }
  }

  const btnLabel = saving
    ? '저장 중...'
    : !isValid
    ? '눈 합계를 21로 맞춰주세요'
    : loggedIn
    ? serverId ? '덱 업데이트 완료' : '덱 저장 완료'
    : '확인 (게스트 — 저장 안됨)'

  const handleCopyDeckCode = async () => {
    try {
      const code = encodeDeckCode(deck)
      await navigator.clipboard.writeText(code)
      setDeckCodeInput(code)
      setDeckCodeMessage('덱 코드를 복사했습니다')
    } catch (e: any) {
      setDeckCodeMessage(e.message ?? '덱 코드를 만들 수 없습니다')
    }
  }

  const handleApplyDeckCode = () => {
    try {
      const diceFaces = decodeDeckCode(deckCodeInput)
      replaceDeckFaces(diceFaces)
      setDeckCodeMessage('덱 코드가 현재 덱에 적용되었습니다')
      setError('')
    } catch (e: any) {
      setDeckCodeMessage(e.message ?? '덱 코드를 적용할 수 없습니다')
    }
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>덱 빌더</h1>
      <p style={{ color: '#6b7280', marginBottom: 20 }}>
        주사위 4개의 각 면을 설정하세요. 각 주사위의 눈 합계는 <strong>21</strong>이어야 합니다.
      </p>

      {/* 덱 이름 */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
          덱 이름
        </label>
        <input
          type="text"
          value={deck.name}
          onChange={e => setName(e.target.value)}
          maxLength={30}
          placeholder="덱 이름을 입력하세요"
          style={{
            width: '100%',
            padding: '10px 14px',
            fontSize: 15,
            fontWeight: 600,
            borderRadius: 10,
            border: '1.5px solid #e2e8f0',
            outline: 'none',
            fontFamily: 'inherit',
            color: '#1e293b',
            boxSizing: 'border-box',
          }}
        />
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 16,
        marginBottom: 24,
      }}>
        {deck.dice.map((die, i) => (
          <DieCube
            key={die.id}
            die={die}
            dieIndex={i}
            onFaceChange={(fi, v) => updateFace(i, fi, v)}
          />
        ))}
      </div>

      <div style={{
        marginBottom: 24,
        padding: '16px 16px 14px',
        borderRadius: 14,
        background: '#fff',
        border: '1.5px solid #e2e8f0',
      }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: '#1e293b', marginBottom: 6 }}>
          덱 코드 복사 / 적용
        </div>
        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>
          24칸의 주사위 눈을 base-22 큰 정수 문자열로 변환합니다. 숫자열만 붙여넣으면 현재 덱에 바로 반영됩니다.
        </div>
        <textarea
          value={deckCodeInput}
          onChange={e => { setDeckCodeInput(e.target.value); setDeckCodeMessage('') }}
          placeholder="덱 코드를 붙여넣으세요"
          rows={3}
          style={{
            width: '100%',
            padding: '12px 14px',
            fontSize: 13,
            lineHeight: 1.5,
            borderRadius: 10,
            border: '1.5px solid #e2e8f0',
            outline: 'none',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            color: '#0f172a',
            boxSizing: 'border-box',
            resize: 'vertical',
            marginBottom: 10,
          }}
        />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <button
            onClick={handleCopyDeckCode}
            disabled={!isValid}
            style={{
              padding: '11px 0',
              borderRadius: 10,
              border: '1.5px solid #bfdbfe',
              background: isValid ? '#eff6ff' : '#f1f5f9',
              color: isValid ? '#1d4ed8' : '#94a3b8',
              cursor: isValid ? 'pointer' : 'not-allowed',
              fontWeight: 700,
              fontFamily: 'inherit',
            }}
          >
            덱 코드 복사
          </button>
          <button
            onClick={handleApplyDeckCode}
            disabled={!deckCodeInput.trim()}
            style={{
              padding: '11px 0',
              borderRadius: 10,
              border: 'none',
              background: deckCodeInput.trim() ? '#0f172a' : '#e2e8f0',
              color: deckCodeInput.trim() ? '#fff' : '#94a3b8',
              cursor: deckCodeInput.trim() ? 'pointer' : 'not-allowed',
              fontWeight: 700,
              fontFamily: 'inherit',
            }}
          >
            코드 적용
          </button>
        </div>
        {deckCodeMessage && (
          <div style={{ marginTop: 10, fontSize: 12, color: '#475569' }}>
            {deckCodeMessage}
          </div>
        )}
      </div>

      {error && (
        <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 12 }}>{error}</div>
      )}

      <button
        onClick={handleSave}
        disabled={!isValid || saving}
        style={{
          width: '100%',
          padding: '14px 0',
          fontSize: 16,
          fontWeight: 700,
          borderRadius: 10,
          border: 'none',
          cursor: isValid && !saving ? 'pointer' : 'not-allowed',
          background: isValid && !saving ? '#2563eb' : '#9ca3af',
          color: '#fff',
          fontFamily: 'inherit',
          transition: 'background 0.15s',
        }}
      >
        {btnLabel}
      </button>

      {loggedIn && (
        <p style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', marginTop: 10 }}>
          {serverId ? '서버에 저장된 덱을 수정합니다' : '계정에 새 덱으로 저장됩니다'}
        </p>
      )}
    </div>
  )
}
