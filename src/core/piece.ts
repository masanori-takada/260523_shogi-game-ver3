import { PieceType, PlayerSide, type Square } from '../types/index.js'

// ------------------------------------------------------------
// 各駒の移動定義
// ------------------------------------------------------------

/** 方向ベクトル（先手視点）。後手は反転して使用 */
type Direction = [number, number] // [rowDelta, colDelta]

/** ライダー（スライド移動: 角・飛・香）の方向 */
const ROOK_DIRS: Direction[]   = [[-1,0],[1,0],[0,-1],[0,1]]
const BISHOP_DIRS: Direction[] = [[-1,-1],[-1,1],[1,-1],[1,1]]
const LANCE_DIRS: Direction[]  = [[-1,0]] // 先手視点（上方向）

/** 金将・と金・成香・成桂・成銀 の移動方向（先手視点） */
const GOLD_DIRS: Direction[] = [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1]]

/** 銀将の移動方向（先手視点） */
const SILVER_DIRS: Direction[] = [[-1,-1],[-1,0],[-1,1],[1,-1],[1,1]]

/** 桂馬の移動（先手視点） */
const KNIGHT_MOVES: Direction[] = [[-2,-1],[-2,1]]

/**
 * 指定した方向ベクトルを後手用に上下反転する
 */
function flipDir([dr, dc]: Direction): Direction {
  return [-dr, dc]
}

export interface PieceMoveConfig {
  /** ステップ移動（最大1マス）の方向リスト */
  stepDirs: Direction[]
  /** スライド移動（複数マス）の方向リスト */
  slideDirs: Direction[]
  /** 桂馬の特殊跳び移動 */
  knightMoves: Direction[]
}

/**
 * 指定した駒種・手番の移動設定を返す
 */
export function getPieceMoveConfig(type: PieceType, side: PlayerSide): PieceMoveConfig {
  const flip = side === PlayerSide.GOTE
  const f = (dirs: Direction[]): Direction[] => flip ? dirs.map(flipDir) : dirs

  switch (type) {
    case PieceType.PAWN:
      return { stepDirs: f([[-1,0]]), slideDirs: [], knightMoves: [] }

    case PieceType.LANCE:
      return { stepDirs: [], slideDirs: f(LANCE_DIRS), knightMoves: [] }

    case PieceType.KNIGHT:
      return { stepDirs: [], slideDirs: [], knightMoves: f(KNIGHT_MOVES) }

    case PieceType.SILVER:
      return { stepDirs: f(SILVER_DIRS), slideDirs: [], knightMoves: [] }

    case PieceType.GOLD:
    case PieceType.PROMOTED_PAWN:
    case PieceType.PROMOTED_LANCE:
    case PieceType.PROMOTED_KNIGHT:
    case PieceType.PROMOTED_SILVER:
      return { stepDirs: f(GOLD_DIRS), slideDirs: [], knightMoves: [] }

    case PieceType.BISHOP:
      return { stepDirs: [], slideDirs: BISHOP_DIRS, knightMoves: [] }

    case PieceType.ROOK:
      return { stepDirs: [], slideDirs: ROOK_DIRS, knightMoves: [] }

    case PieceType.PROMOTED_BISHOP:
      // 龍馬: 角の動き + 上下左右1マス
      return { stepDirs: ROOK_DIRS, slideDirs: BISHOP_DIRS, knightMoves: [] }

    case PieceType.PROMOTED_ROOK:
      // 龍王: 飛の動き + 斜め1マス
      return { stepDirs: BISHOP_DIRS, slideDirs: ROOK_DIRS, knightMoves: [] }

    case PieceType.KING:
      return {
        stepDirs: [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]],
        slideDirs: [],
        knightMoves: [],
      }
  }
}

// ------------------------------------------------------------
// 成り関連
// ------------------------------------------------------------

