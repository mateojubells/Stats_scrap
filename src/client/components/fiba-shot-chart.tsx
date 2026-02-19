"use client"

/* ═══════════════════════════════════════════════════════════════════════════
   FIBA HALF-COURT SHOT MAP — GEOMETRICALLY ACCURATE SVG
   ═══════════════════════════════════════════════════════════════════════════
   
   COORDINATE SYSTEM:
     DATA (from backend after rotation):
       • X_data ∈ [0, 100]  → Width (0=left, 50=center, 100=right)
       • Y_data ∈ [0, 50]   → Depth (0=baseline, 50=halfcourt)
     
     SVG (viewBox="0 0 100 94"):
       • X_svg ∈ [0, 100]   → Width (direct mapping)
       • Y_svg ∈ [0, 94]    → Depth (0=halfcourt, 94=baseline) INVERTED!
   
   TRANSFORMATION:
     x_svg = shot.x_coordinate                  // Direct
     y_svg = 94 - (shot.y_coordinate × 1.88)    // Inverted & scaled (94/50 = 1.88)
   
   FIBA GEOMETRY (viewBox 100×94, proportional to 15m × 14.1m):
     ┌──────────────────────────────────────────────────────────────────────┐
     │ Basket:         (50, 88.25) — 5.75 units from baseline              │
     │ 3PT Arc:        Center (50, 88.25), radius 44.65                     │
     │ 3PT Corners:    X = 6.6 and X = 93.4 (6.6 units from sidelines)     │
     │ Paint width:    X ∈ [33.67, 66.33] (32.66 units wide)               │
     │ Paint depth:    Y ∈ [57, 94] (37 units deep from baseline)          │
     │ Free-throw:     Center (50, 57), radius 12                           │
     │ Restricted:     Center (50, 88.25), radius 8.33                      │
     └──────────────────────────────────────────────────────────────────────┘
   
   ASPECT RATIO:
     Container enforces aspect-[15/14] (almost square) to prevent compression
   
   ═══════════════════════════════════════════════════════════════════════════ */

interface ShotDot {
  x: number
  y: number
  made: boolean
  x_data?: number  // Original data coordinates for tooltip
  y_data?: number
  zone?: string
}

interface FibaShotChartProps {
  shots: ShotDot[]
  className?: string
}

