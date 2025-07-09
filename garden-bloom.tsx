"use client"

import { useState, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

const GRID_SIZE = 8
const FLOWERS = [
  { type: "rose", color: "#FF69B4", symbol: "🌹", name: "Rose" },
  { type: "tulip", color: "#FF6347", symbol: "🌷", name: "Tulip" },
  { type: "sunflower", color: "#FFD700", symbol: "🌻", name: "Sunflower" },
  { type: "daisy", color: "#FFFFFF", symbol: "🌼", name: "Daisy" },
  { type: "lily", color: "#DDA0DD", symbol: "🌺", name: "Lily" },
  { type: "cherry", color: "#FFB6C1", symbol: "🌸", name: "Cherry Blossom" },
]

interface Flower {
  flower: (typeof FLOWERS)[0]
  id: string
  row: number
  col: number
  isNew?: boolean
  isMatched?: boolean
  isSwapping?: boolean
  isSuggested?: boolean
  animationDelay?: number
}

interface Particle {
  id: string
  x: number
  y: number
  vx: number
  vy: number
  symbol: string
  life: number
  maxLife: number
}

interface GameState {
  grid: (Flower | null)[][]
  score: number
  moves: number
  selectedFlower: Flower | null
  timestamp: number
}

interface ValidMove {
  flower1: { row: number; col: number }
  flower2: { row: number; col: number }
  matchCount: number
}

interface GardenBloomProps {
  onBack: () => void
}

const MAX_UNDO_STATES = 10

export default function GardenBloom({ onBack }: GardenBloomProps) {
  const [grid, setGrid] = useState<(Flower | null)[][]>([])
  const [score, setScore] = useState(0)
  const [level, setLevel] = useState(1)
  const [selectedFlower, setSelectedFlower] = useState<Flower | null>(null)
  const [moves, setMoves] = useState(30)
  const [targetScore, setTargetScore] = useState(1000)
  const [isProcessing, setIsProcessing] = useState(false)
  const [particles, setParticles] = useState<Particle[]>([])
  const [comboCount, setComboCount] = useState(0)
  const [gameOver, setGameOver] = useState(false)
  const [noMovesLeft, setNoMovesLeft] = useState(false)

  // Undo/Redo system
  const [undoStack, setUndoStack] = useState<GameState[]>([])
  const [redoStack, setRedoStack] = useState<GameState[]>([])
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  // Suggestion system
  const [suggestedMoves, setSuggestedMoves] = useState<ValidMove[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [hintUsed, setHintUsed] = useState(false)

  // Create game state snapshot
  const createGameState = useCallback((): GameState => {
    return {
      grid: grid.map((row) => row.map((cell) => (cell ? { ...cell } : null))),
      score,
      moves,
      selectedFlower,
      timestamp: Date.now(),
    }
  }, [grid, score, moves, selectedFlower])

  // Save game state to undo stack
  const saveGameState = useCallback(() => {
    const currentState = createGameState()

    setUndoStack((prevStack) => {
      const newStack = [...prevStack, currentState]
      if (newStack.length > MAX_UNDO_STATES) {
        newStack.shift()
      }
      return newStack
    })

    setRedoStack([])
    setCanUndo(true)
    setCanRedo(false)
  }, [createGameState])

  // Restore game state
  const restoreGameState = useCallback((state: GameState) => {
    setGrid(state.grid.map((row) => row.map((cell) => (cell ? { ...cell } : null))))
    setScore(state.score)
    setMoves(state.moves)
    setSelectedFlower(state.selectedFlower)
  }, [])

  // Undo last move
  const undoMove = useCallback(() => {
    if (undoStack.length === 0 || isProcessing) return

    const lastState = undoStack[undoStack.length - 1]
    const currentState = createGameState()

    setRedoStack((prevStack) => [...prevStack, currentState])
    setUndoStack((prevStack) => {
      const newStack = [...prevStack]
      newStack.pop()
      return newStack
    })

    restoreGameState(lastState)
    setCanUndo(undoStack.length > 1)
    setCanRedo(true)
    setShowSuggestions(false)
  }, [undoStack, isProcessing, createGameState, restoreGameState])

  // Redo last undone move
  const redoMove = useCallback(() => {
    if (redoStack.length === 0 || isProcessing) return

    const redoState = redoStack[redoStack.length - 1]
    const currentState = createGameState()

    setUndoStack((prevStack) => [...prevStack, currentState])
    setRedoStack((prevStack) => {
      const newStack = [...prevStack]
      newStack.pop()
      return newStack
    })

    restoreGameState(redoState)
    setCanUndo(true)
    setCanRedo(redoStack.length > 1)
    setShowSuggestions(false)
  }, [redoStack, isProcessing, createGameState, restoreGameState])

  // Create bloom particles
  const createBloomParticles = useCallback((x: number, y: number, symbol: string) => {
    const newParticles: Particle[] = []
    const particleCount = 6

    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 * i) / particleCount
      const speed = 1 + Math.random() * 2
      newParticles.push({
        id: `particle-${Date.now()}-${i}`,
        x: x * 48 + 24,
        y: y * 48 + 24,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        symbol,
        life: 1,
        maxLife: 1,
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

  // Find all valid moves
  const findValidMoves = useCallback((currentGrid: (Flower | null)[][]): ValidMove[] => {
    const validMoves: ValidMove[] = []

    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        const flower = currentGrid[row][col]
        if (!flower) continue

        // Check adjacent positions
        const adjacent = [
          { row: row - 1, col },
          { row: row + 1, col },
          { row, col: col - 1 },
          { row, col: col + 1 },
        ]

        for (const adj of adjacent) {
          if (adj.row >= 0 && adj.row < GRID_SIZE && adj.col >= 0 && adj.col < GRID_SIZE) {
            const adjFlower = currentGrid[adj.row][adj.col]
            if (!adjFlower) continue

            // Simulate swap
            const testGrid = currentGrid.map((r) => [...r])
            testGrid[row][col] = { ...adjFlower, row, col }
            testGrid[adj.row][adj.col] = { ...flower, row: adj.row, col: adj.col }

            // Check if this creates matches
            const matches = findMatches(testGrid)
            if (matches.length > 0) {
              validMoves.push({
                flower1: { row, col },
                flower2: { row: adj.row, col: adj.col },
                matchCount: matches.length,
              })
            }
          }
        }
      }
    }

    return validMoves
  }, [])

  // Show hint
  const showHint = useCallback(() => {
    const validMoves = findValidMoves(grid)
    if (validMoves.length === 0) {
      setNoMovesLeft(true)
      setGameOver(true)
      return
    }

    // Sort by match count and pick the best move
    validMoves.sort((a, b) => b.matchCount - a.matchCount)
    const bestMove = validMoves[0]

    // Highlight suggested flowers
    setGrid((prev) =>
      prev.map((row, rowIndex) =>
        row.map((cell, colIndex) => {
          if (!cell) return null
          const isSuggested =
            (rowIndex === bestMove.flower1.row && colIndex === bestMove.flower1.col) ||
            (rowIndex === bestMove.flower2.row && colIndex === bestMove.flower2.col)
          return { ...cell, isSuggested }
        }),
      ),
    )

    setSuggestedMoves(validMoves)
    setShowSuggestions(true)
    setHintUsed(true)

    // Remove suggestion after 3 seconds
    setTimeout(() => {
      setGrid((prev) => prev.map((row) => row.map((cell) => (cell ? { ...cell, isSuggested: false } : null))))
      setShowSuggestions(false)
    }, 3000)
  }, [grid, findValidMoves])

  const initializeGame = useCallback(() => {
    const newGrid: (Flower | null)[][] = Array(GRID_SIZE)
      .fill(null)
      .map(() => Array(GRID_SIZE).fill(null))

    // Fill grid ensuring no initial matches
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        let flower
        let attempts = 0
        do {
          flower = FLOWERS[Math.floor(Math.random() * FLOWERS.length)]
          attempts++
        } while (attempts < 10 && wouldCreateMatch(newGrid, row, col, flower))

        newGrid[row][col] = {
          flower,
          id: `${row}-${col}-${Date.now()}-${Math.random()}`,
          row,
          col,
          isNew: true,
          animationDelay: (row * GRID_SIZE + col) * 50,
        }
      }
    }

    setGrid(newGrid)
    setSelectedFlower(null)
    setMoves(30)
    setTargetScore(1000 * level)
    setIsProcessing(false)
    setParticles([])
    setComboCount(0)
    setGameOver(false)
    setNoMovesLeft(false)
    setShowSuggestions(false)
    setHintUsed(false)

    // Reset undo/redo system
    setUndoStack([])
    setRedoStack([])
    setCanUndo(false)
    setCanRedo(false)

    // Remove new animation after delay
    setTimeout(() => {
      setGrid((prev) => prev.map((row) => row.map((cell) => (cell ? { ...cell, isNew: false } : null))))
    }, 2000)
  }, [level])

  const wouldCreateMatch = (
    grid: (Flower | null)[][],
    row: number,
    col: number,
    flower: (typeof FLOWERS)[0],
  ): boolean => {
    // Check horizontal
    let count = 1
    // Check left
    for (let c = col - 1; c >= 0 && grid[row][c] && grid[row][c]!.flower.type === flower.type; c--) {
      count++
    }
    // Check right
    for (let c = col + 1; c < GRID_SIZE && grid[row][c] && grid[row][c]!.flower.type === flower.type; c++) {
      count++
    }
    if (count >= 3) return true

    // Check vertical
    count = 1
    // Check up
    for (let r = row - 1; r >= 0 && grid[r][col] && grid[r][col]!.flower.type === flower.type; r--) {
      count++
    }
    // Check down
    for (let r = row + 1; r < GRID_SIZE && grid[r][col] && grid[r][col]!.flower.type === flower.type; r++) {
      count++
    }
    if (count >= 3) return true

    return false
  }

  const findMatches = (grid: (Flower | null)[][]): Flower[] => {
    const matches: Flower[] = []
    const visited = new Set<string>()

    // Horizontal matches
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE - 2; col++) {
        const cell = grid[row][col]
        if (!cell) continue

        const type = cell.flower.type
        const cell1 = grid[row][col + 1]
        const cell2 = grid[row][col + 2]

        if (cell1 && cell2 && cell1.flower.type === type && cell2.flower.type === type) {
          let length = 3

          while (col + length < GRID_SIZE && grid[row][col + length]?.flower.type === type) {
            length++
          }

          for (let i = 0; i < length; i++) {
            const target = grid[row][col + i]
            if (target && !visited.has(target.id)) {
              matches.push(target)
              visited.add(target.id)
            }
          }
        }
      }
    }

    // Vertical matches
    for (let row = 0; row < GRID_SIZE - 2; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        const cell = grid[row][col]
        if (!cell) continue

        const type = cell.flower.type
        const cell1 = grid[row + 1][col]
        const cell2 = grid[row + 2][col]

        if (cell1 && cell2 && cell1.flower.type === type && cell2.flower.type === type) {
          let length = 3

          while (row + length < GRID_SIZE && grid[row + length][col]?.flower.type === type) {
            length++
          }

          for (let i = 0; i < length; i++) {
            const target = grid[row + i][col]
            if (target && !visited.has(target.id)) {
              matches.push(target)
              visited.add(target.id)
            }
          }
        }
      }
    }

    return matches
  }

  const applyGravity = (grid: (Flower | null)[][]): (Flower | null)[][] => {
    const newGrid = grid.map((row) => [...row])

    for (let col = 0; col < GRID_SIZE; col++) {
      const column: (Flower | null)[] = []

      // Collect non-null flowers from bottom to top
      for (let row = GRID_SIZE - 1; row >= 0; row--) {
        if (newGrid[row][col]) {
          column.push(newGrid[row][col])
        }
      }

      // Fill column from bottom up
      for (let row = GRID_SIZE - 1; row >= 0; row--) {
        const columnIndex = GRID_SIZE - 1 - row
        if (columnIndex < column.length && column[columnIndex]) {
          newGrid[row][col] = {
            ...column[columnIndex]!,
            row,
            col,
            isNew: true,
            animationDelay: (GRID_SIZE - 1 - row) * 50,
          }
        } else {
          // Generate new flower
          let flower
          let attempts = 0
          do {
            flower = FLOWERS[Math.floor(Math.random() * FLOWERS.length)]
            attempts++
          } while (attempts < 10 && wouldCreateMatch(newGrid, row, col, flower))

          newGrid[row][col] = {
            flower,
            id: `${row}-${col}-${Date.now()}-${Math.random()}`,
            row,
            col,
            isNew: true,
            animationDelay: (GRID_SIZE - 1 - row) * 50,
          }
        }
      }
    }

    // Remove new animation after delay
    setTimeout(() => {
      setGrid((prev) => prev.map((row) => row.map((cell) => (cell ? { ...cell, isNew: false } : null))))
    }, 500)

    return newGrid
  }

  const processMatches = async (grid: (Flower | null)[][]): Promise<(Flower | null)[][]> => {
    let currentGrid = grid.map((row) => [...row])
    let totalMatches = 0
    let currentCombo = 0

    while (true) {
      const matches = findMatches(currentGrid)
      if (matches.length === 0) break

      currentCombo++

      // Mark matches for animation
      matches.forEach((match) => {
        currentGrid[match.row][match.col] = { ...match, isMatched: true }
      })

      setGrid([...currentGrid])

      // Create bloom particles
      matches.forEach((match, index) => {
        setTimeout(() => {
          createBloomParticles(match.col, match.row, match.flower.symbol)
        }, index * 50)
      })

      // Wait for animation
      await new Promise((resolve) => setTimeout(resolve, 500))

      // Remove matched flowers
      matches.forEach((match) => {
        currentGrid[match.row][match.col] = null
      })

      totalMatches += matches.length
      setScore((prev) => prev + matches.length * 10 * level * currentCombo)

      // Wait for removal animation
      await new Promise((resolve) => setTimeout(resolve, 200))

      // Apply gravity and refill
      currentGrid = applyGravity(currentGrid)

      // Wait for gravity animation
      await new Promise((resolve) => setTimeout(resolve, 300))
    }

    setComboCount(currentCombo)
    if (currentCombo > 1) {
      setTimeout(() => setComboCount(0), 2000)
    }

    return currentGrid
  }

  const swapFlowers = async (flower1: Flower, flower2: Flower) => {
    if (isProcessing) return

    // Save state before move
    saveGameState()

    setIsProcessing(true)

    // Mark flowers as swapping
    setGrid((prev) =>
      prev.map((row) =>
        row.map((cell) => {
          if (cell?.id === flower1.id || cell?.id === flower2.id) {
            return cell ? { ...cell, isSwapping: true } : null
          }
          return cell
        }),
      ),
    )

    // Wait for swap animation
    await new Promise((resolve) => setTimeout(resolve, 300))

    const newGrid = grid.map((row) => [...row])

    // Swap flowers
    const temp = newGrid[flower1.row][flower1.col]
    newGrid[flower1.row][flower1.col] = {
      ...newGrid[flower2.row][flower2.col]!,
      row: flower1.row,
      col: flower1.col,
      isSwapping: false,
    }
    newGrid[flower2.row][flower2.col] = {
      ...temp!,
      row: flower2.row,
      col: flower2.col,
      isSwapping: false,
    }

    // Check for matches
    const matches = findMatches(newGrid)
    if (matches.length > 0) {
      setGrid(newGrid)
      setMoves((prev) => prev - 1)

      // Process all cascading matches
      const finalGrid = await processMatches(newGrid)
      setGrid(finalGrid)

      // Check win condition
      if (score >= targetScore) {
        setTimeout(() => {
          setLevel((prev) => prev + 1)
          initializeGame()
        }, 1000)
      } else {
        // Check if there are valid moves left
        const validMoves = findValidMoves(finalGrid)
        if (validMoves.length === 0) {
          setNoMovesLeft(true)
          setGameOver(true)
        }
      }
    } else {
      // No matches, invalid move - terminate game
      setGrid((prev) => prev.map((row) => row.map((cell) => (cell ? { ...cell, isSwapping: false } : cell))))
      setGameOver(true)
      setTimeout(() => {
        setIsProcessing(false)
      }, 300)
      return
    }

    setSelectedFlower(null)
    setIsProcessing(false)
    setShowSuggestions(false)
  }

  const handleFlowerClick = (flower: Flower) => {
    if (isProcessing || gameOver) return

    if (!selectedFlower) {
      setSelectedFlower(flower)
    } else if (selectedFlower.id === flower.id) {
      setSelectedFlower(null)
    } else {
      // Check if flowers are adjacent
      const rowDiff = Math.abs(selectedFlower.row - flower.row)
      const colDiff = Math.abs(selectedFlower.col - flower.col)
      if ((rowDiff === 1 && colDiff === 0) || (rowDiff === 0 && colDiff === 1)) {
        swapFlowers(selectedFlower, flower)
      } else {
        setSelectedFlower(flower)
      }
    }
  }

  // Check for game over conditions
  useEffect(() => {
    if (moves <= 0 && !gameOver) {
      setGameOver(true)
    }
  }, [moves, gameOver])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case "z":
            e.preventDefault()
            if (e.shiftKey) {
              redoMove()
            } else {
              undoMove()
            }
            break
          case "y":
            e.preventDefault()
            redoMove()
            break
        }
      } else if (e.key === "h" || e.key === "H") {
        e.preventDefault()
        showHint()
      }
    }

    window.addEventListener("keydown", handleKeyPress)
    return () => window.removeEventListener("keydown", handleKeyPress)
  }, [undoMove, redoMove, showHint])

  useEffect(() => {
    initializeGame()
  }, [initializeGame])

  const resetGame = () => {
    setScore(0)
    setLevel(1)
    initializeGame()
  }

  const progress = Math.min((score / targetScore) * 100, 100)

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-900 via-rose-900 to-red-900 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <Button
            onClick={onBack}
            className="bg-gray-600 hover:bg-gray-700 text-white font-bold px-6 py-3 rounded-full transform hover:scale-105 transition-all duration-200"
          >
            ← Back to Hub
          </Button>
          <h1 className="text-4xl font-bold text-white animate-pulse">🌸 Garden Bloom</h1>
          <div className="flex gap-2">
            <Button
              onClick={undoMove}
              disabled={!canUndo || isProcessing}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500 text-white font-bold px-4 py-2 rounded-full transform hover:scale-105 transition-all duration-200"
              title="Undo (Ctrl+Z)"
            >
              ↶ Undo
            </Button>
            <Button
              onClick={redoMove}
              disabled={!canRedo || isProcessing}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-500 text-white font-bold px-4 py-2 rounded-full transform hover:scale-105 transition-all duration-200"
              title="Redo (Ctrl+Y)"
            >
              ↷ Redo
            </Button>
            <Button
              onClick={resetGame}
              className="bg-pink-600 hover:bg-pink-700 text-white font-bold px-6 py-3 rounded-full transform hover:scale-105 transition-all duration-200"
            >
              🎮 New Game
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <Card className="p-4 bg-white/10 backdrop-blur border-white/20 transform hover:scale-105 transition-all duration-200">
            <div className="text-white font-bold">Score</div>
            <div className="text-pink-300 text-xl font-bold animate-pulse">{score.toLocaleString()}</div>
          </Card>
          <Card className="p-4 bg-white/10 backdrop-blur border-white/20 transform hover:scale-105 transition-all duration-200">
            <div className="text-white font-bold">Level</div>
            <div className="text-rose-300 text-xl font-bold">{level}</div>
          </Card>
          <Card className="p-4 bg-white/10 backdrop-blur border-white/20 transform hover:scale-105 transition-all duration-200">
            <div className="text-white font-bold">Moves</div>
            <div className={`text-xl font-bold ${moves <= 5 ? "text-red-300 animate-bounce" : "text-purple-300"}`}>
              {moves}
            </div>
          </Card>
          <Card className="p-4 bg-white/10 backdrop-blur border-white/20 transform hover:scale-105 transition-all duration-200">
            <div className="text-white font-bold">Target</div>
            <div className="text-yellow-300 text-xl font-bold">{targetScore}</div>
          </Card>
        </div>

        {/* Control Panel */}
        <div className="flex justify-center gap-4 mb-4">
          {comboCount > 1 && (
            <Badge className="px-6 py-2 bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold text-lg animate-bounce">
              🌟 COMBO x{comboCount}! 🌟
            </Badge>
          )}
          <Button
            onClick={showHint}
            disabled={isProcessing || gameOver || showSuggestions}
            className="bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-500 text-white font-bold px-4 py-2 rounded-full transform hover:scale-105 transition-all duration-200"
            title="Show Hint (H)"
          >
            💡 Hint
          </Button>
          <Badge className="px-4 py-2 bg-blue-500/20 text-blue-300 border border-blue-500/30 animate-pulse">
            Undo: {undoStack.length}/{MAX_UNDO_STATES}
          </Badge>
        </div>

        {/* Suggestion indicator */}
        {showSuggestions && (
          <div className="flex justify-center mb-4">
            <div className="px-6 py-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-bold text-lg rounded-full animate-pulse">
              💡 Suggested move highlighted! ({suggestedMoves.length} valid moves found)
            </div>
          </div>
        )}

        {/* Progress Bar */}
        <Card className="p-4 bg-white/10 backdrop-blur border-white/20 mb-6 transform hover:scale-105 transition-all duration-200">
          <div className="text-white font-bold mb-2">Progress to Next Level</div>
          <div className="w-full bg-gray-700 rounded-full h-4">
            <div
              className="bg-gradient-to-r from-pink-500 to-rose-500 h-4 rounded-full transition-all duration-500 animate-pulse"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="text-white/70 text-sm mt-1">
            {score} / {targetScore} points
          </div>
        </Card>

        {/* Game Grid */}
        <Card className="p-6 bg-white/10 backdrop-blur border-white/20 mb-6 relative">
          {/* Particles overlay */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {particles.map((particle) => (
              <div
                key={particle.id}
                className="absolute text-2xl animate-bounce"
                style={{
                  left: `${particle.x}px`,
                  top: `${particle.y}px`,
                  opacity: particle.life,
                  transform: `scale(${particle.life})`,
                }}
              >
                {particle.symbol}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-8 gap-2 max-w-md mx-auto">
            {grid.map((row, rowIndex) =>
              row.map((flower, colIndex) => {
                if (!flower) {
                  // empty placeholder
                  return (
                    <div
                      key={`${rowIndex}-${colIndex}`}
                      className="w-12 h-12 border border-gray-600 rounded-lg bg-black/30"
                    />
                  )
                }
                return (
                  <div
                    key={flower.id}
                    className={`
                      w-12 h-12 rounded-lg border-2 cursor-pointer transition-all duration-300 flex items-center justify-center text-2xl
                      shadow-lg relative overflow-hidden
                      ${selectedFlower?.id === flower.id ? "ring-4 ring-yellow-400 scale-110 animate-pulse" : ""}
                      ${flower.isNew ? "animate-bounce" : ""}
                      ${flower.isMatched ? "animate-ping scale-125" : ""}
                      ${flower.isSwapping ? "animate-spin" : ""}
                      ${flower.isSuggested ? "ring-4 ring-green-400 animate-pulse" : ""}
                      ${isProcessing || gameOver ? "pointer-events-none" : "hover:scale-110 hover:shadow-xl"}
                    `}
                    style={{
                      backgroundColor: flower.flower.color,
                      borderColor: flower.flower.color,
                      animationDelay: flower.animationDelay ? `${flower.animationDelay}ms` : "0ms",
                      boxShadow: flower.isMatched
                        ? `0 0 20px ${flower.flower.color}`
                        : flower.isSuggested
                          ? `0 0 15px #10B981`
                          : `0 4px 8px ${flower.flower.color}40`,
                    }}
                    onClick={() => handleFlowerClick(flower)}
                  >
                    <span className={flower.isMatched ? "animate-pulse" : ""}>{flower.flower.symbol}</span>

                    {/* Sparkle effect for selected flower */}
                    {selectedFlower?.id === flower.id && (
                      <div className="absolute inset-0 animate-ping">
                        <div className="absolute top-1 right-1 w-1 h-1 bg-yellow-300 rounded-full"></div>
                        <div className="absolute bottom-1 left-1 w-1 h-1 bg-yellow-300 rounded-full"></div>
                        <div className="absolute top-1 left-1 w-1 h-1 bg-yellow-300 rounded-full"></div>
                        <div className="absolute bottom-1 right-1 w-1 h-1 bg-yellow-300 rounded-full"></div>
                      </div>
                    )}

                    {/* Suggestion glow effect */}
                    {flower.isSuggested && (
                      <div className="absolute inset-0 animate-pulse">
                        <div className="absolute top-0 left-0 w-full h-full border-2 border-green-400 rounded-lg"></div>
                      </div>
                    )}
                  </div>
                )
              }),
            )}
          </div>
        </Card>

        {/* Game Over Modal */}
        {gameOver && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="p-8 bg-white/10 backdrop-blur border-white/20 max-w-md transform animate-bounce">
              <div className="text-center">
                <h2 className="text-3xl font-bold text-white mb-4 animate-pulse">
                  {noMovesLeft ? "🚫 No Moves Left!" : "💥 Game Over!"}
                </h2>
                <div className="space-y-2 mb-6">
                  <p className="text-white/80">
                    Final Score:{" "}
                    <span className="font-bold text-green-300 animate-pulse">{score.toLocaleString()}</span>
                  </p>
                  <p className="text-white/80">
                    Level Reached: <span className="font-bold text-blue-300">{level}</span>
                  </p>
                  <p className="text-white/80">
                    {noMovesLeft
                      ? "No valid moves remaining on the board!"
                      : "Invalid move - only swaps that create matches are allowed!"}
                  </p>
                </div>
                <Button
                  onClick={resetGame}
                  className="bg-pink-600 hover:bg-pink-700 text-white font-bold px-8 py-3 rounded-full transform hover:scale-105 transition-all duration-200"
                >
                  Play Again
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* Instructions */}
        <Card className="p-4 bg-white/10 backdrop-blur border-white/20 transform hover:scale-105 transition-all duration-200">
          <div className="text-center text-white/80 text-sm">
            <p className="font-semibold mb-2">🌺 How to Play:</p>
            <p>
              Swap adjacent flowers to create matches of 3 or more. Only valid moves that create matches are allowed!
            </p>
            <p className="mt-1">
              <strong>Controls:</strong> Click flowers to swap • H for hint • Ctrl+Z/Y for undo/redo
            </p>
            <p className="mt-1 text-red-300">
              <strong>Warning:</strong> Invalid swaps (no matches) will end the game!
            </p>
          </div>
        </Card>
      </div>
    </div>
  )
}
