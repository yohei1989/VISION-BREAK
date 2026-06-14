import { CANVAS_W, CANVAS_H, C } from './constants.js'

// ─── HUD ──────────────────────────────────────────────────────────────────────

export function drawHUD(ctx, { score, timeLeft, combo, bonusActive, waveLabel }) {
  const urgent = timeLeft <= 10

  ctx.save()

  // Top glass panel
  _glassPill(ctx, 0, 0, CANVAS_W, 72, 0)

  // SCORE
  ctx.fillStyle = C.textMuted
  ctx.font      = '500 11px "SF Pro Display", system-ui, sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('SCORE', 20, 22)

  ctx.fillStyle   = C.textPrimary
  ctx.font        = `700 36px "SF Pro Display", system-ui, sans-serif`
  ctx.shadowColor = C.neon; ctx.shadowBlur = urgent ? 16 : 6
  ctx.fillText(String(score).padStart(6, '0'), 20, 58)
  ctx.shadowBlur  = 0

  // TIME
  ctx.fillStyle = C.textMuted
  ctx.font      = '500 11px system-ui'
  ctx.textAlign = 'center'
  ctx.fillText('TIME', CANVAS_W / 2, 22)

  const timeColor = urgent
    ? (Math.floor(Date.now() / 200) % 2 === 0 ? '#ff3366' : '#ff8899')
    : C.textPrimary
  ctx.fillStyle   = timeColor
  ctx.font        = '700 36px system-ui'
  ctx.shadowColor = urgent ? C.danger : C.neon
  ctx.shadowBlur  = urgent ? 20 : 6
  ctx.fillText(Math.ceil(timeLeft), CANVAS_W / 2, 58)
  ctx.shadowBlur  = 0

  // COMBO
  ctx.fillStyle = C.textMuted
  ctx.font      = '500 11px system-ui'
  ctx.textAlign = 'right'
  ctx.fillText('COMBO', CANVAS_W - 20, 22)

  if (combo >= 2) {
    const csize = Math.min(36, 22 + combo)
    ctx.fillStyle   = combo >= 5 ? C.gold : C.neon
    ctx.font        = `700 ${csize}px system-ui`
    ctx.shadowColor = combo >= 5 ? C.goldGlow : C.neonGlow
    ctx.shadowBlur  = 14
    ctx.fillText(`×${combo}`, CANVAS_W - 20, 58)
  } else {
    ctx.fillStyle = C.textPrimary
    ctx.font      = '700 36px system-ui'
    ctx.fillText(combo > 0 ? '×1' : '-', CANVAS_W - 20, 58)
  }
  ctx.shadowBlur = 0

  // Bonus wave label
  if (bonusActive && waveLabel) {
    ctx.textAlign   = 'center'
    ctx.fillStyle   = '#ffd700'
    ctx.font        = '700 13px system-ui'
    ctx.shadowColor = C.goldGlow; ctx.shadowBlur = 10
    ctx.fillText(waveLabel, CANVAS_W / 2, 80)
    ctx.shadowBlur  = 0
  }

  ctx.restore()
}

// ─── Floating score popup ─────────────────────────────────────────────────────

export class ScorePopup {
  constructor(x, y, text, color = C.neon) {
    this.x     = x
    this.y     = y
    this.text  = text
    this.color = color
    this.life  = 1.0
    this.vy    = -1.5
  }

  update(dt) { this.y += this.vy; this.life -= dt * 1.8 }

  draw(ctx) {
    if (this.life <= 0) return
    ctx.save()
    ctx.globalAlpha = Math.min(1, this.life * 2)
    ctx.fillStyle   = this.color
    ctx.font        = '700 22px system-ui'
    ctx.textAlign   = 'center'
    ctx.shadowColor = this.color; ctx.shadowBlur = 12
    ctx.fillText(this.text, this.x, this.y)
    ctx.restore()
  }

  get dead() { return this.life <= 0 }
}

// ─── Big message (MISS / COMBO / BONUS) ──────────────────────────────────────

export class BigMessage {
  constructor(text, sub = '', color = C.neon, duration = 1.0) {
    this.text     = text
    this.sub      = sub
    this.color    = color
    this.life     = duration
    this.maxLife  = duration
    this.scale    = 1.4
  }

  update(dt) {
    this.life  -= dt
    this.scale  = Math.max(1, this.scale - dt * 3)
  }

  draw(ctx) {
    if (this.life <= 0) return
    const alpha = Math.min(1, this.life / this.maxLife * 2)
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.textAlign   = 'center'

    // Shadow/glow
    ctx.fillStyle   = this.color
    ctx.font        = `900 ${Math.round(52 * this.scale)}px system-ui`
    ctx.shadowColor = this.color; ctx.shadowBlur = 30

    // Outline
    ctx.strokeStyle    = 'rgba(0,0,0,0.6)'
    ctx.lineWidth      = 6
    ctx.lineJoin       = 'round'
    ctx.strokeText(this.text, CANVAS_W / 2, CANVAS_H / 2 - 20)
    ctx.fillText(this.text, CANVAS_W / 2, CANVAS_H / 2 - 20)

    if (this.sub) {
      ctx.font        = '600 18px system-ui'
      ctx.shadowBlur  = 10
      ctx.fillStyle   = 'rgba(255,255,255,0.85)'
      ctx.shadowColor = 'rgba(255,255,255,0.5)'
      ctx.fillText(this.sub, CANVAS_W / 2, CANVAS_H / 2 + 18)
    }
    ctx.restore()
  }

