"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { motion } from "framer-motion"
import { OnlineGameBoard } from "./online-game-board"
import { OnlineGameStatus } from "./online-game-status"
import { type OnlineBoard, getValidMovesOnline, checkWinnerOnline, getWinningCellsOnline } from "@/lib/game-ai"
import { database } from "@/lib/firebase"
import { ref, set, onValue, off } from "firebase/database"

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
  lastUpdate: number
  turnStartTime: number
  rematchRequest: RematchRequest
}

interface PlayersState {
  host: "online" | "offline" | "none"
  guest: "online" | "offline" | "none"
}

interface DebugLog {
  id: number
  message: string
  type: "send" | "receive" | "info" | "error"
  timestamp: Date
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
  return Array(BOARD_SIZE)
    .fill(null)
    .map(() => Array(BOARD_SIZE).fill(null))
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
  const [debugLogs, setDebugLogs] = useState<DebugLog[]>([])
  const [opponentDisconnected, setOpponentDisconnected] = useState(false)
  const [rematchRequest, setRematchRequest] = useState<RematchRequest>("none")
  const [showRematchModal, setShowRematchModal] = useState(false)

  const logIdRef = useRef(0)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const lastUpdateRef = useRef<number>(0)
  const pendingMoveRef = useRef<{ row: number; col: number } | null>(null)

  const isSpectator = role === "spectator"
  const isHost = role === "host"
  const isMyTurn = !isSpectator && currentPlayer === role

  const validMoves = winner ? [] : getValidMovesOnline(board, lastMove, currentPlayer)

  const addLog = useCallback((message: string, type: "send" | "receive" | "info" | "error") => {
    setDebugLogs((prev) => {
      const newLog: DebugLog = {
        id: logIdRef.current++,
        message,
        type,
        timestamp: new Date(),
      }
      return [...prev.slice(-9), newLog]
    })
  }, [])

  useEffect(() => {
    const gameStateRef = ref(database, `rooms/${roomId}/gameState`)

    addLog(`방 ${roomId} 구독 시작 (${role})`, "info")

    const unsubscribe = onValue(
      gameStateRef,
      (snapshot) => {
        const data = snapshot.val() as SerializedGameState | null

        if (!data) {
          addLog("게임 데이터 없음", "error")
          return
        }

        if (data.lastUpdate <= lastUpdateRef.current) {
          return
        }

        lastUpdateRef.current = data.lastUpdate

        const newBoard = deserializeBoard(data.boardData)
        const newLastMove =
          data.lastMoveRow >= 0 && data.lastMoveCol >= 0 ? { row: data.lastMoveRow, col: data.lastMoveCol } : null
        const newWinner = data.winner === "none" ? null : data.winner

        pendingMoveRef.current = null

        setBoard(newBoard)
        setCurrentPlayer(data.currentPlayer)
        setLastMove(newLastMove)
        setMoveCount(data.moveCount)
        setWinner(newWinner)
        setWinReason(data.winReason || "none")
        setConnected(true)
        setTurnStartTime(data.turnStartTime || Date.now())
        setRematchRequest(data.rematchRequest || "none")

        if (newWinner) {
          setWinningCells(getWinningCellsOnline(newBoard))
          setShowRematchModal(true)
        } else {
          setWinningCells([])
        }

        addLog(`수신: 수#${data.moveCount}, 턴=${data.currentPlayer}`, "receive")
      },
      (error) => {
        console.error("Firebase error:", error)
        setConnected(false)
        addLog(`오류: ${error.message}`, "error")
      },
    )

    return () => {
      off(gameStateRef)
      addLog("구독 해제", "info")
    }
  }, [roomId, role, addLog])

  useEffect(() => {
    if (isSpectator) return

    const playersRef = ref(database, `rooms/${roomId}/players`)

    const unsubscribe = onValue(playersRef, (snapshot) => {
      const players = snapshot.val() as PlayersState | null
      if (!players) return

      const opponent = isHost ? players.guest : players.host

      if (opponent === "offline" && !winner) {
        setOpponentDisconnected(true)
        addLog("상대방 연결 끊김 감지", "error")
      } else if (opponent === "online") {
        setOpponentDisconnected(false)
      }
    })

    return () => off(playersRef)
  }, [roomId, isHost, isSpectator, winner, addLog])

