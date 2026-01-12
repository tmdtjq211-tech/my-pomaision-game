"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { motion } from "framer-motion"
import { OnlineGameBoard } from "./online-game-board"
import { OnlineGameStatus } from "./online-game-status"
import { type OnlineBoard, getValidMovesOnline, checkWinnerOnline, getWinningCellsOnline } from "@/lib/game-ai"
import { database } from "@/lib/firebase"
import { ref, set, onValue, off, serverTimestamp } from "firebase/database"

export const dynamic = 'force-dynamic'

const BOARD_SIZE = 7
const TURN_TIME_LIMIT = 50

type Role = "host" | "guest" | "spectator"
type WinReason = "connect4" | "timeout" | "disconnect" | "none"
type RematchRequest = "none" | "host" | "guest" | "both"

interface OnlineGameProps {
  roomId: string
  role: Role
  onExit: () => void
}

interface SerializedGameState {
  boardData: string
  currentPlayer: "host" | "guest"
  lastMoveRow: number
  lastMoveCol: number
  moveCount: number
  winner: "host" | "guest" | "none"
  winReason: WinReason
  lastUpdate: any
  turnStartTime: any
  rematchRequest: RematchRequest
}

function serializeBoard(board: OnlineBoard): string {
  const serialized = board.map((row) =>
    row.map((cell) => {
      if (cell === "host") return "H"
      if (cell === "guest") return "G"
      return "E"
    }),
  )
  return JSON.stringify(serialized)
}

function deserializeBoard(data: string): OnlineBoard {
  try {
    const parsed = JSON.parse(data) as string[][]
    return parsed.map((row) =>
      row.map((cell) => {
        if (cell === "H") return "host"
        if (cell === "G") return "guest"
        return null
      }),
    )
  } catch {
    return createEmptyBoard()
  }
}

function createEmptyBoard(): OnlineBoard {
  return Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null))
}

export function OnlineGame({ roomId, role, onExit }: OnlineGameProps) {
  const [board, setBoard] = useState<OnlineBoard>(createEmptyBoard)
  const [currentPlayer, setCurrentPlayer] = useState<"host" | "guest">("host")
  const [lastMove, setLastMove] = useState<{ row: number; col: number } | null>(null)
  const [winner, setWinner] = useState<"host" | "guest" | null>(null)
  const [winReason, setWinReason] = useState<WinReason>("none")
  const [winningCells, setWinningCells] = useState<{ row: number; col: number }[]>([])
  const [moveCount, setMoveCount] = useState(0)
  const [connected, setConnected] = useState(true)
  const [timeLeft, setTimeLeft] = useState(TURN_TIME_LIMIT)
  const [turnStartTime, setTurnStartTime] = useState(Date.now())
  const [debugLogs, setDebugLogs] = useState<any[]>([])
  const [opponentDisconnected, setOpponentDisconnected] = useState(false)
  const [rematchRequest, setRematchRequest] = useState<RematchRequest>("none")
  const [showRematchModal, setShowRematchModal] = useState(false)

  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const isSpectator = role === "spectator"
  const isMyTurn = !isSpectator && currentPlayer === role
  const validMoves = winner ? [] : getValidMovesOnline(board, lastMove, currentPlayer)

  useEffect(() => {
    const gameStateRef = ref(database, `rooms/${roomId}/gameState`)
    const unsubscribe = onValue(gameStateRef, (snapshot) => {
      const data = snapshot.val() as SerializedGameState | null
      if (!data) return

      const newBoard = deserializeBoard(data.boardData)
      setBoard(newBoard)
      setCurrentPlayer(data.currentPlayer)
      setLastMove(data.lastMoveRow >= 0 ? { row: data.lastMoveRow, col: data.lastMoveCol } : null)
      setMoveCount(data.moveCount)
      setWinner(data.winner === "none" ? null : data.winner)
      setWinReason(data.winReason || "none")
      if (data.turnStartTime) setTurnStartTime(data.turnStartTime)

      if (data.winner !== "none") {
        setWinningCells(getWinningCellsOnline(newBoard))
        setShowRematchModal(true)
      } else {
        setShowRematchModal(false)
      }
    })
    return () => off(gameStateRef)
  }, [roomId])

  useEffect(() => {
    if (winner || !connected) return
    const updateTimer = () => {
      const elapsed = Math.floor((Date.now() - turnStartTime) / 1000)
      setTimeLeft(Math.max(0, TURN_TIME_LIMIT - elapsed))
    }
    timerRef.current = setInterval(updateTimer, 500)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [winner, connected, turnStartTime])

  const handleCellClick = useCallback(async (row: number, col: number) => {
    if (winner || !isMyTurn || !connected) return
    if (!validMoves.some(m => m.row === row && m.col === col)) return

    const newBoard = board.map(r => [...r])
    newBoard[row][col] = role as "host" | "guest"
    const nextPlayer = role === "host" ? "guest" : "host"
    const gameWinner = checkWinnerOnline(newBoard)

    try {
      await set(ref(database, `rooms/${roomId}/gameState`), {
        boardData: serializeBoard(newBoard),
        currentPlayer: nextPlayer,
        lastMoveRow: row,
        lastMoveCol: col,
        moveCount: moveCount + 1,
        winner: gameWinner || "none",
        winReason: gameWinner ? "connect4" : "none",
        lastUpdate: serverTimestamp(),
        turnStartTime: serverTimestamp(),
        rematchRequest: "none",
      })
    } catch (e) { console.error(e) }
  }, [board, winner, isMyTurn, connected, roomId, role, moveCount, validMoves])

  const resetGame = async () => {
    await set(ref(database, `rooms/${roomId}/gameState`), {
      boardData: serializeBoard(createEmptyBoard()),
      currentPlayer: "host",
      lastMoveRow: -1,
      lastMoveCol: -1,
      moveCount: 0,
      winner: "none",
      winReason: "none",
      lastUpdate: serverTimestamp(),
      turnStartTime: serverTimestamp(),
      rematchRequest: "none",
    })
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 p-4 md:flex-row">
      <OnlineGameStatus 
        currentPlayer={currentPlayer} winner={winner} isMyTurn={isMyTurn} 
        role={role} connected={connected} onReset={resetGame} 
        onExit={onExit} moveCount={moveCount} timeLeft={timeLeft}
      />
      <OnlineGameBoard 
        board={board} validMoves={isMyTurn ? validMoves : []} 
        lastMove={lastMove} winningCells={winningCells} 
        onCellClick={handleCellClick} disabled={!isMyTurn || !!winner}
      />
    </div>
  )
}
