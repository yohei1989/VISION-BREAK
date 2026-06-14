import { CANVAS_W, CANVAS_H, DIRS, GAP_ANGLE, SPAWN_X_MIN, SPAWN_X_MAX, SPAWN_Y_MIN, SPAWN_Y_MAX, C } from './constants.js'
import { Ring, STATE } from './ring.js'
import { Bullet } from './bullet.js'
import { ParticleSystem } from './particles.js'
import { Background } from './background.js'
import { Utensil, spawnWave1, spawnWave2 } from './utensils.js'
import { drawHUD, drawStartScreen, drawResultScreen, ScorePopup, BigMessage } from './ui.js'

// ─── Game States ──────────────────────────────────────────────────────────────
const GS = { START: 'start', PLAYING: 'playing', RESULT: 'result' }

export class Game {
  constructor(canvas) {
    this.canvas = canvas
    this.ctx    = canvas.getContext('2d', { alpha: false })
    this.dpr    = Math.min(window.devicePixelRatio || 1, 2)

    this._resize()
    window.addEventListener('resize', () => this._resize())

    this.bg       = new Background()
    this.ps       = new ParticleSystem()
    this.state    = GS.START
    this.time     = 0   // wall clock since game start
    this.bestScore = parseInt(localStorage.getItem('vb_best') || '0', 10)

    // Game data
    this._resetData()

    // UI overlays
    this.popups  = []
    this.bigMsgs = []

    // Result screen button areas (set during draw)
    this._resultBtns = null

    // Slow-mo for miss
    this._timeScale = 1
    this._missFlash = 0   // 0-1 red overlay alpha

    // Canvas offset for shake
    this._shakeX = 0; this._shakeY = 0

    // Spawn bookkeeping
    this._spawnTimer   = 0
    this._bonusSpawned = false

    // For animation loop
    this._lastTs = null
    this._rafId  = null
  }

  _resize() {
    const w = Math.min(window.innerWidth, 480)
    const h = window.innerHeight
    this.canvas.style.width  = w + 'px'
    this.canvas.style.height = h + 'px'
    this.canvas.width  = CANVAS_W
    this.canvas.height = CANVAS_H
  }

