import { C } from './constants.js'

// ─── Bullet ───────────────────────────────────────────────────────────────────

export class Bullet {
  constructor(fromX, fromY, ring) {
    this.x      = fromX
    this.y      = fromY
    this.tx     = ring.x
    this.ty     = ring.y
    this.ring   = ring
    this.progress = 0
    this.dead   = false

    this.dx = ring.x - fromX
    this.dy = ring.y - fromY
    this.angle = Math.atan2(this.dy, this.dx)
  }

  update(dt) {
    this.progress += dt * 4
    if (this.progress >= 1) {
      this.progress = 1
      if (!this.ring.hit) {
        this.ring.hit = true
        this.ring.startClose()
      }
      this.dead = true
    }
    const t = this.progress
    this.x  = this.x + (this.tx - this.x) * 0.3   // eased approach
  }

  draw(ctx) {
    if (this.dead) return
    const t   = this.progress
    const ex  = this.tx - this.dx * (1 - t)
    const ey  = this.ty - this.dy * (1 - t)

    ctx.save()
    ctx.translate(ex, ey)
    ctx.rotate(this.angle)

    // Trail
    const trailLen = 22
    const grad = ctx.createLinearGradient(-trailLen, 0, 0, 0)
    grad.addColorStop(0, 'transparent')
    grad.addColorStop(1, C.neon)
    ctx.strokeStyle = grad
    ctx.lineWidth   = 4
    ctx.shadowColor = C.neon; ctx.shadowBlur = 14
    ctx.beginPath(); ctx.moveTo(-trailLen, 0); ctx.lineTo(0, 0); ctx.stroke()

    // Head
    ctx.fillStyle   = '#ffffff'
    ctx.shadowColor = C.neon; ctx.shadowBlur = 20
    ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = C.neon
    ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill()

    ctx.restore()
  }
}
