import { useState } from 'react'
import type { GameMode, GameState, RollResult } from '@dice-game/core'
import { createInitialGameState, applyRoundResult } from '@dice-game/core'
import { clearGameRuntimeCache } from '@/lib/runtimeCache'
import { useDeckStore } from '@/store/deckStore'
import { generateAiDeck } from '@/simulator/aiDeck'
import { DraftPhase } from './DraftPhase'
import { RoundPhase } from './RoundPhase'
import { ResultScreen } from './ResultScreen'
import { VictoryOverlay } from './VictoryOverlay'

type Phase = 'draft' | 'round' | 'result'

interface SimulatorProps {
  mode: GameMode
  onBack: () => void
}

export function Simulator({ mode, onBack }: SimulatorProps) {
  const { deck } = useDeckStore()
  const [aiDeck] = useState(() => generateAiDeck())
  const [phase, setPhase] = useState<Phase>('draft')
  const [draftRounds, setDraftRounds] = useState<string[][] | null>(null)
  const [gameState, setGameState] = useState<GameState>(createInitialGameState(mode))
  const [roundWinners, setRoundWinners] = useState<Array<'me' | 'opp'>>([])
  const [showVictory, setShowVictory] = useState(false)

  const handleDraftConfirm = (rounds: string[][]) => {
    setDraftRounds(rounds)
    setPhase('round')
  }

  const handleRoundEnd = (rolls: RollResult[], winner: 'me' | 'opp') => {
    void clearGameRuntimeCache()
    const next = applyRoundResult(gameState, rolls, winner)
    setGameState(next)
    setRoundWinners(prev => [...prev, winner])
    if (next.finished) {
      setShowVictory(true)
    }
  }

  const handleRestart = () => {
    void clearGameRuntimeCache()
    setPhase('draft')
    setDraftRounds(null)
    setGameState(createInitialGameState(mode))
    setRoundWinners([])
    setShowVictory(false)
  }

  if (phase === 'draft') {
    return (
      <div>
        <button onClick={onBack} style={{ margin: 16, background: 'none', border: 'none', cursor: 'pointer', color: '#2563eb' }}>
          ← 홈으로
        </button>
        <DraftPhase mode={mode} myDice={[...deck.dice]} aiDice={[...aiDeck.dice]} onConfirm={handleDraftConfirm} />
      </div>
    )
  }

  if (phase === 'round' && draftRounds) {
    const roundIndex = gameState.myWins + gameState.oppWins
    const myDice = draftRounds[roundIndex].map(id => deck.dice.find(d => d.id === id)!).filter(Boolean)
    const oppDice = roundIndex === 2 ? aiDeck.dice.slice(2, 4) : [aiDeck.dice[roundIndex]]

    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <RoundPhase
          key={roundIndex}
          mode={mode}
          myDice={myDice}
          oppDice={oppDice}
          roundWinners={roundWinners}
          onRoundEnd={handleRoundEnd}
        />
        {/* 2선승 달성 시 승리 연출 오버레이 */}
        {showVictory && gameState.winner && (
          <VictoryOverlay
            winner={gameState.winner}
            onDone={() => { setShowVictory(false); setPhase('result') }}
          />
        )}
      </div>
    )
  }

  if (phase === 'result') {
    return (
      <ResultScreen
        winner={gameState.winner!}
        myWins={gameState.myWins}
        oppWins={gameState.oppWins}
        onRestart={handleRestart}
        onHome={onBack}
      />
    )
  }

  return null
}
