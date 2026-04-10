/**
 * Redis 기반 게임 룸 상태 스토어
 * Phase 2의 인메모리 Map<string, RoomState>를 대체
 */
import { redis } from '../plugins/redis.js'
import { createInitialGameState } from '@dice-game/core'
import type { GameState, RollResult } from '@dice-game/core'

const ROOM_TTL = 60 * 60 // 1시간

// ── 타입 ──────────────────────────────────────────────────────

export interface RoomPlayer {
  socketId: string
  userId: string
}

export interface RoomState {
  matchId: string
  players: [RoomPlayer | null, RoomPlayer | null]
  decks: [any, any]
  picks: [string[] | null, string[] | null]
  gameState: GameState
  roundHistory: Array<{ number: number; winnerId: string; rolls: RollResult[] }>
  currentRoundRolls: RollResult[]
  roundValues: [number | null, number | null]
  roundReady: [boolean, boolean]   // 각 플레이어가 현재 라운드 주사위를 던졌는지
}

// ── 키 ────────────────────────────────────────────────────────

const roomKey = (matchId: string) => `room:${matchId}`

// ── CRUD ──────────────────────────────────────────────────────

export async function getRoom(matchId: string): Promise<RoomState | null> {
  const raw = await redis.get(roomKey(matchId))
  return raw ? (JSON.parse(raw) as RoomState) : null
}

export async function setRoom(matchId: string, room: RoomState): Promise<void> {
  await redis.set(roomKey(matchId), JSON.stringify(room), 'EX', ROOM_TTL)
}

export async function deleteRoom(matchId: string): Promise<void> {
  await Promise.all([
    redis.del(roomKey(matchId)),
    redis.del(playerSlotsKey(matchId)),
  ])
}

export function createRoom(matchId: string, deckA: any, deckB: any): RoomState {
  return {
    matchId,
    players: [null, null],
    decks: [deckA, deckB],
    picks: [null, null],
    gameState: createInitialGameState(),
    roundHistory: [],
    currentRoundRolls: [],
    roundValues: [null, null],
    roundReady: [false, false],
  }
}

// ── 플레이어 슬롯 (원자적 개별 업데이트) ────────────────────────
// getRoom → modify → setRoom 패턴의 레이스 컨디션을 방지하기 위해
// 플레이어 입장은 Redis Hash 필드 단위로 원자적으로 기록한다.

const playerSlotsKey = (matchId: string) => `room:${matchId}:slots`

export async function setRoomPlayerSlot(
  matchId: string,
  playerIdx: 0 | 1,
  player: RoomPlayer,
): Promise<void> {
  const key = playerSlotsKey(matchId)
  await redis.hset(key, `p${playerIdx}`, JSON.stringify(player))
  await redis.expire(key, ROOM_TTL)
}

export async function getRoomPlayerSlots(
  matchId: string,
): Promise<[RoomPlayer | null, RoomPlayer | null]> {
  const key = playerSlotsKey(matchId)
  const [p0raw, p1raw] = await Promise.all([
    redis.hget(key, 'p0'),
    redis.hget(key, 'p1'),
  ])
  return [
    p0raw ? (JSON.parse(p0raw) as RoomPlayer) : null,
    p1raw ? (JSON.parse(p1raw) as RoomPlayer) : null,
  ]
}

export async function deleteRoomPlayerSlots(matchId: string): Promise<void> {
  await redis.del(playerSlotsKey(matchId))
}

// ── 소켓 ID ↔ matchId 역방향 조회 ──────────────────────────────
// disconnect 핸들러에서 어느 방인지 찾을 때 사용

const socketRoomKey = (socketId: string) => `socket:room:${socketId}`

export async function setSocketRoom(socketId: string, matchId: string): Promise<void> {
  await redis.set(socketRoomKey(socketId), matchId, 'EX', ROOM_TTL)
}

export async function getSocketRoom(socketId: string): Promise<string | null> {
  return redis.get(socketRoomKey(socketId))
}

export async function deleteSocketRoom(socketId: string): Promise<void> {
  await redis.del(socketRoomKey(socketId))
}

// ── 재대결 (Rematch) ────────────────────────────────────────────
// 게임 종료 후 양쪽이 재대결을 수락하면 새 매치를 생성한다.
// 30초 TTL 이후 자동 만료.

const REMATCH_TTL = 30

const rematchInfoKey  = (matchId: string) => `rematch:${matchId}:info`
const rematchReqKey   = (matchId: string, idx: 0 | 1) => `rematch:${matchId}:req:${idx}`

export interface RematchInfo {
  players: [RoomPlayer, RoomPlayer]
  deckIds:  [string, string]
}

/** 게임 종료 시 재대결 컨텍스트 저장 */
export async function setRematchInfo(
  matchId: string,
  players: [RoomPlayer, RoomPlayer],
  deckIds: [string, string],
): Promise<void> {
  await redis.set(
    rematchInfoKey(matchId),
    JSON.stringify({ players, deckIds }),
    'EX',
    REMATCH_TTL,
  )
}

export async function getRematchInfo(matchId: string): Promise<RematchInfo | null> {
  const raw = await redis.get(rematchInfoKey(matchId))
  return raw ? (JSON.parse(raw) as RematchInfo) : null
}

/**
 * 플레이어가 재대결을 요청할 때 호출.
 * 양쪽 모두 요청했으면 { bothReady: true, info } 반환.
 */
export async function setRematchRequest(
  matchId: string,
  playerIdx: 0 | 1,
): Promise<{ bothReady: boolean; info: RematchInfo | null }> {
  await redis.set(rematchReqKey(matchId, playerIdx), '1', 'EX', REMATCH_TTL)
  const [req0, req1, infoRaw] = await Promise.all([
    redis.get(rematchReqKey(matchId, 0)),
    redis.get(rematchReqKey(matchId, 1)),
    redis.get(rematchInfoKey(matchId)),
  ])
  if (req0 && req1 && infoRaw) {
    return { bothReady: true, info: JSON.parse(infoRaw) as RematchInfo }
  }
  return { bothReady: false, info: null }
}

/** 재대결 관련 키 전체 삭제 */
export async function deleteRematchContext(matchId: string): Promise<void> {
  await Promise.all([
    redis.del(rematchInfoKey(matchId)),
    redis.del(rematchReqKey(matchId, 0)),
    redis.del(rematchReqKey(matchId, 1)),
  ])
}
