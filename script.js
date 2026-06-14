'use strict';

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════
var CW = 390, CH = 720;
var RING_R = 46, RING_SW = 11;
var FLICK_MIN = 16;

// リングは画面下60%に出現（片手スワイプ用）
var RING_X0 = 55, RING_X1 = 335;
var RING_Y0 = 360, RING_Y1 = 560;

// ボーナス・スプーンは上エリア
var BONUS_X0 = 80, BONUS_X1 = 310;
var BONUS_Y0 = 120, BONUS_Y1 = 300;

// HUDの高さ（リングはこれより下）
var HUD_H = 108;

var DIRS = ['up','down','left','right'];
var GAP_A = { up: -Math.PI/2, down: Math.PI/2, left: Math.PI, right: 0 };

var C = {
  neon:'#00d4ff', neonG:'rgba(0,212,255,0.35)',
  gold:'#ffd700', goldG:'rgba(255,215,0,0.5)',
  danger:'#ff3366', dangerG:'rgba(255,51,102,0.5)',
  purple:'#7c3aed', purpleG:'rgba(124,58,237,0.3)',
  ok:'#22ee88', okG:'rgba(34,238,136,0.4)',
  white:'#ffffff',
  textP:'#e8f4ff', textM:'rgba(180,220,255,0.6)',
  glassB:'rgba(0,212,255,0.28)', bg1:'#060810'
};

// ═══════════════════════════════════════════════════════════════
// CANVAS
// ═══════════════════════════════════════════════════════════════
var canvas = document.getElementById('c');
var ctx    = canvas.getContext('2d', { alpha: false });

function resize() {
  var mw = Math.min(window.innerWidth, 480);
  var mh = window.innerHeight;
  var sc = Math.min(mw / CW, mh / CH);
  canvas.style.width  = Math.floor(CW * sc) + 'px';
  canvas.style.height = Math.floor(CH * sc) + 'px';
  canvas.width  = CW;
  canvas.height = CH;
}
resize();
window.addEventListener('resize', resize);

// ═══════════════════════════════════════════════════════════════
// GAME STATE
// ═══════════════════════════════════════════════════════════════
var GS = 'start'; // start | playing | result

var score, breakCount, bonusBreak, combo, maxCombo;
var vision;           // 0.1 ~ 2.0
var timeLeft, startTime, surviveTime;
var rings, bullets, particles, spoons, popups, bigMsgs;
var spawnTimer, bonusSpawned, bonusTriggered;
var utensilWave, waveLabel;
var timeScale;

// 視力演出
var visionFlash = 0;     // >0 回復光、<0 ダメージ光
var blurAmt = 0;         // 現在のブラー量（0~1）
var noiseAmt = 0;        // ノイズ量

// ミス跡
var missGhosts = [];

// result buttons
var retryBtn, shareBtn;
var resultBtnsReady = false;

// best
var bestScore = parseInt(localStorage.getItem('vb_best') || '0', 10);

// BG
var bgTime = 0, bgPulse = 0, bgUrgency = 0;
var shakeX = 0, shakeY = 0, shakeDecay = 0;
var scanY  = 0;
var ambients = [], gridLines = [];

// ─── init bg ──────────────────────────────────────────────────
function initBg() {
  gridLines = [];
  var cx = CW/2, cy = CH * 0.35;
  for (var i = 0; i <= 10; i++)
    gridLines.push({ type:'col', x0: i/10*CW, x1:cx, y1:cy });
  for (var j = 1; j <= 8; j++) {
    var t = j/8;
    gridLines.push({ type:'row', y: cy + (CH-cy)*(t*t) });
  }
  ambients = [];
  for (var k = 0; k < 38; k++) ambients.push(mkAmbient());
}

function mkAmbient() {
  return {
    x: Math.random()*CW, y: Math.random()*CH,
    vx: (Math.random()-0.5)*0.18, vy: -(0.18+Math.random()*0.45),
    sz: 1+Math.random()*1.8, al: 0.08+Math.random()*0.35,
    col: Math.random()<0.65 ? C.neon : C.purple
  };
}

// ─── reset ────────────────────────────────────────────────────
function resetGame() {
  rings=[]; bullets=[]; particles=[]; spoons=[]; popups=[]; bigMsgs=[]; missGhosts=[];
  score=0; breakCount=0; bonusBreak=0; combo=0; maxCombo=0;
  vision=1.0; timeLeft=30; surviveTime=0;
  spawnTimer=0; bonusSpawned=false; bonusTriggered=false;
  utensilWave=0; waveLabel='';
  timeScale=1; visionFlash=0; blurAmt=0; noiseAmt=0;
  resultBtnsReady=false;
  shakeDecay=0; shakeX=0; shakeY=0;
}

// ═══════════════════════════════════════════════════════════════
// VISION SYSTEM
// ═══════════════════════════════════════════════════════════════
function clampVision(v) { return Math.round(Math.max(0.1, Math.min(2.0, v)) * 10) / 10; }

function onSuccess() {
  vision = clampVision(vision + 0.1);
  visionFlash = 1.0;  // 正 = 回復
}

function onMiss() {
  vision = clampVision(vision - 0.1);
  visionFlash = -1.0; // 負 = ダメージ
  shakeDecay = 8;
  // ミス跡追加
  missGhosts.push({
    x: 40 + Math.random()*(CW-80),
    y: HUD_H + 20 + Math.random()*(CH-HUD_H-60),
    dir: DIRS[Math.floor(Math.random()*4)],
    r: 55 + Math.random()*60,
    al: 0.14 + Math.random()*0.14,
    rot: Math.random()*Math.PI*2,
    drift: (Math.random()-0.5)*0.008
  });
  // 視力0.1でゲームオーバー
  if (vision <= 0.1) {
    surviveTime = Math.round((performance.now()-startTime)/1000);
    GS = 'result'; saveScore();
  }
}

// 目標blurAmt計算（視力から逆算）
function targetBlur() {
  if (vision >= 0.8) return 0;
  if (vision >= 0.6) return (0.8-vision)/0.2 * 0.25;   // 0~0.25
  if (vision >= 0.4) return 0.25 + (0.6-vision)/0.2 * 0.35; // 0.25~0.6
  return 0.6 + (0.4-vision)/0.3 * 0.4;  // 0.6~1.0
}

