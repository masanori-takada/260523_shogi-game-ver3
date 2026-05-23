import {
  type Board,
  type Square,
  type Piece,
  PieceType,
  PlayerSide,
} from '../types/index.js'
import { squareEquals } from '../core/board.js'
import { PIECE_DISPLAY } from './piece-view.js'

// ------------------------------------------------------------
// 盤面 DOM 描画
// ------------------------------------------------------------

export class BoardView {
  private container: HTMLElement
  private cells: HTMLElement[][] = []
  private onSquareClickCallback: ((sq: Square) => void) | null = null
  private checkIndicator: HTMLElement | null = null

  constructor(container: HTMLElement) {
    this.container = container
    this.render()
  }

  /** 初期 DOM 構築 */
  private render(): void {
    this.container.innerHTML = ''
    this.container.className = 'shogi-board'

    // 筋番号（上部）
    const colLabels = document.createElement('div')
    colLabels.className = 'board-col-labels'
    for (let col = 8; col >= 0; col--) {
      const label = document.createElement('span')
      label.textContent = String(9 - col)
      colLabels.appendChild(label)
    }
    this.container.appendChild(colLabels)

    // 盤面グリッド
    const grid = document.createElement('div')
    grid.className = 'board-grid'

    this.cells = []
    for (let row = 0; row < 9; row++) {
      this.cells[row] = []
      const rowElem = document.createElement('div')
      rowElem.className = 'board-row'

      // 段番号（左）
      const rowLabel = document.createElement('span')
      rowLabel.className = 'board-row-label'
      rowLabel.textContent = String(row + 1)
      rowElem.appendChild(rowLabel)

      for (let col = 8; col >= 0; col--) {
        const cell = document.createElement('div')
        cell.className = 'board-cell'
        cell.dataset['row'] = String(row)
        cell.dataset['col'] = String(col)
        cell.addEventListener('click', () => {
          this.onSquareClickCallback?.({ row, col })
        })
        rowElem.appendChild(cell)
        this.cells[row]![col] = cell
      }

      grid.appendChild(rowElem)
    }

    this.container.appendChild(grid)

    // 王手インジケーター
    this.checkIndicator = document.createElement('div')
    this.checkIndicator.className = 'check-indicator hidden'
    this.checkIndicator.textContent = '王手！'
    this.container.appendChild(this.checkIndicator)
  }

  /** クリックイベントを登録する */
  onSquareClick(callback: (sq: Square) => void): void {
    this.onSquareClickCallback = callback
  }

  /** 盤面を更新する */
  update(
    board: Board,
    selectedSquare: Square | null,
    highlightedSquares: Square[],
    isCheck: boolean,
  ): void {
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        const cell = this.cells[row]![col]!
        const piece = board[row]![col]

        // クラスをリセット
        cell.className = 'board-cell'
        cell.innerHTML = ''

        // 駒を描画
        if (piece) {
          const pieceElem = createPieceElement(piece)
          cell.appendChild(pieceElem)
        }

        // 選択マスのハイライト
        if (selectedSquare && squareEquals(selectedSquare, { row, col })) {
          cell.classList.add('selected')
        }

        // 合法手のハイライト
        if (highlightedSquares.some(s => squareEquals(s, { row, col }))) {
          cell.classList.add('highlight')
          if (!piece) {
            const dot = document.createElement('div')
            dot.className = 'move-dot'
            cell.appendChild(dot)
          }
        }
      }
    }

    // 王手表示
    if (this.checkIndicator) {
      if (isCheck) {
        this.checkIndicator.classList.remove('hidden')
      } else {
        this.checkIndicator.classList.add('hidden')
      }
    }
  }

  /** AI思考中インジケーターの表示切り替え */
  setThinking(thinking: boolean): void {
    if (thinking) {
      this.container.classList.add('thinking')
    } else {
      this.container.classList.remove('thinking')
    }
  }
}

function createPieceElement(piece: Piece): HTMLElement {
  const elem = document.createElement('div')
  elem.className = `piece ${piece.owner === PlayerSide.SENTE ? 'sente' : 'gote'}`
  elem.textContent = PIECE_DISPLAY[piece.type]
  return elem
}
