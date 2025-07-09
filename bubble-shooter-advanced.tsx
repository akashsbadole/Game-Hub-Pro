"use client"

import type React from "react"

import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

// Game constants
const BOARD_WIDTH = 12
const BOARD_HEIGHT = 16
const BUBBLE_RADIUS = 20
const BUBBLE_DIAMETER = BUBBLE_RADIUS * 2
const COLORS = ["#FF6B9D", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7", "#DDA0DD"]
const SHOOTER_Y = 520
const GAME_WIDTH = BOARD_WIDTH * (BUBBLE_DIAMETER + 2)
const GAME_HEIGHT = 580
const BUBBLE_VELOCITY = 8
const MAX_UNDO_STATES = 10

interface Bubble {
  color: string
  row: number
  col: number
  id: string
  isNew?: boolean
  isMatched?: boolean
  isFloating?: boolean
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
  maxLife: number
  size: number
}

interface Position {
  x: number
  y: number
}

interface GameState {
  board: (Bubble | null)[][]
  score: number
  level: number
  movesLeft: number
  currentBubble: string
  nextBubble: string
  combo: number
  bubblesShot: number
  timestamp: number
}

interface BubbleShooterAdvancedProps {
  onBack: () => void
}

export default function BubbleShooterAdvanced({ onBack }: BubbleShooterAdvancedProps) {
  // Game state
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
  const [movesLeft, setMovesLeft] = useState<number>(50)
  const [gameOver, setGameOver] = useState<boolean>(false)
  const [gameWon, setGameWon] = useState<boolean>(false)
  const [combo, setCombo] = useState<number>(0)
  const [bubblesShot, setBubblesShot] = useState<number>(0)

  // Animation state
  const [particles, setParticles] = useState<Particle[]>([])
  const [scorePopups, setScorePopups] = useState<
    Array<{
      id: string
      x: number
      y: number
      score: number
      life: number
    }>
  >([])
  const [shakeIntensity, setShakeIntensity] = useState<number>(0)

  // Undo/Redo system
  const [undoStack, setUndoStack] = useState<GameState[]>([])
  const [redoStack, setRedoStack] = useState<GameState[]>([])
  const [canUndo, setCanUndo] = useState<boolean>(false)
  const [canRedo, setCanRedo] = useState<boolean>(false)

  const animationRef = useRef<number>()

  // Create explosion particles
  const createExplosion = useCallback((x: number, y: number, color: string, intensity = 1) => {
    const newParticles: Particle[] = []
    const particleCount = 8 * intensity

    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 * i) / particleCount
      const speed = 2 + Math.random() * 4
      newParticles.push({
        id: `particle-${Date.now()}-${i}`,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        life: 1,
        maxLife: 1,
        size: 3 + Math.random() * 4,
      })
    }

    setParticles((prev) => [...prev, ...newParticles])
  }, [])

  // Create score popup
  const createScorePopup = useCallback((x: number, y: number, points: number) => {
    const popup = {
      id: `score-${Date.now()}`,
      x,
      y,
      score: points,
      life: 1,
    }
    setScorePopups((prev) => [...prev, popup])
  }, [])

  // Trigger screen shake
  const triggerShake = useCallback((intensity: number) => {
    setShakeIntensity(intensity)
    setTimeout(() => setShakeIntensity(0), 300)
  }, [])

  // Create game state snapshot
  const createGameState = useCallback((): GameState => {
    return {
      board: gameBoard.map((row) => row.map((cell) => (cell ? { ...cell } : null))),
      score,
      level,
      movesLeft,
      currentBubble,
      nextBubble,
      combo,
      bubblesShot,
      timestamp: Date.now(),
    }
  }, [gameBoard, score, level, movesLeft, currentBubble, nextBubble, combo, bubblesShot])

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
    setGameBoard(state.board.map((row) => row.map((cell) => (cell ? { ...cell } : null))))
    setScore(state.score)
    setLevel(state.level)
    setMovesLeft(state.movesLeft)
    setCurrentBubble(state.currentBubble)
    setNextBubble(state.nextBubble)
    setCombo(state.combo)
    setBubblesShot(state.bubblesShot)
  }, [])

  // Undo last move
  const undoMove = useCallback(() => {
    if (undoStack.length === 0 || launchedBubble) return

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
  }, [undoStack, launchedBubble, createGameState, restoreGameState])

  // Redo last undone move
  const redoMove = useCallback(() => {
    if (redoStack.length === 0 || launchedBubble) return

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
  }, [redoStack, launchedBubble, createGameState, restoreGameState])

  // Initialize game
  const initializeGame = useCallback(() => {
    const board: (Bubble | null)[][] = Array(BOARD_HEIGHT)
      .fill(null)
      .map(() => Array(BOARD_WIDTH).fill(null))

    const initialRows = 6
    for (let row = 0; row < initialRows; row++) {
      for (let col = 0; col < BOARD_WIDTH; col++) {
        if (Math.random() < 0.75) {
          board[row][col] = {
            color: COLORS[Math.floor(Math.random() * COLORS.length)],
            row,
            col,
            id: `${row}-${col}-${Date.now()}-${Math.random()}`,
            isNew: true,
            animationDelay: (row * BOARD_WIDTH + col) * 50,
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
    setMovesLeft(50)
    setParticles([])
    setScorePopups([])

    // Reset undo/redo system
    setUndoStack([])
    setRedoStack([])
    setCanUndo(false)
    setCanRedo(false)

    // Remove new bubble animation after delay
    setTimeout(() => {
      setGameBoard((prev) => prev.map((row) => row.map((cell) => (cell ? { ...cell, isNew: false } : null))))
    }, 2000)
  }, [])

  // Get bubble position on screen (hexagonal grid)
  const getBubblePosition = (row: number, col: number): Position => {
    const offsetX = row % 2 === 0 ? 0 : BUBBLE_RADIUS + 1
    return {
      x: col * (BUBBLE_DIAMETER + 2) + BUBBLE_RADIUS + 10 + offsetX,
      y: row * (BUBBLE_DIAMETER - 4) + BUBBLE_RADIUS + 10,
    }
  }

  // Get grid position from screen coordinates
  const getGridPosition = (x: number, y: number): { row: number; col: number } => {
    const row = Math.round((y - BUBBLE_RADIUS - 10) / (BUBBLE_DIAMETER - 4))
    const offsetX = row % 2 === 0 ? 0 : BUBBLE_RADIUS + 1
    const col = Math.round((x - BUBBLE_RADIUS - 10 - offsetX) / (BUBBLE_DIAMETER + 2))
    return {
      row: Math.max(0, Math.min(BOARD_HEIGHT - 1, row)),
      col: Math.max(0, Math.min(BOARD_WIDTH - 1, col)),
    }
  }

  // Check collision between two bubbles
  const checkCollision = (pos1: Position, pos2: Position): boolean => {
    const dx = pos1.x - pos2.x
    const dy = pos1.y - pos2.y
    const distance = Math.sqrt(dx * dx + dy * dy)
    return distance < BUBBLE_DIAMETER - 2
  }

  // Get hexagonal neighbors
  const getHexNeighbors = (row: number, col: number): number[][] => {
    return row % 2 === 0
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
  }

  // Find cluster of same color bubbles (3 or more)
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

      const neighbors = getHexNeighbors(row, col)
      neighbors.forEach(([dr, dc]) => {
        stack.push({ x: col + dc, y: row + dr })
      })
    }

    return cluster
  }

  // Find bubbles connected to top (not floating)
  const findConnectedToTop = (board: (Bubble | null)[][]): Set<string> => {
    const connected = new Set<string>()
    const stack: Position[] = []

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

      const neighbors = getHexNeighbors(row, col)
      neighbors.forEach(([dr, dc]) => {
        stack.push({ x: col + dc, y: row + dr })
      })
    }

    return connected
  }

  // Remove floating bubbles (not connected to top)
  const removeFloatingBubbles = (board: (Bubble | null)[][]): { board: (Bubble | null)[][]; removed: number } => {
    const connected = findConnectedToTop(board)
    const newBoard = board.map((row) => [...row])
    let removed = 0

    for (let row = 0; row < BOARD_HEIGHT; row++) {
      for (let col = 0; col < BOARD_WIDTH; col++) {
        if (newBoard[row][col] && !connected.has(`${row}-${col}`)) {
          // Mark as floating for animation
          newBoard[row][col]!.isFloating = true

          // Create explosion effect
          const pos = getBubblePosition(row, col)
          createExplosion(pos.x, pos.y, newBoard[row][col]!.color, 0.5)

          setTimeout(() => {
            newBoard[row][col] = null
          }, 300)

          removed++
        }
      }
    }

    return { board: newBoard, removed }
  }

  // Find best position to place bubble
  const findBestPlacement = (
    board: (Bubble | null)[][],
    bubbleX: number,
    bubbleY: number,
  ): { row: number; col: number } | null => {
    const gridPos = getGridPosition(bubbleX, bubbleY)

    if (!board[gridPos.row][gridPos.col]) {
      return gridPos
    }

    const neighbors = getHexNeighbors(gridPos.row, gridPos.col)
    for (const [dr, dc] of neighbors) {
      const newRow = gridPos.row + dr
      const newCol = gridPos.col + dc
      if (newRow >= 0 && newRow < BOARD_HEIGHT && newCol >= 0 && newCol < BOARD_WIDTH && !board[newRow][newCol]) {
        return { row: newRow, col: newCol }
      }
    }

    return null
  }

  // Calculate trajectory and launch bubble
  const launchBubble = useCallback(
    (angle: number) => {
      if (launchedBubble || gameOver || gameWon || movesLeft <= 0) return

      saveGameState()

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
      setMovesLeft((prev) => prev - 1)
    },
    [launchedBubble, gameOver, gameWon, movesLeft, currentBubble, saveGameState],
  )

  // Update launched bubble position and handle collisions
  const updateLaunchedBubble = useCallback(() => {
    if (!launchedBubble) return

    const newBubble = { ...launchedBubble }
    newBubble.x += newBubble.vx
    newBubble.y += newBubble.vy

    // Wall collision - bounce off sides
    if (newBubble.x <= BUBBLE_RADIUS + 10 || newBubble.x >= GAME_WIDTH - BUBBLE_RADIUS - 10) {
      newBubble.vx = -newBubble.vx
      newBubble.x = Math.max(BUBBLE_RADIUS + 10, Math.min(GAME_WIDTH - BUBBLE_RADIUS - 10, newBubble.x))

      // Create spark effect on wall bounce
      createExplosion(newBubble.x, newBubble.y, "#FFFFFF", 0.3)
    }

    // Check collision with existing bubbles
    let collided = false
    let nearestBubble: { row: number; col: number } | null = null
    let minDistance = Number.POSITIVE_INFINITY

    for (let row = 0; row < BOARD_HEIGHT; row++) {
      for (let col = 0; col < BOARD_WIDTH; col++) {
        if (gameBoard[row][col]) {
          const bubblePos = getBubblePosition(row, col)
          const distance = Math.sqrt(Math.pow(newBubble.x - bubblePos.x, 2) + Math.pow(newBubble.y - bubblePos.y, 2))

          if (distance < BUBBLE_DIAMETER - 2) {
            collided = true
            if (distance < minDistance) {
              minDistance = distance
              nearestBubble = { row, col }
            }
          }
        }
      }
    }

    // Check if bubble reached top
    if (newBubble.y <= BUBBLE_RADIUS + 10 && !collided) {
      collided = true
      const gridPos = getGridPosition(newBubble.x, newBubble.y)
      nearestBubble = { row: 0, col: gridPos.col }
    }

    if (collided) {
      let placementPos: { row: number; col: number } | null = null

      if (nearestBubble) {
        const neighbors = getHexNeighbors(nearestBubble.row, nearestBubble.col)
        let bestPos: { row: number; col: number } | null = null
        let bestDistance = Number.POSITIVE_INFINITY

        for (const [dr, dc] of neighbors) {
          const newRow = nearestBubble.row + dr
          const newCol = nearestBubble.col + dc

          if (
            newRow >= 0 &&
            newRow < BOARD_HEIGHT &&
            newCol >= 0 &&
            newCol < BOARD_WIDTH &&
            !gameBoard[newRow][newCol]
          ) {
            const pos = getBubblePosition(newRow, newCol)
            const distance = Math.sqrt(Math.pow(newBubble.x - pos.x, 2) + Math.pow(newBubble.y - pos.y, 2))

            if (distance < bestDistance) {
              bestDistance = distance
              bestPos = { row: newRow, col: newCol }
            }
          }
        }

        placementPos = bestPos
      }

      if (!placementPos) {
        placementPos = findBestPlacement(gameBoard, newBubble.x, newBubble.y)
      }

      if (placementPos) {
        // Place bubble on board with animation
        const newBoard = gameBoard.map((row) => [...row])
        newBoard[placementPos.row][placementPos.col] = {
          color: newBubble.color,
          row: placementPos.row,
          col: placementPos.col,
          id: `${placementPos.row}-${placementPos.col}-${Date.now()}`,
          isNew: true,
        }

        // Remove new animation after delay
        setTimeout(() => {
          setGameBoard((prev) =>
            prev.map((row) =>
              row.map((cell) =>
                cell && cell.row === placementPos!.row && cell.col === placementPos!.col
                  ? { ...cell, isNew: false }
                  : cell,
              ),
            ),
          )
        }, 500)

        // Find cluster of same color (minimum 3 for removal)
        const cluster = findCluster(newBoard, placementPos.row, placementPos.col, newBubble.color)
        let newScore = score
        let newCombo = combo

        if (cluster.length >= 3) {
          // Mark bubbles as matched for animation
          cluster.forEach(({ x: col, y: row }) => {
            if (newBoard[row][col]) {
              newBoard[row][col]!.isMatched = true
            }
          })

          setGameBoard(newBoard)

          // Create explosions and score popups
          cluster.forEach(({ x: col, y: row }, index) => {
            const pos = getBubblePosition(row, col)
            setTimeout(() => {
              createExplosion(pos.x, pos.y, newBoard[row][col]!.color, 1)
              if (index === 0) {
                createScorePopup(pos.x, pos.y, cluster.length * 10)
              }
            }, index * 50)
          })

          // Remove matched bubbles after animation
          setTimeout(
            () => {
              cluster.forEach(({ x: col, y: row }) => {
                newBoard[row][col] = null
              })

              newCombo += 1
              newScore += cluster.length * 10 * newCombo

              // Remove floating bubbles
              const { board: finalBoard, removed } = removeFloatingBubbles(newBoard)
              if (removed > 0) {
                newScore += removed * 15 * Math.max(1, newCombo)
                triggerShake(0.5)
              }

              setGameBoard(finalBoard)
              setScore(newScore)
              setCombo(newCombo)

              // Check win condition
              const hasBubbles = finalBoard.some((row) => row.some((bubble) => bubble !== null))
              if (!hasBubbles) {
                setGameWon(true)
                setScore((prev) => prev + 1000 + movesLeft * 10)
                triggerShake(1)
              }

              // Check game over condition
              const bottomRows = finalBoard.slice(-3)
              const hasBottomBubbles = bottomRows.some((row) => row.some((bubble) => bubble !== null))
              if (hasBottomBubbles) {
                setGameOver(true)
              }
            },
            cluster.length * 50 + 200,
          )

          if (cluster.length >= 5) {
            triggerShake(0.3)
          }
        } else {
          setGameBoard(newBoard)
          setCombo(0)
        }

        setCurrentBubble(nextBubble)
        setNextBubble(COLORS[Math.floor(Math.random() * COLORS.length)])
        setLaunchedBubble(null)

        if (movesLeft <= 1) {
          setGameOver(true)
        }
      } else {
        setLaunchedBubble(newBubble)
      }
    } else {
      setLaunchedBubble(newBubble)
    }
  }, [launchedBubble, gameBoard, score, combo, nextBubble, movesLeft, createExplosion, createScorePopup, triggerShake])

  // Update particles and score popups
  const updateAnimations = useCallback(() => {
    // Update particles
    setParticles((prev) =>
      prev
        .map((particle) => ({
          ...particle,
          x: particle.x + particle.vx,
          y: particle.y + particle.vy,
          vy: particle.vy + 0.1, // gravity
          life: particle.life - 0.02,
        }))
        .filter((particle) => particle.life > 0),
    )

    // Update score popups
    setScorePopups((prev) =>
      prev
        .map((popup) => ({
          ...popup,
          y: popup.y - 1,
          life: popup.life - 0.02,
        }))
        .filter((popup) => popup.life > 0),
    )
  }, [])

  // Game loop
  useEffect(() => {
    const gameLoop = () => {
      updateLaunchedBubble()
      updateAnimations()
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
  }, [updateLaunchedBubble, updateAnimations, gameOver, gameWon])

  // Initialize game on mount
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
      }
    }

    window.addEventListener("keydown", handleKeyPress)
    return () => window.removeEventListener("keydown", handleKeyPress)
  }, [undoMove, redoMove])

  const accuracy = bubblesShot > 0 ? Math.round((score / (bubblesShot * 10)) * 100) : 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <Button
            onClick={onBack}
            className="bg-gray-600 hover:bg-gray-700 text-white font-bold px-6 py-3 rounded-full transform hover:scale-105 transition-all duration-200"
          >
            ← Back to Hub
          </Button>
          <h1 className="text-4xl font-bold text-white animate-pulse">🎯 Advanced Bubble Shooter</h1>
          <div className="flex gap-2">
            <Button
              onClick={undoMove}
              disabled={!canUndo || launchedBubble}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500 text-white font-bold px-4 py-2 rounded-full transform hover:scale-105 transition-all duration-200"
              title="Undo (Ctrl+Z)"
            >
              ↶ Undo
            </Button>
            <Button
              onClick={redoMove}
              disabled={!canRedo || launchedBubble}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-500 text-white font-bold px-4 py-2 rounded-full transform hover:scale-105 transition-all duration-200"
              title="Redo (Ctrl+Y)"
            >
              ↷ Redo
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
          <Card className="p-4 bg-white/10 backdrop-blur border-white/20 transform hover:scale-105 transition-all duration-200">
            <div className="text-white font-bold">Score</div>
            <div className="text-cyan-300 text-xl font-bold animate-pulse">{score.toLocaleString()}</div>
          </Card>
          <Card className="p-4 bg-white/10 backdrop-blur border-white/20 transform hover:scale-105 transition-all duration-200">
            <div className="text-white font-bold">Level</div>
            <div className="text-pink-300 text-xl font-bold">{level}</div>
          </Card>
          <Card className="p-4 bg-white/10 backdrop-blur border-white/20 transform hover:scale-105 transition-all duration-200">
            <div className="text-white font-bold">Moves Left</div>
            <div className={`text-xl font-bold ${movesLeft <= 10 ? "text-red-300 animate-bounce" : "text-yellow-300"}`}>
              {movesLeft}
            </div>
          </Card>
          <Card className="p-4 bg-white/10 backdrop-blur border-white/20 transform hover:scale-105 transition-all duration-200">
            <div className="text-white font-bold">Shots</div>
            <div className="text-orange-300 text-xl font-bold">{bubblesShot}</div>
          </Card>
          <Card className="p-4 bg-white/10 backdrop-blur border-white/20 transform hover:scale-105 transition-all duration-200">
            <div className="text-white font-bold">Combo</div>
            <div className={`text-xl font-bold ${combo > 0 ? "text-red-300 animate-pulse" : "text-red-300"}`}>
              x{combo}
            </div>
          </Card>
          <Card className="p-4 bg-white/10 backdrop-blur border-white/20 transform hover:scale-105 transition-all duration-200">
            <div className="text-white font-bold">Accuracy</div>
            <div className="text-green-300 text-xl font-bold">{accuracy}%</div>
          </Card>
        </div>

        {/* Undo/Redo Status */}
        <div className="flex justify-center gap-4 mb-4">
          {combo > 0 && (
            <Badge className="px-6 py-2 bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold text-lg animate-bounce">
              🔥 COMBO x{combo}!
            </Badge>
          )}
          <Badge className="px-4 py-2 bg-blue-500/20 text-blue-300 border border-blue-500/30 animate-pulse">
            Undo Stack: {undoStack.length}/{MAX_UNDO_STATES}
          </Badge>
          <Badge className="px-4 py-2 bg-green-500/20 text-green-300 border border-green-500/30 animate-pulse">
            Redo Stack: {redoStack.length}
          </Badge>
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
              style={{
                transform:
                  shakeIntensity > 0
                    ? `translate(${(Math.random() - 0.5) * shakeIntensity * 10}px, ${(Math.random() - 0.5) * shakeIntensity * 10}px)`
                    : "none",
                transition: shakeIntensity > 0 ? "none" : "transform 0.1s ease-out",
              }}
            >
              {/* Trajectory preview line */}
              <line
                x1={GAME_WIDTH / 2}
                y1={SHOOTER_Y}
                x2={GAME_WIDTH / 2 + Math.sin(shooterAngle) * 100}
                y2={SHOOTER_Y - Math.cos(shooterAngle) * 100}
                stroke="rgba(255,255,255,0.5)"
                strokeWidth="2"
                strokeDasharray="5,5"
                className="animate-pulse"
              />

              {/* Game board bubbles */}
              {gameBoard.map((row, rowIndex) =>
                row.map((bubble, colIndex) => {
                  if (!bubble) return null
                  const pos = getBubblePosition(rowIndex, colIndex)
                  return (
                    <g key={bubble.id}>
                      <circle
                        cx={pos.x}
                        cy={pos.y}
                        r={BUBBLE_RADIUS}
                        fill={bubble.color}
                        stroke="white"
                        strokeWidth="2"
                        className={`drop-shadow-lg ${
                          bubble.isNew
                            ? "animate-bounce"
                            : bubble.isMatched
                              ? "animate-ping"
                              : bubble.isFloating
                                ? "animate-pulse"
                                : "hover:animate-pulse"
                        }`}
                        style={{
                          animationDelay: bubble.animationDelay ? `${bubble.animationDelay}ms` : "0ms",
                          filter: bubble.isMatched ? "brightness(1.5)" : "none",
                        }}
                      />
                      {/* Glow effect for matched bubbles */}
                      {bubble.isMatched && (
                        <circle
                          cx={pos.x}
                          cy={pos.y}
                          r={BUBBLE_RADIUS + 5}
                          fill="none"
                          stroke={bubble.color}
                          strokeWidth="3"
                          opacity="0.5"
                          className="animate-ping"
                        />
                      )}
                    </g>
                  )
                }),
              )}

              {/* Particles */}
              {particles.map((particle) => (
                <circle
                  key={particle.id}
                  cx={particle.x}
                  cy={particle.y}
                  r={particle.size * particle.life}
                  fill={particle.color}
                  opacity={particle.life}
                />
              ))}

              {/* Score popups */}
              {scorePopups.map((popup) => (
                <text
                  key={popup.id}
                  x={popup.x}
                  y={popup.y}
                  textAnchor="middle"
                  fill="white"
                  fontSize="16"
                  fontWeight="bold"
                  opacity={popup.life}
                  className="animate-bounce"
                >
                  +{popup.score}
                </text>
              ))}

              {/* Launched bubble */}
              {launchedBubble && (
                <g>
                  <circle
                    cx={launchedBubble.x}
                    cy={launchedBubble.y}
                    r={BUBBLE_RADIUS}
                    fill={launchedBubble.color}
                    stroke="white"
                    strokeWidth="2"
                    className="drop-shadow-lg animate-pulse"
                  />
                  {/* Trail effect */}
                  <circle
                    cx={launchedBubble.x - launchedBubble.vx}
                    cy={launchedBubble.y - launchedBubble.vy}
                    r={BUBBLE_RADIUS * 0.7}
                    fill={launchedBubble.color}
                    opacity="0.5"
                  />
                  <circle
                    cx={launchedBubble.x - launchedBubble.vx * 2}
                    cy={launchedBubble.y - launchedBubble.vy * 2}
                    r={BUBBLE_RADIUS * 0.4}
                    fill={launchedBubble.color}
                    opacity="0.3"
                  />
                </g>
              )}

              {/* Shooter */}
              <g transform={`translate(${GAME_WIDTH / 2}, ${SHOOTER_Y})`}>
                <circle
                  cx="0"
                  cy="0"
                  r={BUBBLE_RADIUS + 5}
                  fill="gray"
                  stroke="white"
                  strokeWidth="3"
                  className="animate-pulse"
                />
                <circle
                  cx="0"
                  cy="0"
                  r={BUBBLE_RADIUS}
                  fill={currentBubble}
                  stroke="white"
                  strokeWidth="2"
                  className="hover:animate-bounce"
                />
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
                    className="animate-bounce"
                  >
                    {gameWon ? "🎉 You Won!" : "💥 Game Over!"}
                  </text>
                  <text x={GAME_WIDTH / 2} y={GAME_HEIGHT / 2 + 40} textAnchor="middle" fill="white" fontSize="20">
                    Final Score: {score.toLocaleString()}
                  </text>
                  <text x={GAME_WIDTH / 2} y={GAME_HEIGHT / 2 + 70} textAnchor="middle" fill="white" fontSize="16">
                    Accuracy: {accuracy}% • Moves Used: {50 - movesLeft}
                  </text>
                </>
              )}
            </svg>
          </Card>

          {/* Next bubble */}
          <Card className="ml-4 p-4 bg-white/10 backdrop-blur border-white/20 h-fit transform hover:scale-105 transition-all duration-200">
            <div className="text-white font-bold mb-2 text-center">Next</div>
            <div className="flex justify-center">
              <div
                className="w-12 h-12 rounded-full border-2 border-white animate-pulse hover:animate-bounce"
                style={{ backgroundColor: nextBubble }}
              />
            </div>
          </Card>
        </div>

        {/* Controls */}
        <div className="flex justify-center gap-4 mt-6">
          <Button
            onClick={resetGame}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-8 py-3 rounded-full transform hover:scale-105 transition-all duration-200"
          >
            🎮 New Game
          </Button>
        </div>

        {/* Instructions */}
        <Card className="mt-6 p-4 bg-white/10 backdrop-blur border-white/20 transform hover:scale-105 transition-all duration-200">
          <div className="text-center text-white/80 text-sm">
            <p className="font-semibold mb-2">🎯 How to Play:</p>
            <p>Move mouse to aim • Click to shoot • Match 3+ bubbles to clear them • Limited moves!</p>
            <p className="mt-1">
              <strong>Undo/Redo:</strong> Use buttons or Ctrl+Z (undo) / Ctrl+Y (redo) • Strategic planning enabled!
            </p>
          </div>
        </Card>
      </div>
    </div>
  )
}