// ═══════════════════════════════════════════════════════════════
// BLUR / DISTORTION OVERLAY
// ═══════════════════════════════════════════════════════════════
function drawBlurOverlay() {
  var tb = targetBlur();
  blurAmt += (tb - blurAmt) * 0.08;

  // 回復フラッシュ（visionFlash>0）→ blurをその瞬間だけ薄める
  var flashBlur = blurAmt;
  if (visionFlash > 0) flashBlur *= (1 - visionFlash * 0.7);

  if (flashBlur < 0.01 && noiseAmt < 0.01) return;

  // ぼやけ = 複数の半透明層を重ねる（CSSフィルタ不可なのでCanvas擬似ブラー）
  if (flashBlur > 0.05) {
    var layers = Math.floor(flashBlur * 5) + 1;
    var layerAlpha = flashBlur * 0.06;
    ctx.save();
    ctx.globalAlpha = Math.min(0.35, layerAlpha);
    for (var li = 0; li < layers; li++) {
      var ox = (Math.random()-0.5) * flashBlur * 12;
      var oy = (Math.random()-0.5) * flashBlur * 12;
      // 現フレームをずらして再描画は重いので代わりに暗い矩形でぼかし感
      ctx.fillStyle = 'rgba(10,14,26,' + (flashBlur * 0.12) + ')';
      ctx.fillRect(0, 0, CW, CH);
    }
    ctx.restore();

    // 色収差チック（赤/青を微妙にずらす）
    if (flashBlur > 0.3) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = flashBlur * 0.04;
      ctx.fillStyle = 'rgba(255,0,0,1)';
      ctx.fillRect(-flashBlur*6, 0, CW, CH);
      ctx.fillStyle = 'rgba(0,0,255,1)';
      ctx.fillRect(flashBlur*6, 0, CW, CH);
      ctx.globalCompositeOperation = 'source-over';
      ctx.restore();
    }
  }

  // 暗化
  if (flashBlur > 0.45) {
    ctx.fillStyle = 'rgba(0,0,0,' + ((flashBlur-0.45)*0.65) + ')';
    ctx.fillRect(0,0,CW,CH);
  }

  // ノイズ（視力 0.4以下）
  if (vision <= 0.4) {
    noiseAmt += (((0.4-vision)/0.3) - noiseAmt)*0.1;
    var nd = ctx.getImageData(0,0,CW,CH);
    var dd = nd.data;
    var nm = noiseAmt * 60;
    for (var pi=0; pi<dd.length; pi+=16) {
      var nv = (Math.random()-0.5)*nm;
      dd[pi] = Math.min(255,Math.max(0,dd[pi]+nv));
      dd[pi+1]=Math.min(255,Math.max(0,dd[pi+1]+nv));
      dd[pi+2]=Math.min(255,Math.max(0,dd[pi+2]+nv));
    }
    ctx.putImageData(nd,0,0);
  } else {
    noiseAmt *= 0.9;
  }

  // 回復フラッシュ（白く光る）
  if (visionFlash > 0) {
    ctx.fillStyle = 'rgba(0,220,255,' + (visionFlash * 0.18) + ')';
    ctx.fillRect(0,0,CW,CH);
  }
  // ダメージフラッシュ（赤く光る）
  if (visionFlash < 0) {
    ctx.fillStyle = 'rgba(255,30,80,' + (Math.abs(visionFlash) * 0.22) + ')';
    ctx.fillRect(0,0,CW,CH);
  }
}

// ═══════════════════════════════════════════════════════════════
// MISS GHOSTS
// ═══════════════════════════════════════════════════════════════
function drawMissGhosts() {
  for (var i=0; i<missGhosts.length; i++) {
    var g = missGhosts[i];
    g.rot += g.drift;
    var base = GAP_A[g.dir];
    var gap  = Math.PI * 0.44;
    ctx.save();
    ctx.translate(g.x, g.y);
    ctx.rotate(g.rot);
    ctx.globalAlpha = g.al;
    ctx.strokeStyle = C.danger;
    ctx.lineWidth   = g.r * 0.2;
    ctx.lineCap     = 'round';
    ctx.shadowColor = C.danger; ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(0, 0, g.r, base+gap, base+Math.PI*2-gap);
    ctx.stroke();
    ctx.restore();
  }
}

// ═══════════════════════════════════════════════════════════════
// RINGS
// ═══════════════════════════════════════════════════════════════
// state: 'alive' | 'hit' | 'breaking' | 'dead'
function mkRing(x, y, dir) {
  return {
    x:x, y:y, dir:dir, isBonus:dir===null,
    sc:0.05, tsc:1,
    state:'alive',
    breakP:0,
    glowPh: Math.random()*Math.PI*2,
    depthPh: Math.random()*Math.PI*2
  };
}

function updateRing(r, dt, t) {
  if (r.sc < r.tsc) r.sc = Math.min(r.tsc, r.sc + dt*2.4);
  if (r.state==='alive' && r.sc>=0.99)
    r.tsc = 1 + Math.sin(t*2.2+r.depthPh)*0.022;
  if (r.state==='breaking') {
    r.breakP += dt * 3.5;   // 0.29秒で消滅
    if (r.breakP >= 1) r.state = 'dead';
  }
  r.glowPh += dt*3.8;
}

function drawRing(r) {
  if (r.state==='dead' || r.state==='hit') return;  // hit後は即非表示
  var alpha = r.state==='breaking' ? Math.max(0, 1 - r.breakP*r.breakP) : 1;
  ctx.save();
  ctx.translate(r.x, r.y);
  ctx.scale(r.sc, r.sc);
  ctx.globalAlpha = alpha;
  var gw = (Math.sin(r.glowPh)+1)/2;
  if (r.isBonus) drawBonusRing(r, gw);
  else           drawCRing(r, gw);
  if (r.state==='breaking') drawShards(r.breakP, false);
  ctx.restore();
}

function drawCRing(r, gw) {
  var gap = Math.PI*0.44;
  var base = r.dir ? GAP_A[r.dir] : 0;
  var sa = base+gap, ea = base+Math.PI*2-gap;

  // glow halo
  ctx.strokeStyle = 'rgba(0,212,255,'+(0.14+gw*0.1)+')';
  ctx.lineWidth=RING_SW+13; ctx.shadowColor=C.neon; ctx.shadowBlur=24+gw*10;
  ctx.lineCap='round';
  ctx.beginPath(); ctx.arc(0,0,RING_R,sa,ea); ctx.stroke();
  // white arc
  ctx.strokeStyle=C.white; ctx.lineWidth=RING_SW; ctx.shadowBlur=6;
  ctx.beginPath(); ctx.arc(0,0,RING_R,sa,ea); ctx.stroke();
  // inner accent
  ctx.strokeStyle=C.neon; ctx.lineWidth=2.5; ctx.shadowBlur=0;
  ctx.globalAlpha *= 0.5;
  ctx.beginPath(); ctx.arc(0,0,RING_R-RING_SW*0.28,sa,ea); ctx.stroke();
  ctx.globalAlpha /= 0.5;
  // arrow hint
  if (!r.hit) drawArrowHint(r.dir, gw);
}

function drawArrowHint(dir, gw) {
  var a=GAP_A[dir], r1=RING_R+18, r2=RING_R+32;
  var ax=Math.cos(a), ay=Math.sin(a);
  ctx.save();
  ctx.globalAlpha *= (0.25+gw*0.28);
  ctx.strokeStyle=C.neon; ctx.lineWidth=2; ctx.lineCap='round';
  ctx.shadowColor=C.neon; ctx.shadowBlur=7;
  ctx.beginPath(); ctx.moveTo(ax*r1,ay*r1); ctx.lineTo(ax*r2,ay*r2); ctx.stroke();
  var ha=Math.PI/5;
  ctx.beginPath();
  ctx.moveTo(ax*r2,ay*r2);
  ctx.lineTo(ax*r2+Math.cos(a+Math.PI+ha)*9,ay*r2+Math.sin(a+Math.PI+ha)*9);
  ctx.moveTo(ax*r2,ay*r2);
  ctx.lineTo(ax*r2+Math.cos(a+Math.PI-ha)*9,ay*r2+Math.sin(a+Math.PI-ha)*9);
  ctx.stroke();
  ctx.restore();
}

