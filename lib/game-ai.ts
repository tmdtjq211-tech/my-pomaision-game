// Minimax AI with Alpha-Beta Pruning for Formation game

export type Player = "human" | "ai" | null
export type OnlinePlayer = "host" | "guest" | null
export type Board = Player[][]
export type OnlineBoard = OnlinePlayer[][]
export type Difficulty = "beginner" | "intermediate" | "advanced"

const BOARD_SIZE = 7
const WIN_LENGTH = 4

const DEPTH_BY_DIFFICULTY: Record<Difficulty, number> = {
  beginner: 1,
  intermediate: 2,
  advanced: 4,
}

const MISTAKE_RATE: Record<Difficulty, number> = {
  beginner: 0.4, // 40% chance to make mistake
  intermediate: 0.15, // 15% chance to make mistake
  advanced: 0, // Never makes mistakes
}

// Direction vectors for checking lines
const DIRECTIONS = [
  [0, 1], // horizontal
  [1, 0], // vertical
  [1, 1], // diagonal down-right
  [1, -1], // diagonal down-left
]

// Get valid moves based on opponent's last move
export function getValidMoves(
  board: Board,
  lastMove: { row: number; col: number } | null,
  currentPlayer: Player = "human",
): { row: number; col: number }[] {
  const validMoves: { row: number; col: number }[] = []

  if (!lastMove) {
    // First move - any empty cell is valid
    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        if (board[row][col] === null) {
          validMoves.push({ row, col })
        }
      }
    }
    return validMoves
  }

  // Check 8 adjacent cells around last move
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue
      const newRow = lastMove.row + dr
      const newCol = lastMove.col + dc
      if (newRow >= 0 && newRow < BOARD_SIZE && newCol >= 0 && newCol < BOARD_SIZE && board[newRow][newCol] === null) {
        validMoves.push({ row: newRow, col: newCol })
      }
    }
  }

  if (validMoves.length === 0) {
    const opponent: Player = currentPlayer === "human" ? "ai" : "human"
    const validMoveSet = new Set<string>()

    // Find all opponent's stones
    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        if (board[row][col] === opponent) {
          // Check 8 adjacent cells around each opponent's stone
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              if (dr === 0 && dc === 0) continue
              const newRow = row + dr
              const newCol = col + dc
              if (
                newRow >= 0 &&
                newRow < BOARD_SIZE &&
                newCol >= 0 &&
                newCol < BOARD_SIZE &&
                board[newRow][newCol] === null
              ) {
                validMoveSet.add(`${newRow},${newCol}`)
              }
            }
          }
        }
      }
    }

    // Convert set to array
    for (const key of validMoveSet) {
      const [row, col] = key.split(",").map(Number)
      validMoves.push({ row, col })
    }
  }

  return validMoves
}

// Check for winner
export function checkWinner(board: Board): Player {
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const cell = board[row][col]
      if (cell === null) continue

      for (const [dr, dc] of DIRECTIONS) {
        let count = 1

        for (let i = 1; i < WIN_LENGTH; i++) {
          const newRow = row + dr * i
          const newCol = col + dc * i
          if (
            newRow >= 0 &&
            newRow < BOARD_SIZE &&
            newCol >= 0 &&
            newCol < BOARD_SIZE &&
            board[newRow][newCol] === cell
          ) {
            count++
          } else {
            break
          }
        }

        if (count >= WIN_LENGTH) {
          return cell
        }
      }
    }
  }
  return null
}

// Get winning cells for highlighting
export function getWinningCells(board: Board): { row: number; col: number }[] {
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const cell = board[row][col]
      if (cell === null) continue

      for (const [dr, dc] of DIRECTIONS) {
        const winningCells = [{ row, col }]

        for (let i = 1; i < WIN_LENGTH; i++) {
          const newRow = row + dr * i
          const newCol = col + dc * i
          if (
            newRow >= 0 &&
            newRow < BOARD_SIZE &&
            newCol >= 0 &&
            newCol < BOARD_SIZE &&
            board[newRow][newCol] === cell
          ) {
            winningCells.push({ row: newRow, col: newCol })
          } else {
            break
          }
        }

        if (winningCells.length >= WIN_LENGTH) {
          return winningCells
        }
      }
    }
  }
  return []
}

