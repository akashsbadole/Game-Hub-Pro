"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

const GRID_WIDTH = 10
const GRID_HEIGHT = 20
const BLOCK_SIZE = 25

// Tetromino shapes
const TETROMINOES = {
  I: {
    shape: [[1, 1, 1, 1]],
    color: "#00FFFF",
  },
  O: {
    shape: [
      [1, 1],
      [1, 1],
    ],
    color: "#FFFF00",
  },
  T: {
    shape: [
      [0, 1, 0],
      [1, 1, 1],
    ],
    color: "#800080",
  },
  S: {
    shape: [
      [0, 1, 1],
      [1, 1, 0],
    ],
    color: "#00FF00",
  },
  Z: {
    shape: [
      [1, 1, 0],
      [0, 1, 1],
    ],
    color: "#FF0000",
  },
  J: {
    shape: [
      [1, 0, 0],
      [1, 1, 1],
    ],
    color: "#0000FF",
  },
  L: {
    shape: [
      [0, 0, 1],
      [1, 1, 1],
    ],
    color: "#FFA500",
  },
}

interface Block {
  filled: boolean
  color?: string
  isNew?: boolean
  isClearing?: boolean
  animationDelay?: number
}

interface FallingPiece {
  type: keyof typeof TETROMINOES
  x: number
  y: number
  rotation: number
  shape: number[][]
  color: string
}

interface ElementBlocksProps {
  onBack: () => void
}

