import {
  type Hand,
  type Square,
  PieceType,
  PlayerSide,
} from '../types/index.js'
import { PIECE_DISPLAY } from './piece-view.js'

// ------------------------------------------------------------
// 持ち駒エリア
// ------------------------------------------------------------

// 持ち駒として出現しうる駒種（玉は除く）
const HAND_PIECE_TYPES: PieceType[] = [
  PieceType.ROOK,
  PieceType.BISHOP,
  PieceType.GOLD,
  PieceType.SILVER,
  PieceType.KNIGHT,
  PieceType.LANCE,
  PieceType.PAWN,
]

export class HandView {
  private container: HTMLElement
  private side: PlayerSide
  private onPieceClickCallback: ((type: PieceType) => void) | null = null
  private selectedType: PieceType | null = null
  private highlightedSquares: Square[] = []

  constructor(container: HTMLElement, side: PlayerSide) {
    this.container = container
    this.side = side
    this.render(new Map())
  }

  onPieceClick(callback: (type: PieceType) => void): void {
    this.onPieceClickCallback = callback
  }

  update(hand: Hand, selectedType: PieceType | null): void {
    this.selectedType = selectedType
    this.render(hand)
  }

  private render(hand: Hand): void {
    this.container.innerHTML = ''
    this.container.className = `hand-area hand-${this.side === PlayerSide.SENTE ? 'sente' : 'gote'}`

    const label = document.createElement('div')
    label.className = 'hand-label'
    label.textContent = this.side === PlayerSide.SENTE ? '先手持ち駒' : '後手持ち駒'
    this.container.appendChild(label)

    const pieces = document.createElement('div')
    pieces.className = 'hand-pieces'

    for (const type of HAND_PIECE_TYPES) {
      const count = hand.get(type) ?? 0
      if (count === 0) continue

      const pieceElem = document.createElement('div')
      pieceElem.className = 'hand-piece'
      if (this.selectedType === type) {
        pieceElem.classList.add('selected')
      }

      const display = document.createElement('span')
      display.className = 'hand-piece-char'
      display.textContent = PIECE_DISPLAY[type]

      const countElem = document.createElement('span')
      countElem.className = 'hand-piece-count'
      countElem.textContent = count > 1 ? String(count) : ''

      pieceElem.appendChild(display)
      pieceElem.appendChild(countElem)
      pieceElem.addEventListener('click', () => {
        this.onPieceClickCallback?.(type)
      })

      pieces.appendChild(pieceElem)
    }

    this.container.appendChild(pieces)
  }
}