  get dead() { return this.life <= 0 }
}

// ─── Start Screen ─────────────────────────────────────────────────────────────

export function drawStartScreen(ctx, time, bestScore) {
  ctx.save()

  // Full overlay
  ctx.fillStyle = 'rgba(6,8,16,0.88)'
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

  // Center ring decoration
  const cx = CANVAS_W / 2, cy = CANVAS_H * 0.34
  const pulse = (Math.sin(time * 2) + 1) / 2

  // Outer glow
  ctx.strokeStyle = `rgba(0,212,255,${0.1 + pulse * 0.08})`
  ctx.lineWidth   = 28
  ctx.shadowColor = C.neon; ctx.shadowBlur = 30
  ctx.beginPath(); ctx.arc(cx, cy, 70, 0.6, Math.PI * 2 - 0.6); ctx.stroke()

  // Main ring (Landolt C style)
  ctx.strokeStyle = C.neon
  ctx.lineWidth   = 10
  ctx.shadowBlur  = 18
  ctx.beginPath(); ctx.arc(cx, cy, 70, 0.6, Math.PI * 2 - 0.6); ctx.stroke()

  // Inner
  ctx.strokeStyle = 'rgba(255,255,255,0.6)'
  ctx.lineWidth   = 2; ctx.shadowBlur = 0
  ctx.beginPath(); ctx.arc(cx, cy, 62, 0.6, Math.PI * 2 - 0.6); ctx.stroke()

  // VISION BREAK title
  ctx.textAlign   = 'center'
  ctx.font        = '900 38px system-ui'
  ctx.fillStyle   = '#ffffff'
  ctx.shadowColor = C.neon; ctx.shadowBlur = 20
  ctx.fillText('VISION', CANVAS_W / 2, cy + 130)
  ctx.fillStyle   = C.neon
  ctx.shadowBlur  = 30
  ctx.fillText('BREAK', CANVAS_W / 2, cy + 176)
  ctx.shadowBlur  = 0

  // Subtitle
  ctx.font      = '400 13px system-ui'
  ctx.fillStyle = C.textMuted
  ctx.fillText('近未来視覚トレーニング', CANVAS_W / 2, cy + 206)

  // Best score
  if (bestScore > 0) {
    ctx.font      = '500 12px system-ui'
    ctx.fillStyle = C.textMuted
    ctx.fillText(`BEST  ${String(bestScore).padStart(6,'0')}`, CANVAS_W / 2, cy + 234)
  }

  // Start button
  const bx = CANVAS_W / 2 - 90, by = CANVAS_H * 0.72
  _glassButton(ctx, bx, by, 180, 54, C.neon, pulse)
  ctx.fillStyle   = '#ffffff'
  ctx.font        = '700 20px system-ui'
  ctx.shadowColor = C.neon; ctx.shadowBlur = 10
  ctx.fillText('TAP TO START', CANVAS_W / 2, by + 34)
  ctx.shadowBlur  = 0

  // How to play
  ctx.font      = '400 12px system-ui'
  ctx.fillStyle = C.textMuted
  ctx.fillText('フリック → C の向きへ ／ タップ → O を破壊', CANVAS_W / 2, CANVAS_H - 30)

  ctx.restore()
}

// ─── Result Screen ────────────────────────────────────────────────────────────

