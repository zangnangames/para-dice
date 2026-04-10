interface ResultScreenProps {
  winner: 'me' | 'opp'
  myWins: number
  oppWins: number
  onRestart: () => void
}

export function ResultScreen({ winner, myWins, oppWins, onRestart }: ResultScreenProps) {
  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: 24, textAlign: 'center' }}>
      <div style={{ fontSize: 64, marginBottom: 16 }}>
        {winner === 'me' ? '🏆' : '💀'}
      </div>
      <h2 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>
        {winner === 'me' ? '승리!' : '패배'}
      </h2>
      <p style={{ color: '#6b7280', marginBottom: 24 }}>
        최종 스코어: 나 {myWins} : {oppWins} 상대
      </p>
      <button
        onClick={onRestart}
        style={{
          padding: '12px 32px', fontSize: 16, fontWeight: 600,
          borderRadius: 8, border: 'none', cursor: 'pointer',
          background: '#2563eb', color: '#fff',
        }}
      >
        다시 하기
      </button>
    </div>
  )
}
