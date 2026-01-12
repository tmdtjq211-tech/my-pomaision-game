"use client"

import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Wifi, Copy, Check, ArrowLeft, Loader2, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { database } from "@/lib/firebase"
import { ref, set, onValue, get, off, onDisconnect } from "firebase/database"

type Role = "host" | "guest" | "spectator"

interface OnlineLobbyProps {
  onGameStart: (roomId: string, role: Role) => void
  onBack: () => void
}

type LobbyState = "menu" | "creating" | "waiting" | "joining" | "connecting"

const BOARD_SIZE = 7

function createSerializedEmptyBoard(): string {
  const board = Array(BOARD_SIZE)
    .fill(null)
    .map(() => Array(BOARD_SIZE).fill("E"))
  return JSON.stringify(board)
}

export function OnlineLobby({ onGameStart, onBack }: OnlineLobbyProps) {
  const [lobbyState, setLobbyState] = useState<LobbyState>("menu")
  const [roomCode, setRoomCode] = useState("")
  const [inputCode, setInputCode] = useState("")
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [joinMode, setJoinMode] = useState<"player" | "spectator">("player")

  const unsubscribeRef = useRef<(() => void) | null>(null)

  const generateRoomCode = () => {
    return Math.floor(1000 + Math.random() * 9000).toString()
  }

  const cleanup = () => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current()
      unsubscribeRef.current = null
    }
  }

  const createRoom = async () => {
    cleanup()
    setLobbyState("creating")
    setError(null)
    const code = generateRoomCode()
    setRoomCode(code)

    try {
      const roomRef = ref(database, `rooms/${code}`)

      await set(roomRef, {
        createdAt: Date.now(),
        players: {
          host: "online",
          guest: "none",
        },
        spectatorCount: 0,
        gameState: {
          boardData: createSerializedEmptyBoard(),
          currentPlayer: "host",
          lastMoveRow: -1,
          lastMoveCol: -1,
          moveCount: 0,
          winner: "none",
          winReason: "none", // "connect4" | "timeout" | "disconnect" | "none"
          lastUpdate: Date.now(),
          turnStartTime: Date.now(),
          rematchRequest: "none", // "none" | "host" | "guest" | "both"
        },
      })

      const hostStatusRef = ref(database, `rooms/${code}/players/host`)
      onDisconnect(hostStatusRef).set("offline")

      setLobbyState("waiting")

      // 게스트 참가 대기
      const playersRef = ref(database, `rooms/${code}/players`)
      const unsubscribe = onValue(playersRef, (snapshot) => {
        const players = snapshot.val()
        if (players && players.guest === "online") {
          cleanup()
          onGameStart(code, "host")
        }
      })

      unsubscribeRef.current = () => off(playersRef)
    } catch (err) {
      console.error("Room creation error:", err)
      setError("방 생성에 실패했습니다. 다시 시도해주세요.")
      setLobbyState("menu")
    }
  }

  const joinRoom = async (asSpectator = false) => {
    if (inputCode.length !== 4) {
      setError("4자리 방 코드를 입력해주세요.")
      return
    }

    cleanup()
    setLobbyState("connecting")
    setError(null)

    try {
      const roomRef = ref(database, `rooms/${inputCode}`)
      const snapshot = await get(roomRef)

      if (!snapshot.exists()) {
        setError("방을 찾을 수 없습니다. 코드를 확인해주세요.")
        setLobbyState("joining")
        return
      }

      const roomData = snapshot.val()

      if (asSpectator) {
        const currentCount = roomData.spectatorCount || 0
        await set(ref(database, `rooms/${inputCode}/spectatorCount`), currentCount + 1)
        onGameStart(inputCode, "spectator")
      } else {
        if (roomData.players?.guest === "online") {
          const currentCount = roomData.spectatorCount || 0
          await set(ref(database, `rooms/${inputCode}/spectatorCount`), currentCount + 1)
          onGameStart(inputCode, "spectator")
          return
        }

        // 게스트로 참가
        const guestStatusRef = ref(database, `rooms/${inputCode}/players/guest`)
        await set(guestStatusRef, "online")

        onDisconnect(guestStatusRef).set("offline")

        await set(ref(database, `rooms/${inputCode}/gameState/turnStartTime`), Date.now())

        onGameStart(inputCode, "guest")
      }
    } catch (err) {
      console.error("Join error:", err)
      setError("연결에 실패했습니다. 다시 시도해주세요.")
      setLobbyState("joining")
    }
  }

  const copyRoomCode = async () => {
    await navigator.clipboard.writeText(roomCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleBack = () => {
    cleanup()
    setLobbyState("menu")
    setRoomCode("")
    setInputCode("")
    setError(null)
    setJoinMode("player")
  }

  useEffect(() => {
    return () => cleanup()
  }, [])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 p-4">
      <motion.h1
        className="text-4xl font-bold tracking-tight sm:text-5xl"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        FORMATION
      </motion.h1>

      <motion.div
        className="flex items-center gap-2 text-muted-foreground"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <Wifi className="h-5 w-5" />
        <span>온라인 대전</span>
      </motion.div>

      <AnimatePresence mode="wait">
        {lobbyState === "menu" && (
          <motion.div
            key="menu"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex flex-col gap-4"
          >
            <Button size="lg" className="w-64 gap-2" onClick={createRoom}>
              방 만들기
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="w-64 gap-2 bg-transparent"
              onClick={() => {
                setJoinMode("player")
                setLobbyState("joining")
              }}
            >
              방 참가
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="w-64 gap-2 bg-transparent"
              onClick={() => {
                setJoinMode("spectator")
                setLobbyState("joining")
              }}
            >
              <Eye className="h-4 w-4" />
              관전하기
            </Button>
            <Button size="lg" variant="ghost" className="w-64 gap-2" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
              뒤로
            </Button>
          </motion.div>
        )}

        {(lobbyState === "creating" || lobbyState === "waiting") && (
          <motion.div
            key="waiting"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex flex-col items-center gap-6"
          >
            {lobbyState === "creating" ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>방 생성 중...</span>
              </div>
            ) : (
              <>
                <div className="text-center">
                  <p className="mb-2 text-sm text-muted-foreground">방 코드</p>
                  <div className="flex items-center gap-2">
                    <div className="rounded-xl bg-secondary px-8 py-4 text-4xl font-bold tracking-widest">
                      {roomCode}
                    </div>
                    <Button size="icon" variant="outline" className="bg-transparent" onClick={copyRoomCode}>
                      {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>상대방 대기 중...</span>
                </div>

                <p className="max-w-xs text-center text-sm text-muted-foreground">
                  이 코드를 상대방에게 알려주세요. 상대방이 참가하면 게임이 시작됩니다.
                </p>
              </>
            )}

            <Button variant="ghost" className="gap-2" onClick={handleBack}>
              <ArrowLeft className="h-4 w-4" />
              취소
            </Button>
          </motion.div>
        )}

        {(lobbyState === "joining" || lobbyState === "connecting") && (
          <motion.div
            key="joining"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex flex-col items-center gap-6"
          >
            <div className="text-center">
              <p className="mb-4 text-sm text-muted-foreground">
                {joinMode === "spectator" ? "관전할 방 코드 입력" : "방 코드 입력"}
              </p>
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                placeholder="0000"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value.replace(/\D/g, ""))}
                className="w-48 bg-secondary text-center text-2xl tracking-widest"
                disabled={lobbyState === "connecting"}
              />
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            {lobbyState === "connecting" ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>{joinMode === "spectator" ? "관전 연결 중..." : "연결 중..."}</span>
              </div>
            ) : (
              <Button
                size="lg"
                className="w-48 gap-2"
                onClick={() => joinRoom(joinMode === "spectator")}
                disabled={inputCode.length !== 4}
              >
                {joinMode === "spectator" && <Eye className="h-4 w-4" />}
                {joinMode === "spectator" ? "관전" : "참가"}
              </Button>
            )}

            <Button variant="ghost" className="gap-2" onClick={handleBack} disabled={lobbyState === "connecting"}>
              <ArrowLeft className="h-4 w-4" />
              뒤로
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
