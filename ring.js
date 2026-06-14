import { C, SPOON_COUNT, FORK_COUNT, KNIFE_COUNT } from './constants.js'

// ─── Utensil types ────────────────────────────────────────────────────────────

const COLORS = {
  spoon: { fill: '#b0c8e8', stroke: '#7aaad4', glow: 'rgba(140,190,230,0.6)' },
  fork:  { fill: '#c8b0e8', stroke: '#9a7ad4', glow: 'rgba(180,140,230,0.6)' },
  knife: { fill: '#e8d0b0', stroke: '#d4a870', glow: 'rgba(230,200,140,0.6)' },
}

export class Utensil {
  constructor(type, x, y, wave = 1) {
    this.type  = type   // 'spoon' | 'fork' | 'knife'
    this.x     = x
    this.y     = y
    this.vx    = (Math.random() - 0.5) * 1.8
    this.vy    = (Math.random() - 0.5) * 1.8
    this.angle = Math.random() * Math.PI * 2
    this.spin  = (Math.random() - 0.5) * 0.06
    this.scale = 0.2 + Math.random() * 0.5
    this.alive = true
    this.pulse = Math.random() * Math.PI * 2
    this.wave  = wave        // wave 1 = spoons only, wave 2 = fork+knife
    this.multiplier = wave   // ×1 spoons, ×2 fork/knife
  }

  update(dt) {
    this.pulse  += dt * 3
    this.angle  += this.spin
    this.x      += this.vx * 0.5
    this.y      += this.vy * 0.5
    this.vx     *= 0.995
    this.vy     *= 0.995
    // Bounce inside upper zone
    if (this.x < 30)  this.vx =  Math.abs(this.vx)
    if (this.x > 360) this.vx = -Math.abs(this.vx)
    if (this.y < 10)  this.vy =  Math.abs(this.vy)
    if (this.y > 230) this.vy = -Math.abs(this.vy)
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   */
  draw(ctx) {
    if (!this.alive) return
    const c = COLORS[this.type]
    const glowAmt = (Math.sin(this.pulse) + 1) / 2

    ctx.save()
    ctx.translate(this.x, this.y)
    ctx.rotate(this.angle)
    ctx.scale(this.scale, this.scale)
    ctx.shadowColor = c.glow
    ctx.shadowBlur  = 10 + glowAmt * 8

    if (this.type === 'spoon')      drawSpoon(ctx, c)
    else if (this.type === 'fork')  drawFork(ctx, c)
    else                            drawKnife(ctx, c)

    ctx.restore()
  }

  hitTest(px, py) {
    const dx = px - this.x, dy = py - this.y
    const r  = 28 * this.scale
    return Math.hypot(dx, dy) < r
  }
}

// ─── Drawing helpers ─────────────────────────────────────────────────────────

function drawSpoon(ctx, c) {
  ctx.fillStyle   = c.fill
  ctx.strokeStyle = c.stroke
  ctx.lineWidth   = 3

  // Handle
  ctx.beginPath()
  ctx.roundRect(-4, 10, 8, 50, 4)
  ctx.fill(); ctx.stroke()

  // Bowl
  ctx.beginPath()
  ctx.ellipse(0, -10, 16, 20, 0, 0, Math.PI * 2)
  ctx.fill(); ctx.stroke()

  // Shine
  ctx.fillStyle = 'rgba(255,255,255,0.35)'
  ctx.beginPath()
  ctx.ellipse(-5, -15, 5, 7, -0.4, 0, Math.PI * 2)
  ctx.fill()
}

function drawFork(ctx, c) {
  ctx.fillStyle   = c.fill
  ctx.strokeStyle = c.stroke
  ctx.lineWidth   = 3

  // Handle
  ctx.beginPath(); ctx.roundRect(-4, 10, 8, 52, 4); ctx.fill(); ctx.stroke()

  // Tines
  const tines = [-8, -3, 3, 8]
  tines.forEach(tx => {
    ctx.beginPath(); ctx.moveTo(tx, 8); ctx.lineTo(tx, -24); ctx.stroke()
  })
  // Top caps
  tines.forEach(tx => {
    ctx.beginPath(); ctx.arc(tx, -24, 2.5, 0, Math.PI * 2); ctx.fill()
  })
  // Horizontal connector
  ctx.beginPath(); ctx.moveTo(-8, -10); ctx.lineTo(8, -10); ctx.stroke()
}

function drawKnife(ctx, c) {
  ctx.fillStyle   = c.fill
  ctx.strokeStyle = c.stroke
  ctx.lineWidth   = 3

  // Handle
  ctx.beginPath(); ctx.roundRect(-5, 18, 10, 44, 5); ctx.fill(); ctx.stroke()

  // Blade (tapers to a point)
  ctx.beginPath()
  ctx.moveTo(-5, 18)
  ctx.lineTo(-5, -10)
  ctx.lineTo(0, -28)   // point
  ctx.lineTo(5, -10)
  ctx.lineTo(5, 18)
  ctx.closePath()
  ctx.fill(); ctx.stroke()

  // Blade shine
  ctx.fillStyle = 'rgba(255,255,255,0.25)'
  ctx.beginPath()
  ctx.moveTo(-2, 14)
  ctx.lineTo(-2, -6)
  ctx.lineTo(0, -22)
  ctx.lineTo(1, -6)
  ctx.lineTo(1, 14)
  ctx.closePath()
  ctx.fill()
}

// ─── Wave factory ─────────────────────────────────────────────────────────────

export function spawnWave1() {
  return Array.from({ length: SPOON_COUNT }, () =>
    new Utensil('spoon', 30 + Math.random() * 330, 10 + Math.random() * 215, 1)
  )
}

export function spawnWave2() {
  const items = []
  for (let i = 0; i < FORK_COUNT;  i++) items.push(new Utensil('fork',  30 + Math.random() * 330, 10 + Math.random() * 215, 2))
  for (let i = 0; i < KNIFE_COUNT; i++) items.push(new Utensil('knife', 30 + Math.random() * 330, 10 + Math.random() * 215, 2))
  return items
}