// Evaluate board position for AI
function evaluatePosition(board: Board, player: Player): number {
  const opponent: Player = player === "ai" ? "human" : "ai"
  let score = 0

  // Scoring weights
  const SCORES = {
    four: 100000,
    openThree: 5000,
    blockedThree: 500,
    openTwo: 100,
    blockedTwo: 10,
    center: 5,
  }

  // Check all lines
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      // Center control bonus
      const centerDist = Math.abs(row - 3) + Math.abs(col - 3)
      if (board[row][col] === player) {
        score += (6 - centerDist) * SCORES.center
      } else if (board[row][col] === opponent) {
        score -= (6 - centerDist) * SCORES.center
      }

      for (const [dr, dc] of DIRECTIONS) {
        const line: (Player | "out")[] = []

        // Get line of 4
        for (let i = 0; i < WIN_LENGTH; i++) {
          const newRow = row + dr * i
          const newCol = col + dc * i
          if (newRow >= 0 && newRow < BOARD_SIZE && newCol >= 0 && newCol < BOARD_SIZE) {
            line.push(board[newRow][newCol])
          } else {
            line.push("out")
          }
        }

        if (line.length === WIN_LENGTH && !line.includes("out")) {
          const playerCount = line.filter((c) => c === player).length
          const opponentCount = line.filter((c) => c === opponent).length
          const emptyCount = line.filter((c) => c === null).length

          // Scoring based on patterns
          if (playerCount === 4) score += SCORES.four
          else if (opponentCount === 4)
            score -= SCORES.four * 1.1 // Prioritize blocking
          else if (playerCount === 3 && emptyCount === 1) score += SCORES.openThree
          else if (opponentCount === 3 && emptyCount === 1) score -= SCORES.openThree * 1.2
          else if (playerCount === 2 && emptyCount === 2) score += SCORES.openTwo
          else if (opponentCount === 2 && emptyCount === 2) score -= SCORES.openTwo
        }
      }
    }
  }

  return score
}

// Minimax with Alpha-Beta Pruning
function minimax(
  board: Board,
  depth: number,
  alpha: number,
  beta: number,
  isMaximizing: boolean,
  lastMove: { row: number; col: number } | null,
): number {
  const winner = checkWinner(board)
  if (winner === "ai") return 100000 + depth
  if (winner === "human") return -100000 - depth
  if (depth === 0) return evaluatePosition(board, "ai")

  const currentPlayer: Player = isMaximizing ? "ai" : "human"
  const validMoves = getValidMoves(board, lastMove, currentPlayer)
  if (validMoves.length === 0) return 0

  // Sort moves by heuristic for better pruning
  const scoredMoves = validMoves.map((move) => {
    const newBoard = board.map((row) => [...row])
    newBoard[move.row][move.col] = isMaximizing ? "ai" : "human"
    return {
      move,
      score: evaluatePosition(newBoard, "ai"),
    }
  })
  scoredMoves.sort((a, b) => (isMaximizing ? b.score - a.score : a.score - b.score))

  if (isMaximizing) {
    let maxEval = Number.NEGATIVE_INFINITY
    for (const { move } of scoredMoves.slice(0, 10)) {
      // Limit branching
      const newBoard = board.map((row) => [...row])
      newBoard[move.row][move.col] = "ai"
      const evalScore = minimax(newBoard, depth - 1, alpha, beta, false, move)
      maxEval = Math.max(maxEval, evalScore)
      alpha = Math.max(alpha, evalScore)
      if (beta <= alpha) break
    }
    return maxEval
  } else {
    let minEval = Number.POSITIVE_INFINITY
    for (const { move } of scoredMoves.slice(0, 10)) {
      const newBoard = board.map((row) => [...row])
      newBoard[move.row][move.col] = "human"
      const evalScore = minimax(newBoard, depth - 1, alpha, beta, true, move)
      minEval = Math.min(minEval, evalScore)
      beta = Math.min(beta, evalScore)
      if (beta <= alpha) break
    }
    return minEval
  }
}

