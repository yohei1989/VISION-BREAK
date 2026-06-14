// ─── Particle System ──────────────────────────────────────────────────────────

export class ParticleSystem {
  constructor() {
    /** @type {Array<{x,y,vx,vy,life,maxLife,color,size,glow,shape}>} */
    this.pool = []
  }

  emit(x, y, opts = {}) {
    const {
      count  = 10,
      color  = '#00d4ff',
      glow   = 'rgba(0,212,255,0.6)',
      speed  = 4,
      spread = Math.PI * 2,
      angle  = 0,
      life   = 0.9,
      size   = 4,
      shape  = 'circle',  // 'circle' | 'spark'
    } = opts

    for (let i = 0; i < count; i++) {
      const a = angle - spread / 2 + Math.random() * spread
      const s = speed * (0.4 + Math.random() * 0.6)
      this.pool.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life,
        maxLife: life,
        color,
        glow,
        size: size * (0.5 + Math.random() * 0.5),
        shape,
        drag: 0.94,
      })
    }
  }

  emitBurst(x, y, opts = {}) {
    this.emit(x, y, { count: 24, speed: 6, size: 5, life: 1.1, ...opts })
  }

  emitSparks(x, y, opts = {}) {
    this.emit(x, y, {
      count: 16, speed: 7, size: 2, life: 0.7, shape: 'spark',
      color: '#ffffff', glow: 'rgba(255,255,255,0.8)', ...opts,
    })
  }

  update(dt) {
    for (let i = this.pool.length - 1; i >= 0; i--) {
      const p = this.pool[i]
      p.x  += p.vx
      p.y  += p.vy
      p.vy += 0.18   // gravity
      p.vx *= p.drag
      p.vy *= p.drag
      p.life -= dt
      if (p.life <= 0) this.pool.splice(i, 1)
    }
  }

  draw(ctx) {
    for (const p of this.pool) {
      const alpha = Math.min(1, p.life / p.maxLife)
      ctx.save()
      ctx.globalAlpha = alpha

      if (p.shape === 'spark') {
        ctx.strokeStyle = p.color
        ctx.lineWidth   = p.size
        ctx.shadowColor = p.glow
        ctx.shadowBlur  = 8
        ctx.beginPath()
        ctx.moveTo(p.x, p.y)
        ctx.lineTo(p.x - p.vx * 4, p.y - p.vy * 4)
        ctx.stroke()
      } else {
        ctx.fillStyle   = p.color
        ctx.shadowColor = p.glow
        ctx.shadowBlur  = 12
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()
    }
  }
}
