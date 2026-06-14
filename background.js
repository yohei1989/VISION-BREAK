import { RING_RADIUS, RING_STROKE, GAP_ANGLE, C } from './constants.js'

// ─── Ring States ──────────────────────────────────────────────────────────────
export const STATE = { ALIVE: 'alive', CLOSING: 'closing', BREAKING: 'breaking', DEAD: 'dead' }

export class Ring {
  /**
   * @param {number} x
   * @param {number} y
   * @param {'up'|'down'|'left'|'right'|null} dir  null = bonus O
   */
  constructor(x, y, dir) {
    this.x   = x
    this.y   = y
    this.dir = dir          // null => full circle (bonus)
    this.isBonus = dir === null

    // Scale-in from tiny
    this.scale = 0.05
    this.targetScale = 1

    this.state = STATE.ALIVE
    this.closeProgress = 0  // 0→1 during CLOSING
    this.breakProgress = 0  // 0→1 during BREAKING
    this.hit = false

    // Depth illusion: ring pulses slightly
    this.depthPhase = Math.random() * Math.PI * 2
    this.depthAmp   = 0.02

    // Glow phase
    this.glowPhase = Math.random() * Math.PI * 2
  }

  get alive() { return this.state !== STATE.DEAD }

  update(dt, time) {
    // Scale in
    if (this.scale < this.targetScale) {
      this.scale = Math.min(this.targetScale, this.scale + dt * 1.8)
    }
    // Slight depth pulse when fully in
    if (this.state === STATE.ALIVE && this.scale >= 0.99) {
      this.targetScale = 1 + Math.sin(time * 2.5 + this.depthPhase) * this.depthAmp
    }

    if (this.state === STATE.CLOSING) {
      this.closeProgress += dt * 3.5
      if (this.closeProgress >= 1) {
        this.closeProgress = 1
        this.state = STATE.BREAKING
      }
    }
    if (this.state === STATE.BREAKING) {
      this.breakProgress += dt * 2.8
      if (this.breakProgress >= 1) {
        this.state = STATE.DEAD
      }
    }

    this.glowPhase += dt * 4
  }

  startClose() {
    if (this.state === STATE.ALIVE) {
      this.state = STATE.CLOSING
      this.closeProgress = 0
    }
  }

  draw(ctx, time, nightMode = false) {
    if (this.state === STATE.DEAD) return

    const alpha = this.state === STATE.BREAKING
      ? Math.max(0, 1 - this.breakProgress)
      : 1

    ctx.save()
    ctx.translate(this.x, this.y)
    ctx.scale(this.scale, this.scale)
    ctx.globalAlpha = alpha

    const glow = (Math.sin(this.glowPhase) + 1) / 2

    if (this.isBonus) {
      this._drawBonus(ctx, glow)
    } else {
      this._drawC(ctx, glow)
    }

    // Breaking shards
    if (this.state === STATE.BREAKING) {
      this._drawShards(ctx, this.breakProgress)
    }

    ctx.restore()
  }

  _drawC(ctx, glow) {
    const gap = this.state === STATE.CLOSING
      ? (1 - this.closeProgress) * (Math.PI * 0.44)
      : Math.PI * 0.44

    const base   = this.dir ? GAP_ANGLE[this.dir] : 0
    const startA = base + gap
    const endA   = base + Math.PI * 2 - gap

    // Outer glow ring
    ctx.strokeStyle = `rgba(0,212,255,${0.15 + glow * 0.1})`
    ctx.lineWidth   = RING_STROKE + 10
    ctx.shadowColor = C.neon
    ctx.shadowBlur  = 20 + glow * 10
    ctx.lineCap     = 'round'
    ctx.beginPath(); ctx.arc(0, 0, RING_RADIUS, startA, endA); ctx.stroke()

    // Main ring
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth   = RING_STROKE
    ctx.shadowBlur  = 6
    ctx.beginPath(); ctx.arc(0, 0, RING_RADIUS, startA, endA); ctx.stroke()

    // Inner accent
    ctx.strokeStyle = C.neon
    ctx.lineWidth   = 2
    ctx.shadowBlur  = 0
    ctx.globalAlpha *= 0.6
    ctx.beginPath(); ctx.arc(0, 0, RING_RADIUS - RING_STROKE * 0.3, startA, endA); ctx.stroke()
    ctx.globalAlpha /= 0.6  // restore

    // Direction arrow hint (subtle)
    if (this.dir && !this.hit) {
      this._drawArrow(ctx, glow)
    }
  }

