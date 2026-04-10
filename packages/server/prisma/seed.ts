import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// 합계 21인 주사위 세트들 (비추이적 다이스 예시 포함)
const DECK_PRESETS = [
  {
    name: '공격형 덱',
    nickname: '홍길동',
    dice: [
      [6, 6, 2, 2, 2, 3],   // 합=21
      [5, 5, 5, 2, 2, 2],   // 합=21
      [4, 4, 4, 4, 3, 2],   // 합=21
      [6, 5, 3, 3, 2, 2],   // 합=21
    ],
    wins: 14, losses: 5,
  },
  {
    name: '균형 덱',
    nickname: '김철수',
    dice: [
      [5, 4, 4, 3, 3, 2],   // 합=21
      [6, 4, 3, 3, 3, 2],   // 합=21
      [5, 5, 4, 3, 2, 2],   // 합=21
      [4, 4, 4, 3, 3, 3],   // 합=21
    ],
    wins: 11, losses: 6,
  },
  {
    name: '비추이적 클래식',
    nickname: '이영희',
    dice: [
      [2, 2, 4, 4, 9, 0],   // 합=21
      [1, 1, 6, 6, 7, 0],   // 합=21
      [3, 3, 5, 5, 5, 0],   // 합=21
      [4, 4, 4, 4, 4, 1],   // 합=21
    ],
    wins: 9, losses: 4,
  },
  {
    name: '하이로우 덱',
    nickname: '박민준',
    dice: [
      [8, 7, 1, 1, 2, 2],   // 합=21
      [9, 5, 1, 2, 2, 2],   // 합=21
      [7, 7, 2, 2, 2, 1],   // 합=21
      [6, 6, 6, 1, 1, 1],   // 합=21
    ],
    wins: 7, losses: 8,
  },
  {
    name: '수비형 덱',
    nickname: '최지훈',
    dice: [
      [4, 4, 3, 3, 4, 3],   // 합=21
      [3, 3, 4, 4, 3, 4],   // 합=21
      [5, 3, 3, 3, 4, 3],   // 합=21
      [4, 4, 4, 3, 3, 3],   // 합=21
    ],
    wins: 5, losses: 10,
  },
  {
    name: '파워 스파이크',
    nickname: '정수연',
    dice: [
      [9, 6, 1, 1, 2, 2],   // 합=21
      [8, 7, 2, 1, 2, 1],   // 합=21
      [6, 6, 6, 1, 1, 1],   // 합=21
      [7, 5, 3, 2, 2, 2],   // 합=21
    ],
    wins: 12, losses: 3,
  },
  {
    name: '미드레인지',
    nickname: '강동현',
    dice: [
      [5, 4, 4, 4, 2, 2],   // 합=21
      [4, 4, 3, 4, 3, 3],   // 합=21
      [5, 5, 3, 3, 3, 2],   // 합=21
      [4, 4, 4, 4, 3, 2],   // 합=21
    ],
    wins: 8, losses: 7,
  },
  {
    name: '올인 덱',
    nickname: '윤서아',
    dice: [
      [10, 5, 1, 1, 2, 2],  // 합=21
      [9, 8, 1, 1, 1, 1],   // 합=21
      [7, 7, 3, 1, 2, 1],   // 합=21
      [6, 6, 5, 2, 1, 1],   // 합=21
    ],
    wins: 6, losses: 9,
  },
]

async function main() {
  console.log('🌱 시드 데이터 삽입 시작...')

  // 기존 시드 데이터 정리 (googleId가 seed-* 인 유저)
  const seedUsers = await prisma.user.findMany({
    where: { googleId: { startsWith: 'seed-' } },
  })
  for (const u of seedUsers) {
    await prisma.user.delete({ where: { id: u.id } })
  }
  console.log(`  ✓ 기존 시드 ${seedUsers.length}개 삭제`)

  for (const preset of DECK_PRESETS) {
    // 유저 생성
    const user = await prisma.user.create({
      data: {
        googleId: `seed-${preset.nickname}`,
        email: `seed-${preset.nickname}@seed.test`,
        nickname: preset.nickname,
        stats: {
          create: {
            totalWins: preset.wins,
            totalLosses: preset.losses,
            currentStreak: Math.floor(Math.random() * 4),
            maxStreak: Math.floor(preset.wins / 2),
          },
        },
      },
    })

    // 덱 + 주사위 + 통계 생성
    await prisma.deck.create({
      data: {
        name: preset.name,
        userId: user.id,
        dice: {
          create: preset.dice.map((faces, order) => ({ faces, order })),
        },
        stats: {
          create: {
            totalGames: preset.wins + preset.losses,
            wins: preset.wins,
            losses: preset.losses,
          },
        },
      },
    })

    console.log(`  ✓ ${preset.nickname} / ${preset.name} (${preset.wins}승 ${preset.losses}패)`)
  }

  console.log('\n✅ 시드 완료! 랭킹 페이지에서 확인하세요.')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