  useEffect(() => {
    if (winner || !connected) {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      return
    }

    const updateTimer = () => {
      const elapsed = Math.floor((Date.now() - turnStartTime) / 1000)
      const remaining = Math.max(0, TURN_TIME_LIMIT - elapsed)
      setTimeLeft(remaining)

      if (remaining <= 0 && isMyTurn && !winner) {
        addLog("시간 초과! 자동 패배", "error")
        const winnerPlayer = currentPlayer === "host" ? "guest" : "host"

        const gameStateRef = ref(database, `rooms/${roomId}/gameState`)
        const newUpdate = Date.now()
        lastUpdateRef.current = newUpdate

        set(gameStateRef, {
          boardData: serializeBoard(board),
          currentPlayer: currentPlayer,
          lastMoveRow: lastMove?.row ?? -1,
          lastMoveCol: lastMove?.col ?? -1,
          moveCount: moveCount,
          winner: winnerPlayer,
          winReason: "timeout",
          lastUpdate: newUpdate,
          turnStartTime: turnStartTime,
          rematchRequest: "none",
        } as SerializedGameState)
      }
    }

    updateTimer()
    timerRef.current = setInterval(updateTimer, 100)

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [winner, connected, turnStartTime, isMyTurn, currentPlayer, roomId, board, lastMove, moveCount, addLog])

  const handleCellClick = useCallback(
    async (row: number, col: number) => {
      if (winner || !isMyTurn || !connected || isSpectator) {
        return
      }
      if (!validMoves.some((m) => m.row === row && m.col === col)) {
        return
      }

      const newBoard = board.map((r) => [...r])
      newBoard[row][col] = currentPlayer
      const nextPlayer: "host" | "guest" = currentPlayer === "host" ? "guest" : "host"
      const newMoveCount = moveCount + 1

      const gameWinner = checkWinnerOnline(newBoard)
      const winnerValue: "host" | "guest" | "none" = gameWinner || "none"

      pendingMoveRef.current = { row, col }
      setBoard(newBoard)
      setCurrentPlayer(nextPlayer)
      setLastMove({ row, col })
      setMoveCount(newMoveCount)
      if (gameWinner) {
        setWinner(gameWinner)
        setWinReason("connect4")
        setWinningCells(getWinningCellsOnline(newBoard))
        setShowRematchModal(true)
      }

      addLog(`착수: (${row},${col}) - 화면 즉시 반영`, "info")

      try {
        const gameStateRef = ref(database, `rooms/${roomId}/gameState`)
        const newUpdate = Date.now()
        lastUpdateRef.current = newUpdate

        await set(gameStateRef, {
          boardData: serializeBoard(newBoard),
          currentPlayer: nextPlayer,
          lastMoveRow: row,
          lastMoveCol: col,
          moveCount: newMoveCount,
          winner: winnerValue,
          winReason: gameWinner ? "connect4" : "none",
          lastUpdate: newUpdate,
          turnStartTime: newUpdate,
          rematchRequest: "none",
        } as SerializedGameState)

        addLog(`전송 완료: 수#${newMoveCount}`, "send")
      } catch (error) {
        console.error("Firebase update error:", error)
        addLog("착수 저장 실패! 롤백 중...", "error")

        pendingMoveRef.current = null
        setBoard(board)
        setCurrentPlayer(currentPlayer)
        setLastMove(lastMove)
        setMoveCount(moveCount)
        setWinner(null)
        setWinReason("none")
        setWinningCells([])
      }
    },
    [winner, isMyTurn, connected, isSpectator, validMoves, board, currentPlayer, moveCount, roomId, lastMove, addLog],
  )

  const requestRematch = useCallback(async () => {
    if (isSpectator) return

    try {
      const gameStateRef = ref(database, `rooms/${roomId}/gameState`)

      let newRematchRequest: RematchRequest
      if (rematchRequest === "none") {
        newRematchRequest = role as "host" | "guest"
      } else if ((rematchRequest === "host" && role === "guest") || (rematchRequest === "guest" && role === "host")) {
        newRematchRequest = "both"
      } else {
        newRematchRequest = rematchRequest
      }

      if (newRematchRequest === "both") {
        const newUpdate = Date.now()
        lastUpdateRef.current = newUpdate

        await set(gameStateRef, {
          boardData: serializeBoard(createEmptyBoard()),
          currentPlayer: "host",
          lastMoveRow: -1,
          lastMoveCol: -1,
          moveCount: 0,
          winner: "none",
          winReason: "none",
          lastUpdate: newUpdate,
          turnStartTime: newUpdate,
          rematchRequest: "none",
        } as SerializedGameState)

        setShowRematchModal(false)
        addLog("재대결 시작!", "info")
      } else {
        await set(ref(database, `rooms/${roomId}/gameState/rematchRequest`), newRematchRequest)
        addLog("재대결 요청 전송", "send")
      }
    } catch (error) {
      console.error("Rematch request error:", error)
      addLog("재대결 요청 실패", "error")
    }
  }, [roomId, role, rematchRequest, isSpectator, addLog])

  const resetGame = useCallback(async () => {
    const newUpdate = Date.now()
    lastUpdateRef.current = newUpdate

    setBoard(createEmptyBoard())
    setCurrentPlayer("host")
    setLastMove(null)
    setMoveCount(0)
    setWinner(null)
    setWinReason("none")
    setWinningCells([])
    setShowRematchModal(false)

    try {
      const gameStateRef = ref(database, `rooms/${roomId}/gameState`)
      await set(gameStateRef, {
        boardData: serializeBoard(createEmptyBoard()),
        currentPlayer: "host",
        lastMoveRow: -1,
        lastMoveCol: -1,
        moveCount: 0,
        winner: "none",
        winReason: "none",
        lastUpdate: newUpdate,
        turnStartTime: newUpdate,
        rematchRequest: "none",
      } as SerializedGameState)
      addLog("게임 리셋 완료", "send")
    } catch (error) {
      console.error("Reset error:", error)
      addLog("리셋 실패", "error")
    }
  }, [roomId, addLog])

  const handleExit = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    onExit()
  }, [onExit])

  const getWinReasonText = () => {
    if (!winner) return ""
    const isMyWin = role === winner
    switch (winReason) {
      case "timeout":
        return isMyWin ? "상대방 시간 초과로 승리!" : "시간 초과로 패배!"
      case "disconnect":
        return isMyWin ? "상대방 연결 끊김으로 승리!" : "연결 끊김으로 패배!"
      case "connect4":
      default:
        return isMyWin ? "축하합니다! 4목 완성 승리!" : "상대방 4목 완성!"
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 p-4 md:flex-row md:gap-16">
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
        <OnlineGameStatus
          currentPlayer={currentPlayer}
          winner={winner}
          winReason={winReason}
          isMyTurn={isMyTurn}
          role={role}
          connected={connected}
          onReset={resetGame}
          onExit={handleExit}
          moveCount={moveCount}
          timeLeft={timeLeft}
          opponentDisconnected={opponentDisconnected}
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2 }}
        className="relative pl-6 pb-6"
      >
        <OnlineGameBoard
          board={board}
          validMoves={isMyTurn && !isSpectator ? validMoves : []}
          lastMove={lastMove}
          winningCells={winningCells}
          onCellClick={handleCellClick}
          disabled={!isMyTurn || !!winner || !connected || isSpectator}
        />
      </motion.div>

      {opponentDisconnected && !winner && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 rounded-lg bg-yellow-500/90 px-6 py-3 text-black font-medium">
          상대방 연결이 끊겼습니다. 잠시 기다려주세요...
        </div>
      )}

      {!connected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="rounded-xl bg-card p-6 text-center">
            <h3 className="mb-4 text-xl font-bold text-destructive">연결 끊김</h3>
            <p className="mb-4 text-muted-foreground">서버와 연결이 끊겼습니다.</p>
            <button
              onClick={handleExit}
              className="rounded-lg bg-primary px-6 py-2 font-medium text-primary-foreground hover:bg-primary/90"
            >
              로비로 돌아가기
            </button>
          </div>
        </div>
      )}

      {showRematchModal && winner && !isSpectator && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-xl bg-card p-8 text-center max-w-sm mx-4"
          >
            <div
              className="mx-auto mb-4 h-16 w-16 rounded-full flex items-center justify-center"
              style={{
                backgroundColor: role === winner ? "var(--player-human)" : "var(--player-ai)",
              }}
            >
              {role === winner ? "🏆" : "😢"}
            </div>
            <h3 className="mb-2 text-2xl font-bold">{role === winner ? "승리!" : "패배"}</h3>
            <p className="mb-6 text-muted-foreground">{getWinReasonText()}</p>

            <div className="mb-4">
              {rematchRequest === "none" ? (
                <p className="text-sm text-muted-foreground">다시 게임하시겠습니까?</p>
              ) : rematchRequest === role ? (
                <p className="text-sm text-yellow-500">상대방의 응답을 기다리는 중...</p>
              ) : (
                <p className="text-sm text-green-500">상대방이 재대결을 요청했습니다!</p>
              )}
            </div>

            <div className="flex gap-3 justify-center">
              <button
                onClick={requestRematch}
                disabled={rematchRequest === role}
                className={`rounded-lg px-6 py-3 font-medium transition-all ${
                  rematchRequest === role
                    ? "bg-muted text-muted-foreground cursor-not-allowed"
                    : "bg-primary text-primary-foreground hover:bg-primary/90"
                }`}
              >
                {rematchRequest === role ? "요청됨" : "다시하기"}
              </button>
              <button
                onClick={handleExit}
                className="rounded-lg bg-secondary px-6 py-3 font-medium text-secondary-foreground hover:bg-secondary/80"
              >
                나가기
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {showRematchModal && winner && isSpectator && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-xl bg-card p-8 text-center max-w-sm mx-4"
          >
            <h3 className="mb-4 text-2xl font-bold">{winner === "host" ? "플레이어 1" : "플레이어 2"} 승리!</h3>
            <p className="mb-6 text-muted-foreground">
              {winReason === "timeout"
                ? "상대방 시간 초과"
                : winReason === "disconnect"
                  ? "상대방 연결 끊김"
                  : "4목 완성"}
            </p>
            <p className="mb-4 text-sm text-muted-foreground">플레이어들이 재대결을 준비 중입니다...</p>
            <button
              onClick={handleExit}
              className="rounded-lg bg-secondary px-6 py-3 font-medium text-secondary-foreground hover:bg-secondary/80"
            >
              나가기
            </button>
          </motion.div>
        </div>
      )}

      <div className="fixed bottom-4 right-4 w-72 max-h-48 overflow-y-auto rounded-lg bg-black/80 p-3 text-xs font-mono">
        <div className="mb-2 text-muted-foreground border-b border-muted pb-1 flex justify-between">
          <span>네트워크 로그 ({role})</span>
          <span className={connected ? "text-green-400" : "text-red-400"}>{connected ? "● 연결됨" : "● 끊김"}</span>
        </div>
        <div className="text-muted-foreground mb-1">방 코드: {roomId}</div>
        {debugLogs.length === 0 ? (
          <div className="text-muted-foreground">대기 중...</div>
        ) : (
          debugLogs.map((log) => (
            <div
              key={log.id}
              className={`py-0.5 ${
                log.type === "send"
                  ? "text-green-400"
                  : log.type === "receive"
                    ? "text-blue-400"
                    : log.type === "error"
                      ? "text-red-400"
                      : "text-yellow-400"
              }`}
            >
              [{log.timestamp.toLocaleTimeString()}] {log.message}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
