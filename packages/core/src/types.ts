// ─── 주사위 / 덱 ───────────────────────────────────────────────

export interface Die {
  id: string
  faces: [number, number, number, number, number, number]
}

export interface Deck {
  id: string
  name: string
  dice: [Die, Die, Die, Die]
}

// ─── 드래프트 ──────────────────────────────────────────────────

export interface DraftPick {
  diceIds: [string, string, string] // 인덱스 = 출전 순서
}

// ─── 라운드 결과 ───────────────────────────────────────────────

export type RoundResult = 'win' | 'lose' | 'draw'

export interface RollResult {
  myRoll: number
  oppRoll: number
  result: RoundResult
}

// ─── 게임 상태 ─────────────────────────────────────────────────

export interface GameState {
  round: number           // 1 | 2 | 3
  myWins: number
  oppWins: number
  rolls: RollResult[]     // 현재 라운드의 모든 굴림 (동점 재대결 포함)
  finished: boolean
  winner: 'me' | 'opp' | null
}
