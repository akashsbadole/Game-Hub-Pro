"use client"

import type React from "react"
import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

// Game constants
const BOARD_WIDTH = 12
const BOARD_HEIGHT = 16
const BUBBLE_RADIUS = 20
const BUBBLE_DIAMETER = BUBBLE_RADIUS * 2
const COLORS = ["#FF6B9D", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7", "#DDA0DD"]
const SHOOTER_Y = 520
const GAME_WIDTH = BOARD_WIDTH * (BUBBLE_DIAMETER + 2)
const GAME_HEIGHT = 580
const BUBBLE_VELOCITY = 12

interface Bubble {
  color: string
  row: number
  col: number
  id: string
}

interface Position {
  x: number
  y: number
}

interface BubbleShooterProps {
  onBack: () => void
}

export default function BubbleShooter({ onBack }: BubbleShooterProps) {
  const [gameBoard, setGameBoard] = useState<(Bubble | null)[][]>([])
  const [currentBubble, setCurrentBubble] = useState<string>("")
  const [nextBubble, setNextBubble] = useState<string>("")
  const [shooterAngle, setShooterAngle] = useState<number>(0)
  const [launchedBubble, setLaunchedBubble] = useState<{
    x: number
    y: number
    vx: number
    vy: number
    color: string
  } | null>(null)
  const [score, setScore] = useState<number>(0)
  const [level, setLevel] = useState<number>(1)
  const [gameOver, setGameOver] = useState<boolean>(false)
  const [gameWon, setGameWon] = useState<boolean>(false)
  const [combo, setCombo] = useState<number>(0)
  const [bubblesShot, setBubblesShot] = useState<number>(0)

  const animationRef = useRef<number>()

  // Initialize game
  const initializeGame = useCallback(() => {
    const board: (Bubble | null)[][] = Array(BOARD_HEIGHT)
      .fill(null)
      .map(() => Array(BOARD_WIDTH).fill(null))

    // Create initial bubble pattern
    const initialRows = 8
    for (let row = 0; row < initialRows; row++) {
      for (let col = 0; col < BOARD_WIDTH; col++) {
        if (Math.random() < 0.7) {
          board[row][col] = {
            color: COLORS[Math.floor(Math.random() * COLORS.length)],
            row,
            col,
            id: `${row}-${col}-${Date.now()}-${Math.random()}`,
          }
        }
      }
    }

    setGameBoard(board)
    setCurrentBubble(COLORS[Math.floor(Math.random() * COLORS.length)])
    setNextBubble(COLORS[Math.floor(Math.random() * COLORS.length)])
    setLaunchedBubble(null)
    setGameOver(false)
    setGameWon(false)
    setCombo(0)
    setBubblesShot(0)
  }, [])

  // Get bubble position on screen
  const getBubblePosition = (row: number, col: number): Position => {
    const offsetX = row % 2 === 0 ? 0 : BUBBLE_RADIUS + 1
    return {
      x: col * (BUBBLE_DIAMETER + 2) + BUBBLE_RADIUS + 10 + offsetX,
      y: row * (BUBBLE_DIAMETER - 2) + BUBBLE_RADIUS + 10,
    }
  }

  // Check collision between two bubbles
  const checkCollision = (pos1: Position, pos2: Position): boolean => {
    const dx = pos1.x - pos2.x
    const dy = pos1.y - pos2.y
    const distance = Math.sqrt(dx * dx + dy * dy)
    return distance < BUBBLE_DIAMETER - 5
  }

  // Find cluster of same color bubbles
  const findCluster = (board: (Bubble | null)[][], startRow: number, startCol: number, color: string): Position[] => {
    const visited = new Set<string>()
    const cluster: Position[] = []
    const stack: Position[] = [{ x: startCol, y: startRow }]

    while (stack.length > 0) {
      const { x: col, y: row } = stack.pop()!
      const key = `${row}-${col}`

      if (visited.has(key) || row < 0 || row >= BOARD_HEIGHT || col < 0 || col >= BOARD_WIDTH) {
        continue
      }

      const bubble = board[row][col]
      if (!bubble || bubble.color !== color) {
        continue
      }

      visited.add(key)
      cluster.push({ x: col, y: row })

      // Get neighbors based on row parity
      const neighbors =
        row % 2 === 0
          ? [
              [-1, -1],
              [-1, 0],
              [0, -1],
              [0, 1],
              [1, -1],
              [1, 0],
            ]
          : [
              [-1, 0],
              [-1, 1],
              [0, -1],
              [0, 1],
              [1, 0],
              [1, 1],
            ]

      neighbors.forEach(([dr, dc]) => {
        stack.push({ x: col + dc, y: row + dr })
      })
    }

    return cluster
  }

  // Find connected bubbles to top
  const findConnectedToTop = (board: (Bubble | null)[][]): Set<string> => {
    const connected = new Set<string>()
    const stack: Position[] = []

    // Start from top row
    for (let col = 0; col < BOARD_WIDTH; col++) {
      if (board[0][col]) {
        stack.push({ x: col, y: 0 })
      }
    }

    while (stack.length > 0) {
      const { x: col, y: row } = stack.pop()!
      const key = `${row}-${col}`

      if (connected.has(key) || row < 0 || row >= BOARD_HEIGHT || col < 0 || col >= BOARD_WIDTH || !board[row][col]) {
        continue
      }

      connected.add(key)

      const neighbors =
        row % 2 === 0
          ? [
              [-1, -1],
              [-1, 0],
              [0, -1],
              [0, 1],
              [1, -1],
              [1, 0],
            ]
          : [
              [-1, 0],
              [-1, 1],
              [0, -1],
              [0, 1],
              [1, 0],
              [1, 1],
            ]

      neighbors.forEach(([dr, dc]) => {
        stack.push({ x: col + dc, y: row + dr })
      })
    }

    return connected
  }

  // Remove floating bubbles
  const removeFloatingBubbles = (board: (Bubble | null)[][]): { board: (Bubble | null)[][]; removed: number } => {
    const connected = findConnectedToTop(board)
    const newBoard = board.map((row) => [...row])
    let removed = 0

    for (let row = 0; row < BOARD_HEIGHT; row++) {
      for (let col = 0; col < BOARD_WIDTH; col++) {
        if (newBoard[row][col] && !connected.has(`${row}-${col}`)) {
          newBoard[row][col] = null
          removed++
        }
      }
    }

    return { board: newBoard, removed }
  }

  // Launch bubble
  const launchBubble = useCallback(
    (angle: number) => {
      if (launchedBubble || gameOver || gameWon) return

      const vx = Math.sin(angle) * BUBBLE_VELOCITY
      const vy = -Math.cos(angle) * BUBBLE_VELOCITY

      setLaunchedBubble({
        x: GAME_WIDTH / 2,
        y: SHOOTER_Y,
        vx,
        vy,
        color: currentBubble,
      })

      setBubblesShot((prev) => prev + 1)
    },
    [launchedBubble, gameOver, gameWon, currentBubble],
  )

  // Update launched bubble position
  const updateLaunchedBubble = useCallback(() => {
    if (!launchedBubble) return

    const newBubble = { ...launchedBubble }
    newBubble.x += newBubble.vx
    newBubble.y += newBubble.vy

    // Wall collision
    if (newBubble.x <= BUBBLE_RADIUS + 10 || newBubble.x >= GAME_WIDTH - BUBBLE_RADIUS - 10) {
      newBubble.vx = -newBubble.vx
      newBubble.x = Math.max(BUBBLE_RADIUS + 10, Math.min(GAME_WIDTH - BUBBLE_RADIUS - 10, newBubble.x))
    }

    // Check collision with existing bubbles
    let collided = false
    let targetRow = -1,
      targetCol = -1

    for (let row = 0; row < BOARD_HEIGHT && !collided; row++) {
      for (let col = 0; col < BOARD_WIDTH && !collided; col++) {
        if (gameBoard[row][col]) {
          const bubblePos = getBubblePosition(row, col)
          if (checkCollision({ x: newBubble.x, y: newBubble.y }, bubblePos)) {
            collided = true

            // Find empty adjacent position
            const neighbors =
              row % 2 === 0
                ? [
                    [-1, -1],
                    [-1, 0],
                    [0, -1],
                    [0, 1],
                    [1, -1],
                    [1, 0],
                  ]
                : [
                    [-1, 0],
                    [-1, 1],
                    [0, -1],
                    [0, 1],
                    [1, 0],
                    [1, 1],
                  ]

            for (const [dr, dc] of neighbors) {
              const newRow = row + dr
              const newCol = col + dc
              if (
                newRow >= 0 &&
                newRow < BOARD_HEIGHT &&
                newCol >= 0 &&
                newCol < BOARD_WIDTH &&
                !gameBoard[newRow][newCol]
              ) {
                targetRow = newRow
                targetCol = newCol
                break
              }
            }
          }
        }
      }
    }

    // Check if bubble reached top
    if (newBubble.y <= BUBBLE_RADIUS + 10 && !collided) {
      const col = Math.round((newBubble.x - BUBBLE_RADIUS - 10) / (BUBBLE_DIAMETER + 2))
      targetRow = 0
      targetCol = Math.max(0, Math.min(BOARD_WIDTH - 1, col))
      collided = true
    }

    if (collided && targetRow >= 0 && targetCol >= 0) {
      const newBoard = gameBoard.map((row) => [...row])
      newBoard[targetRow][targetCol] = {
        color: newBubble.color,
        row: targetRow,
        col: targetCol,
        id: `${targetRow}-${targetCol}-${Date.now()}`,
      }

      const cluster = findCluster(newBoard, targetRow, targetCol, newBubble.color)
      let newScore = score
      let newCombo = combo

      if (cluster.length >= 3) {
        // Remove matched bubbles
        cluster.forEach(({ x: col, y: row }) => {
          newBoard[row][col] = null
        })
        newCombo += 1
        newScore += cluster.length * 10 * newCombo
      } else {
        newCombo = 0
      }

      // Remove floating bubbles
      const { board: finalBoard, removed } = removeFloatingBubbles(newBoard)
      if (removed > 0) {
        newScore += removed * 15 * Math.max(1, newCombo)
      }

      setGameBoard(finalBoard)
      setScore(newScore)
      setCombo(newCombo)
      setCurrentBubble(nextBubble)
      setNextBubble(COLORS[Math.floor(Math.random() * COLORS.length)])
      setLaunchedBubble(null)

      // Check win condition
      const hasBubbles = finalBoard.some((row) => row.some((bubble) => bubble !== null))
      if (!hasBubbles) {
        setGameWon(true)
        setScore((prev) => prev + 1000)
      }

      // Check game over condition
      const bottomRows = finalBoard.slice(-3)
      const hasBottomBubbles = bottomRows.some((row) => row.some((bubble) => bubble !== null))
      if (hasBottomBubbles) {
        setGameOver(true)
      }
    } else {
      setLaunchedBubble(newBubble)
    }
  }, [launchedBubble, gameBoard, score, combo, nextBubble])

  // Game loop
  useEffect(() => {
    const gameLoop = () => {
      updateLaunchedBubble()
      if (!gameOver && !gameWon) {
        animationRef.current = requestAnimationFrame(gameLoop)
      }
    }

    if (!gameOver && !gameWon) {
      animationRef.current = requestAnimationFrame(gameLoop)
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [updateLaunchedBubble, gameOver, gameWon])

  useEffect(() => {
    initializeGame()
  }, [initializeGame])

  // Handle mouse move for aiming
  const handleMouseMove = (e: React.MouseEvent<SVGElement>) => {
    if (launchedBubble || gameOver || gameWon) return

    const rect = e.currentTarget.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    const dx = mouseX - GAME_WIDTH / 2
    const dy = mouseY - SHOOTER_Y
    const angle = Math.atan2(dx, -dy)

    const maxAngle = Math.PI * 0.4
    setShooterAngle(Math.max(-maxAngle, Math.min(maxAngle, angle)))
  }

  const handleClick = () => {
    launchBubble(shooterAngle)
  }

  const resetGame = () => {
    setScore(0)
    setLevel(1)
    initializeGame()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <Button
            onClick={onBack}
            className="bg-gray-600 hover:bg-gray-700 text-white font-bold px-6 py-3 rounded-full"
          >
            ← Back to Hub
          </Button>
          <h1 className="text-4xl font-bold text-white">🎯 Bubble Shooter</h1>
          <Button
            onClick={resetGame}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-3 rounded-full"
          >
            🎮 New Game
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <Card className="p-4 bg-white/10 backdrop-blur border-white/20">
            <div className="text-white font-bold">Score</div>
            <div className="text-cyan-300 text-xl font-bold">{score.toLocaleString()}</div>
          </Card>
          <Card className="p-4 bg-white/10 backdrop-blur border-white/20">
            <div className="text-white font-bold">Level</div>
            <div className="text-pink-300 text-xl font-bold">{level}</div>
          </Card>
          <Card className="p-4 bg-white/10 backdrop-blur border-white/20">
            <div className="text-white font-bold">Shots</div>
            <div className="text-yellow-300 text-xl font-bold">{bubblesShot}</div>
          </Card>
          <Card className="p-4 bg-white/10 backdrop-blur border-white/20">
            <div className="text-white font-bold">Combo</div>
            <div className="text-orange-300 text-xl font-bold">x{combo}</div>
          </Card>
        </div>

        {/* Game Area */}
        <div className="flex justify-center">
          <Card className="p-4 bg-white/10 backdrop-blur border-white/20">
            <svg
              width={GAME_WIDTH}
              height={GAME_HEIGHT}
              className="bg-gradient-to-b from-blue-900/30 to-purple-900/30 rounded-lg cursor-crosshair"
              onMouseMove={handleMouseMove}
              onClick={handleClick}
            >
              {/* Game board bubbles */}
              {gameBoard.map((row, rowIndex) =>
                row.map((bubble, colIndex) => {
                  if (!bubble) return null
                  const pos = getBubblePosition(rowIndex, colIndex)
                  return (
                    <circle
                      key={bubble.id}
                      cx={pos.x}
                      cy={pos.y}
                      r={BUBBLE_RADIUS}
                      fill={bubble.color}
                      stroke="white"
                      strokeWidth="2"
                      className="drop-shadow-lg"
                    />
                  )
                }),
              )}

              {/* Launched bubble */}
              {launchedBubble && (
                <circle
                  cx={launchedBubble.x}
                  cy={launchedBubble.y}
                  r={BUBBLE_RADIUS}
                  fill={launchedBubble.color}
                  stroke="white"
                  strokeWidth="2"
                  className="drop-shadow-lg"
                />
              )}

              {/* Shooter */}
              <g transform={`translate(${GAME_WIDTH / 2}, ${SHOOTER_Y})`}>
                <line
                  x1="0"
                  y1="0"
                  x2={Math.sin(shooterAngle) * 60}
                  y2={-Math.cos(shooterAngle) * 60}
                  stroke="white"
                  strokeWidth="3"
                  strokeDasharray="5,5"
                />
                <circle cx="0" cy="0" r={BUBBLE_RADIUS + 5} fill="gray" stroke="white" strokeWidth="3" />
                <circle cx="0" cy="0" r={BUBBLE_RADIUS} fill={currentBubble} stroke="white" strokeWidth="2" />
              </g>

              {/* Game over/won overlay */}
              {(gameOver || gameWon) && (
                <>
                  <rect x="0" y="0" width={GAME_WIDTH} height={GAME_HEIGHT} fill="rgba(0,0,0,0.7)" />
                  <text
                    x={GAME_WIDTH / 2}
                    y={GAME_HEIGHT / 2}
                    textAnchor="middle"
                    fill="white"
                    fontSize="36"
                    fontWeight="bold"
                  >
                    {gameWon ? "🎉 You Won!" : "💥 Game Over!"}
                  </text>
                  <text x={GAME_WIDTH / 2} y={GAME_HEIGHT / 2 + 40} textAnchor="middle" fill="white" fontSize="20">
                    Final Score: {score.toLocaleString()}
                  </text>
                </>
              )}
            </svg>
          </Card>

          {/* Next bubble */}
          <Card className="ml-4 p-4 bg-white/10 backdrop-blur border-white/20 h-fit">
            <div className="text-white font-bold mb-2 text-center">Next</div>
            <div className="flex justify-center">
              <div className="w-12 h-12 rounded-full border-2 border-white" style={{ backgroundColor: nextBubble }} />
            </div>
          </Card>
        </div>

        {/* Instructions */}
        <Card className="mt-6 p-4 bg-white/10 backdrop-blur border-white/20">
          <div className="text-center text-white/80 text-sm">
            <p className="font-semibold mb-2">🎯 How to Play:</p>
            <p>Move mouse to aim • Click to shoot • Match 3+ bubbles of the same color to clear them!</p>
          </div>
        </Card>
      </div>
    </div>
  )
}
