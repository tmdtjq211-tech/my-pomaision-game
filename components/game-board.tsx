"use client"

import { motion, AnimatePresence } from "framer-motion"
import type { Player } from "@/lib/game-ai"

interface GameBoardProps {
  board: Player[][]
  validMoves: { row: number; col: number }[]
  lastMove: { row: number; col: number } | null
  winningCells: { row: number; col: number }[]
  onCellClick: (row: number, col: number) => void
  disabled: boolean
}

export function GameBoard({ board, validMoves, lastMove, winningCells, onCellClick, disabled }: GameBoardProps) {
  const isValidMove = (row: number, col: number) => validMoves.some((m) => m.row === row && m.col === col)

  const isWinningCell = (row: number, col: number) => winningCells.some((c) => c.row === row && c.col === col)

  const isLastMove = (row: number, col: number) => lastMove?.row === row && lastMove?.col === col

  return (
    <div className="relative">
      {/* Board container */}
      <div className="grid grid-cols-7 gap-1 rounded-xl bg-secondary/50 p-2 backdrop-blur-sm">
        {board.map((row, rowIndex) =>
          row.map((cell, colIndex) => (
            <motion.button
              key={`${rowIndex}-${colIndex}`}
              className={`
                relative aspect-square w-10 sm:w-12 md:w-14 rounded-lg
                transition-all duration-200
                ${
                  cell === null && isValidMove(rowIndex, colIndex) && !disabled
                    ? "cursor-pointer hover:scale-105"
                    : "cursor-default"
                }
                ${
                  isWinningCell(rowIndex, colIndex)
                    ? "ring-2 ring-[var(--last-move)] ring-offset-2 ring-offset-background"
                    : ""
                }
              `}
              style={{
                backgroundColor:
                  isValidMove(rowIndex, colIndex) && cell === null ? "var(--valid-move)" : "var(--muted)",
              }}
              onClick={() => {
                if (!disabled && cell === null && isValidMove(rowIndex, colIndex)) {
                  onCellClick(rowIndex, colIndex)
                }
              }}
              whileHover={!disabled && cell === null && isValidMove(rowIndex, colIndex) ? { scale: 1.05 } : {}}
              whileTap={!disabled && cell === null && isValidMove(rowIndex, colIndex) ? { scale: 0.95 } : {}}
            >
              {/* Last move indicator */}
              {isLastMove(rowIndex, colIndex) && (
                <motion.div
                  className="absolute inset-0 rounded-lg"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  style={{
                    boxShadow: "0 0 0 3px var(--last-move)",
                  }}
                />
              )}

              {/* Stone */}
              <AnimatePresence>
                {cell && (
                  <motion.div
                    className="absolute inset-1.5 sm:inset-2 rounded-full shadow-lg"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{
                      type: "spring",
                      stiffness: 500,
                      damping: 25,
                    }}
                    style={{
                      backgroundColor: cell === "human" ? "var(--player-human)" : "var(--player-ai)",
                      boxShadow:
                        cell === "human"
                          ? "0 4px 12px oklch(0.7 0.15 180 / 0.4)"
                          : "0 4px 12px oklch(0.65 0.18 30 / 0.4)",
                    }}
                  >
                    {/* Inner highlight */}
                    <div
                      className="absolute inset-1 rounded-full opacity-30"
                      style={{
                        background: "radial-gradient(circle at 30% 30%, white, transparent)",
                      }}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Valid move dot indicator */}
              {cell === null && isValidMove(rowIndex, colIndex) && !disabled && (
                <motion.div
                  className="absolute inset-0 flex items-center justify-center"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: "var(--primary)" }} />
                </motion.div>
              )}
            </motion.button>
          )),
        )}
      </div>

      {/* Board coordinates */}
      <div className="absolute -left-5 top-2 flex h-full flex-col justify-around text-xs text-muted-foreground">
        {[1, 2, 3, 4, 5, 6, 7].map((n) => (
          <span key={n}>{n}</span>
        ))}
      </div>
      <div className="absolute -bottom-5 left-2 flex w-full justify-around text-xs text-muted-foreground">
        {["A", "B", "C", "D", "E", "F", "G"].map((l) => (
          <span key={l}>{l}</span>
        ))}
      </div>
    </div>
  )
}