// Get best AI move
export function getAIMove(
  board: Board,
  lastMove: { row: number; col: number } | null,
  difficulty: Difficulty = "advanced",
): { row: number; col: number } | null {
  const validMoves = getValidMoves(board, lastMove, "ai")
  if (validMoves.length === 0) return null

  const maxDepth = DEPTH_BY_DIFFICULTY[difficulty]
  const mistakeRate = MISTAKE_RATE[difficulty]

  // Check for immediate winning move (always take it, even on beginner)
  for (const move of validMoves) {
    const newBoard = board.map((row) => [...row])
    newBoard[move.row][move.col] = "ai"
    if (checkWinner(newBoard) === "ai") {
      return move
    }
  }

  // Check for blocking opponent's winning move
  // Beginner might miss this
  if (difficulty !== "beginner" || Math.random() > 0.5) {
    for (const move of validMoves) {
      const newBoard = board.map((row) => [...row])
      newBoard[move.row][move.col] = "human"
      if (checkWinner(newBoard) === "human") {
        return move
      }
    }
  }

  if (Math.random() < mistakeRate) {
    // Make a semi-random move (not completely random, prefer center area)
    const scoredMoves = validMoves.map((move) => {
      const centerDist = Math.abs(move.row - 3) + Math.abs(move.col - 3)
      return { move, score: 6 - centerDist + Math.random() * 3 }
    })
    scoredMoves.sort((a, b) => b.score - a.score)
    return scoredMoves[0].move
  }

  let bestMove = validMoves[0]
  let bestScore = Number.NEGATIVE_INFINITY

  for (const move of validMoves) {
    const newBoard = board.map((row) => [...row])
    newBoard[move.row][move.col] = "ai"
    const score = minimax(newBoard, maxDepth - 1, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY, false, move)
    if (score > bestScore) {
      bestScore = score
      bestMove = move
    }
  }

  return bestMove
}

// Online-specific functions

// Get valid moves for online board with host/guest
export function getValidMovesOnline(
  board: OnlineBoard,
  lastMove: { row: number; col: number } | null,
  currentPlayer: "host" | "guest",
): { row: number; col: number }[] {
  const validMoves: { row: number; col: number }[] = []

  if (!lastMove) {
    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        if (board[row][col] === null) {
          validMoves.push({ row, col })
        }
      }
    }
    return validMoves
  }

  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue
      const newRow = lastMove.row + dr
      const newCol = lastMove.col + dc
      if (newRow >= 0 && newRow < BOARD_SIZE && newCol >= 0 && newCol < BOARD_SIZE && board[newRow][newCol] === null) {
        validMoves.push({ row: newRow, col: newCol })
      }
    }
  }

  if (validMoves.length === 0) {
    const opponent: "host" | "guest" = currentPlayer === "host" ? "guest" : "host"
    const validMoveSet = new Set<string>()

    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        if (board[row][col] === opponent) {
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              if (dr === 0 && dc === 0) continue
              const newRow = row + dr
              const newCol = col + dc
              if (
                newRow >= 0 &&
                newRow < BOARD_SIZE &&
                newCol >= 0 &&
                newCol < BOARD_SIZE &&
                board[newRow][newCol] === null
              ) {
                validMoveSet.add(`${newRow},${newCol}`)
              }
            }
          }
        }
      }
    }

    for (const key of validMoveSet) {
      const [row, col] = key.split(",").map(Number)
      validMoves.push({ row, col })
    }
  }

  return validMoves
}

export function checkWinnerOnline(board: OnlineBoard): "host" | "guest" | null {
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const cell = board[row][col]
      if (cell === null) continue

      for (const [dr, dc] of DIRECTIONS) {
        let count = 1

        for (let i = 1; i < WIN_LENGTH; i++) {
          const newRow = row + dr * i
          const newCol = col + dc * i
          if (
            newRow >= 0 &&
            newRow < BOARD_SIZE &&
            newCol >= 0 &&
            newCol < BOARD_SIZE &&
            board[newRow][newCol] === cell
          ) {
            count++
          } else {
            break
          }
        }

        if (count >= WIN_LENGTH) {
          return cell
        }
      }
    }
  }
  return null
}

export function getWinningCellsOnline(board: OnlineBoard): { row: number; col: number }[] {
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const cell = board[row][col]
      if (cell === null) continue

      for (const [dr, dc] of DIRECTIONS) {
        const winningCells = [{ row, col }]

        for (let i = 1; i < WIN_LENGTH; i++) {
          const newRow = row + dr * i
          const newCol = col + dc * i
          if (
            newRow >= 0 &&
            newRow < BOARD_SIZE &&
            newCol >= 0 &&
            newCol < BOARD_SIZE &&
            board[newRow][newCol] === cell
          ) {
            winningCells.push({ row: newRow, col: newCol })
          } else {
            break
          }
        }

        if (winningCells.length >= WIN_LENGTH) {
          return winningCells
        }
      }
    }
  }
  return []
}
