import { Game } from './game.js'
import { InputManager } from './input.js'

// ─── Bootstrap ────────────────────────────────────────────────────────────────

const root   = document.getElementById('root')
const canvas = document.createElement('canvas')
canvas.style.cssText = `
  display: block;
  margin: 0 auto;
  touch-action: none;
  cursor: pointer;
`
root.appendChild(canvas)

const game  = new Game(canvas)
const input = new InputManager(canvas)

input
  .on('tap',   ({ x, y })              => game.onTap(x, y))
  .on('flick', ({ x, y, dir, dx, dy }) => game.onFlick(x, y, dir, dx, dy))

// Start the animation loop immediately (shows start screen)
game.startLoop()

// Register service worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {})
  })
}
