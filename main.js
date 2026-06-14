import { CANVAS_W, CANVAS_H, C } from './constants.js'

// ─── Animated Background ──────────────────────────────────────────────────────

export class Background {
  constructor() {
    this.time    = 0
    this.pulse   = 0       // 0-1, driven by combo
    this.urgency = 0       // 0-1, ramps up in last 10s
    this.shake   = { x: 0, y: 0, decay: 0 }

    // Grid lines: perspective grid converging to center
    this.gridLines = this._buildGrid()

    // Floating particles (ambient)
    this.ambient = Array.from({ length: 40 }, () => this._newAmbient())

    // Scan line state
    this.scanY = 0
  }

  _buildGrid() {
    const lines = []
    const cx = CANVAS_W / 2, cy = CANVAS_H * 0.42
    const cols = 10, rows = 8
    for (let i = 0; i <= cols; i++) {
      const t = i / cols
      const x = t * CANVAS_W
      lines.push({ type: 'col', x0: x, y0: 0, x1: cx, y1: cy })
    }
    for (let j = 1; j <= rows; j++) {
      const t = j / rows
      const y = cy + (CANVAS_H - cy) * (t * t)  // perspective spacing
      lines.push({ type: 'row', y })
    }
    return lines
  }

  _newAmbient() {
    return {
      x: Math.random() * CANVAS_W,
      y: Math.random() * CANVAS_H,
      vy: -(0.2 + Math.random() * 0.5),
      vx: (Math.random() - 0.5) * 0.2,
      size: 1 + Math.random() * 2,
      alpha: 0.1 + Math.random() * 0.4,
      color: Math.random() < 0.7 ? '#00d4ff' : '#7c3aed',
    }
  }

  triggerShake(intensity = 6) {
    this.shake.decay = intensity
  }

  setPulse(combo) {
    // Pulse intensity rises with combo
    this.pulse = Math.min(1, combo / 10)
  }

  setUrgency(t) {
    this.urgency = Math.max(0, Math.min(1, (10 - t) / 10))
  }

  update(dt) {
    this.time += dt

    // Shake
    if (this.shake.decay > 0) {
      this.shake.x = (Math.random() - 0.5) * this.shake.decay
      this.shake.y = (Math.random() - 0.5) * this.shake.decay
      this.shake.decay *= 0.78
      if (this.shake.decay < 0.3) this.shake.decay = 0
    } else {
      this.shake.x = 0; this.shake.y = 0
    }

    // Scan line
    this.scanY = (this.scanY + 1.5 + this.urgency * 2) % CANVAS_H

    // Ambient particles
    for (const p of this.ambient) {
      p.x += p.vx; p.y += p.vy
      if (p.y < -5) { p.y = CANVAS_H + 5; p.x = Math.random() * CANVAS_W }
    }
  }

  draw(ctx) {
    const { x: sx, y: sy } = this.shake

    ctx.save()
    ctx.translate(sx, sy)

    // Base background gradient
    const bg = ctx.createRadialGradient(CANVAS_W/2, CANVAS_H*0.4, 0, CANVAS_W/2, CANVAS_H/2, CANVAS_H*0.75)
    bg.addColorStop(0, '#0d1528')
    bg.addColorStop(0.5, '#080d1a')
    bg.addColorStop(1, C.bgDeep)
    ctx.fillStyle = bg
    ctx.fillRect(-sx, -sy, CANVAS_W, CANVAS_H)

    // Urgency vignette (red in last 10s)
    if (this.urgency > 0) {
      const vig = ctx.createRadialGradient(CANVAS_W/2, CANVAS_H/2, CANVAS_H*0.2, CANVAS_W/2, CANVAS_H/2, CANVAS_H*0.7)
      vig.addColorStop(0, 'transparent')
      vig.addColorStop(1, `rgba(255,30,60,${0.18 * this.urgency})`)
      ctx.fillStyle = vig; ctx.fillRect(-sx, -sy, CANVAS_W, CANVAS_H)
    }

    // Perspective grid
    this._drawGrid(ctx)

    // Combo pulse glow (center burst)
    if (this.pulse > 0) {
      const beat = (Math.sin(this.time * 8) + 1) / 2
      const r = (80 + beat * 60) * this.pulse
      const glow = ctx.createRadialGradient(CANVAS_W/2, CANVAS_H*0.5, 0, CANVAS_W/2, CANVAS_H*0.5, r)
      glow.addColorStop(0, `rgba(124,58,237,${0.25 * this.pulse})`)
      glow.addColorStop(1, 'transparent')
      ctx.fillStyle = glow; ctx.fillRect(-sx, -sy, CANVAS_W, CANVAS_H)
    }

    // Ambient particles
    for (const p of this.ambient) {
      ctx.globalAlpha = p.alpha
      ctx.fillStyle = p.color
      ctx.shadowColor = p.color
      ctx.shadowBlur = 6
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill()
    }
    ctx.globalAlpha = 1; ctx.shadowBlur = 0

    // Scan line
    const scanAlpha = 0.04 + this.urgency * 0.06
    const scanGrad = ctx.createLinearGradient(0, this.scanY - 30, 0, this.scanY + 30)
    scanGrad.addColorStop(0, 'transparent')
    scanGrad.addColorStop(0.5, `rgba(0,212,255,${scanAlpha})`)
    scanGrad.addColorStop(1, 'transparent')
    ctx.fillStyle = scanGrad; ctx.fillRect(-sx, this.scanY - 30, CANVAS_W, 60)

    ctx.restore()
  }

  _drawGrid(ctx) {
    const pulse = (Math.sin(this.time * 3) + 1) / 2
    const baseAlpha = 0.06 + pulse * 0.04 * this.pulse + this.urgency * 0.04
    const cx = CANVAS_W / 2, cy = CANVAS_H * 0.42

    ctx.save()
    ctx.strokeStyle = C.neon
    ctx.lineWidth = 0.5

    for (const l of this.gridLines) {
      if (l.type === 'col') {
        ctx.globalAlpha = baseAlpha
        ctx.beginPath(); ctx.moveTo(l.x0, CANVAS_H); ctx.lineTo(l.x1, l.y1); ctx.stroke()
        // upper half
        ctx.beginPath(); ctx.moveTo(l.x0, 0); ctx.lineTo(l.x1, l.y1); ctx.stroke()
      } else {
        // Row: interpolate between edge-width and vanish width
        const t = (l.y - cy) / (CANVAS_H - cy)
        const hw = CANVAS_W / 2 * t
        ctx.globalAlpha = baseAlpha * t
        ctx.beginPath(); ctx.moveTo(cx - hw, l.y); ctx.lineTo(cx + hw, l.y); ctx.stroke()
      }
    }
    ctx.globalAlpha = 1
    ctx.restore()
  }
}
