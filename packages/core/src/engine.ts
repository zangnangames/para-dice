import type { Die, RollResult, GameState } from './types'

export function rollDie(die: Die): number {
  return die.faces[Math.floor(Math.random() * 6)]
}

export function rollRound(myDie: Die, oppDie: Die): RollResult {
  const myRoll = rollDie(myDie)
  const oppRoll = rollDie(oppDie)
  const result = myRoll > oppRoll ? 'win' : myRoll < oppRoll ? 'lose' : 'draw'
  return { myRoll, oppRoll, result }
}

// 동점 재대결 포함 — 승패가 결정될 때까지 반복
export function resolveRound(
  myDie: Die,
  oppDie: Die
): { rolls: RollResult[]; winner: 'me' | 'opp' } {
  const rolls: RollResult[] = []
  while (true) {
    const roll = rollRound(myDie, oppDie)
    rolls.push(roll)
    if (roll.result === 'win') return { rolls, winner: 'me' }
    if (roll.result === 'lose') return { rolls, winner: 'opp' }
  }
}

export function createInitialGameState(): GameState {
  return { round: 1, myWins: 0, oppWins: 0, rolls: [], finished: false, winner: null }
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
    round: state.round + 1,
    myWins,
    oppWins,
    rolls,
    finished,
    winner: finished ? (myWins >= 2 ? 'me' : 'opp') : null,
  }
}
