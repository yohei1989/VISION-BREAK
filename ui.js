// ─── Game Constants ────────────────────────────────────────────────────────────

export const GAME_DURATION = 30      // seconds
export const RING_RADIUS   = 44      // canvas units
export const RING_STROKE   = 10
export const GAP_RATIO     = 0.22    // fraction of full circle that is the gap

// Flick threshold in CSS pixels
export const FLICK_MIN_DIST  = 22
export const FLICK_MAX_TIME  = 400   // ms – faster than this is a flick

// Ring spawn zones (canvas coords, 0,0 = top-left of game canvas)
// Rings appear in the lower 2/3 of the game area and zoom toward viewer
export const SPAWN_X_MIN = 80
export const SPAWN_X_MAX = 300
export const SPAWN_Y_MIN = 200
export const SPAWN_Y_MAX = 420

// Canvas logical size (independent of device pixel ratio)
export const CANVAS_W = 390
export const CANVAS_H = 720

// Bonus zone: upper area where spoons/forks live
export const BONUS_ZONE_MAX_Y = 240

// Directions
export const DIRS = ['up', 'down', 'left', 'right']

// Angle of gap opening in radians, keyed by direction
// (which direction is "open", i.e. where the gap faces)
export const GAP_ANGLE = {
  up:    -Math.PI / 2,
  down:   Math.PI / 2,
  left:   Math.PI,
  right:  0,
}

// Colors
export const C = {
  bg:          '#0a0e1a',
  bgDeep:      '#060810',
  neon:        '#00d4ff',
  neonDim:     '#0088bb',
  neonGlow:    'rgba(0,212,255,0.25)',
  accent:      '#7c3aed',
  accentGlow:  'rgba(124,58,237,0.3)',
  danger:      '#ff3366',
  dangerGlow:  'rgba(255,51,102,0.4)',
  gold:        '#ffd700',
  goldGlow:    'rgba(255,215,0,0.4)',
  white:       '#ffffff',
  whiteDim:    'rgba(255,255,255,0.15)',
  textPrimary: '#e8f4ff',
  textMuted:   'rgba(180,220,255,0.6)',
  glass:       'rgba(255,255,255,0.06)',
  glassBorder: 'rgba(0,212,255,0.3)',
}

export const SPOON_COUNT  = 14
export const FORK_COUNT   = 10
export const KNIFE_COUNT  = 8