function drawBonusRing(r, gw) {
  var p = 0.88+gw*0.14;
  // outer corona
  ctx.strokeStyle='rgba(255,215,0,'+(0.22+gw*0.18)+')';
  ctx.lineWidth=RING_SW+18; ctx.shadowColor=C.gold; ctx.shadowBlur=36+gw*18;
  ctx.beginPath(); ctx.arc(0,0,RING_R*p*1.4,0,Math.PI*2); ctx.stroke();
  // main
  ctx.strokeStyle=C.gold; ctx.lineWidth=RING_SW+2; ctx.shadowBlur=14;
  ctx.beginPath(); ctx.arc(0,0,RING_R*1.4,0,Math.PI*2); ctx.stroke();
  // inner
  ctx.strokeStyle='#fff9c4'; ctx.lineWidth=3; ctx.shadowBlur=0;
  ctx.beginPath(); ctx.arc(0,0,(RING_R-5)*1.4,0,Math.PI*2); ctx.stroke();
  // TAP label
  ctx.fillStyle=C.gold; ctx.shadowColor=C.gold; ctx.shadowBlur=14;
  ctx.font='900 22px system-ui'; ctx.textAlign='center';
  ctx.fillText('TAP!',0,8);
}

function drawShards(prog, isMiss) {
  var spread=prog*88, al=(1-prog)*(1-prog);
  for (var i=0;i<12;i++) {
    var a=(i/12)*Math.PI*2, d=spread*(0.5+(i%3)*0.25);
    var len=(9+(i%4)*5)*(1-prog*0.55);
    ctx.save();
    ctx.globalAlpha=al;
    ctx.translate(Math.cos(a)*d,Math.sin(a)*d);
    ctx.rotate(a);
    ctx.strokeStyle=isMiss?C.danger:(i%2===0?C.white:C.neon);
    ctx.lineWidth=2; ctx.shadowColor=isMiss?C.danger:C.neon; ctx.shadowBlur=10;
    ctx.beginPath(); ctx.moveTo(-len/2,0); ctx.lineTo(len/2,0); ctx.stroke();
    ctx.restore();
  }
}

// ═══════════════════════════════════════════════════════════════
// BULLETS
// ═══════════════════════════════════════════════════════════════
function mkBullet(fx, fy, ring) {
  return {
    sx:fx, sy:fy,
    dx:ring.x-fx, dy:ring.y-fy,
    angle:Math.atan2(ring.y-fy,ring.x-fx),
    prog:0, dead:false, ring:ring
  };
}

function updateBullet(b, dt) {
  b.prog += dt*5;
  if (b.prog>=1) {
    b.prog=1;
    // 着弾時にbreakingへ（hitはすでにtrue）
    if (b.ring.state==='hit') b.ring.state='breaking';
    b.dead=true;
  }
}

function drawBullet(b) {
  if (b.dead) return;
  var ex=b.sx+b.dx*b.prog, ey=b.sy+b.dy*b.prog;
  ctx.save();
  ctx.translate(ex,ey); ctx.rotate(b.angle);
  var tl=28;
  var g=ctx.createLinearGradient(-tl,0,0,0);
  g.addColorStop(0,'transparent'); g.addColorStop(1,C.neon);
  ctx.strokeStyle=g; ctx.lineWidth=5; ctx.shadowColor=C.neon; ctx.shadowBlur=18;
  ctx.beginPath(); ctx.moveTo(-tl,0); ctx.lineTo(0,0); ctx.stroke();
  ctx.fillStyle=C.white; ctx.shadowBlur=24;
  ctx.beginPath(); ctx.arc(0,0,5.5,0,Math.PI*2); ctx.fill();
  ctx.fillStyle=C.neon; ctx.shadowBlur=0;
  ctx.beginPath(); ctx.arc(0,0,3,0,Math.PI*2); ctx.fill();
  ctx.restore();
}

// ═══════════════════════════════════════════════════════════════
// PARTICLES
// ═══════════════════════════════════════════════════════════════
function emitP(x,y,opts) {
  var cnt=opts.cnt||10, col=opts.col||C.neon, gl=opts.gl||C.neonG;
  var spd=opts.spd||4, life=opts.life||0.9, sz=opts.sz||4, shape=opts.shape||'c';
  for (var i=0;i<cnt;i++) {
    var a=Math.random()*Math.PI*2, s=spd*(0.4+Math.random()*0.6);
    particles.push({
      x:x,y:y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,
      life:life,ml:life,col:col,gl:gl,
      sz:sz*(0.5+Math.random()*0.5),shape:shape,drag:0.93
    });
  }
}
function burst(x,y,opts){ emitP(x,y,Object.assign({cnt:28,spd:7,sz:5,life:1.1},opts)); }
function sparks(x,y,opts){ emitP(x,y,Object.assign({cnt:20,spd:8,sz:2,life:0.65,shape:'s',col:C.white,gl:'rgba(255,255,255,0.8)'},opts)); }

function updateParticles(dt) {
  for (var i=particles.length-1;i>=0;i--) {
    var p=particles[i];
    p.x+=p.vx; p.y+=p.vy; p.vy+=0.22; p.vx*=p.drag; p.vy*=p.drag; p.life-=dt;
    if (p.life<=0) particles.splice(i,1);
  }
}
function drawParticles() {
  for (var i=0;i<particles.length;i++) {
    var p=particles[i];
    var al=Math.min(1,p.life/p.ml);
    ctx.save(); ctx.globalAlpha=al;
    if (p.shape==='s') {
      ctx.strokeStyle=p.col; ctx.lineWidth=p.sz;
      ctx.shadowColor=p.gl; ctx.shadowBlur=9;
      ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(p.x-p.vx*4,p.y-p.vy*4); ctx.stroke();
    } else {
      ctx.fillStyle=p.col; ctx.shadowColor=p.gl; ctx.shadowBlur=13;
      ctx.beginPath(); ctx.arc(p.x,p.y,p.sz*al,0,Math.PI*2); ctx.fill();
    }
    ctx.restore();
  }
}

// ═══════════════════════════════════════════════════════════════
// SPOONS (bonus utensils)
// ═══════════════════════════════════════════════════════════════
var SPOON_COLS = ['#b0c8e8','#c8b0e8','#e8d0b0','#b0e8c8','#e8b0c8'];

