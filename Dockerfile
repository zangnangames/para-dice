FROM node:20-alpine
RUN apk add --no-cache openssl
RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

# 의존성 설치 (package.json만 먼저 복사 → Docker 레이어 캐시 활용)
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages/core/package.json ./packages/core/
COPY packages/server/package.json ./packages/server/
RUN pnpm install --frozen-lockfile

# 소스 복사 및 빌드
COPY packages/core ./packages/core
COPY packages/server ./packages/server
RUN pnpm --filter @dice-game/server build

WORKDIR /app/packages/server

ENV NODE_ENV=production
EXPOSE 3001

# DB 마이그레이션 실행 후 서버 시작
CMD ["sh", "-c", "pnpm exec prisma migrate deploy && node dist/index.js"]
