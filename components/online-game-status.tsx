"use client"

import { motion, AnimatePresence } from "framer-motion"
import { RotateCcw, Trophy, User, Wifi, WifiOff, LogOut, Eye, Clock, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"

type Role = "host" | "guest" | "spectator"
type WinReason = "connect4" | "timeout" | "disconnect" | "none"

interface OnlineGameStatusProps {
  currentPlayer: "host" | "guest"
  winner: "host" | "guest" | null
  winReason: WinReason
  isMyTurn: boolean
  role: Role
  connected: boolean
  onReset: () => void
  onExit: () => void
  moveCount: number
  timeLeft: number
  opponentDisconnected: boolean
}

export function OnlineGameStatus({
  currentPlayer,
  winner,
  winReason,
  isMyTurn,
  role,
  connected,
  onReset,
  onExit,
  moveCount,
  timeLeft,
  opponentDisconnected,
}: OnlineGameStatusProps) {
  const isSpectator = role === "spectator"
  const isHost = role === "host"

  const timerColor = timeLeft <= 10 ? "text-red-500" : timeLeft <= 20 ? "text-yellow-500" : "text-foreground"

  const getWinnerText = () => {
    if (!winner) return ""

    if (isSpectator) {
      const playerName = winner === "host" ? "플레이어 1" : "플레이어 2"
      switch (winReason) {
        case "timeout":
          return `${playerName} 승리! (상대 시간 초과)`
        case "disconnect":
          return `${playerName} 승리! (상대 연결 끊김)`
        default:
          return `${playerName} 승리!`
      }
    }

    const isMyWin = role === winner
    switch (winReason) {
      case "timeout":
        return isMyWin ? "승리! (상대 시간 초과)" : "패배 (시간 초과)"
      case "disconnect":
        return isMyWin ? "승리! (상대 연결 끊김)" : "패배 (연결 끊김)"
      default:
        return isMyWin ? "축하합니다! 승리!" : "상대방 승리!"
    }
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <motion.h1
        className="text-4xl font-bold tracking-tight sm:text-5xl"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        FORMATION
      </motion.h1>

      {isSpectator && (
        <div className="flex items-center gap-2 rounded-full bg-yellow-500/20 px-4 py-2 text-yellow-500">
          <Eye className="h-4 w-4" />
          <span className="text-sm font-medium">관전 중</span>
        </div>
      )}

      <div className={`flex items-center gap-2 text-sm ${connected ? "text-green-500" : "text-red-500"}`}>
        {connected ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
        <span>{connected ? "연결됨" : "연결 끊김"}</span>
      </div>

      {opponentDisconnected && !winner && (
        <div className="flex items-center gap-2 rounded-lg bg-yellow-500/20 px-4 py-2 text-yellow-500">
          <AlertTriangle className="h-4 w-4" />
          <span className="text-sm">상대방 연결 끊김</span>
        </div>
      )}

      {!winner && connected && (
        <motion.div
          className={`flex items-center gap-2 rounded-lg bg-secondary px-4 py-2 ${timerColor}`}
          animate={{ scale: timeLeft <= 5 ? [1, 1.05, 1] : 1 }}
          transition={{ repeat: timeLeft <= 5 ? Number.POSITIVE_INFINITY : 0, duration: 0.5 }}
        >
          <Clock className="h-5 w-5" />
          <span className="text-2xl font-bold tabular-nums">{timeLeft}초</span>
        </motion.div>
      )}

      <div className="flex items-center gap-4">
        <motion.div
          className={`flex items-center gap-2 rounded-full px-4 py-2 transition-all ${
            currentPlayer === "host" && !winner ? "ring-2 ring-[var(--player-human)]" : ""
          }`}
          style={{ backgroundColor: "var(--secondary)" }}
          animate={{
            scale: currentPlayer === "host" && !winner ? 1.05 : 1,
          }}
        >
          <User className="h-5 w-5" style={{ color: "var(--player-human)" }} />
          <span className="text-sm font-medium">{isSpectator ? "플레이어 1" : isHost ? "나" : "상대"} (파랑)</span>
        </motion.div>

        <span className="text-muted-foreground">vs</span>

        <motion.div
          className={`flex items-center gap-2 rounded-full px-4 py-2 transition-all ${
            currentPlayer === "guest" && !winner ? "ring-2 ring-[var(--player-ai)]" : ""
          }`}
          style={{ backgroundColor: "var(--secondary)" }}
          animate={{
            scale: currentPlayer === "guest" && !winner ? 1.05 : 1,
          }}
        >
          <User className="h-5 w-5" style={{ color: "var(--player-ai)" }} />
          <span className="text-sm font-medium">{isSpectator ? "플레이어 2" : isHost ? "상대" : "나"} (빨강)</span>
        </motion.div>
      </div>

      <AnimatePresence mode="wait">
        {!connected ? (
          <motion.div
            key="disconnected"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex items-center gap-2 rounded-lg bg-red-500/20 px-6 py-3 text-red-500"
          >
            <WifiOff className="h-5 w-5" />
            <span>{isSpectator ? "방송이 종료되었습니다" : "서버와 연결이 끊어졌습니다"}</span>
          </motion.div>
        ) : winner ? (
          <motion.div
            key="winner"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex items-center gap-2 rounded-lg px-6 py-3"
            style={{
              backgroundColor: winner === "host" ? "var(--player-human)" : "var(--player-ai)",
              color: "var(--background)",
            }}
          >
            <Trophy className="h-5 w-5" />
            <span className="text-lg font-bold">{getWinnerText()}</span>
          </motion.div>
        ) : (
          <motion.div
            key="turn"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`rounded-lg px-4 py-2 ${!isSpectator && isMyTurn ? "bg-primary/20 text-primary" : "text-muted-foreground"}`}
          >
            {isSpectator
              ? `${currentPlayer === "host" ? "플레이어 1" : "플레이어 2"}의 차례`
              : isMyTurn
                ? moveCount === 0
                  ? "첫 번째 수를 두세요 (아무 곳이나 가능)"
                  : "내 차례입니다"
                : "상대방 차례입니다..."}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="text-sm text-muted-foreground">진행된 수: {moveCount}</div>

      <div className="flex gap-2">
        {!isSpectator && (
          <Button variant="outline" size="lg" onClick={onReset} className="gap-2 bg-transparent">
            <RotateCcw className="h-4 w-4" />새 게임
          </Button>
        )}
        <Button variant="ghost" size="lg" onClick={onExit} className="gap-2">
          <LogOut className="h-4 w-4" />
          나가기
        </Button>
      </div>

      <div className="mt-4 max-w-sm rounded-lg bg-secondary/50 p-4 text-center text-sm text-muted-foreground">
        <p className="mb-2 font-medium text-foreground">게임 규칙</p>
        <ul className="space-y-1 text-left text-xs">
          <li>• 7x7 보드에서 가로/세로/대각선 4개를 연결하면 승리</li>
          <li>• 첫 수 이후, 상대방의 직전 수 인접 8칸에만 착수 가능</li>
          <li>• 인접 8칸이 모두 차면 상대 돌 인접 칸에 착수 가능</li>
          <li>• 50초 안에 착수하지 않으면 자동 패배!</li>
        </ul>
      </div>
    </div>
  )
}
