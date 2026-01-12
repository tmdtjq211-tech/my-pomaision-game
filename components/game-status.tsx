"use client"

import { motion, AnimatePresence } from "framer-motion"
import type { Player, Difficulty } from "@/lib/game-ai"
import { RotateCcw, Trophy, Cpu, User, Users, Wifi } from "lucide-react"
import { Button } from "@/components/ui/button"

interface GameStatusProps {
  currentPlayer: "human" | "ai" | "player2"
  winner: Player
  isThinking: boolean
  onReset: () => void
  moveCount: number
  difficulty: Difficulty
  onDifficultyChange: (difficulty: Difficulty) => void
  gameMode: "pvp" | "ai" | "online"
  onGameModeChange: (mode: "pvp" | "ai" | "online") => void
}

function DifficultyButton({
  difficulty,
  currentDifficulty,
  onClick,
  label,
}: {
  difficulty: Difficulty
  currentDifficulty: Difficulty
  onClick: () => void
  label: string
}) {
  const isActive = difficulty === currentDifficulty
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
        isActive ? "bg-foreground text-background" : "bg-secondary text-muted-foreground hover:bg-secondary/80"
      }`}
    >
      {label}
    </button>
  )
}

export function GameStatus({
  currentPlayer,
  winner,
  isThinking,
  onReset,
  moveCount,
  difficulty,
  onDifficultyChange,
  gameMode,
  onGameModeChange,
}: GameStatusProps) {
  return (
    <div className="flex flex-col items-center gap-6">
      <motion.h1
        className="text-4xl font-bold tracking-tight sm:text-5xl"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        FORMATION
      </motion.h1>

      <div className="flex flex-col items-center gap-2">
        <span className="text-xs text-muted-foreground">게임 모드</span>
        <div className="flex flex-wrap justify-center gap-2">
          <button
            onClick={() => onGameModeChange("ai")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              gameMode === "ai"
                ? "bg-foreground text-background"
                : "bg-secondary text-muted-foreground hover:bg-secondary/80"
            }`}
          >
            <Cpu className="h-4 w-4" />
            vs AI
          </button>
          <button
            onClick={() => onGameModeChange("pvp")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              gameMode === "pvp"
                ? "bg-foreground text-background"
                : "bg-secondary text-muted-foreground hover:bg-secondary/80"
            }`}
          >
            <Users className="h-4 w-4" />
            2인 대전
          </button>
          <button
            onClick={() => onGameModeChange("online")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              gameMode === "online"
                ? "bg-foreground text-background"
                : "bg-secondary text-muted-foreground hover:bg-secondary/80"
            }`}
          >
            <Wifi className="h-4 w-4" />
            온라인
          </button>
        </div>
      </div>

      {gameMode === "ai" && (
        <div className="flex flex-col items-center gap-2">
          <span className="text-xs text-muted-foreground">AI 난이도</span>
          <div className="flex gap-2">
            <DifficultyButton
              difficulty="beginner"
              currentDifficulty={difficulty}
              onClick={() => onDifficultyChange("beginner")}
              label="초보"
            />
            <DifficultyButton
              difficulty="intermediate"
              currentDifficulty={difficulty}
              onClick={() => onDifficultyChange("intermediate")}
              label="중급"
            />
            <DifficultyButton
              difficulty="advanced"
              currentDifficulty={difficulty}
              onClick={() => onDifficultyChange("advanced")}
              label="고급"
            />
          </div>
        </div>
      )}

      {/* Turn indicator */}
      <div className="flex items-center gap-4">
        <motion.div
          className={`flex items-center gap-2 rounded-full px-4 py-2 transition-all ${
            currentPlayer === "human" && !winner ? "ring-2 ring-[var(--player-human)]" : ""
          }`}
          style={{ backgroundColor: "var(--secondary)" }}
          animate={{
            scale: currentPlayer === "human" && !winner ? 1.05 : 1,
          }}
        >
          <User className="h-5 w-5" style={{ color: "var(--player-human)" }} />
          <span className="text-sm font-medium">{gameMode === "pvp" ? "플레이어 1" : "Player"}</span>
        </motion.div>

        <span className="text-muted-foreground">vs</span>

        <motion.div
          className={`flex items-center gap-2 rounded-full px-4 py-2 transition-all ${
            (currentPlayer === "ai" || currentPlayer === "player2") && !winner ? "ring-2 ring-[var(--player-ai)]" : ""
          }`}
          style={{ backgroundColor: "var(--secondary)" }}
          animate={{
            scale: (currentPlayer === "ai" || currentPlayer === "player2") && !winner ? 1.05 : 1,
          }}
        >
          {gameMode === "pvp" ? (
            <User className="h-5 w-5" style={{ color: "var(--player-ai)" }} />
          ) : (
            <Cpu className="h-5 w-5" style={{ color: "var(--player-ai)" }} />
          )}
          <span className="text-sm font-medium">{gameMode === "pvp" ? "플레이어 2" : "AI"}</span>
        </motion.div>
      </div>

      {/* Status message */}
      <AnimatePresence mode="wait">
        {winner ? (
          <motion.div
            key="winner"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex items-center gap-2 rounded-lg px-6 py-3"
            style={{
              backgroundColor: winner === "human" ? "var(--player-human)" : "var(--player-ai)",
              color: "var(--background)",
            }}
          >
            <Trophy className="h-5 w-5" />
            <span className="text-lg font-bold">
              {gameMode === "pvp"
                ? winner === "human"
                  ? "플레이어 1 승리!"
                  : "플레이어 2 승리!"
                : winner === "human"
                  ? "축하합니다! 승리!"
                  : "AI 승리!"}
            </span>
          </motion.div>
        ) : isThinking ? (
          <motion.div
            key="thinking"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2 text-muted-foreground"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
            >
              <Cpu className="h-5 w-5" />
            </motion.div>
            <span>AI가 생각 중...</span>
          </motion.div>
        ) : (
          <motion.div
            key="turn"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-muted-foreground"
          >
            {moveCount === 0 ? "첫 번째 수를 두세요 (아무 곳이나 가능)" : "하이라이트된 칸에 돌을 놓으세요"}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Move count */}
      <div className="text-sm text-muted-foreground">진행된 수: {moveCount}</div>

      {/* Reset button */}
      <Button variant="outline" size="lg" onClick={onReset} className="gap-2 bg-transparent">
        <RotateCcw className="h-4 w-4" />새 게임
      </Button>

      {/* Rules */}
      <div className="mt-4 max-w-sm rounded-lg bg-secondary/50 p-4 text-center text-sm text-muted-foreground">
        <p className="mb-2 font-medium text-foreground">게임 규칙</p>
        <ul className="space-y-1 text-left text-xs">
          <li>• 7×7 보드에서 가로/세로/대각선 4개를 연결하면 승리</li>
          <li>• 첫 수 이후, 상대방의 직전 수 인접 8칸에만 착수 가능</li>
          <li>• 인접 8칸이 모두 차면 상대 돌 인접 칸에 착수 가능</li>
        </ul>
      </div>
    </div>
  )
}
