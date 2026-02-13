"use client"

import { useRef, useEffect } from "react"

interface HeatZone {
  x: number
  y: number
  intensity: number
  radius: number
}

interface BasketballCourtProps {
  heatZones?: HeatZone[]
  shotDots?: { x: number; y: number; made: boolean }[]
  className?: string
  variant?: "heatmap" | "shotchart" | "defensive"
  defensiveZones?: { zone: string; percentage: number }[]
}

export function BasketballCourt({
  heatZones,
  shotDots,
  className = "",
  variant = "heatmap",
  defensiveZones,
}: BasketballCourtProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const w = canvas.width
    const h = canvas.height

    ctx.clearRect(0, 0, w, h)

    // Draw court background
    ctx.fillStyle = "#0f1923"
    ctx.fillRect(0, 0, w, h)

    // Draw court lines
    ctx.strokeStyle = "rgba(255, 255, 255, 0.12)"
    ctx.lineWidth = 1.5

    // Court boundary
    ctx.strokeRect(w * 0.1, h * 0.05, w * 0.8, h * 0.9)

    // Paint area
    const paintLeft = w * 0.32
    const paintRight = w * 0.68
    const paintTop = h * 0.05
    const paintHeight = h * 0.45
    ctx.strokeRect(paintLeft, paintTop, paintRight - paintLeft, paintHeight)

    // Free throw circle
    ctx.beginPath()
    ctx.arc(w * 0.5, paintTop + paintHeight, w * 0.12, 0, Math.PI)
    ctx.stroke()

    // Center circle
    ctx.beginPath()
    ctx.arc(w * 0.5, h * 0.95, w * 0.12, Math.PI, 0)
    ctx.stroke()

    // Three point arc
    ctx.beginPath()
    ctx.moveTo(w * 0.12, h * 0.05)
    ctx.lineTo(w * 0.12, h * 0.3)
    ctx.arc(w * 0.5, h * 0.05, w * 0.38, Math.PI - 0.3, 0.3)
    ctx.lineTo(w * 0.88, h * 0.05)
    ctx.stroke()

    // Basket
    ctx.beginPath()
    ctx.arc(w * 0.5, h * 0.12, 4, 0, Math.PI * 2)
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)"
    ctx.stroke()

    // Backboard
    ctx.beginPath()
    ctx.moveTo(w * 0.44, h * 0.08)
    ctx.lineTo(w * 0.56, h * 0.08)
    ctx.strokeStyle = "rgba(255, 255, 255, 0.25)"
    ctx.lineWidth = 2
    ctx.stroke()

    if (variant === "heatmap" && heatZones) {
      heatZones.forEach((zone) => {
        const grd = ctx.createRadialGradient(
          w * (zone.x / 100),
          h * (zone.y / 100),
          0,
          w * (zone.x / 100),
          h * (zone.y / 100),
          zone.radius * 1.5
        )
        const alpha = zone.intensity * 0.7
        grd.addColorStop(0, `rgba(255, 80, 20, ${alpha})`)
        grd.addColorStop(0.5, `rgba(255, 40, 10, ${alpha * 0.5})`)
        grd.addColorStop(1, "rgba(255, 40, 10, 0)")
        ctx.fillStyle = grd
        ctx.fillRect(0, 0, w, h)
      })
    }

    if (variant === "shotchart" && shotDots) {
      shotDots.forEach((dot) => {
        ctx.beginPath()
        ctx.arc(w * (dot.x / 100), h * (dot.y / 100), 5, 0, Math.PI * 2)
        ctx.fillStyle = dot.made
          ? "hsl(217, 91%, 60%)"
          : "rgba(150, 150, 150, 0.5)"
        ctx.fill()
        if (dot.made) {
          ctx.strokeStyle = "rgba(255, 255, 255, 0.3)"
          ctx.lineWidth = 1
          ctx.stroke()
        }
      })
    }

    if (variant === "defensive" && defensiveZones) {
      // Right wing zone
      ctx.fillStyle = "rgba(200, 120, 50, 0.5)"
      ctx.fillRect(w * 0.75, h * 0.1, w * 0.13, h * 0.45)

      // Paint zone
      ctx.fillStyle = "rgba(200, 120, 50, 0.35)"
      ctx.fillRect(w * 0.35, h * 0.55, w * 0.3, h * 0.25)

      // Zone labels
      ctx.font = "bold 12px Inter, sans-serif"
      ctx.fillStyle = "#fff"
      ctx.textAlign = "center"
      if (defensiveZones[0]) {
        ctx.fillText(`${defensiveZones[0].percentage}%`, w * 0.815, h * 0.35)
      }
      if (defensiveZones[1]) {
        ctx.fillText(`${defensiveZones[1].percentage}%`, w * 0.5, h * 0.7)
      }
    }
  }, [heatZones, shotDots, variant, defensiveZones])

  return (
    <canvas
      ref={canvasRef}
      width={500}
      height={600}
      className={`w-full h-full ${className}`}
      style={{ imageRendering: "auto" }}
    />
  )
}