  _drawArrow(ctx, glow) {
    const a  = GAP_ANGLE[this.dir]
    const r1 = RING_RADIUS + 18
    const r2 = RING_RADIUS + 30
    const ax = Math.cos(a), ay = Math.sin(a)

    ctx.save()
    ctx.globalAlpha *= (0.3 + glow * 0.3)
    ctx.strokeStyle = C.neon
    ctx.lineWidth   = 2
    ctx.lineCap     = 'round'
    ctx.shadowColor = C.neon; ctx.shadowBlur = 8

    // Shaft
    ctx.beginPath(); ctx.moveTo(ax * r1, ay * r1); ctx.lineTo(ax * r2, ay * r2); ctx.stroke()

    // Arrowhead
    const ha = Math.PI / 5
    ctx.beginPath()
    ctx.moveTo(ax * r2, ay * r2)
    ctx.lineTo((ax * r2) + Math.cos(a + Math.PI + ha) * 9, (ay * r2) + Math.sin(a + Math.PI + ha) * 9)
    ctx.moveTo(ax * r2, ay * r2)
    ctx.lineTo((ax * r2) + Math.cos(a + Math.PI - ha) * 9, (ay * r2) + Math.sin(a + Math.PI - ha) * 9)
    ctx.stroke()
    ctx.restore()
  }

  _drawBonus(ctx, glow) {
    // Animated golden O
    const pulse = 0.9 + glow * 0.12

    // Outer corona
    ctx.strokeStyle = `rgba(255,215,0,${0.2 + glow * 0.15})`
    ctx.lineWidth   = RING_STROKE + 14
    ctx.shadowColor = C.gold; ctx.shadowBlur = 28 + glow * 14
    ctx.beginPath(); ctx.arc(0, 0, RING_RADIUS * pulse, 0, Math.PI * 2); ctx.stroke()

    // Main circle
    ctx.strokeStyle = C.gold
    ctx.lineWidth   = RING_STROKE
    ctx.shadowBlur  = 10
    ctx.beginPath(); ctx.arc(0, 0, RING_RADIUS, 0, Math.PI * 2); ctx.stroke()

    // Inner ring
    ctx.strokeStyle = '#fff9c4'
    ctx.lineWidth   = 2
    ctx.shadowBlur  = 0
    ctx.beginPath(); ctx.arc(0, 0, RING_RADIUS - RING_STROKE * 0.3, 0, Math.PI * 2); ctx.stroke()

    // Center dot
    ctx.fillStyle   = C.gold
    ctx.shadowColor = C.gold; ctx.shadowBlur = 12
    ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill()
  }

  _drawShards(ctx, progress) {
    const count  = 10
    const spread = progress * 80
    const alpha  = 1 - progress

    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2
      const d = spread * (0.6 + (i % 3) * 0.2)
      const sx = Math.cos(a) * d, sy = Math.sin(a) * d
      const len = (8 + (i % 4) * 4) * (1 - progress * 0.5)

      ctx.save()
      ctx.globalAlpha = alpha * alpha
      ctx.translate(sx, sy)
      ctx.rotate(a)
      ctx.strokeStyle = i % 2 === 0 ? '#ffffff' : C.neon
      ctx.lineWidth   = 1.5
      ctx.shadowColor = C.neon; ctx.shadowBlur = 8
      ctx.beginPath()
      ctx.moveTo(-len / 2, 0); ctx.lineTo(len / 2, 0)
      ctx.stroke()
      ctx.restore()
    }
  }
}