function mkSpoon(wave) {
  var bigScale = 0.7 + Math.random()*1.1;   // かなり大きい
  return {
    type: wave===2 ? (Math.random()<0.5?'fork':'knife') : 'spoon',
    wave: wave, alive: true,
    x: 20 + Math.random()*(CW-40),
    y: HUD_H + 20 + Math.random()*(RING_Y0-HUD_H-40),
    vx: (Math.random()-0.5)*2.8,
    vy: (Math.random()-0.5)*2.8,
    angle: Math.random()*Math.PI*2,
    spin: (Math.random()-0.5)*0.08,
    sc: bigScale,
    pulse: Math.random()*Math.PI*2,
    col: SPOON_COLS[Math.floor(Math.random()*SPOON_COLS.length)]
  };
}

function updateSpoon(u, dt) {
  u.pulse+=dt*3; u.angle+=u.spin;
  u.x+=u.vx*0.55; u.y+=u.vy*0.55;
  u.vx*=0.996; u.vy*=0.996;
  var yMax = RING_Y0 - 20;
  if(u.x<20)u.vx=Math.abs(u.vx)+0.4;
  if(u.x>CW-20)u.vx=-Math.abs(u.vx)-0.4;
  if(u.y<HUD_H+10)u.vy=Math.abs(u.vy)+0.4;
  if(u.y>yMax)u.vy=-Math.abs(u.vy)-0.4;
}

