# Dice Game — Codex 컨텍스트

## 프로젝트 개요

주사위 눈 합계 21을 6면에 자유 배치하는 전략형 1대1 웹 주사위 게임.
비추이적 주사위(Non-transitive Dice) 원리를 활용한 덱 빌딩 + 실시간 대전 서비스.

## 핵심 게임 룰

- 주사위 1개: 6면, 각 눈의 **합계는 반드시 21**
- 덱: 주사위 **4개**로 구성, 사전에 제작
- 매칭 후: 상대 덱 4개 **전부 공개** 확인
- 드래프트: 내 4개 중 **3개 선택 + 출전 순서 봉인**
- 경기: 봉인된 순서대로 라운드 진행, **2선승** 시 승리
- 동점: 같은 주사위로 **재대결** (해소될 때까지 반복)

## 모노레포 구조

```
dice-game/
├── AGENTS.md                  ← 현재 파일 (Codex 전역 컨텍스트)
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── package.json
└── packages/
    ├── core/                  ← 게임 로직 (서버·클라이언트 공유 순수 함수)
    ├── client/                ← React + Vite 프론트엔드
    └── server/                ← Fastify + Socket.io 백엔드
```

## 개발 환경

- OS: macOS
- 런타임: Node.js (LTS)
- 패키지 매니저: pnpm (워크스페이스)
- 언어: TypeScript (strict mode)

## 기술 스택 요약

| 레이어 | 기술 |
|--------|------|
| 클라이언트 | React 18, Vite, Zustand, Socket.io-client |
| 서버 | Fastify, Socket.io, Node.js |
| DB (영구) | PostgreSQL + Prisma ORM |
| DB (휘발) | Redis (게임룸·세션·매칭큐) |
| 인증 | JWT + OAuth (Google) |
| 배포 | Docker, Railway/Fly.io, Vercel |
| 테스트 | Vitest (core), Playwright (e2e) |

## 패키지 참조 방법

```jsonc
// packages/client/package.json 또는 packages/server/package.json
{
  "dependencies": {
    "@dice-game/core": "workspace:*"
  }
}
```

## 개발 단계 (Phase)

| Phase | 내용 | 문서 |
|-------|------|------|
| 1 | 프로젝트 세팅 + 게임 로직 + 로컬 시뮬레이터 | [PHASE-1.md](./docs/PHASE-1.md) |
| 2 | 인증 + DB + 실시간 1대1 매칭 | [PHASE-2.md](./docs/PHASE-2.md) |
| 3 | 매칭 시스템 + 게임 UX 완성 | [PHASE-3.md](./docs/PHASE-3.md) |
| 4 | 소셜 + 메타게임 + 출시 준비 | [PHASE-4.md](./docs/PHASE-4.md) |

## 핵심 원칙

1. **게임 로직은 항상 서버에서 검증** — 클라이언트는 표시만 담당
2. **core 패키지는 순수 함수만** — 외부 의존성(DB, 네트워크) 없음
3. **Redis = 휘발성 게임 상태 / PostgreSQL = 영구 기록** 명확히 분리
4. **타입은 core에서 정의** — client·server 모두 core 타입 import
