import type { Die, RollResult, GameMode, GameState } from './types'

export function rollDie(die: Die): number {
  return die.faces[Math.floor(Math.random() * 6)]
}

export function getRoundSlotSizes(mode: GameMode): [1, 1, 1] | [1, 1, 2] {
  return mode === 'double-battle' ? [1, 1, 2] : [1, 1, 1]
}

export function rollRound(myDice: Die[], oppDice: Die[]): RollResult {
  const myRolls = myDice.map(rollDie)
  const oppRolls = oppDice.map(rollDie)
  const myRoll = myRolls.reduce((sum, value) => sum + value, 0)
  const oppRoll = oppRolls.reduce((sum, value) => sum + value, 0)
  const result = myRoll > oppRoll ? 'win' : myRoll < oppRoll ? 'lose' : 'draw'
  return { myRolls, oppRolls, myRoll, oppRoll, result }
}

// 동점 재대결 포함 — 승패가 결정될 때까지 반복
export function resolveRound(
  myDice: Die[],
  oppDice: Die[],
): { rolls: RollResult[]; winner: 'me' | 'opp' } {
  const rolls: RollResult[] = []
  while (true) {
    const roll = rollRound(myDice, oppDice)
    rolls.push(roll)
    if (roll.result === 'win') return { rolls, winner: 'me' }
    if (roll.result === 'lose') return { rolls, winner: 'opp' }
  }
}

export function createInitialGameState(mode: GameMode = 'classic'): GameState {
  return { mode, round: 1, myWins: 0, oppWins: 0, rolls: [], finished: false, winner: null }
}

export function applyRoundResult(
  state: GameState,
  rolls: RollResult[],
  winner: 'me' | 'opp'
): GameState {
  const myWins = state.myWins + (winner === 'me' ? 1 : 0)
  const oppWins = state.oppWins + (winner === 'opp' ? 1 : 0)
  const finished = myWins >= 2 || oppWins >= 2
  return {
    mode: state.mode,
    round: state.round + 1,
    myWins,
    oppWins,
    rolls,
    finished,
    winner: finished ? (myWins >= 2 ? 'me' : 'opp') : null,
  }
}
