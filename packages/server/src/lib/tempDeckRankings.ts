type TempDeckPreset = {
  deckId: string
  deckName: string
  ownerNickname: string
  wins: number
  losses: number
  dice: number[][]
}

const TEMP_DECK_PRESETS: TempDeckPreset[] = [
  {
    deckId: 'temp-ranking-1',
    deckName: '공격형 덱',
    ownerNickname: '홍길동',
    wins: 14,
    losses: 5,
    dice: [
      [6, 6, 2, 2, 2, 3],
      [5, 5, 5, 2, 2, 2],
      [4, 4, 4, 4, 3, 2],
      [6, 5, 3, 3, 2, 2],
    ],
  },
  {
    deckId: 'temp-ranking-2',
    deckName: '파워 스파이크',
    ownerNickname: '정수연',
    wins: 12,
    losses: 3,
    dice: [
      [9, 6, 1, 1, 2, 2],
      [8, 7, 2, 1, 2, 1],
      [6, 6, 6, 1, 1, 1],
      [7, 5, 3, 2, 2, 2],
    ],
  },
  {
    deckId: 'temp-ranking-3',
    deckName: '균형 덱',
    ownerNickname: '김철수',
    wins: 11,
    losses: 6,
    dice: [
      [5, 4, 4, 3, 3, 2],
      [6, 4, 3, 3, 3, 2],
      [5, 5, 4, 3, 2, 2],
      [4, 4, 4, 3, 3, 3],
    ],
  },
  {
    deckId: 'temp-ranking-4',
    deckName: '비추이적 클래식',
    ownerNickname: '이영희',
    wins: 9,
    losses: 4,
    dice: [
      [2, 2, 4, 4, 9, 0],
      [1, 1, 6, 6, 7, 0],
      [3, 3, 5, 5, 5, 0],
      [4, 4, 4, 4, 4, 1],
    ],
  },
  {
    deckId: 'temp-ranking-5',
    deckName: '미드레인지',
    ownerNickname: '강동현',
    wins: 8,
    losses: 7,
    dice: [
      [5, 4, 4, 4, 2, 2],
      [4, 4, 3, 4, 3, 3],
      [5, 5, 3, 3, 3, 2],
      [4, 4, 4, 4, 3, 2],
    ],
  },
  {
    deckId: 'temp-ranking-6',
    deckName: '하이로우 덱',
    ownerNickname: '박민준',
    wins: 7,
    losses: 8,
    dice: [
      [8, 7, 1, 1, 2, 2],
      [9, 5, 1, 2, 2, 2],
      [7, 7, 2, 2, 2, 1],
      [6, 6, 6, 1, 1, 1],
    ],
  },
  {
    deckId: 'temp-ranking-7',
    deckName: '올인 덱',
    ownerNickname: '윤서아',
    wins: 6,
    losses: 9,
    dice: [
      [10, 5, 1, 1, 2, 2],
      [9, 8, 1, 1, 1, 1],
      [7, 7, 3, 1, 2, 1],
      [6, 6, 5, 2, 1, 1],
    ],
  },
  {
    deckId: 'temp-ranking-8',
    deckName: '수비형 덱',
    ownerNickname: '최지훈',
    wins: 5,
    losses: 10,
    dice: [
      [4, 4, 3, 3, 4, 3],
      [3, 3, 4, 4, 3, 4],
      [5, 3, 3, 3, 4, 3],
      [4, 4, 4, 3, 3, 3],
    ],
  },
]

export function getTempDeckRankings() {
  return TEMP_DECK_PRESETS.map((preset) => {
    const totalGames = preset.wins + preset.losses

    return {
      deckId: preset.deckId,
      deckName: preset.deckName,
      ownerNickname: preset.ownerNickname,
      dice: preset.dice.map((faces, order) => ({
        id: `${preset.deckId}-die-${order + 1}`,
        deckId: preset.deckId,
        faces,
        order,
      })),
      totalGames,
      wins: preset.wins,
      losses: preset.losses,
      winRate: Math.round((preset.wins / totalGames) * 1000) / 10,
    }
  })
}
