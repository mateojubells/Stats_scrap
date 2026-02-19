"use client"

import { useState, useRef, useEffect } from "react"
import { FibaShotChart } from "@/components/fiba-shot-chart"

/**
 * DEBUG PAGE: Interactive shot chart to find zone boundaries
 * Click anywhere on the court to log coordinates
 */
export default function DebugPage() {
  const svgRef = useRef<SVGSVGElement>(null)
  const [clickCount, setClickCount] = useState(0)

  // Coordinate transformation functions (matching FibaShotChart)
  const toSvgY = (dataY: number) => 94 - dataY * 1.88
  const toDataX = (svgX: number) => svgX
  const toDataY = (svgY: number) => (94 - svgY) / 1.88

  const handleSvgClick = (event: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return

    // Get SVG element dimensions
    const svg = svgRef.current
    const rect = svg.getBoundingClientRect()

    // Get click position in viewport
    const clickX = event.clientX - rect.left
    const clickY = event.clientY - rect.top

    // Get SVG viewBox
    const viewBox = svg.viewBox.baseVal
    const scaleX = viewBox.width / rect.width
    const scaleY = viewBox.height / rect.height

    // Convert click to SVG coordinates
    const svgX = clickX * scaleX + viewBox.x
    const svgY = clickY * scaleY + viewBox.y

    // Convert SVG to data coordinates
    const dataX = toDataX(svgX)
    const dataY = toDataY(svgY)

    // Log to console
    const logEntry = {
      click: clickCount + 1,
      svgCoordinates: { x: svgX.toFixed(2), y: svgY.toFixed(2) },
      dataCoordinates: { x: dataX.toFixed(2), y: dataY.toFixed(2) },
      timestamp: new Date().toLocaleTimeString(),
    }

    console.log("═══════════════════════════════════════════════════════════")
    console.log(`CLICK #${clickCount + 1}`)
    console.log("───────────────────────────────────────────────────────────")
    console.log(`SVG Coords:  x=${svgX.toFixed(2)}, y=${svgY.toFixed(2)}`)
    console.log(`Data Coords: x=${dataX.toFixed(2)}, y=${dataY.toFixed(2)}`)
    console.log("───────────────────────────────────────────────────────────")

    // Also log as JSON for easy copy-paste
    console.log("JSON:", JSON.stringify(logEntry, null, 2))

    setClickCount((c) => c + 1)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            🔍 Debug: Shot Chart Zones
          </h1>
          <p className="text-gray-400 text-lg">
            Click on the court to capture coordinates and find zone boundaries.
            Check your browser console for detailed logs.
          </p>
        </div>

        {/* Main content grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Shot Chart - takes 2/3 of space on large screens */}
          <div className="lg:col-span-2">
            <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 shadow-2xl">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <span className="text-2xl">🏀</span>
                Court (Click to Capture)
              </h2>

              {/* Interactive SVG wrapper */}
              <div className="bg-slate-900 rounded-lg overflow-hidden">
                <svg
                  ref={svgRef}
                  viewBox="0 0 100 94"
                  className="w-full h-auto cursor-crosshair"
                  preserveAspectRatio="xMidYMid meet"
                  onClick={handleSvgClick}
                  style={{ minHeight: "500px" }}
                >
                  {/* Background */}
                  <rect x="0" y="0" width="100" height="94" fill="#0a1018" />

                  {/* Court perimeter */}
                  <g stroke="rgba(255, 255, 255, 0.4)" strokeWidth="0.5" fill="none">
                    <rect x="0" y="0" width="100" height="94" />
                  </g>

                  {/* Paint */}
                  <g stroke="rgba(255, 255, 255, 0.35)" strokeWidth="0.45" fill="none">
                    <rect
                      x={33.67}
                      y={57}
                      width={66.33 - 33.67}
                      height={94 - 57}
                    />
                    <path d="M 38 57 A 12 12 0 0 1 62 57" />
                    <line
                      x1={38}
                      y1={57}
                      x2={62}
                      y2={57}
                      strokeDasharray="1,1"
                      opacity="0.4"
                    />
                  </g>

                  {/* Three-point line */}
                  <g stroke="rgba(255, 255, 255, 0.65)" strokeWidth="0.6" fill="none">
                    {/* Connector arc */}
                    <path d="M 10 75 A 40 40 0 0 1 90 75" />
                    {/* Corner lines */}
                    <line x1={10} y1={75} x2={10} y2={94} />
                    <line x1={90} y1={75} x2={90} y2={94} />
                  </g>

                  {/* Basket & backboard */}
                  <g>
                    <line
                      x1={44}
                      y1={91}
                      x2={56}
                      y2={91}
                      stroke="rgba(255, 160, 40, 0.95)"
                      strokeWidth="0.8"
                      strokeLinecap="round"
                    />
                    <circle
                      cx={50}
                      cy={88.25}
                      r={2}
                      stroke="rgba(255, 160, 40, 0.95)"
                      strokeWidth="0.6"
                      fill="none"
                    />
                    <path
                      d="M 41.67 88.25 A 8.33 8.33 0 0 0 58.33 88.25"
                      stroke="rgba(255, 255, 255, 0.3)"
                      strokeWidth="0.4"
                      fill="none"
                    />
                  </g>

                  {/* Center circle */}
                  <path
                    d="M 38 0 A 12 12 0 0 1 62 0"
                    stroke="rgba(255, 255, 255, 0.35)"
                    strokeWidth="0.4"
                    fill="none"
                  />

                  {/* Grid overlay (optional - helps visualize scale) */}
                  <g stroke="rgba(255, 255, 255, 0.05)" strokeWidth="0.3">
                    {/* Vertical lines every 10 units */}
                    {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((x) => (
                      <line key={`v${x}`} x1={x} y1={0} x2={x} y2={94} />
                    ))}
                    {/* Horizontal lines every 10 units */}
                    {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90].map((y) => (
                      <line key={`h${y}`} x1={0} y1={y} x2={100} y2={y} />
                    ))}
                  </g>
                </svg>
              </div>

              <p className="text-xs text-gray-500 mt-4 text-center">
                Cursor changes to crosshair when hovering over the court
              </p>
            </div>
          </div>

          {/* Info Panel */}
          <div className="lg:col-span-1">
            <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 shadow-2xl h-full flex flex-col">
              <h2 className="text-xl font-semibold text-white mb-4">📊 Statistics</h2>

              <div className="space-y-4 flex-1">
                {/* Click counter */}
                <div className="bg-slate-700 rounded-lg p-4">
                  <div className="text-gray-400 text-sm mb-1">Total Clicks</div>
                  <div className="text-4xl font-bold text-blue-400">{clickCount}</div>
                </div>

                {/* Zone reference */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-300 mb-3">
                    Zone Boundaries (Data coords)
                  </h3>
                  <div className="space-y-2 text-xs text-gray-400">
                    <div className="bg-slate-700 p-2 rounded">
                      <div className="font-mono text-amber-300 mb-1">🎯 PAINT</div>
                      <div>X: [33.6, 66.2]</div>
                      <div>Y: [0, 19.8]</div>
                    </div>
                    <div className="bg-slate-700 p-2 rounded">
                      <div className="font-mono text-purple-300 mb-1">3️⃣ THREE POINT</div>
                      <div>Distance ~23.75m</div>
                    </div>
                    <div className="bg-slate-700 p-2 rounded">
                      <div className="font-mono text-cyan-300 mb-1">🔄 MID-RANGE</div>
                      <div>Between 3pt and paint</div>
                    </div>
                  </div>
                </div>

                {/* Instructions */}
                <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-3 text-xs text-blue-200">
                  <strong>💡 How to use:</strong>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>Click on zones to find exact boundaries</li>
                    <li>Check browser console for logs</li>
                    <li>Use the grid overlay to orient yourself</li>
                  </ul>
                </div>
              </div>

              {/* Console tip */}
              <div className="mt-4 pt-4 border-t border-slate-600 text-xs text-gray-400">
                <p>
                  <strong className="text-gray-300">Pro Tip:</strong> Open DevTools (F12)
                  and go to the Console tab to see detailed logs.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>
            Data coordinates: X ∈ [0, 100] (width), Y ∈ [0, 50] (depth from baseline)
          </p>
        </div>
      </div>
    </div>
  )
}