export default function ElementBlocks({ onBack }: ElementBlocksProps) {
  const [grid, setGrid] = useState<Block[][]>([])
  const [currentPiece, setCurrentPiece] = useState<FallingPiece | null>(null)
  const [nextPiece, setNextPiece] = useState<FallingPiece | null>(null)
  const [score, setScore] = useState(0)
  const [level, setLevel] = useState(1)
  const [lines, setLines] = useState(0)
  const [gameOver, setGameOver] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [dropTime, setDropTime] = useState(1000)
  const [clearedLines, setClearedLines] = useState<number[]>([])

  const gameLoopRef = useRef<number>()
  const lastDropRef = useRef<number>(Date.now())

  // Initialize empty grid
  const initializeGrid = useCallback(() => {
    return Array(GRID_HEIGHT)
      .fill(null)
      .map(() =>
        Array(GRID_WIDTH)
          .fill(null)
          .map(() => ({ filled: false })),
      )
  }, [])

  // Rotate matrix 90 degrees clockwise
  const rotateMatrix = (matrix: number[][]): number[][] => {
    const rows = matrix.length
    const cols = matrix[0].length
    const rotated = Array(cols)
      .fill(null)
      .map(() => Array(rows).fill(0))

    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        rotated[j][rows - 1 - i] = matrix[i][j]
      }
    }
    return rotated
  }

  // Create a new random piece
  const createPiece = useCallback((): FallingPiece => {
    const types = Object.keys(TETROMINOES) as (keyof typeof TETROMINOES)[]
    const type = types[Math.floor(Math.random() * types.length)]
    const tetromino = TETROMINOES[type]

    return {
      type,
      x: Math.floor(GRID_WIDTH / 2) - Math.floor(tetromino.shape[0].length / 2),
      y: 0,
      rotation: 0,
      shape: tetromino.shape,
      color: tetromino.color,
    }
  }, [])

  // Check if piece can be placed at position
  const canPlacePiece = useCallback(
    (piece: FallingPiece, grid: Block[][], offsetX = 0, offsetY = 0, newShape?: number[][]): boolean => {
      const shape = newShape || piece.shape

      for (let y = 0; y < shape.length; y++) {
        for (let x = 0; x < shape[y].length; x++) {
          if (shape[y][x]) {
            const newX = piece.x + x + offsetX
            const newY = piece.y + y + offsetY

            if (newX < 0 || newX >= GRID_WIDTH || newY >= GRID_HEIGHT) {
              return false
            }

            if (newY >= 0 && grid[newY][newX].filled) {
              return false
            }
          }
        }
      }
      return true
    },
    [],
  )

  // Place piece on grid
  const placePiece = useCallback((piece: FallingPiece, grid: Block[][]): Block[][] => {
    const newGrid = grid.map((row) => [...row])

    for (let y = 0; y < piece.shape.length; y++) {
      for (let x = 0; x < piece.shape[y].length; x++) {
        if (piece.shape[y][x]) {
          const gridY = piece.y + y
          const gridX = piece.x + x
          if (gridY >= 0 && gridY < GRID_HEIGHT && gridX >= 0 && gridX < GRID_WIDTH) {
            newGrid[gridY][gridX] = {
              filled: true,
              color: piece.color,
              isNew: true,
              animationDelay: (y * piece.shape[0].length + x) * 50,
            }
          }
        }
      }
    }

    // Remove new animation after delay
    setTimeout(() => {
      setGrid((prev) => prev.map((row) => row.map((cell) => ({ ...cell, isNew: false }))))
    }, 500)

    return newGrid
  }, [])

  // Check and clear completed lines
  const clearLines = useCallback((grid: Block[][]): { newGrid: Block[][]; linesCleared: number } => {
    const completedLines: number[] = []

    for (let y = 0; y < GRID_HEIGHT; y++) {
      if (grid[y].every((block) => block.filled)) {
        completedLines.push(y)
      }
    }

    if (completedLines.length === 0) {
      return { newGrid: grid, linesCleared: 0 }
    }

    // Mark lines for clearing animation
    setClearedLines(completedLines)

    // Animate clearing
    const newGrid = grid.map((row, index) =>
      completedLines.includes(index) ? row.map((cell) => ({ ...cell, isClearing: true })) : row,
    )

    setGrid(newGrid)

    // Clear lines after animation
    setTimeout(() => {
      const finalGrid = grid.filter((_, index) => !completedLines.includes(index))

      // Add empty lines at the top with animation
      for (let i = 0; i < completedLines.length; i++) {
        finalGrid.unshift(
          Array(GRID_WIDTH)
            .fill(null)
            .map((_, index) => ({
              filled: false,
              isNew: true,
              animationDelay: index * 30,
            })),
        )
      }

      setGrid(finalGrid)
      setClearedLines([])

      // Remove new animation
      setTimeout(() => {
        setGrid((prev) => prev.map((row) => row.map((cell) => ({ ...cell, isNew: false }))))
      }, 500)
    }, 500)

    return { newGrid: grid, linesCleared: completedLines.length }
  }, [])

  // Move piece down
  const dropPiece = useCallback(() => {
    if (!currentPiece || gameOver || isPaused) return

    if (canPlacePiece(currentPiece, grid, 0, 1)) {
      setCurrentPiece((prev) => (prev ? { ...prev, y: prev.y + 1 } : null))
    } else {
      // Place piece and create new one
      const newGrid = placePiece(currentPiece, grid)
      const { newGrid: clearedGrid, linesCleared } = clearLines(newGrid)

      setGrid(clearedGrid)
      setLines((prev) => prev + linesCleared)

      // Calculate score
      const lineScores = [0, 100, 300, 500, 800]
      const points = lineScores[Math.min(linesCleared, 4)] * level
      setScore((prev) => prev + points)

      // Check game over
      if (nextPiece && !canPlacePiece(nextPiece, clearedGrid)) {
        setGameOver(true)
        return
      }

      setCurrentPiece(nextPiece)
      setNextPiece(createPiece())
    }
  }, [currentPiece, grid, gameOver, isPaused, canPlacePiece, placePiece, clearLines, level, nextPiece, createPiece])

  // Handle keyboard input
  const handleKeyPress = useCallback(
    (e: KeyboardEvent) => {
      if (gameOver || isPaused || !currentPiece) return

      switch (e.key) {
        case "ArrowLeft":
          if (canPlacePiece(currentPiece, grid, -1, 0)) {
            setCurrentPiece((prev) => (prev ? { ...prev, x: prev.x - 1 } : null))
          }
          break
        case "ArrowRight":
          if (canPlacePiece(currentPiece, grid, 1, 0)) {
            setCurrentPiece((prev) => (prev ? { ...prev, x: prev.x + 1 } : null))
          }
          break
        case "ArrowDown":
          dropPiece()
          break
        case "ArrowUp":
        case " ":
          const rotatedShape = rotateMatrix(currentPiece.shape)
          if (canPlacePiece(currentPiece, grid, 0, 0, rotatedShape)) {
            setCurrentPiece((prev) =>
              prev
                ? {
                    ...prev,
                    rotation: (prev.rotation + 1) % 4,
                    shape: rotatedShape,
                  }
                : null,
            )
          }
          break
        case "p":
          setIsPaused((prev) => !prev)
          break
      }
    },
    [currentPiece, grid, gameOver, isPaused, canPlacePiece, dropPiece],
  )

  // Game loop
  useEffect(() => {
    const gameLoop = () => {
      const now = Date.now()
      if (now - lastDropRef.current > dropTime) {
        dropPiece()
        lastDropRef.current = now
      }
      if (!gameOver && !isPaused) {
        gameLoopRef.current = requestAnimationFrame(gameLoop)
      }
    }

    if (!gameOver && !isPaused) {
      gameLoopRef.current = requestAnimationFrame(gameLoop)
    }

    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current)
      }
    }
  }, [dropPiece, dropTime, gameOver, isPaused])

  // Keyboard event listeners
  useEffect(() => {
    window.addEventListener("keydown", handleKeyPress)
    return () => window.removeEventListener("keydown", handleKeyPress)
  }, [handleKeyPress])

  // Update level and speed
  useEffect(() => {
    const newLevel = Math.floor(lines / 10) + 1
    if (newLevel !== level) {
      setLevel(newLevel)
      setDropTime(Math.max(100, 1000 - (newLevel - 1) * 100))
    }
  }, [lines, level])

  // Initialize game
  useEffect(() => {
    const newGrid = initializeGrid()
    setGrid(newGrid)
    const first = createPiece()
    const second = createPiece()
    setCurrentPiece(first)
    setNextPiece(second)
  }, [initializeGrid, createPiece])

  const resetGame = () => {
    setGrid(initializeGrid())
    setScore(0)
    setLevel(1)
    setLines(0)
    setGameOver(false)
    setIsPaused(false)
    setDropTime(1000)
    setClearedLines([])
    const first = createPiece()
    const second = createPiece()
    setCurrentPiece(first)
    setNextPiece(second)
  }

  const togglePause = () => {
    setIsPaused(!isPaused)
  }

  // Render grid with current piece
  const renderGrid = () => {
    const displayGrid = grid.map((row) => [...row])

    // Add current piece to display grid
    if (currentPiece) {
      for (let y = 0; y < currentPiece.shape.length; y++) {
        for (let x = 0; x < currentPiece.shape[y].length; x++) {
          if (currentPiece.shape[y][x]) {
            const gridY = currentPiece.y + y
            const gridX = currentPiece.x + x
            if (gridY >= 0 && gridY < GRID_HEIGHT && gridX >= 0 && gridX < GRID_WIDTH) {
              displayGrid[gridY][gridX] = {
                filled: true,
                color: currentPiece.color,
              }
            }
          }
        }
      }
    }

    return displayGrid
  }

  const displayGrid = renderGrid()

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-900 via-teal-900 to-green-900 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <Button
            onClick={onBack}
            className="bg-gray-600 hover:bg-gray-700 text-white font-bold px-6 py-3 rounded-full transform hover:scale-105 transition-all duration-200"
          >
            ← Back to Hub
          </Button>
          <h1 className="text-4xl font-bold text-white animate-pulse">🧩 Element Blocks</h1>
          <div className="flex gap-2">
            <Button
              onClick={togglePause}
              disabled={gameOver}
              className="bg-yellow-600 hover:bg-yellow-700 text-white font-bold px-4 py-3 rounded-full transform hover:scale-105 transition-all duration-200"
            >
              {isPaused ? "▶️" : "⏸️"}
            </Button>
            <Button
              onClick={resetGame}
              className="bg-green-600 hover:bg-green-700 text-white font-bold px-6 py-3 rounded-full transform hover:scale-105 transition-all duration-200"
            >
              🎮 New Game
            </Button>
          </div>
        </div>

        <div className="flex gap-6 justify-center">
          {/* Game Area */}
          <div className="flex flex-col items-center">
            {/* Stats */}
            <div className="grid grid-cols-4 gap-4 mb-6 w-full max-w-md">
              <Card className="p-3 bg-white/10 backdrop-blur border-white/20 transform hover:scale-105 transition-all duration-200">
                <div className="text-white font-bold text-sm">Score</div>
                <div className="text-green-300 text-lg font-bold animate-pulse">{score.toLocaleString()}</div>
              </Card>
              <Card className="p-3 bg-white/10 backdrop-blur border-white/20 transform hover:scale-105 transition-all duration-200">
                <div className="text-white font-bold text-sm">Level</div>
                <div className="text-teal-300 text-lg font-bold">{level}</div>
              </Card>
              <Card className="p-3 bg-white/10 backdrop-blur border-white/20 transform hover:scale-105 transition-all duration-200">
                <div className="text-white font-bold text-sm">Lines</div>
                <div className="text-blue-300 text-lg font-bold">{lines}</div>
              </Card>
              <Card className="p-3 bg-white/10 backdrop-blur border-white/20 transform hover:scale-105 transition-all duration-200">
                <div className="text-white font-bold text-sm">Speed</div>
                <div className="text-purple-300 text-lg font-bold">{Math.round(1000 / dropTime)}x</div>
              </Card>
            </div>

            {/* Game Grid */}
            <Card className="p-4 bg-white/10 backdrop-blur border-white/20 transform hover:scale-105 transition-all duration-200">
              <div
                className="grid gap-px bg-gray-800 p-2"
                style={{
                  gridTemplateColumns: `repeat(${GRID_WIDTH}, ${BLOCK_SIZE}px)`,
                  gridTemplateRows: `repeat(${GRID_HEIGHT}, ${BLOCK_SIZE}px)`,
                }}
              >
                {displayGrid.map((row, y) =>
                  row.map((block, x) => (
                    <div
                      key={`${y}-${x}`}
                      className={`border border-gray-600 transition-all duration-300 ${
                        block.isNew
                          ? "animate-bounce"
                          : block.isClearing
                            ? "animate-ping bg-white"
                            : block.filled
                              ? "hover:brightness-110"
                              : ""
                      }`}
                      style={{
                        width: `${BLOCK_SIZE}px`,
                        height: `${BLOCK_SIZE}px`,
                        backgroundColor: block.filled ? block.color : "#1a1a1a",
                        animationDelay: block.animationDelay ? `${block.animationDelay}ms` : "0ms",
                        boxShadow: block.filled ? `0 0 10px ${block.color}40` : "none",
                      }}
                    />
                  )),
                )}
              </div>
            </Card>
          </div>

          {/* Side Panel */}
          <div className="flex flex-col gap-4">
            {/* Next Piece */}
            <Card className="p-4 bg-white/10 backdrop-blur border-white/20 transform hover:scale-105 transition-all duration-200">
              <h3 className="text-white font-bold mb-3 text-center">Next</h3>
              <div className="flex justify-center">
                <div
                  className="grid gap-px bg-gray-800 p-2"
                  style={{
                    gridTemplateColumns: `repeat(4, 20px)`,
                    gridTemplateRows: `repeat(4, 20px)`,
                  }}
                >
                  {Array(16)
                    .fill(null)
                    .map((_, i) => {
                      const x = i % 4
                      const y = Math.floor(i / 4)
                      const inShape =
                        nextPiece &&
                        y < nextPiece.shape.length &&
                        x < nextPiece.shape[y].length &&
                        nextPiece.shape[y][x]

                      return (
                        <div
                          key={i}
                          className={`w-5 h-5 border border-gray-600 transition-all duration-200 ${
                            inShape ? "animate-pulse" : ""
                          }`}
                          style={{
                            backgroundColor: inShape ? nextPiece?.color : "#1a1a1a",
                            boxShadow: inShape ? `0 0 5px ${nextPiece?.color}40` : "none",
                          }}
                        />
                      )
                    })}
                </div>
              </div>
            </Card>

            {/* Controls */}
            <Card className="p-4 bg-white/10 backdrop-blur border-white/20 transform hover:scale-105 transition-all duration-200">
              <h3 className="text-white font-bold mb-3 text-center">Controls</h3>
              <div className="text-white/80 text-sm space-y-1">
                <div className="hover:text-white transition-colors">← → Move</div>
                <div className="hover:text-white transition-colors">↓ Soft Drop</div>
                <div className="hover:text-white transition-colors">↑ / Space Rotate</div>
                <div className="hover:text-white transition-colors">P Pause</div>
              </div>
            </Card>
          </div>
        </div>

        {/* Game Over */}
        {gameOver && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="p-8 bg-white/10 backdrop-blur border-white/20 max-w-md transform animate-bounce">
              <div className="text-center">
                <h2 className="text-3xl font-bold text-white mb-4 animate-pulse">Game Over!</h2>
                <div className="space-y-2 mb-6">
                  <p className="text-white/80">
                    Final Score:{" "}
                    <span className="font-bold text-green-300 animate-pulse">{score.toLocaleString()}</span>
                  </p>
                  <p className="text-white/80">
                    Level Reached: <span className="font-bold text-blue-300">{level}</span>
                  </p>
                  <p className="text-white/80">
                    Lines Cleared: <span className="font-bold text-purple-300">{lines}</span>
                  </p>
                </div>
                <Button
                  onClick={resetGame}
                  className="bg-green-600 hover:bg-green-700 text-white font-bold px-8 py-3 rounded-full transform hover:scale-105 transition-all duration-200"
                >
                  Play Again
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* Pause Overlay */}
        {isPaused && !gameOver && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40">
            <Card className="p-8 bg-white/10 backdrop-blur border-white/20 transform animate-pulse">
              <div className="text-center">
                <h2 className="text-3xl font-bold text-white mb-4">⏸️ Paused</h2>
                <Button
                  onClick={togglePause}
                  className="bg-green-600 hover:bg-green-700 text-white font-bold px-8 py-3 rounded-full transform hover:scale-105 transition-all duration-200"
                >
                  Resume Game
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* Instructions */}
        <Card className="mt-6 p-4 bg-white/10 backdrop-blur border-white/20 transform hover:scale-105 transition-all duration-200">
          <div className="text-center text-white/80 text-sm">
            <p className="font-semibold mb-2">🎯 How to Play:</p>
            <p>Arrange falling blocks to create complete horizontal lines. Clear lines to score points!</p>
            <p className="mt-1">Use arrow keys to move and rotate pieces. Game speeds up as you level up!</p>
          </div>
        </Card>
      </div>
    </div>
  )
}