function drawSpoon(u) {
  if (!u.alive) return;
  var gw=(Math.sin(u.pulse)+1)/2;
  ctx.save();
  ctx.translate(u.x,u.y); ctx.rotate(u.angle); ctx.scale(u.sc,u.sc);
  ctx.shadowColor=u.col; ctx.shadowBlur=14+gw*12;
  ctx.fillStyle=u.col; ctx.strokeStyle='rgba(255,255,255,0.5)'; ctx.lineWidth=2.5;

  if (u.type==='spoon') {
    // 柄
    ctx.beginPath(); rrect(ctx,-5,12,10,52,5); ctx.fill(); ctx.stroke();
    // ボウル
    ctx.beginPath(); ctx.ellipse(0,-12,18,22,0,0,Math.PI*2); ctx.fill(); ctx.stroke();
    // 光沢
    ctx.fillStyle='rgba(255,255,255,0.38)';
    ctx.beginPath(); ctx.ellipse(-6,-18,5,7,-0.4,0,Math.PI*2); ctx.fill();
  } else if (u.type==='fork') {
    ctx.beginPath(); rrect(ctx,-5,12,10,52,5); ctx.fill(); ctx.stroke();
    [-9,-3,3,9].forEach(function(tx){
      ctx.beginPath(); ctx.moveTo(tx,10); ctx.lineTo(tx,-26); ctx.stroke();
      ctx.beginPath(); ctx.arc(tx,-26,3,0,Math.PI*2); ctx.fill();
    });
    ctx.beginPath(); ctx.moveTo(-9,-12); ctx.lineTo(9,-12); ctx.stroke();
  } else {
    ctx.beginPath(); rrect(ctx,-6,20,12,46,6); ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-6,20); ctx.lineTo(-6,-10); ctx.lineTo(0,-30); ctx.lineTo(6,-10); ctx.lineTo(6,20);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle='rgba(255,255,255,0.28)';
    ctx.beginPath(); ctx.moveTo(-2,16); ctx.lineTo(-2,-6); ctx.lineTo(0,-24); ctx.lineTo(2,-6); ctx.lineTo(2,16); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

function spoonHit(u,px,py){ return Math.hypot(px-u.x,py-u.y)<34*u.sc; }

function spawnWave1() {
  spoons=[];
  for(var i=0;i<22;i++) spoons.push(mkSpoon(1));  // 大量！
  utensilWave=1; waveLabel='🥄 SPOON BREAK! ×2';
  bigMsgs.push(mkBig('SPOON\nBREAK!','タップで全部壊せ！',C.neon,2.0));
  shakeDecay=5;
}
function spawnWave2() {
  spoons=[];
  for(var i=0;i<18;i++) spoons.push(mkSpoon(2));
  utensilWave=2; waveLabel='🍴 FORK & KNIFE! ×4';
  bigMsgs.push(mkBig('WAVE 2!','フォーク＆ナイフ ×4','#c8b0e8',1.8));
  shakeDecay=6;
}

// ═══════════════════════════════════════════════════════════════
// POPUPS & BIG MSGS
// ═══════════════════════════════════════════════════════════════
function mkPop(x,y,text,col){ return {x:x,y:y,text:text,col:col||C.neon,life:1.0,vy:-1.9}; }
function updPop(p,dt){ p.y+=p.vy; p.life-=dt*1.9; }
function drawPop(p) {
  if(p.life<=0)return;
  ctx.save(); ctx.globalAlpha=Math.min(1,p.life*2.2);
  ctx.fillStyle=p.col; ctx.font='700 21px system-ui'; ctx.textAlign='center';
  ctx.shadowColor=p.col; ctx.shadowBlur=14;
  ctx.fillText(p.text,p.x,p.y); ctx.restore();
}

function mkBig(text,sub,col,dur){ return {text:text,sub:sub||'',col:col||C.neon,life:dur||1.0,ml:dur||1.0,sc:1.5}; }
function updBig(m,dt){ m.life-=dt; m.sc=Math.max(1,m.sc-dt*3.5); }
function drawBig(m) {
  if(m.life<=0)return;
  var al=Math.min(1,m.life/m.ml*2.2);
  ctx.save(); ctx.globalAlpha=al; ctx.textAlign='center';
  // 改行対応
  var lines=m.text.split('\n');
  var y0=CH*0.43 - (lines.length-1)*30;
  ctx.font='900 '+(Math.round(48*m.sc))+'px system-ui';
  ctx.fillStyle=m.col; ctx.shadowColor=m.col; ctx.shadowBlur=32;
  ctx.strokeStyle='rgba(0,0,0,0.7)'; ctx.lineWidth=7; ctx.lineJoin='round';
  for (var li=0;li<lines.length;li++) {
    ctx.strokeText(lines[li],CW/2,y0+li*56*m.sc);
    ctx.fillText(lines[li],CW/2,y0+li*56*m.sc);
  }
  if(m.sub){
    ctx.font='600 17px system-ui'; ctx.shadowBlur=10;
    ctx.fillStyle='rgba(255,255,255,0.88)'; ctx.shadowColor='rgba(255,255,255,0.5)';
    ctx.fillText(m.sub,CW/2,y0+lines.length*56*m.sc+10);
  }
  ctx.restore();
}

// ═══════════════════════════════════════════════════════════════
// BACKGROUND
// ═══════════════════════════════════════════════════════════════
function updateBg(dt) {
  bgTime+=dt;
  if(shakeDecay>0){
    shakeX=(Math.random()-0.5)*shakeDecay; shakeY=(Math.random()-0.5)*shakeDecay;
    shakeDecay*=0.74; if(shakeDecay<0.28)shakeDecay=0;
  } else { shakeX=0; shakeY=0; }
  scanY=(scanY+1.6+bgUrgency*2.8)%CH;
  for(var i=0;i<ambients.length;i++){
    var p=ambients[i]; p.x+=p.vx; p.y+=p.vy;
    if(p.y<-5){p.y=CH+5;p.x=Math.random()*CW;}
  }
}

function drawBg() {
  ctx.save(); ctx.translate(shakeX,shakeY);
  var bg=ctx.createRadialGradient(CW/2,CH*0.36,0,CW/2,CH/2,CH*0.82);
  bg.addColorStop(0,'#0d1528'); bg.addColorStop(0.5,'#080d1a'); bg.addColorStop(1,C.bg1);
  ctx.fillStyle=bg; ctx.fillRect(-shakeX,-shakeY,CW,CH);
  if(bgUrgency>0){
    var vig=ctx.createRadialGradient(CW/2,CH/2,CH*0.14,CW/2,CH/2,CH*0.74);
    vig.addColorStop(0,'transparent');
    vig.addColorStop(1,'rgba(255,30,60,'+(0.22*bgUrgency)+')');
    ctx.fillStyle=vig; ctx.fillRect(-shakeX,-shakeY,CW,CH);
  }
  // grid
  var pls=(Math.sin(bgTime*3)+1)/2;
  var bA=0.055+pls*0.035*bgPulse+bgUrgency*0.04;
  var gcx=CW/2,gcy=CH*0.35;
  ctx.strokeStyle=C.neon; ctx.lineWidth=0.5;
  for(var i=0;i<gridLines.length;i++){
    var l=gridLines[i];
    if(l.type==='col'){
      ctx.globalAlpha=bA;
      ctx.beginPath(); ctx.moveTo(l.x0,CH); ctx.lineTo(l.x1,l.y1); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(l.x0,0); ctx.lineTo(l.x1,l.y1); ctx.stroke();
    } else {
      var t=(l.y-gcy)/(CH-gcy),hw=CW/2*t;
      ctx.globalAlpha=bA*t;
      ctx.beginPath(); ctx.moveTo(gcx-hw,l.y); ctx.lineTo(gcx+hw,l.y); ctx.stroke();
    }
  }
  ctx.globalAlpha=1;
  if(bgPulse>0){
    var bt=(Math.sin(bgTime*8)+1)/2;
    var gr=ctx.createRadialGradient(CW/2,CH*0.5,0,CW/2,CH*0.5,(80+bt*55)*bgPulse);
    gr.addColorStop(0,'rgba(124,58,237,'+(0.26*bgPulse)+')');
    gr.addColorStop(1,'transparent');
    ctx.fillStyle=gr; ctx.fillRect(-shakeX,-shakeY,CW,CH);
  }
  for(var i=0;i<ambients.length;i++){
    var p=ambients[i];
    ctx.globalAlpha=p.al; ctx.fillStyle=p.col;
    ctx.shadowColor=p.col; ctx.shadowBlur=5;
    ctx.beginPath(); ctx.arc(p.x,p.y,p.sz,0,Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha=1; ctx.shadowBlur=0;
  var sa=0.04+bgUrgency*0.07;
  var sg=ctx.createLinearGradient(0,scanY-28,0,scanY+28);
  sg.addColorStop(0,'transparent');
  sg.addColorStop(0.5,'rgba(0,212,255,'+sa+')');
  sg.addColorStop(1,'transparent');
  ctx.fillStyle=sg; ctx.fillRect(-shakeX,scanY-28,CW,56);
  ctx.restore();
}

// ═══════════════════════════════════════════════════════════════
// HUD
// ═══════════════════════════════════════════════════════════════
var comboAnim = 0; // >0 で光る

function drawHUD() {
  var urgent = timeLeft<=10;
  ctx.save();
  // パネル背景
  ctx.fillStyle='rgba(6,10,22,0.78)';
  rrect(ctx,0,0,CW,HUD_H,0); ctx.fill();
  ctx.strokeStyle=C.glassB; ctx.lineWidth=0.5;
  rrect(ctx,0,0,CW,HUD_H,0); ctx.stroke();

  // ── SCORE ──
  ctx.fillStyle=C.textM; ctx.font='500 10px system-ui'; ctx.textAlign='left';
  ctx.fillText('SCORE',14,18);
  ctx.fillStyle=C.textP; ctx.font='700 30px system-ui';
  ctx.shadowColor=C.neon; ctx.shadowBlur=6;
  ctx.fillText(String(score).padStart(6,'0'),14,50);

  // ── TIME ──
  ctx.fillStyle=C.textM; ctx.font='500 10px system-ui'; ctx.textAlign='center';
  ctx.fillText('TIME',CW/2,18);
  var blink=urgent&&Math.floor(Date.now()/200)%2===0;
  ctx.fillStyle=urgent?(blink?'#ff3366':'#ff8888'):C.textP;
  ctx.font='700 30px system-ui';
  ctx.shadowColor=urgent?C.danger:C.neon; ctx.shadowBlur=urgent?20:6;
  ctx.fillText(Math.ceil(timeLeft),CW/2,50);

  // ── VISION ──
  var vCol = vision<=0.3?'#ff4466':(vision<=0.6?'#ffaa44':(visionFlash>0?'#88ffee':C.neon));
  ctx.fillStyle=C.textM; ctx.font='500 10px system-ui'; ctx.textAlign='right';
  ctx.fillText('VISION',CW-14,18);
  ctx.fillStyle=vCol; ctx.font='700 30px system-ui';
  ctx.shadowColor=vCol; ctx.shadowBlur=visionFlash>0?18:6;
  ctx.fillText(vision.toFixed(1),CW-14,50);
  ctx.shadowBlur=0;

  // ── COMBO（右上固定・小さめ・邪魔しない）──
  if (combo>=2) {
    var cGlow = Math.max(0,comboAnim);
    var cCol  = combo>=8?C.gold:(combo>=4?'#88eeff':C.neon);
    var cSz   = combo>=8?16:(combo>=4?15:14);
    ctx.textAlign='right'; ctx.font='700 '+cSz+'px system-ui';
    ctx.fillStyle=cCol;
    ctx.shadowColor=cCol; ctx.shadowBlur=6+cGlow*12;
    ctx.globalAlpha=0.82+cGlow*0.18;
    ctx.fillText('×'+combo+' COMBO',CW-10,80);
    ctx.globalAlpha=1; ctx.shadowBlur=0;
  }

  // ── WAVE LABEL ──
  if (utensilWave>0&&waveLabel) {
    ctx.textAlign='left'; ctx.fillStyle=C.gold;
    ctx.font='700 11px system-ui';
    ctx.shadowColor=C.goldG; ctx.shadowBlur=8;
    ctx.fillText(waveLabel,14,78);
    ctx.shadowBlur=0;
  }

  ctx.restore();
}

// ═══════════════════════════════════════════════════════════════
// START SCREEN
// ═══════════════════════════════════════════════════════════════
function drawStart() {
  ctx.save();
  ctx.fillStyle='rgba(6,8,16,0.9)'; ctx.fillRect(0,0,CW,CH);
  var cx=CW/2, cy=CH*0.30, pls=(Math.sin(bgTime*2)+1)/2;

  // 大きいCリングアニメ
  ctx.strokeStyle='rgba(0,212,255,'+(0.1+pls*0.1)+')';
  ctx.lineWidth=32; ctx.shadowColor=C.neon; ctx.shadowBlur=35;
  ctx.beginPath(); ctx.arc(cx,cy,78,0.55,Math.PI*2-0.55); ctx.stroke();
  ctx.strokeStyle=C.neon; ctx.lineWidth=12; ctx.shadowBlur=20;
  ctx.beginPath(); ctx.arc(cx,cy,78,0.55,Math.PI*2-0.55); ctx.stroke();
  ctx.strokeStyle='rgba(255,255,255,0.55)'; ctx.lineWidth=2; ctx.shadowBlur=0;
  ctx.beginPath(); ctx.arc(cx,cy,68,0.55,Math.PI*2-0.55); ctx.stroke();

  ctx.textAlign='center';
  ctx.font='900 42px system-ui'; ctx.fillStyle=C.white;
  ctx.shadowColor=C.neon; ctx.shadowBlur=22;
  ctx.fillText('VISION',cx,cy+146);
  ctx.fillStyle=C.neon; ctx.shadowBlur=34;
  ctx.fillText('BREAK',cx,cy+194); ctx.shadowBlur=0;
  ctx.font='400 13px system-ui'; ctx.fillStyle=C.textM;
  ctx.fillText('近未来視覚トレーニング',cx,cy+222);
  if(bestScore>0){
    ctx.font='500 12px system-ui';
    ctx.fillText('BEST  '+String(bestScore).padStart(6,'0'),cx,cy+248);
  }

  // TAP TO START
  var bx=cx-100,by=CH*0.70;
  glassBtn(bx,by,200,56,C.neon,pls);
  ctx.fillStyle=C.white; ctx.font='700 20px system-ui'; ctx.textAlign='center';
  ctx.shadowColor=C.neon; ctx.shadowBlur=12;
  ctx.fillText('TAP TO START',cx,by+37); ctx.shadowBlur=0;

  ctx.font='400 11px system-ui'; ctx.fillStyle=C.textM;
  ctx.fillText('フリック→Cの向き  ／  タップ→Oをタップ',cx,CH-48);
  // 注意書き
  ctx.font='400 9px system-ui'; ctx.fillStyle='rgba(150,180,220,0.5)';
  ctx.fillText('※このゲーム内の視力スコアは演出上の数値であり、実際の視力測定ではありません。',cx,CH-22);
  ctx.restore();
}

// ═══════════════════════════════════════════════════════════════
// RESULT SCREEN
// ═══════════════════════════════════════════════════════════════
function drawResult() {
  ctx.save();
  ctx.fillStyle='rgba(6,8,16,0.94)'; ctx.fillRect(0,0,CW,CH);
  var cx=CW/2, pls=(Math.sin(bgTime*2.5)+1)/2;
  var isVO = vision<=0.1;
  var pw=330,ph=460,px=(CW-pw)/2,py=(CH-ph)/2;
  glassPanel(px,py,pw,ph,22);

  ctx.textAlign='center'; ctx.font='900 32px system-ui';
  ctx.fillStyle=isVO?C.danger:C.neon;
  ctx.shadowColor=isVO?C.dangerG:C.neonG; ctx.shadowBlur=20;
  ctx.fillText(isVO?'VISION LOST':'TIME UP!',cx,py+56); ctx.shadowBlur=0;

  var isNB=(score>bestScore&&score>0);
  if(isNB){
    ctx.font='700 13px system-ui'; ctx.fillStyle=C.gold;
    ctx.shadowColor=C.goldG; ctx.shadowBlur=14;
    ctx.fillText('★ NEW BEST ★',cx,py+82); ctx.shadowBlur=0;
  }

  var stats=[
    ['SCORE',   String(score).padStart(6,'0'), C.neon],
    ['BREAK',   breakCount,   C.textP],
    ['COMBO',   '×'+maxCombo, C.textP],
    ['BONUS',   bonusBreak,   C.gold],
    ['VISION',  vision.toFixed(1), vision<=0.3?C.danger:(vision<=0.6?'#ffaa44':C.ok)],
    ['SURVIVE', surviveTime+'s', C.textM]
  ];
  for(var i=0;i<stats.length;i++){
    var s=stats[i],ry=py+108+i*50;
    ctx.fillStyle=i%2===0?'rgba(255,255,255,0.03)':'transparent';
    ctx.fillRect(px+10,ry-16,pw-20,40);
    ctx.fillStyle=C.textM; ctx.font='500 11px system-ui'; ctx.textAlign='left';
    ctx.fillText(s[0],px+22,ry+4);
    ctx.fillStyle=s[2]; ctx.font='700 23px system-ui'; ctx.textAlign='right';
    ctx.shadowColor=s[2]; ctx.shadowBlur=5;
    ctx.fillText(s[1],px+pw-22,ry+4); ctx.shadowBlur=0;
  }

  ctx.strokeStyle=C.glassB; ctx.lineWidth=0.5;
  ctx.beginPath(); ctx.moveTo(px+16,py+415); ctx.lineTo(px+pw-16,py+415); ctx.stroke();
  ctx.font='400 9px system-ui'; ctx.fillStyle=C.textM; ctx.textAlign='center';
  ctx.fillText('VISION BREAK  SCORE '+score+'  #VISIONBREAK',cx,py+430);
  ctx.font='400 8px system-ui'; ctx.fillStyle='rgba(150,180,220,0.4)';
  ctx.fillText('※視力スコアは演出上の数値です。',cx,py+446);

  var bw=136,bh=52;
  var b1x=cx-bw-7,b2x=cx+7,bby=py+ph-64;
  glassBtn(b1x,bby,bw,bh,C.purple,pls);
  ctx.fillStyle=C.white; ctx.font='700 17px system-ui'; ctx.textAlign='center';
  ctx.shadowColor=C.purple; ctx.shadowBlur=10;
  ctx.fillText('RETRY',b1x+bw/2,bby+34);
  glassBtn(b2x,bby,bw,bh,C.neon,pls);
  ctx.fillStyle=C.white; ctx.shadowColor=C.neon; ctx.shadowBlur=10;
  ctx.fillText('SHARE',b2x+bw/2,bby+34); ctx.shadowBlur=0;

  retryBtn={x:b1x,y:bby,w:bw,h:bh};
  shareBtn={x:b2x,y:bby,w:bw,h:bh};
  resultBtnsReady=true;
  ctx.restore();
}

// ═══════════════════════════════════════════════════════════════
// UI HELPERS
// ═══════════════════════════════════════════════════════════════
function rrect(c,x,y,w,h,r) {
  c.beginPath();
  c.moveTo(x+r,y); c.lineTo(x+w-r,y); c.arcTo(x+w,y,x+w,y+r,r);
  c.lineTo(x+w,y+h-r); c.arcTo(x+w,y+h,x+w-r,y+h,r);
  c.lineTo(x+r,y+h); c.arcTo(x,y+h,x,y+h-r,r);
  c.lineTo(x,y+r); c.arcTo(x,y,x+r,y,r);
  c.closePath();
}
function glassPanel(x,y,w,h,r) {
  ctx.shadowColor='rgba(0,212,255,0.1)'; ctx.shadowBlur=44;
  ctx.fillStyle='rgba(11,17,34,0.94)';
  rrect(ctx,x,y,w,h,r); ctx.fill(); ctx.shadowBlur=0;
  ctx.strokeStyle=C.glassB; ctx.lineWidth=1;
  rrect(ctx,x,y,w,h,r); ctx.stroke();
  var sh=ctx.createLinearGradient(x,y,x,y+60);
  sh.addColorStop(0,'rgba(255,255,255,0.07)'); sh.addColorStop(1,'transparent');
  ctx.fillStyle=sh; rrect(ctx,x,y,w,60,r); ctx.fill();
}
function glassBtn(x,y,w,h,col,pls) {
  pls=pls||0;
  var rv=parseInt(col.slice(1,3),16),gv=parseInt(col.slice(3,5),16),bv=parseInt(col.slice(5,7),16);
  ctx.shadowColor=col; ctx.shadowBlur=10+pls*10;
  ctx.fillStyle='rgba('+rv+','+gv+','+bv+',0.13)';
  rrect(ctx,x,y,w,h,14); ctx.fill(); ctx.shadowBlur=0;
  ctx.strokeStyle=col; ctx.lineWidth=1.5;
  rrect(ctx,x,y,w,h,14); ctx.stroke();
}
function inRect(x,y,r){return x>=r.x&&x<=r.x+r.w&&y>=r.y&&y<=r.y+r.h;}

// ═══════════════════════════════════════════════════════════════
// GAME LOGIC
// ═══════════════════════════════════════════════════════════════
function getRingCount() {
  if(timeLeft>20)return 1;
  if(timeLeft>10)return 2;
  return 3;
}
function getSpawnInterval() {
  if(timeLeft>20)return 2.6;
  if(timeLeft>10)return 1.6;
  return 0.9;
}

function spawnRing() {
  var dir=DIRS[Math.floor(Math.random()*4)];
  var x=RING_X0+Math.random()*(RING_X1-RING_X0);
  var y=RING_Y0+Math.random()*(RING_Y1-RING_Y0);
  rings.push(mkRing(x,y,dir));
}

function spawnBonusO() {
  // 画面中央付近、大きく目立つ
  var x=CW/2 + (Math.random()-0.5)*80;
  var y=RING_Y0+60+Math.random()*80;
  var r=mkRing(x,y,null);
  r.sc=0.05; r.tsc=1;
  rings.push(r);
  bonusTriggered=true;
  // 大きい告知
  bigMsgs.push(mkBig('BONUS!','Oをタップ！',C.gold,1.4));
  shakeDecay=4;
}

// リングヒット（フリック成功）
function hitRingFlick(ring, fx, fy) {
  ring.state='hit';      // 即座に描画から外す
  ring.hit=true;
  bullets.push(mkBullet(fx,fy,ring));
  // 少し後にbreakingへ（弾が着弾時にbreakingに切り替わる）

  combo++; maxCombo=Math.max(maxCombo,combo); breakCount++;
  comboAnim=1.0;

  var base=100+combo*18;
  var pts=combo>=5?Math.round(base*1.25):base;
  score+=pts; saveScore();

  onSuccess(); // 視力+0.1

  burst(ring.x,ring.y,{col:C.neon,gl:C.neonG});
  sparks(ring.x,ring.y);
  popups.push(mkPop(ring.x,ring.y-26,'+'+pts,C.neon));
  if(combo>=10){bigMsgs.push(mkBig(combo+' COMBO!!','すごい！',C.gold,0.85));shakeDecay=3;}
  else if(combo>=5){bigMsgs.push(mkBig(combo+' COMBO','',C.neon,0.65));}
  bgPulse=Math.min(1,combo/10);
}

// ボーナスOタップ
function hitBonusO(ring) {
  ring.state='hit';
  ring.hit=true;
  // breaking transition after tiny delay
  setTimeout(function(){
    ring.state='breaking'; ring.breakP=0;
  },30);

  bonusBreak++; score+=400; saveScore();
  onSuccess(); // 視力+0.1

  burst(ring.x,ring.y,{cnt:36,col:C.gold,gl:C.goldG,spd:9});
  sparks(ring.x,ring.y,{col:C.gold,gl:C.goldG});
  popups.push(mkPop(ring.x,ring.y-30,'+400 BONUS!',C.gold));
  bigMsgs.push(mkBig('BONUS!','視力+0.1！',C.gold,1.2));
  shakeDecay=6;

  setTimeout(function(){ if(GS==='playing') spawnWave1(); }, 500);
}

// スプーンタップ
function hitSpoon(u,px,py) {
  u.alive=false;
  var pts=50*u.wave; score+=pts; bonusBreak++; saveScore();
  var col=u.wave===2?'#c8b0e8':u.col;
  emitP(px,py,{cnt:18,col:col,gl:'rgba(140,190,230,0.7)',spd:6,sz:5});
  sparks(px,py,{col:col,gl:'rgba(200,180,255,0.6)'});
  popups.push(mkPop(px,py,'+'+pts,col));
  if(spoons.every(function(v){return !v.alive;})){
    if(utensilWave===1){
      setTimeout(function(){if(GS==='playing')spawnWave2();},350);
    } else if(utensilWave===2){
      utensilWave=0; waveLabel='';
      bigMsgs.push(mkBig('PERFECT!','ボーナスクリア！',C.gold,1.4));
      shakeDecay=7;
    }
  }
}

// フリック方向ミス
function missFlick(ring) {
  ring.state='dead'; // 即消す
  combo=0;
  onMiss();
  popups.push(mkPop(ring.x,ring.y-20,'MISS',C.danger));
}

function saveScore(){
  if(score>bestScore){bestScore=score;localStorage.setItem('vb_best',String(score));}
}

// ═══════════════════════════════════════════════════════════════
// INPUT
// ═══════════════════════════════════════════════════════════════
var touches={}, mouseDown=null;

function cxy(cx,cy){
  var r=canvas.getBoundingClientRect();
  return {x:(cx-r.left)*(CW/r.width),y:(cy-r.top)*(CH/r.height)};
}

function resolve(x0,y0,x1,y1){
  var dx=x1-x0,dy=y1-y0,dist=Math.hypot(dx,dy);
  if(dist<FLICK_MIN) onTap(x1,y1);
  else {
    var dir=Math.abs(dx)>=Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'down':'up');
    onFlick(x0,y0,dir);
  }
}

function onTap(x,y){
  if(GS==='start'){startGame();return;}
  if(GS==='result'){
    if(resultBtnsReady){
      if(inRect(x,y,retryBtn)){startGame();return;}
      if(inRect(x,y,shareBtn)){doShare();return;}
    }
    return;
  }
  if(GS!=='playing')return;

  // ① ボーナスO
  for(var i=0;i<rings.length;i++){
    var r=rings[i];
    if(!r.isBonus||r.state!=='alive')continue;
    if(Math.hypot(x-r.x,y-r.y)<70*r.sc){hitBonusO(r);return;}
  }
  // ② スプーン類
  for(var i=0;i<spoons.length;i++){
    var u=spoons[i];
    if(!u.alive)continue;
    if(spoonHit(u,x,y)){hitSpoon(u,x,y);return;}
  }
}

function onFlick(x,y,dir){
  if(GS!=='playing')return;
  // 一番近いCリングを探す
  var best=null,bestD=9999;
  for(var i=0;i<rings.length;i++){
    var r=rings[i];
    if(r.isBonus||r.state!=='alive')continue;
    var d=Math.hypot(x-r.x,y-r.y);
    if(d<130&&d<bestD){best=r;bestD=d;}
  }
  if(!best)return;  // 対象なし→ミスにしない
  if(dir===best.dir) hitRingFlick(best,x,y);
  else               missFlick(best);
}

canvas.addEventListener('touchstart',function(e){
  e.preventDefault();
  for(var i=0;i<e.changedTouches.length;i++){
    var t=e.changedTouches[i],p=cxy(t.clientX,t.clientY);
    touches[t.identifier]={x0:p.x,y0:p.y,x:p.x,y:p.y};
  }
},{passive:false});
canvas.addEventListener('touchmove',function(e){
  e.preventDefault();
  for(var i=0;i<e.changedTouches.length;i++){
    var t=e.changedTouches[i],p=cxy(t.clientX,t.clientY);
    if(touches[t.identifier]){touches[t.identifier].x=p.x;touches[t.identifier].y=p.y;}
  }
},{passive:false});
canvas.addEventListener('touchend',function(e){
  e.preventDefault();
  for(var i=0;i<e.changedTouches.length;i++){
    var t=e.changedTouches[i],s=touches[t.identifier];
    if(s){var p=cxy(t.clientX,t.clientY);resolve(s.x0,s.y0,p.x,p.y);}
    delete touches[t.identifier];
  }
},{passive:false});
canvas.addEventListener('mousedown',function(e){
  var p=cxy(e.clientX,e.clientY); mouseDown={x0:p.x,y0:p.y};
});
canvas.addEventListener('mouseup',function(e){
  if(!mouseDown)return;
  var p=cxy(e.clientX,e.clientY); resolve(mouseDown.x0,mouseDown.y0,p.x,p.y); mouseDown=null;
});
canvas.addEventListener('mouseleave',function(){mouseDown=null;});

// ═══════════════════════════════════════════════════════════════
// SHARE
// ═══════════════════════════════════════════════════════════════
function doShare(){
  var txt='VISION BREAK\n近未来視覚トレーニング\n\nSCORE: '+score+'\nVISION: '+vision.toFixed(1)+'\nBREAK: '+breakCount+'\nCOMBO: ×'+maxCombo+'\n\n君は見切れる？\n#VISIONBREAK';
  if(navigator.share)navigator.share({text:txt}).catch(function(){});
  else{
    if(navigator.clipboard)navigator.clipboard.writeText(txt).catch(function(){});
    bigMsgs.push(mkBig('COPIED!','クリップボードにコピー',C.neon,1.0));
  }
}

// ═══════════════════════════════════════════════════════════════
// MAIN LOOP
// ═══════════════════════════════════════════════════════════════
function startGame(){
  resetGame();
  GS='playing';
  startTime=performance.now();
}

var lastTs=null;

function loop(ts){
  if(lastTs===null)lastTs=ts;
  var dt=Math.min((ts-lastTs)/1000,0.05);
  lastTs=ts;

  var sdt=GS==='playing'?dt*timeScale:dt;
  bgTime+=sdt;

  // ─── UPDATE ───────────────────────────────────────────────
  if(GS==='playing'){
    var elapsed=(performance.now()-startTime)/1000;
    timeLeft=Math.max(0,30-elapsed);
    if(timeLeft<=0&&GS==='playing'){
      surviveTime=30; GS='result'; saveScore();
    }
    bgUrgency=Math.max(0,Math.min(1,(10-timeLeft)/10));
    bgPulse=Math.min(1,combo/10);

    // visionFlash decay
    if(visionFlash>0) visionFlash=Math.max(0,visionFlash-dt*2.8);
    if(visionFlash<0) visionFlash=Math.min(0,visionFlash+dt*2.8);

    // comboAnim decay
    if(comboAnim>0) comboAnim=Math.max(0,comboAnim-dt*3);

    // ボーナスO：10秒後に必ず1回
    if(!bonusSpawned && elapsed>=10){
      bonusSpawned=true;
      spawnBonusO();
    }

    // リングスポーン
    spawnTimer-=sdt;
    if(spawnTimer<=0){
      var alive=rings.filter(function(r){return !r.isBonus&&r.state==='alive';});
      var need=getRingCount();
      if(alive.length<need) spawnRing();
      spawnTimer=getSpawnInterval()/need;
    }

    // リング更新
    for(var i=0;i<rings.length;i++) updateRing(rings[i],sdt,bgTime);
    rings=rings.filter(function(r){return r.state!=='dead';});

    // 弾更新
    for(var i=0;i<bullets.length;i++) updateBullet(bullets[i],sdt);
    bullets=bullets.filter(function(b){return !b.dead;});

    // スプーン更新
    for(var i=0;i<spoons.length;i++) updateSpoon(spoons[i],sdt);

    // パーティクル
    updateParticles(sdt);

    // ポップアップ
    for(var i=0;i<popups.length;i++) updPop(popups[i],sdt);
    popups=popups.filter(function(p){return p.life>0;});

    // ビッグメッセージ
    for(var i=0;i<bigMsgs.length;i++) updBig(bigMsgs[i],sdt);
    bigMsgs=bigMsgs.filter(function(m){return m.life>0;});
  }

  updateBg(sdt);

  // ─── DRAW ─────────────────────────────────────────────────
  drawBg();
  drawMissGhosts();

  if(GS==='playing'||GS==='result'){
    // スプーン（上エリア）
    for(var i=0;i<spoons.length;i++) drawSpoon(spoons[i]);

    // ボーナスO
    for(var i=0;i<rings.length;i++){
      if(rings[i].isBonus) drawRing(rings[i]);
    }

    // Cリング（下エリア）
    for(var i=0;i<rings.length;i++){
      if(!rings[i].isBonus) drawRing(rings[i]);
    }

    // 弾
    for(var i=0;i<bullets.length;i++) drawBullet(bullets[i]);

    // パーティクル
    drawParticles();

    // ポップアップ
    for(var i=0;i<popups.length;i++) drawPop(popups[i]);

    // ビッグメッセージ
    for(var i=0;i<bigMsgs.length;i++) drawBig(bigMsgs[i]);
  }

  // 視力ブラー演出（HUDの前に）
  if(GS==='playing') drawBlurOverlay();

  // HUD
  if(GS==='playing') drawHUD();

  // 画面
  if(GS==='start')  drawStart();
  if(GS==='result') drawResult();

  requestAnimationFrame(loop);
}

// ═══════════════════════════════════════════════════════════════
// BOOT
// ═══════════════════════════════════════════════════════════════
initBg();
resetGame();
requestAnimationFrame(loop);
