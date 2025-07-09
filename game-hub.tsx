"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import ElementBlocks from "./element-blocks"
import GardenBloom from "./garden-bloom"
import ColorFill3D from "./color-fill-3d"
import BubbleShooterAdvanced from "./bubble-shooter-advanced"

type GameType = "menu" | "bubble-shooter" | "element-blocks" | "garden-bloom" | "color-fill-3d"

const games = [
  {
    id: "bubble-shooter" as GameType,
    title: "3D Bubble Shooter Pro",
    description: "Match colorful bubbles in this enhanced 3D shooter with undo/redo functionality",
    icon: "🎯",
    gradient: "from-blue-500 to-purple-600",
    features: ["3D Graphics", "Undo/Redo", "Fast Speed", "Combo System"],
  },
  {
    id: "element-blocks" as GameType,
    title: "Element Blocks",
    description: "Strategic block puzzle where you match elements to clear the board",
    icon: "🧩",
    gradient: "from-green-500 to-teal-600",
    features: ["Strategy", "Elements", "Block Puzzle", "Chain Reactions"],
  },
  {
    id: "garden-bloom" as GameType,
    title: "Garden Bloom",
    description: "Beautiful match-3 garden game where you help flowers bloom",
    icon: "🌸",
    gradient: "from-pink-500 to-rose-600",
    features: ["Match-3", "Garden Theme", "Flower Power", "Seasonal Events"],
  },
  {
    id: "color-fill-3d" as GameType,
    title: "Color Fill 3D",
    description: "Satisfying 3D color-filling game with beautiful shapes and patterns",
    icon: "🎨",
    gradient: "from-orange-500 to-red-600",
    features: ["3D Shapes", "Color Filling", "Relaxing", "Creative"],
  },
]

export default function GameHub() {
  const [currentGame, setCurrentGame] = useState<GameType>("menu")

  const renderGame = () => {
    switch (currentGame) {
      case "bubble-shooter":
        return <BubbleShooterAdvanced onBack={() => setCurrentGame("menu")} />
      case "element-blocks":
        return <ElementBlocks onBack={() => setCurrentGame("menu")} />
      case "garden-bloom":
        return <GardenBloom onBack={() => setCurrentGame("menu")} />
      case "color-fill-3d":
        return <ColorFill3D onBack={() => setCurrentGame("menu")} />
      default:
        return (
          <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
            {/* Animated Background */}
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute top-20 left-20 w-32 h-32 bg-blue-500 rounded-full blur-3xl animate-pulse opacity-20"></div>
              <div className="absolute top-40 right-32 w-24 h-24 bg-purple-500 rounded-full blur-2xl animate-pulse delay-1000 opacity-20"></div>
              <div className="absolute bottom-32 left-1/3 w-40 h-40 bg-pink-500 rounded-full blur-3xl animate-pulse delay-2000 opacity-20"></div>
              <div className="absolute bottom-20 right-20 w-28 h-28 bg-green-500 rounded-full blur-2xl animate-pulse delay-3000 opacity-20"></div>
            </div>

            <div className="max-w-6xl mx-auto relative z-10">
              {/* Header */}
              <div className="text-center mb-12">
                <h1 className="text-6xl font-bold text-white mb-4 bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent drop-shadow-2xl">
                  🎮 Game Hub Pro
                </h1>
                <p className="text-xl text-white/80 mb-6">
                  Experience premium gaming with stunning 3D graphics and advanced features
                </p>
                <Badge className="px-6 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold text-lg">
                  ✨ 4 Amazing Games Available
                </Badge>
              </div>

              {/* Games Grid */}
              <div className="grid md:grid-cols-2 gap-8 mb-12">
                {games.map((game) => (
                  <Card
                    key={game.id}
                    className="p-8 bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border-white/20 shadow-2xl rounded-3xl hover:scale-105 transition-all duration-300 cursor-pointer group"
                    onClick={() => setCurrentGame(game.id)}
                  >
                    <div className="text-center">
                      <div className="text-6xl mb-4 group-hover:scale-110 transition-transform duration-300">
                        {game.icon}
                      </div>
                      <h3 className="text-2xl font-bold text-white mb-3">{game.title}</h3>
                      <p className="text-white/70 mb-6 leading-relaxed">{game.description}</p>

                      {/* Features */}
                      <div className="flex flex-wrap justify-center gap-2 mb-6">
                        {game.features.map((feature) => (
                          <Badge key={feature} className="px-3 py-1 bg-white/20 text-white/90 text-sm">
                            {feature}
                          </Badge>
                        ))}
                      </div>

                      <Button
                        className={`w-full bg-gradient-to-r ${game.gradient} hover:scale-105 text-white font-bold py-3 px-6 rounded-full shadow-lg transition-all duration-300`}
                      >
                        Play Now →
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>

              {/* Features Section */}
              <Card className="p-8 bg-gradient-to-br from-white/5 to-white/10 backdrop-blur-xl border-white/20 shadow-2xl rounded-3xl">
                <h2 className="text-3xl font-bold text-white text-center mb-8">🌟 Platform Features</h2>
                <div className="grid md:grid-cols-3 gap-6">
                  <div className="text-center">
                    <div className="text-4xl mb-3">🎨</div>
                    <h3 className="text-xl font-bold text-white mb-2">Stunning 3D Graphics</h3>
                    <p className="text-white/70">Advanced visual effects and smooth animations</p>
                  </div>
                  <div className="text-center">
                    <div className="text-4xl mb-3">⚡</div>
                    <h3 className="text-xl font-bold text-white mb-2">High Performance</h3>
                    <p className="text-white/70">Optimized for 60fps gameplay experience</p>
                  </div>
                  <div className="text-center">
                    <div className="text-4xl mb-3">🏆</div>
                    <h3 className="text-xl font-bold text-white mb-2">Advanced Features</h3>
                    <p className="text-white/70">Undo/redo, combos, and smart game mechanics</p>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )
    }
  }

  return renderGame()
}