/** 成り前 → 成り後 のマップ */
const PROMOTION_MAP: Partial<Record<PieceType, PieceType>> = {
  [PieceType.PAWN]:   PieceType.PROMOTED_PAWN,
  [PieceType.LANCE]:  PieceType.PROMOTED_LANCE,
  [PieceType.KNIGHT]: PieceType.PROMOTED_KNIGHT,
  [PieceType.SILVER]: PieceType.PROMOTED_SILVER,
  [PieceType.BISHOP]: PieceType.PROMOTED_BISHOP,
  [PieceType.ROOK]:   PieceType.PROMOTED_ROOK,
}

/** 成り後 → 成り前 のマップ */
const DEMOTION_MAP: Partial<Record<PieceType, PieceType>> = {
  [PieceType.PROMOTED_PAWN]:   PieceType.PAWN,
  [PieceType.PROMOTED_LANCE]:  PieceType.LANCE,
  [PieceType.PROMOTED_KNIGHT]: PieceType.KNIGHT,
  [PieceType.PROMOTED_SILVER]: PieceType.SILVER,
  [PieceType.PROMOTED_BISHOP]: PieceType.BISHOP,
  [PieceType.PROMOTED_ROOK]:   PieceType.ROOK,
}

/** この駒が成ることができるか（金・玉・成り駒は不可） */
export function canPromotePiece(type: PieceType): boolean {
  return type in PROMOTION_MAP
}

/** 成り後の駒種を返す */
export function promote(type: PieceType): PieceType {
  const promoted = PROMOTION_MAP[type]
  if (!promoted) throw new Error(`${type} cannot promote`)
  return promoted
}

/** 持ち駒化（成りを解除）する駒種を返す */
export function demote(type: PieceType): PieceType {
  return DEMOTION_MAP[type] ?? type
}

/** 既に成り駒かどうか */
export function isPromoted(type: PieceType): boolean {
  return type in DEMOTION_MAP
}

// ------------------------------------------------------------
// 駒の価値（AI評価用）
// ------------------------------------------------------------
const PIECE_VALUES: Record<PieceType, number> = {
  [PieceType.PAWN]:             100,
  [PieceType.LANCE]:            300,
  [PieceType.KNIGHT]:           350,
  [PieceType.SILVER]:           500,
  [PieceType.GOLD]:             600,
  [PieceType.BISHOP]:           800,
  [PieceType.ROOK]:            1000,
  [PieceType.KING]:           10000,
  [PieceType.PROMOTED_PAWN]:    400,
  [PieceType.PROMOTED_LANCE]:   400,
  [PieceType.PROMOTED_KNIGHT]:  450,
  [PieceType.PROMOTED_SILVER]:  500,
  [PieceType.PROMOTED_BISHOP]: 1100,
  [PieceType.PROMOTED_ROOK]:   1300,
}

export function pieceValue(type: PieceType): number {
  return PIECE_VALUES[type]
}

// ------------------------------------------------------------
// 行き所のない駒判定
// ------------------------------------------------------------

/**
 * この駒をこの位置に打った/移動した場合、行き所がなくなるか
 * （先手: row=0-1 が香/歩の禁止エリア、row=0 が桂馬の禁止エリア 2段）
 */
export function hasNoRetreat(type: PieceType, side: PlayerSide, sq: Square): boolean {
  const baseType = demote(type)

  if (side === PlayerSide.SENTE) {
    if (baseType === PieceType.PAWN  && sq.row === 0) return true
    if (baseType === PieceType.LANCE && sq.row === 0) return true
    if (baseType === PieceType.KNIGHT && sq.row <= 1) return true
  } else {
    if (baseType === PieceType.PAWN  && sq.row === 8) return true
    if (baseType === PieceType.LANCE && sq.row === 8) return true
    if (baseType === PieceType.KNIGHT && sq.row >= 7) return true
  }
  return false
}

/**
 * 強制成りが必要か（行き所のない駒を生のまま置く場合）
 */
export function mustPromoteAtSquare(type: PieceType, side: PlayerSide, sq: Square): boolean {
  if (!canPromotePiece(type)) return false
  return hasNoRetreat(type, side, sq)
}

/**
 * 相手陣（成りゾーン）かどうか
 */
export function isEnemyTerritory(side: PlayerSide, sq: Square): boolean {
  if (side === PlayerSide.SENTE) return sq.row <= 2
  return sq.row >= 6
}