export function drawResultScreen(ctx, data, time) {
  const { score, breakCount, maxCombo, bonusBreak, surviveTime, bestScore, isNewBest } = data

  ctx.save()
  ctx.fillStyle = 'rgba(6,8,16,0.92)'
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

  const cx = CANVAS_W / 2
  const pulse = (Math.sin(time * 2.5) + 1) / 2

  // Panel
  const pw = 320, ph = 420, px = (CANVAS_W - pw) / 2, py = (CANVAS_H - ph) / 2
  _glassPanel(ctx, px, py, pw, ph)

  // Title
  ctx.textAlign   = 'center'
  ctx.font        = '900 32px system-ui'
  ctx.fillStyle   = data.missed ? C.danger : C.neon
  ctx.shadowColor = data.missed ? C.dangerGlow : C.neonGlow
  ctx.shadowBlur  = 18
  ctx.fillText(data.missed ? 'GAME OVER' : 'TIME UP!', cx, py + 52)
  ctx.shadowBlur  = 0

  // New best
  if (isNewBest) {
    ctx.font        = '700 13px system-ui'
    ctx.fillStyle   = C.gold
    ctx.shadowColor = C.goldGlow; ctx.shadowBlur = 12
    ctx.fillText('★ NEW BEST ★', cx, py + 78)
    ctx.shadowBlur  = 0
  }

  // Stats
  const stats = [
    ['SCORE',   String(score).padStart(6, '0'), C.neon],
    ['BREAK',   breakCount,   C.textPrimary],
    ['COMBO',   `×${maxCombo}`, C.textPrimary],
    ['BONUS',   bonusBreak,   C.gold],
    ['SURVIVE', `${surviveTime}s`, C.textMuted],
  ]
  stats.forEach(([label, value, color], i) => {
    const ry = py + 112 + i * 52
    // Row bg
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'transparent'
    ctx.fillRect(px + 12, ry - 16, pw - 24, 40)

    ctx.fillStyle = C.textMuted
    ctx.font      = '500 11px system-ui'
    ctx.textAlign = 'left'
    ctx.fillText(label, px + 24, ry + 4)

    ctx.fillStyle   = color
    ctx.font        = '700 24px system-ui'
    ctx.textAlign   = 'right'
    ctx.shadowColor = color; ctx.shadowBlur = 6
    ctx.fillText(value, px + pw - 24, ry + 4)
    ctx.shadowBlur  = 0
  })

  // Divider
  ctx.strokeStyle = C.glassBorder; ctx.lineWidth = 0.5
  ctx.beginPath(); ctx.moveTo(px + 20, py + 376); ctx.lineTo(px + pw - 20, py + 376); ctx.stroke()

  // Share text (SNS)
  ctx.font      = '400 10px system-ui'
  ctx.fillStyle = C.textMuted
  ctx.textAlign = 'center'
  ctx.fillText(`VISION BREAK  SCORE ${score}  BREAK ${breakCount}  #VISIONBREAK`, cx, py + 396)

  // Buttons
  const bw = 130, bh = 50
  const b1x = cx - bw - 8, b2x = cx + 8, by = py + ph - 62

  _glassButton(ctx, b1x, by, bw, bh, '#7c3aed', pulse)
  ctx.fillStyle = '#ffffff'; ctx.font = '700 16px system-ui'; ctx.textAlign = 'center'
  ctx.shadowColor = '#7c3aed'; ctx.shadowBlur = 8
  ctx.fillText('RETRY', b1x + bw / 2, by + 32)

  _glassButton(ctx, b2x, by, bw, bh, C.neon, pulse)
  ctx.fillStyle = '#ffffff'
  ctx.shadowColor = C.neon; ctx.shadowBlur = 8
  ctx.fillText('SHARE', b2x + bw / 2, by + 32)
  ctx.shadowBlur = 0

  // Store button hit areas for click detection
  ctx.restore()

  return {
    retryBtn: { x: b1x, y: by, w: bw, h: bh },
    shareBtn: { x: b2x, y: by, w: bw, h: bh },
  }
}

// ─── Glass helpers ────────────────────────────────────────────────────────────

function _glassPill(ctx, x, y, w, h, r = 12) {
  ctx.save()
  ctx.fillStyle = 'rgba(0,0,0,0.45)'
  _roundRect(ctx, x, y, w, h, r)
  ctx.fill()
  ctx.strokeStyle = C.glassBorder; ctx.lineWidth = 0.5
  _roundRect(ctx, x, y, w, h, r)
  ctx.stroke()
  ctx.restore()
}

function _glassPanel(ctx, x, y, w, h) {
  ctx.save()
  // Shadow
  ctx.shadowColor = 'rgba(0,212,255,0.12)'; ctx.shadowBlur = 40
  ctx.fillStyle   = 'rgba(12,18,35,0.92)'
  _roundRect(ctx, x, y, w, h, 24); ctx.fill()
  ctx.shadowBlur  = 0

  // Border
  ctx.strokeStyle = C.glassBorder; ctx.lineWidth = 1
  _roundRect(ctx, x, y, w, h, 24); ctx.stroke()

  // Top shimmer
  const shimmer = ctx.createLinearGradient(x, y, x, y + 60)
  shimmer.addColorStop(0, 'rgba(255,255,255,0.06)')
  shimmer.addColorStop(1, 'transparent')
  ctx.fillStyle = shimmer
  _roundRect(ctx, x, y, w, 60, 24); ctx.fill()
  ctx.restore()
}

function _glassButton(ctx, x, y, w, h, color, pulse = 0) {
  ctx.save()
  ctx.shadowColor = color; ctx.shadowBlur = 8 + pulse * 8
  ctx.fillStyle   = `rgba(${hexToRgb(color)},0.12)`
  _roundRect(ctx, x, y, w, h, 14); ctx.fill()
  ctx.shadowBlur  = 0
  ctx.strokeStyle = color; ctx.lineWidth = 1
  _roundRect(ctx, x, y, w, h, 14); ctx.stroke()
  ctx.restore()
}

function _roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1,3), 16)
  const g = parseInt(hex.slice(3,5), 16)
  const b = parseInt(hex.slice(5,7), 16)
  return `${r},${g},${b}`
}