export function FibaShotChart({ shots, className = "" }: FibaShotChartProps) {
  // ══════════════════════════════════════════════════════════════════════════
  // COORDINATE TRANSFORMATION: Data space → SVG space
  // ══════════════════════════════════════════════════════════════════════════
  
  const toSvgX = (dataX: number) => dataX  // Direct mapping [0,100] → [0,100]
  const toSvgY = (dataY: number) => 94 - (dataY * 1.88)  // Inverted: [0,50] → [94,0]

  // ══════════════════════════════════════════════════════════════════════════
  // FIBA GEOMETRY CONSTANTS (in SVG coordinate space)
  // ══════════════════════════════════════════════════════════════════════════
  
  const BASKET = { x: 50, y: 88.25 }
  const PAINT = { left: 33.67, right: 66.33, top: 57, bottom: 94 }
  const THREE_PT = {
    arcCenter: { x: 55, y: 57 },
    arcRadius: 39,
    cornerX_L: 10,
    cornerX_R: 90,
    cornerY_top: 60,  // Where corner line meets arc (top point)
    connectY: 75,  // Y where corner lines connect
  }
  const FREE_THROW = { center: { x: 50, y: 57 }, radius: 12 }
  const RESTRICTED = { center: { x: 50, y: 88.25 }, radius: 8.33 }
  const BACKBOARD = { left: 44, right: 56, y: 91 }
  const RIM_RADIUS = 2

  // ══════════════════════════════════════════════════════════════════════════
  // PATH GENERATORS
  // ══════════════════════════════════════════════════════════════════════════

  // Three-point arc: Draw arc from left corner to right corner
  const threePtArcPath = () => {
    const { x: cx, y: cy } = THREE_PT.arcCenter
    const r = THREE_PT.arcRadius
    const leftX = THREE_PT.cornerX_L
    const rightX = THREE_PT.cornerX_R
    const arcTop = THREE_PT.cornerY_top

    return `
      M ${leftX} ${arcTop}
      A ${r} ${r} 0 0 1 ${rightX} ${arcTop}
    `
  }

  // Small connector arc from 3pt line to corner lines
  const connectorArcPath = () => {
    const leftX = THREE_PT.cornerX_L
    const rightX = THREE_PT.cornerX_R
    const connectY = THREE_PT.connectY
    const r = (rightX - leftX) / 2  // radius for the connecting arc
    
    return `
      M ${leftX} ${connectY}
      A ${r} ${r} 0 0 1 ${rightX} ${connectY}
    `
  }

  // Helper to get connection Y
  const getConnectionY = () => THREE_PT.connectY

  // Free-throw circle (bottom semicircle only)
  const freeThrowArcPath = () => {
    const { x, y } = FREE_THROW.center
    const r = FREE_THROW.radius
    return `
      M ${x - r} ${y}
      A ${r} ${r} 0 0 1 ${x + r} ${y}
    `
  }

  // Restricted area (top semicircle only, facing towards baseline)
  const restrictedAreaPath = () => {
    const { x, y } = RESTRICTED.center
    const r = RESTRICTED.radius
    return `
      M ${x - r} ${y}
      A ${r} ${r} 0 0 0 ${x + r} ${y}
    `
  }

  // Center circle at halfcourt (bottom semicircle only)
  const centerCirclePath = () => {
    const x = 50
    const y = 0
    const r = 12
    return `
      M ${x - r} ${y}
      A ${r} ${r} 0 0 1 ${x + r} ${y}
    `
  }

  return (
    <div className={`w-full aspect-[15/14] ${className}`}>
      <svg
        viewBox="0 0 100 94"
        className="w-full h-full"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* ═══════════════════════════════════════════════════════════════════
            SVG FILTERS: Glow effects for made/missed shots
            ═══════════════════════════════════════════════════════════════════ */}
        <defs>
          <filter id="glow-green" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="0.8" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <filter id="glow-red" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="0.6" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* ═══════════════════════════════════════════════════════════════════
            BACKGROUND
            ═══════════════════════════════════════════════════════════════════ */}
        <rect x="0" y="0" width="100" height="94" fill="#0a1018" />

        {/* ═══════════════════════════════════════════════════════════════════
            COURT PERIMETER
            ═══════════════════════════════════════════════════════════════════ */}
        <g stroke="rgba(255, 255, 255, 0.4)" strokeWidth="0.5" fill="none">
          <rect x="0" y="0" width="100" height="94" />
        </g>

        {/* ═══════════════════════════════════════════════════════════════════
            PAINT / KEY AREA
            ═══════════════════════════════════════════════════════════════════ */}
        <g stroke="rgba(255, 255, 255, 0.35)" strokeWidth="0.45" fill="none">
          {/* Paint rectangle */}
          <rect
            x={PAINT.left}
            y={PAINT.top}
            width={PAINT.right - PAINT.left}
            height={PAINT.bottom - PAINT.top}
          />

          {/* Free-throw circle (bottom semicircle) */}
          <path d={freeThrowArcPath()} />

          {/* Free-throw line (dashed) */}
          <line
            x1={FREE_THROW.center.x - FREE_THROW.radius}
            y1={FREE_THROW.center.y}
            x2={FREE_THROW.center.x + FREE_THROW.radius}
            y2={FREE_THROW.center.y}
            strokeDasharray="1,1"
            opacity="0.4"
          />
        </g>

        {/* ═══════════════════════════════════════════════════════════════════
            THREE-POINT LINE (MOST IMPORTANT — HIGH CONTRAST)
            ═══════════════════════════════════════════════════════════════════ */}
        <g stroke="rgba(255, 255, 255, 0.65)" strokeWidth="0.6" fill="none">
          {/* Connector arc at y: 85 */}
          <path d={connectorArcPath()} />

          {/* Left corner line - from y: 85 to baseline */}
          <line
            x1={THREE_PT.cornerX_L}
            y1={getConnectionY()}
            x2={THREE_PT.cornerX_L}
            y2="94"
          />

          {/* Right corner line - from y: 85 to baseline */}
          <line
            x1={THREE_PT.cornerX_R}
            y1={getConnectionY()}
            x2={THREE_PT.cornerX_R}
            y2="94"
          />
        </g>

        {/* ═══════════════════════════════════════════════════════════════════
            BASKET & BACKBOARD
            ═══════════════════════════════════════════════════════════════════ */}
        <g>
          {/* Backboard */}
          <line
            x1={BACKBOARD.left}
            y1={BACKBOARD.y}
            x2={BACKBOARD.right}
            y2={BACKBOARD.y}
            stroke="rgba(255, 255, 255, 0.6)"
            strokeWidth="0.8"
            strokeLinecap="round"
          />

          {/* Rim */}
          <circle
            cx={BASKET.x}
            cy={BASKET.y}
            r={RIM_RADIUS}
            stroke="rgba(255, 160, 40, 0.95)"
            strokeWidth="0.6"
            fill="none"
          />

          {/* Restricted area (semicircle above basket) */}
          <path
            d={restrictedAreaPath()}
            stroke="rgba(255, 255, 255, 0.3)"
            strokeWidth="0.4"
            fill="none"
          />
        </g>

        {/* ═══════════════════════════════════════════════════════════════════
            CENTER CIRCLE (at halfcourt Y=0)
            ═══════════════════════════════════════════════════════════════════ */}
        <path
          d={centerCirclePath()}
          stroke="rgba(255, 255, 255, 0.35)"
          strokeWidth="0.4"
          fill="none"
        />

        {/* ═══════════════════════════════════════════════════════════════════
            SHOT MARKERS (Small, semi-transparent, with border)
            ═══════════════════════════════════════════════════════════════════ */}
        <g>
          {shots.map((shot, idx) => {
            const svgX = toSvgX(shot.x)
            const svgY = toSvgY(shot.y)

            const fill = shot.made
              ? "#39FF14"   // Verde Neón
              : "#FF3131"   // Rojo Neón

            const filter = shot.made ? "url(#glow-green)" : "url(#glow-red)"

            const tooltipText = `x: ${shot.x_data?.toFixed(2) ?? shot.x.toFixed(2)}, y: ${shot.y_data?.toFixed(2) ?? shot.y.toFixed(2)}${shot.zone ? ` [${shot.zone}]` : ''}`

            return (
              <g key={idx}>
                <title>{tooltipText}</title>
                <circle
                  cx={svgX}
                  cy={svgY}
                  r={0.8}
                  fill={fill}
                  stroke="rgba(255, 255, 255, 0.4)"
                  strokeWidth={0.25}
                  opacity={0.8}
                  filter={filter}
                  style={{ cursor: "pointer" }}
                />
              </g>
            )
          })}
        </g>
      </svg>
    </div>
  )
}
