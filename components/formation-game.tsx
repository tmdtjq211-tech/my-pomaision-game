"use client"

import { useState, useCallback, useEffect } from "react"
import { motion } from "framer-motion"
import { GameBoard } from "./game-board"
import { GameStatus } from "./game-status"
import { OnlineLobby } from "./online-lobby"
import { OnlineGame } from "./online-game"
import {
  type Player,
  type Board,
  type Difficulty,
  getValidMoves,
  checkWinner,
  getWinningCells,
  getAIMove,
} from "@/lib/game-ai"

const BOARD_SIZE = 7

type GameMode = "pvp" | "ai" | "online"
type Role = "host" | "guest" | "spectator"

function createEmptyBoard(): Board {
  return Array(BOARD_SIZE)
    .fill(null)
    .map(() => Array(BOARD_SIZE).fill(null))
}

export function FormationGame() {
  const [gameMode, setGameMode] = useState<GameMode>("ai")
  const [board, setBoard] = useState<Board>(createEmptyBoard)
  const [currentPlayer, setCurrentPlayer] = useState<"human" | "ai" | "player2">("human")
  const [lastMove, setLastMove] = useState<{ row: number; col: number } | null>(null)
  const [winner, setWinner] = useState<Player>(null)
  const [winningCells, setWinningCells] = useState<{ row: number; col: number }[]>([])
  const [isThinking, setIsThinking] = useState(false)
  const [moveCount, setMoveCount] = useState(0)
  const [difficulty, setDifficulty] = useState<Difficulty>("intermediate")

  const [onlineRoomId, setOnlineRoomId] = useState<string | null>(null)
  const [onlineRole, setOnlineRole] = useState<Role>("host")

  const validMoves = winner ? [] : getValidMoves(board, lastMove, currentPlayer === "player2" ? "ai" : currentPlayer)

  const makeMove = useCallback((row: number, col: number, player: "human" | "ai" | "player2") => {
    setBoard((prev) => {
      const newBoard = prev.map((r) => [...r])
      newBoard[row][col] = player === "player2" ? "ai" : player
      return newBoard
    })
    setLastMove({ row, col })
    setMoveCount((prev) => prev + 1)
  }, [])

  const handleCellClick = useCallback(
    (row: number, col: number) => {
      if (winner || isThinking) return
      if (!validMoves.some((m) => m.row === row && m.col === col)) return

      if (gameMode === "pvp") {
        if (currentPlayer !== "human" && currentPlayer !== "player2") return
        makeMove(row, col, currentPlayer)
        setCurrentPlayer(currentPlayer === "human" ? "player2" : "human")
      } else {
        if (currentPlayer !== "human") return
        makeMove(row, col, "human")
        setCurrentPlayer("ai")
      }
    },
    [winner, currentPlayer, isThinking, validMoves, makeMove, gameMode],
  )

  useEffect(() => {
    const gameWinner = checkWinner(board)
    if (gameWinner) {
      setWinner(gameWinner)
      setWinningCells(getWinningCells(board))
    }
  }, [board])

  useEffect(() => {
    if (gameMode !== "ai" || currentPlayer !== "ai" || winner) return

    setIsThinking(true)
    const thinkingDelay = difficulty === "beginner" ? 300 : difficulty === "intermediate" ? 500 : 700
    const timeout = setTimeout(() => {
      const aiMove = getAIMove(board, lastMove, difficulty)
      if (aiMove) {
        makeMove(aiMove.row, aiMove.col, "ai")
      }
      setCurrentPlayer("human")
      setIsThinking(false)
    }, thinkingDelay)

    return () => clearTimeout(timeout)
  }, [currentPlayer, winner, board, lastMove, makeMove, difficulty, gameMode])

  const resetGame = useCallback(() => {
    setBoard(createEmptyBoard())
    setCurrentPlayer("human")
    setLastMove(null)
    setWinner(null)
    setWinningCells([])
    setMoveCount(0)
    setIsThinking(false)
  }, [])

  const handleDifficultyChange = useCallback(
    (newDifficulty: Difficulty) => {
      setDifficulty(newDifficulty)
      resetGame()
    },
    [resetGame],
  )

  const handleGameModeChange = useCallback(
    (newMode: GameMode) => {
      setGameMode(newMode)
      resetGame()
    },
    [resetGame],
  )

  const handleOnlineGameStart = useCallback((roomId: string, role: Role) => {
    setOnlineRoomId(roomId)
    setOnlineRole(role)
  }, [])

  const handleOnlineExit = useCallback(() => {
    setOnlineRoomId(null)
    setGameMode("ai")
    resetGame()
  }, [resetGame])

  if (gameMode === "online") {
    if (onlineRoomId) {
      return <OnlineGame roomId={onlineRoomId} role={onlineRole} onExit={handleOnlineExit} />
    }
    return <OnlineLobby onGameStart={handleOnlineGameStart} onBack={() => setGameMode("ai")} />
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 p-4 md:flex-row md:gap-16">
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
        <GameStatus
          currentPlayer={currentPlayer}
          winner={winner}
          isThinking={isThinking}
          onReset={resetGame}
          moveCount={moveCount}
          difficulty={difficulty}
          onDifficultyChange={handleDifficultyChange}
          gameMode={gameMode}
          onGameModeChange={handleGameModeChange}
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2 }}
        className="relative pl-6 pb-6"
      >
        <GameBoard
          board={board}
          validMoves={validMoves}
          lastMove={lastMove}
          winningCells={winningCells}
          onCellClick={handleCellClick}
          disabled={(gameMode === "ai" && currentPlayer === "ai") || !!winner || isThinking}
        />
      </motion.div>
    </div>
  )
}