  _resetData() {
    this.rings     = []
    this.bullets   = []
    this.utensils  = []
    this.score     = 0
    this.combo     = 0
    this.maxCombo  = 0
    this.breakCount= 0
    this.bonusBreak= 0
    this.timeLeft  = 30
    this.missed    = false
    this.surviveTime = 0

    this._bonusSpawned  = false
    this._utensilWave   = 0   // 0=none 1=spoons 2=fork+knife
    this._waveLabel     = ''
    this._spawnTimer    = 0
    this._timeScale     = 1
    this._missFlash     = 0
    this.popups  = []
    this.bigMsgs = []
    this.bullets = []
    this.ps      = new ParticleSystem()
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  start() {
    this._resetData()
    this.state     = GS.PLAYING
    this.startTime = performance.now()
    this.time      = 0
    this._lastTs   = null
    if (!this._rafId) this._loop(performance.now())
  }

  startLoop() {
    this._lastTs = null
    this._rafId  = requestAnimationFrame(ts => this._loop(ts))
  }

  // ─── Input handlers (called by InputManager via main.js) ────────────────────

  onTap(x, y) {
    if (this.state === GS.START) { this.start(); return }
    if (this.state === GS.RESULT) {
      this._handleResultTap(x, y); return
    }
    if (this.state !== GS.PLAYING) return

    // Bonus O rings
    for (const r of this.rings) {
      if (!r.alive || r.hit || !r.isBonus || r.state !== STATE.ALIVE) continue
      if (Math.hypot(x - r.x, y - r.y) < 60 * r.scale) {
        this._hitBonus(r, x, y)
        return
      }
    }

    // Utensils
    for (const u of this.utensils) {
      if (!u.alive) continue
      if (u.hitTest(x, y)) {
        this._hitUtensil(u, x, y); return
      }
    }
  }

  onFlick(x, y, dir, dx, dy) {
    if (this.state !== GS.PLAYING) return

    // Find closest ring that matches
    let best = null, bestDist = 999
    for (const r of this.rings) {
      if (!r.alive || r.hit || r.isBonus || r.state !== STATE.ALIVE) continue
      const d = Math.hypot(x - r.x, y - r.y)
      if (d < 100 && d < bestDist) { best = r; bestDist = d }
    }

    if (!best) return

    if (dir === best.dir) {
      this._hitRing(best, x, y)
    } else {
      this._miss()
    }
  }

  // ─── Hit logic ───────────────────────────────────────────────────────────────

  _hitRing(ring, x, y) {
    ring.hit = true
    this.bullets.push(new Bullet(x, y, ring))

    this.combo++
    this.maxCombo = Math.max(this.maxCombo, this.combo)
    this.breakCount++

    const base = 100 + this.combo * 15
    const pts  = this.combo >= 5 ? Math.round(base * 1.2) : base
    this.score += pts
    this._saveScore()

    // Particles
    this.ps.emitBurst(ring.x, ring.y, { color: C.neon,  glow: C.neonGlow })
    this.ps.emitSparks(ring.x, ring.y)

    this.popups.push(new ScorePopup(ring.x, ring.y - 20, `+${pts}`, C.neon))

    if (this.combo >= 10) {
      this.bigMsgs.push(new BigMessage(`${this.combo} COMBO!!`, '気持ちいい！', C.gold, 0.9))
      this.bg.triggerShake(3)
    } else if (this.combo >= 5) {
      this.bigMsgs.push(new BigMessage(`${this.combo} COMBO`, '', C.neon, 0.7))
    }

    this.bg.setPulse(this.combo)
  }

  _hitBonus(ring, x, y) {
    ring.hit = true
    ring.startClose()
    this.bonusBreak++
    const pts = 300
    this.score += pts
    this._saveScore()
    this.ps.emitBurst(ring.x, ring.y, { count: 32, color: C.gold, glow: C.goldGlow, speed: 8 })
    this.ps.emitSparks(ring.x, ring.y, { color: C.gold, glow: C.goldGlow })
    this.popups.push(new ScorePopup(ring.x, ring.y - 20, '+300 BONUS!', C.gold))
    this.bigMsgs.push(new BigMessage('BONUS!', 'スプーンをタップ！', C.gold, 1.4))
    this.bg.triggerShake(5)

    // Spawn wave 1: spoons
    setTimeout(() => {
      this.utensils = spawnWave1()
      this._utensilWave = 1
      this._waveLabel   = '🥄 SPOON BREAK! ×2'
    }, 400)
  }

  _hitUtensil(u, x, y) {
    u.alive = false
    const wave  = u.wave
    const pts   = 50 * wave
    this.score += pts
    this.bonusBreak++
    this._saveScore()

    this.ps.emit(x, y, {
      count: 14, color: wave === 2 ? '#c8b0e8' : '#b0c8e8',
      glow: wave === 2 ? 'rgba(180,140,230,0.6)' : 'rgba(140,190,230,0.6)',
      speed: 5, size: 4,
    })
    this.popups.push(new ScorePopup(x, y, `+${pts}`, wave === 2 ? '#c8b0e8' : C.neon))

    // Check if all dead
    if (this.utensils.every(u => !u.alive)) {
      if (this._utensilWave === 1) {
        // Spawn wave 2: fork + knife
        setTimeout(() => {
          this.utensils = spawnWave2()
          this._utensilWave = 2
          this._waveLabel   = '🍴 FORK & KNIFE! ×4'
          this.bigMsgs.push(new BigMessage('WAVE 2!', 'フォーク＆ナイフ ×4', '#c8b0e8', 1.2))
          this.bg.triggerShake(4)
        }, 300)
      } else if (this._utensilWave === 2) {
        this._utensilWave = 0
        this._waveLabel   = ''
        this.bigMsgs.push(new BigMessage('PERFECT!', 'ボーナスクリア！', C.gold, 1.2))
        this.bg.triggerShake(6)
      }
    }
  }

  _miss() {
    if (this.state !== GS.PLAYING) return
    this.state       = GS.RESULT
    this.missed      = true
    this.surviveTime = Math.round((performance.now() - this.startTime) / 1000)
    this.combo       = 0
    this._missFlash  = 1
    this._timeScale  = 0.15  // brief slow-mo
    this.bg.triggerShake(12)

    // Noise / glass crack particles
    const cx = CANVAS_W / 2, cy = CANVAS_H / 2
    this.ps.emitBurst(cx, cy, { count: 30, color: C.danger, glow: C.dangerGlow, speed: 10, size: 6 })
    this.ps.emitSparks(cx, cy, { color: C.danger, glow: C.dangerGlow })

    setTimeout(() => {
      this._timeScale = 1
      this._saveScore()
    }, 600)
  }

  // ─── Spawn logic ─────────────────────────────────────────────────────────────

  _getRingCount() {
    if (this.timeLeft > 20) return 1
    if (this.timeLeft > 10) return 2
    return 3
  }

  _spawnRing() {
    const dir  = DIRS[Math.floor(Math.random() * 4)]
    const x    = SPAWN_X_MIN + Math.random() * (SPAWN_X_MAX - SPAWN_X_MIN)
    const y    = SPAWN_Y_MIN + Math.random() * (SPAWN_Y_MAX - SPAWN_Y_MIN)
    this.rings.push(new Ring(x, y, dir))
  }

  _spawnBonus() {
    const x = SPAWN_X_MIN + Math.random() * (SPAWN_X_MAX - SPAWN_X_MIN)
    const y = SPAWN_Y_MIN + Math.random() * (SPAWN_Y_MAX - SPAWN_Y_MIN)
    this.rings.push(new Ring(x, y, null))
    this._bonusSpawned = true
    this.bigMsgs.push(new BigMessage('BONUS!', 'O をタップ！', C.gold, 1.0))
  }

  // ─── Update ──────────────────────────────────────────────────────────────────

  _update(dt) {
    if (this.state !== GS.PLAYING) return

    const scaledDt = dt * this._timeScale
    this.time += scaledDt

    // Countdown
    const elapsed  = (performance.now() - this.startTime) / 1000
    this.timeLeft  = Math.max(0, 30 - elapsed)

    if (this.timeLeft <= 0) {
      this.surviveTime = 30
      this.state = GS.RESULT
      this._saveScore()
      return
    }

    this.bg.setUrgency(this.timeLeft)
    this.bg.setPulse(this.combo)
    this.bg.update(scaledDt)

    // Spawn rings
    this._spawnTimer -= scaledDt
    if (this._spawnTimer <= 0) {
      const alive = this.rings.filter(r => r.alive && !r.isBonus && !r.hit)
      const need  = this._getRingCount()
      if (alive.length < need) this._spawnRing()

      // Bonus O: random chance after 8s, once
      if (!this._bonusSpawned && elapsed > 8 && Math.random() < 0.02) {
        this._spawnBonus()
      }

      const interval = this.timeLeft > 20 ? 2.5 : this.timeLeft > 10 ? 1.6 : 1.0
      this._spawnTimer = interval / need
    }

    // Update rings
    for (const r of this.rings) r.update(scaledDt, this.time)
    this.rings = this.rings.filter(r => r.state !== STATE.DEAD)

    // Update bullets
    for (const b of this.bullets) b.update(scaledDt)
    this.bullets = this.bullets.filter(b => !b.dead)

    // Update utensils
    for (const u of this.utensils) u.update(scaledDt)

    // Particles
    this.ps.update(scaledDt)

    // Popups / messages
    for (const p of this.popups) p.update(scaledDt)
    this.popups = this.popups.filter(p => !p.dead)
    for (const m of this.bigMsgs) m.update(scaledDt)
    this.bigMsgs = this.bigMsgs.filter(m => !m.dead)

    // Slow-mo recovery
    if (this._timeScale < 1) {
      this._timeScale = Math.min(1, this._timeScale + dt * 1.5)
    }
    // Miss flash decay
    if (this._missFlash > 0) this._missFlash -= dt * 3

    // Background shake
    this.bg.update(0)   // already called above, just ensure shake syncs
  }

  // ─── Draw ────────────────────────────────────────────────────────────────────

  _draw() {
    const ctx = this.ctx

    if (this.state === GS.START) {
      this.bg.update(1/60)
      this.bg.draw(ctx)
      drawStartScreen(ctx, this.time, this.bestScore)
      this.time += 1/60
      return
    }

    // Background
    this.bg.draw(ctx)

    // Utensils (bonus zone – upper area)
    for (const u of this.utensils) u.draw(ctx)

    // Rings
    for (const r of this.rings) r.draw(ctx, this.time)

    // Bullets
    for (const b of this.bullets) b.draw(ctx)

    // Particles
    this.ps.draw(ctx)

    // Score popups
    for (const p of this.popups) p.draw(ctx)

    // Big messages
    for (const m of this.bigMsgs) m.draw(ctx)

    // Miss flash (red overlay)
    if (this._missFlash > 0) {
      ctx.fillStyle = `rgba(255,30,60,${this._missFlash * 0.45})`
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)
      // Glass crack lines
      if (this._missFlash > 0.5) {
        ctx.save()
        ctx.strokeStyle = `rgba(255,100,120,${(this._missFlash - 0.5) * 2 * 0.6})`
        ctx.lineWidth   = 1.5
        const cx = CANVAS_W / 2, cy = CANVAS_H / 2
        for (let i = 0; i < 8; i++) {
          const a  = (i / 8) * Math.PI * 2
          const r1 = 30 + Math.random() * 20
          const r2 = 120 + Math.random() * 80
          ctx.beginPath()
          ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1)
          ctx.lineTo(cx + Math.cos(a + 0.15) * r2, cy + Math.sin(a + 0.15) * r2)
          ctx.stroke()
        }
        ctx.restore()
      }
    }

