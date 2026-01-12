"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { motion } from "framer-motion"
import { OnlineGameBoard } from "./online-game-board"
import { OnlineGameStatus } from "./online-game-status"
import { type OnlineBoard, getValidMovesOnline, checkWinnerOnline, getWinningCellsOnline } from "@/lib/game-ai"
import { database } from "@/lib/firebase"
import { ref, set, onValue, off, serverTimestamp } from "firebase/database" // serverTimestamp 추가

// Next.js 캐싱 방지용 강제 동적 렌더링 설정
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
  lastUpdate: any // Firebase 서버 시간을 담기 위해 수정
  turnStartTime: any // Firebase 서버 시간을 담기 위해 수정
  rematchRequest: RematchRequest
}

// ... (기존 serializeBoard, deserializeBoard, createEmptyBoard 함수는 동일하게 유지)

export function OnlineGame({ roomId, role, onExit }: OnlineGameProps) {
  // ... (기존 State 선언 동일하게 유지)
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

  const logIdRef = useRef(0)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const lastUpdateRef = useRef<number>(0)

  // 핵심 수정: 실시간 리스너 강화
  useEffect(() => {
    const gameStateRef = ref(database, `rooms/${roomId}/gameState`)
    const unsubscribe = onValue(gameStateRef, (snapshot) => {
      const data = snapshot.val() as SerializedGameState | null
      if (!data) return

      // 실시간 동기화를 위해 lastUpdateRef 체크 방식을 느슨하게 변경하거나 제거
      const newBoard = deserializeBoard(data.boardData)
      const newLastMove = data.lastMoveRow >= 0 && data.lastMoveCol >= 0 ? { row: data.lastMoveRow, col: data.lastMoveCol } : null
      
      setBoard(newBoard)
      setCurrentPlayer(data.currentPlayer)
      setLastMove(newLastMove)
      setMoveCount(data.moveCount)
      setWinner(data.winner === "none" ? null : data.winner)
      setWinReason(data.winReason || "none")
      // Firebase 서버에서 받은 턴 시작 시간을 로컬 상태로 반영
      if (data.turnStartTime) setTurnStartTime(data.turnStartTime) 

      if (data.winner !== "none") {
        setWinningCells(getWinningCellsOnline(newBoard))
        setShowRematchModal(true)
      }
    })
    return () => off(gameStateRef)
  }, [roomId])

  // 핵심 수정: 타이머 동기화 로직
  useEffect(() => {
    if (winner || !connected) return
    
    const updateTimer = () => {
      // Date.now()와 서버에서 받아온 turnStartTime의 오차를 계산
      const elapsed = Math.floor((Date.now() - turnStartTime) / 1000)
      const remaining = Math.max(0, TURN_TIME_LIMIT - elapsed)
      setTimeLeft(remaining)
    }

    timerRef.current = setInterval(updateTimer, 500)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [winner, connected, turnStartTime])

  // 핵심 수정: 착수 시 serverTimestamp() 사용
  const handleCellClick = useCallback(async (row: number, col: number) => {
    if (winner || currentPlayer !== role || !connected) return

    const newBoard = board.map((r) => [...r])
    newBoard[row][col] = role as "host" | "guest"
    const nextPlayer = role === "host" ? "guest" : "host"

    const gameWinner = checkWinnerOnline(newBoard)

    try {
      const gameStateRef = ref(database, `rooms/${roomId}/gameState`)
      await set(gameStateRef, {
        boardData: serializeBoard(newBoard),
        currentPlayer: nextPlayer,
        lastMoveRow: row,
        lastMoveCol: col,
        moveCount: moveCount + 1,
        winner: gameWinner || "none",
        winReason: gameWinner ? "connect4" : "none",
        lastUpdate: serverTimestamp(), // 내 컴 시계가 아닌 서버 시계 사용!
        turnStartTime: serverTimestamp(), // 다음 사람 턴도 서버 시계로 시작!
        rematchRequest: "none",
      })
    } catch (error) {
      console.error("Firebase update error:", error)
    }
  }, [board, winner, currentPlayer, role, connected, roomId, moveCount])

  // ... (이하 나머지 렌더링 부분은 기존 코드 유지)
  return (
    // ... (기존 return 코드와 동일)
    <div className="flex min-h-screen ..."> ... </div>
  )
}
