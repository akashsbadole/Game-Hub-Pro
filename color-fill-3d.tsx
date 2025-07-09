"use client"

import { useState, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

const COLORS = ["#FF6B9D", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7", "#DDA0DD"]

interface Cell {
  id: string
  color: string
  locked: boolean
  obstacle: boolean
  target: boolean
  targetColor?: string
  row: number
  col: number
  isNew?: boolean
  isFilling?: boolean
  isCompleted?: boolean
  animationDelay?: number
}

interface Particle {
  id: string
  x: number
  y: number
  vx: number
  vy: number
  color: string
  life: number
  size: number
}

interface ColorFill3DProps {
  onBack: () => void
}

export default function ColorFill3D({ onBack }: ColorFill3DProps) {
  const [grid, setGrid] = useState<Cell[][]>([])
  const [selectedColor, setSelectedColor] = useState<string>(COLORS[0])
  const [score, setScore] = useState(0)
  const [level, setLevel] = useState(1)
  const [moves, setMoves] = useState(0)
  const [maxMoves, setMaxMoves] = useState(15)
  const [gameOver, setGameOver] = useState(false)
  const [levelComplete, setLevelComplete] = useState(false)
  const [gridSize, setGridSize] = useState(6)
  const [targetCells, setTargetCells] = useState(0)
  const [completedCells, setCompletedCells] = useState(0)
  const [particles, setParticles] = useState<Particle[]>([])
  const [isAnimating, setIsAnimating] = useState(false)

  // Create fill particles
  const createFillParticles = useCallback((x: number, y: number, color: string) => {
    const newParticles: Particle[] = []
    const particleCount = 8

    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 * i) / particleCount
      const speed = 1 + Math.random() * 2
      newParticles.push({
        id: `particle-${Date.now()}-${i}`,
        x: x * 40 + 20,
        y: y * 40 + 20,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        life: 1,
        size: 2 + Math.random() * 3,
      })
    }

    setParticles((prev) => [...prev, ...newParticles])
  }, [])

  // Update particles
  const updateParticles = useCallback(() => {
    setParticles((prev) =>
      prev
        .map((particle) => ({
          ...particle,
          x: particle.x + particle.vx,
          y: particle.y + particle.vy,
          vy: particle.vy + 0.05, // gravity
          life: particle.life - 0.02,
        }))
        .filter((particle) => particle.life > 0),
    )
  }, [])

  // Animation loop for particles
  useEffect(() => {
    const interval = setInterval(updateParticles, 16)
    return () => clearInterval(interval)
  }, [updateParticles])

  const initializeGame = useCallback(() => {
    const size = Math.min(6 + Math.floor(level / 2), 10)
    const newGrid: Cell[][] = Array(size)
      .fill(null)
      .map(() => Array(size).fill(null))

    let targetCount = 0

    // Initialize grid
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        const isObstacle = Math.random() < 0.1
        const isTarget = !isObstacle && Math.random() < 0.3
        const baseColor = COLORS[Math.floor(Math.random() * COLORS.length)]

        if (isTarget) targetCount++

        newGrid[row][col] = {
          id: `${row}-${col}`,
          color: baseColor,
          locked: false,
          obstacle: isObstacle,
          target: isTarget,
          targetColor: isTarget ? COLORS[Math.floor(Math.random() * COLORS.length)] : undefined,
          row,
          col,
          isNew: true,
          animationDelay: (row * size + col) * 30,
        }
      }
    }

    // Ensure minimum targets
    if (targetCount < 3) {
      for (let i = 0; i < 3; i++) {
        const row = Math.floor(Math.random() * size)
        const col = Math.floor(Math.random() * size)
        if (!newGrid[row][col].obstacle) {
          newGrid[row][col].target = true
          newGrid[row][col].targetColor = COLORS[Math.floor(Math.random() * COLORS.length)]
          targetCount++
        }
      }
    }

    setGrid(newGrid)
    setGridSize(size)
    setMoves(0)
    setMaxMoves(12 + level * 2)
    setTargetCells(targetCount)
    setCompletedCells(0)
    setGameOver(false)
    setLevelComplete(false)
    setParticles([])

    // Remove new animation after delay
    setTimeout(() => {
      setGrid((prev) => prev.map((row) => row.map((cell) => ({ ...cell, isNew: false }))))
    }, 1500)
  }, [level])

  // Flood fill algorithm with animation
  const floodFill = useCallback(
    async (grid: Cell[][], startRow: number, startCol: number, newColor: string): Promise<Cell[][]> => {
      const newGrid = grid.map((row) => row.map((cell) => ({ ...cell })))
      const originalColor = grid[startRow][startCol].color

      if (originalColor === newColor || newGrid[startRow][startCol].obstacle || newGrid[startRow][startCol].locked) {
        return newGrid
      }

      const stack: { row: number; col: number }[] = [{ row: startRow, col: startCol }]
      const visited = new Set<string>()
      const cellsToFill: { row: number; col: number }[] = []

      // Find all cells to fill
      while (stack.length > 0) {
        const { row, col } = stack.pop()!
        const key = `${row}-${col}`

        if (
          visited.has(key) ||
          row < 0 ||
          row >= gridSize ||
          col < 0 ||
          col >= gridSize ||
          newGrid[row][col].color !== originalColor ||
          newGrid[row][col].obstacle ||
          newGrid[row][col].locked
        ) {
          continue
        }

        visited.add(key)
        cellsToFill.push({ row, col })

        // Add adjacent cells
        stack.push({ row: row - 1, col }, { row: row + 1, col }, { row, col: col - 1 }, { row, col: col + 1 })
      }

      // Animate filling
      setIsAnimating(true)

      for (let i = 0; i < cellsToFill.length; i++) {
        const { row, col } = cellsToFill[i]

        // Mark as filling
        newGrid[row][col].isFilling = true
        newGrid[row][col].color = newColor

        // Create particles
        createFillParticles(col, row, newColor)

        setGrid([...newGrid.map((r) => [...r])])

        // Small delay between fills for wave effect
        await new Promise((resolve) => setTimeout(resolve, 30))
      }

      // Remove filling animation
      setTimeout(() => {
        setGrid((prev) => prev.map((row) => row.map((cell) => ({ ...cell, isFilling: false }))))
        setIsAnimating(false)
      }, 200)

      return newGrid
    },
    [gridSize, createFillParticles],
  )

  // Handle cell click
  const handleCellClick = useCallback(
    async (row: number, col: number) => {
      if (gameOver || levelComplete || moves >= maxMoves || isAnimating) return

      const cell = grid[row][col]
      if (cell.obstacle || cell.locked) return

      const newGrid = await floodFill(grid, row, col, selectedColor)
      setGrid(newGrid)
      setMoves((prev) => prev + 1)

      // Check for completed targets and lock them
      const updatedGrid = newGrid.map((gridRow) =>
        gridRow.map((gridCell) => {
          if (gridCell.target && gridCell.color === gridCell.targetColor && !gridCell.locked) {
            return { ...gridCell, locked: true, isCompleted: true }
          }
          return gridCell
        }),
      )

      if (JSON.stringify(updatedGrid) !== JSON.stringify(newGrid)) {
        setGrid(updatedGrid)

        // Remove completion animation after delay
        setTimeout(() => {
          setGrid((prev) => prev.map((row) => row.map((cell) => ({ ...cell, isCompleted: false }))))
        }, 1000)
      }

      // Calculate completed cells
      const completed = updatedGrid.flat().filter((cell) => cell.target && cell.locked).length
      setCompletedCells(completed)

      // Calculate score
      const floodedCells = newGrid.flat().filter((cell) => cell.color === selectedColor).length
      const targetHits = updatedGrid.flat().filter((cell) => cell.target && cell.locked).length
      setScore((prev) => prev + floodedCells * 5 + targetHits * 50)
    },
    [grid, selectedColor, gameOver, levelComplete, moves, maxMoves, isAnimating, floodFill],
  )

  // Check win/lose conditions
  useEffect(() => {
    if (completedCells === targetCells && targetCells > 0) {
      setLevelComplete(true)
      const bonusScore = (maxMoves - moves) * 20 + level * 100
      setScore((prev) => prev + bonusScore)

      setTimeout(() => {
        setLevel((prev) => prev + 1)
        initializeGame()
      }, 2000)
    } else if (moves >= maxMoves && !levelComplete) {
      setGameOver(true)
    }
  }, [completedCells, targetCells, moves, maxMoves, levelComplete, level, initializeGame])

  useEffect(() => {
    initializeGame()
  }, [initializeGame])

  const resetGame = () => {
    setScore(0)
    setLevel(1)
    setMoves(0)
    setGameOver(false)
    setLevelComplete(false)
    initializeGame()
  }

  const progress = targetCells > 0 ? (completedCells / targetCells) * 100 : 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-900 via-red-900 to-pink-900 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <Button
            onClick={onBack}
            className="bg-gray-600 hover:bg-gray-700 text-white font-bold px-6 py-3 rounded-full transform hover:scale-105 transition-all duration-200"
          >
            ← Back to Hub
          </Button>
          <h1 className="text-4xl font-bold text-white animate-pulse">🎨 Color Fill 3D</h1>
          <Button
            onClick={resetGame}
            className="bg-orange-600 hover:bg-orange-700 text-white font-bold px-6 py-3 rounded-full transform hover:scale-105 transition-all duration-200"
          >
            🎮 New Game
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-5 gap-4 mb-6">
          <Card className="p-4 bg-white/10 backdrop-blur border-white/20 transform hover:scale-105 transition-all duration-200">
            <div className="text-white font-bold">Score</div>
            <div className="text-orange-300 text-xl font-bold animate-pulse">{score.toLocaleString()}</div>
          </Card>
          <Card className="p-4 bg-white/10 backdrop-blur border-white/20 transform hover:scale-105 transition-all duration-200">
            <div className="text-white font-bold">Level</div>
            <div className="text-red-300 text-xl font-bold">{level}</div>
          </Card>
          <Card className="p-4 bg-white/10 backdrop-blur border-white/20 transform hover:scale-105 transition-all duration-200">
            <div className="text-white font-bold">Moves</div>
            <div
              className={`text-xl font-bold ${moves >= maxMoves - 3 ? "text-red-300 animate-bounce" : "text-pink-300"}`}
            >
              {moves}/{maxMoves}
            </div>
          </Card>
          <Card className="p-4 bg-white/10 backdrop-blur border-white/20 transform hover:scale-105 transition-all duration-200">
            <div className="text-white font-bold">Progress</div>
            <div className="text-purple-300 text-xl font-bold animate-pulse">{Math.round(progress)}%</div>
          </Card>
          <Card className="p-4 bg-white/10 backdrop-blur border-white/20 transform hover:scale-105 transition-all duration-200">
            <div className="text-white font-bold">Targets</div>
            <div className="text-blue-300 text-xl font-bold">
              {completedCells}/{targetCells}
            </div>
          </Card>
        </div>

        <div className="flex gap-6 justify-center">
          {/* Game Grid */}
          <Card className="p-6 bg-white/10 backdrop-blur border-white/20 relative">
            {/* Particles overlay */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              {particles.map((particle) => (
                <div
                  key={particle.id}
                  className="absolute rounded-full"
                  style={{
                    left: `${particle.x}px`,
                    top: `${particle.y}px`,
                    width: `${particle.size}px`,
                    height: `${particle.size}px`,
                    backgroundColor: particle.color,
                    opacity: particle.life,
                    transform: `scale(${particle.life})`,
                  }}
                />
              ))}
            </div>

            <div
              className="grid gap-1 p-4 bg-black/20 rounded-lg"
              style={{
                gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
                width: "400px",
                height: "400px",
              }}
            >
              {grid.map((row, rowIndex) =>
                row.map((cell, colIndex) => (
                  <div
                    key={cell.id}
                    className={`
                      relative cursor-pointer transition-all duration-300 rounded-sm flex items-center justify-center text-xs
                      ${!cell.obstacle && !cell.locked && !isAnimating ? "hover:scale-110 hover:shadow-lg" : ""}
                      ${cell.locked ? "animate-pulse ring-2 ring-yellow-400" : ""}
                      ${cell.isNew ? "animate-bounce" : ""}
                      ${cell.isFilling ? "animate-ping scale-110" : ""}
                      ${cell.isCompleted ? "animate-bounce scale-125" : ""}
                    `}
                    style={{
                      backgroundColor: cell.obstacle ? "#333" : cell.color,
                      border: cell.locked ? "2px solid #FFD700" : cell.target ? "2px dashed #FFF" : "1px solid #666",
                      animationDelay: cell.animationDelay ? `${cell.animationDelay}ms` : "0ms",
                      boxShadow: cell.isFilling
                        ? `0 0 20px ${cell.color}`
                        : cell.locked
                          ? `0 0 15px #FFD700`
                          : `0 2px 4px ${cell.color}40`,
                    }}
                    onClick={() => handleCellClick(rowIndex, colIndex)}
                  >
                    {cell.obstacle && <span className="animate-spin">🚫</span>}
                    {cell.target && !cell.locked && cell.targetColor && (
                      <div
                        className="absolute -top-1 -right-1 w-2 h-2 rounded-full border border-white animate-pulse"
                        style={{ backgroundColor: cell.targetColor }}
                      />
                    )}
                    {cell.locked && <span className="animate-bounce">🔒</span>}
                    {cell.isCompleted && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-yellow-300 text-lg animate-bounce">✨</span>
                      </div>
                    )}
                  </div>
                )),
              )}
            </div>
          </Card>

          {/* Color Palette */}
          <Card className="p-4 bg-white/10 backdrop-blur border-white/20 h-fit transform hover:scale-105 transition-all duration-200">
            <h3 className="text-white font-bold text-center mb-4">Colors</h3>
            <div className="grid grid-cols-2 gap-3">
              {COLORS.map((color) => (
                <button
                  key={color}
                  className={`w-12 h-12 rounded-lg border-2 transition-all duration-300 hover:scale-110 ${
                    selectedColor === color ? "border-white scale-110 shadow-lg animate-pulse" : "border-gray-400"
                  }`}
                  style={{
                    backgroundColor: color,
                    boxShadow: selectedColor === color ? `0 0 20px ${color}` : `0 4px 8px ${color}40`,
                  }}
                  onClick={() => setSelectedColor(color)}
                >
                  {selectedColor === color && <div className="text-white text-lg font-bold animate-bounce">✓</div>}
                </button>
              ))}
            </div>
          </Card>
        </div>

        {/* Level Complete */}
        {levelComplete && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="p-8 bg-white/10 backdrop-blur border-white/20 max-w-md transform animate-bounce">
              <div className="text-center">
                <h2 className="text-3xl font-bold text-white mb-4 animate-pulse">🎉 Level Complete!</h2>
                <div className="space-y-2 mb-6">
                  <p className="text-white/80">
                    Score: <span className="font-bold text-green-300 animate-pulse">{score.toLocaleString()}</span>
                  </p>
                  <p className="text-white/80">
                    Move Bonus: <span className="font-bold text-yellow-300">+{(maxMoves - moves) * 20}</span>
                  </p>
                </div>
                <div className="text-white/60 text-sm animate-pulse">Advancing to Level {level + 1}...</div>
              </div>
            </Card>
          </div>
        )}

        {/* Game Over */}
        {gameOver && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="p-8 bg-white/10 backdrop-blur border-white/20 max-w-md transform animate-bounce">
              <div className="text-center">
                <h2 className="text-3xl font-bold text-white mb-4 animate-pulse">💥 Game Over!</h2>
                <div className="space-y-2 mb-6">
                  <p className="text-white/80">
                    Final Score:{" "}
                    <span className="font-bold text-green-300 animate-pulse">{score.toLocaleString()}</span>
                  </p>
                  <p className="text-white/80">
                    Level Reached: <span className="font-bold text-blue-300">{level}</span>
                  </p>
                </div>
                <Button
                  onClick={resetGame}
                  className="bg-orange-600 hover:bg-orange-700 text-white font-bold px-8 py-3 rounded-full transform hover:scale-105 transition-all duration-200"
                >
                  Try Again
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* Instructions */}
        <Card className="mt-6 p-4 bg-white/10 backdrop-blur border-white/20 transform hover:scale-105 transition-all duration-200">
          <div className="text-center text-white/80 text-sm">
            <p className="font-semibold mb-2">🎯 How to Play:</p>
            <p>
              Select a color and click cells to flood fill connected areas. Fill target cells with their matching color!
            </p>
          </div>
        </Card>
      </div>
    </div>
  )
}