    // HUD (always on top)
    if (this.state === GS.PLAYING) {
      drawHUD(ctx, {
        score: this.score,
        timeLeft: this.timeLeft,
        combo: this.combo,
        bonusActive: this._utensilWave > 0,
        waveLabel: this._waveLabel,
      })
    }

    // Result screen
    if (this.state === GS.RESULT) {
      const isNewBest = this.score > this.bestScore
      this._resultBtns = drawResultScreen(ctx, {
        score: this.score,
        breakCount: this.breakCount,
        maxCombo: this.maxCombo,
        bonusBreak: this.bonusBreak,
        surviveTime: this.surviveTime,
        bestScore: this.bestScore,
        isNewBest,
        missed: this.missed,
      }, this.time)
    }
  }

  // ─── Loop ────────────────────────────────────────────────────────────────────

  _loop(ts) {
    if (this._lastTs === null) this._lastTs = ts
    const dt = Math.min((ts - this._lastTs) / 1000, 0.05)
    this._lastTs = ts

    this._update(dt)
    this._draw()

    this._rafId = requestAnimationFrame(t => this._loop(t))
  }

  // ─── Result interaction ───────────────────────────────────────────────────────

  _handleResultTap(x, y) {
    if (!this._resultBtns) return
    const { retryBtn, shareBtn } = this._resultBtns

    if (_inRect(x, y, retryBtn)) {
      this.start()
      return
    }
    if (_inRect(x, y, shareBtn)) {
      this._share()
    }
  }

  _share() {
    const text = `VISION BREAK\n近未来視覚トレーニング\n\nSCORE: ${this.score}\nBREAK: ${this.breakCount}\nCOMBO: ×${this.maxCombo}\n\n君は見切れる？\n#VISIONBREAK`
    if (navigator.share) {
      navigator.share({ text }).catch(() => {})
    } else {
      navigator.clipboard?.writeText(text).catch(() => {})
      this.bigMsgs.push(new BigMessage('COPIED!', 'クリップボードにコピー', C.neon, 1.0))
    }
  }

  _saveScore() {
    if (this.score > this.bestScore) {
      this.bestScore = this.score
      localStorage.setItem('vb_best', String(this.score))
    }
  }
}

function _inRect(x, y, r) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h
}
