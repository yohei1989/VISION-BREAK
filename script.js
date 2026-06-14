'use strict';

// ─── Constants ────────────────────────────────────────────────────────────────
var CW = 390, CH = 720;
var RING_R = 44, RING_SW = 10;
var FLICK_MIN = 22;
var SPAWN_X0 = 70, SPAWN_X1 = 320, SPAWN_Y0 = 220, SPAWN_Y1 = 460;
var DIRS = ['up','down','left','right'];
var GAP_A = { up: -Math.PI/2, down: Math.PI/2, left: Math.PI, right: 0 };
var CLR = {
  neon:'#00d4ff', neonG:'rgba(0,212,255,0.3)',
  gold:'#ffd700', goldG:'rgba(255,215,0,0.4)',
  danger:'#ff3366', dangerG:'rgba(255,51,102,0.5)',
  purple:'#7c3aed', purpleG:'rgba(124,58,237,0.3)',
  white:'#ffffff', textP:'#e8f4ff', textM:'rgba(180,220,255,0.6)',
  glassB:'rgba(0,212,255,0.3)', bg0:'#0d1528', bg1:'#060810'
};

// ─── Canvas setup ─────────────────────────────────────────────────────────────
var canvas = document.getElementById('c');
var ctx = canvas.getContext('2d', { alpha: false });

function resize() {
  var maxW = Math.min(window.innerWidth, 480);
  var maxH = window.innerHeight;
  var scale = Math.min(maxW / CW, maxH / CH);
  canvas.style.width  = Math.floor(CW * scale) + 'px';
  canvas.style.height = Math.floor(CH * scale) + 'px';
  canvas.width  = CW;
  canvas.height = CH;
}
resize();
window.addEventListener('resize', resize);

// ─── Game State ───────────────────────────────────────────────────────────────
var GS = 'start'; // 'start' | 'playing' | 'result'
var score, breakCount, bonusBreak, combo, maxCombo;
var timeLeft, startTime, surviveTime, missed;
var rings, bullets, particles, utensils, popups, bigMsgs;
var spawnTimer, bonusSpawned, utensilWave, waveLabel;
var timeScale, missFlash;
var bestScore = parseInt(localStorage.getItem('vb_best') || '0', 10);

// bg state
var bgTime = 0, bgPulse = 0, bgUrgency = 0;
var shakeX = 0, shakeY = 0, shakeDecay = 0;
var scanY = 0;
var ambients = [];
var gridLines = [];

// result button rects
var retryBtn, shareBtn;
var resultBtnsValid = false;

function initBg() {
  // grid
  gridLines = [];
  var cx = CW/2, cy = CH*0.42;
  for (var i = 0; i <= 10; i++) {
    gridLines.push({ type:'col', x0: i/10*CW, y0:0, x1:cx, y1:cy });
  }
  for (var j = 1; j <= 8; j++) {
    var t = j/8;
    gridLines.push({ type:'row', y: cy + (CH-cy)*(t*t) });
  }
  // ambient
  ambients = [];
  for (var k = 0; k < 40; k++) ambients.push(newAmbient());
}

function newAmbient() {
  return {
    x: Math.random()*CW, y: Math.random()*CH,
    vx: (Math.random()-0.5)*0.2, vy: -(0.2+Math.random()*0.5),
    size: 1+Math.random()*2, alpha: 0.1+Math.random()*0.4,
    color: Math.random()<0.7 ? CLR.neon : CLR.purple
  };
}

function resetGame() {
  rings=[]; bullets=[]; particles=[]; utensils=[]; popups=[]; bigMsgs=[];
  score=0; breakCount=0; bonusBreak=0; combo=0; maxCombo=0;
  timeLeft=30; missed=false; surviveTime=0;
  spawnTimer=0; bonusSpawned=false; utensilWave=0; waveLabel='';
  timeScale=1; missFlash=0;
  resultBtnsValid=false;
}

// ─── Ring ─────────────────────────────────────────────────────────────────────
function makeRing(x, y, dir) {
  return {
    x:x, y:y, dir:dir, isBonus: dir===null,
    scale:0.05, targetScale:1,
    state:'alive', // alive|closing|breaking|dead
    closeP:0, breakP:0, hit:false,
    depthPh: Math.random()*Math.PI*2,
    glowPh: Math.random()*Math.PI*2
  };
}

function updateRing(r, dt, t) {
  if (r.scale < r.targetScale) r.scale = Math.min(r.targetScale, r.scale + dt*1.8);
  if (r.state==='alive' && r.scale>=0.99)
    r.targetScale = 1 + Math.sin(t*2.5+r.depthPh)*0.02;
  if (r.state==='closing') {
    r.closeP += dt*3.5;
    if (r.closeP>=1) { r.closeP=1; r.state='breaking'; }
  }
  if (r.state==='breaking') {
    r.breakP += dt*2.8;
    if (r.breakP>=1) r.state='dead';
  }
  r.glowPh += dt*4;
}

function drawRing(r) {
  if (r.state==='dead') return;
  var alpha = r.state==='breaking' ? Math.max(0,1-r.breakP) : 1;
  ctx.save();
  ctx.translate(r.x, r.y);
  ctx.scale(r.scale, r.scale);
  ctx.globalAlpha = alpha;
  var glow = (Math.sin(r.glowPh)+1)/2;

  if (r.isBonus) {
    drawBonusRing(glow);
  } else {
    drawCRing(r, glow);
  }
  if (r.state==='breaking') drawShards(r.breakP);
  ctx.restore();
}

function drawCRing(r, glow) {
  var gap = r.state==='closing'
    ? (1-r.closeP)*(Math.PI*0.44)
    : Math.PI*0.44;
  var base = r.dir ? GAP_A[r.dir] : 0;
  var sa = base+gap, ea = base+Math.PI*2-gap;

  // glow halo
  ctx.strokeStyle = 'rgba(0,212,255,'+(0.15+glow*0.1)+')';
  ctx.lineWidth = RING_SW+10;
  ctx.shadowColor = CLR.neon; ctx.shadowBlur = 20+glow*10;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(0,0,RING_R,sa,ea); ctx.stroke();
  // main
  ctx.strokeStyle = CLR.white; ctx.lineWidth = RING_SW; ctx.shadowBlur = 6;
  ctx.beginPath(); ctx.arc(0,0,RING_R,sa,ea); ctx.stroke();
  // inner accent
  ctx.strokeStyle = CLR.neon; ctx.lineWidth = 2; ctx.shadowBlur = 0;
  ctx.globalAlpha *= 0.6;
  ctx.beginPath(); ctx.arc(0,0,RING_R-RING_SW*0.3,sa,ea); ctx.stroke();
  ctx.globalAlpha /= 0.6;
  // arrow hint
  if (r.dir && !r.hit) drawArrow(r.dir, glow);
}

function drawArrow(dir, glow) {
  var a = GAP_A[dir];
  var r1=RING_R+18, r2=RING_R+30;
  var ax=Math.cos(a), ay=Math.sin(a);
  ctx.save();
  ctx.globalAlpha *= (0.3+glow*0.3);
  ctx.strokeStyle = CLR.neon; ctx.lineWidth=2; ctx.lineCap='round';
  ctx.shadowColor=CLR.neon; ctx.shadowBlur=8;
  ctx.beginPath(); ctx.moveTo(ax*r1,ay*r1); ctx.lineTo(ax*r2,ay*r2); ctx.stroke();
  var ha=Math.PI/5;
  ctx.beginPath();
  ctx.moveTo(ax*r2,ay*r2);
  ctx.lineTo(ax*r2+Math.cos(a+Math.PI+ha)*9, ay*r2+Math.sin(a+Math.PI+ha)*9);
  ctx.moveTo(ax*r2,ay*r2);
  ctx.lineTo(ax*r2+Math.cos(a+Math.PI-ha)*9, ay*r2+Math.sin(a+Math.PI-ha)*9);
  ctx.stroke();
  ctx.restore();
}

function drawBonusRing(glow) {
  var p = 0.9+glow*0.12;
  ctx.strokeStyle = 'rgba(255,215,0,'+(0.2+glow*0.15)+')';
  ctx.lineWidth = RING_SW+14; ctx.shadowColor=CLR.gold; ctx.shadowBlur=28+glow*14;
  ctx.beginPath(); ctx.arc(0,0,RING_R*p,0,Math.PI*2); ctx.stroke();
  ctx.strokeStyle=CLR.gold; ctx.lineWidth=RING_SW; ctx.shadowBlur=10;
  ctx.beginPath(); ctx.arc(0,0,RING_R,0,Math.PI*2); ctx.stroke();
  ctx.strokeStyle='#fff9c4'; ctx.lineWidth=2; ctx.shadowBlur=0;
  ctx.beginPath(); ctx.arc(0,0,RING_R-RING_SW*0.3,0,Math.PI*2); ctx.stroke();
  ctx.fillStyle=CLR.gold; ctx.shadowColor=CLR.gold; ctx.shadowBlur=12;
  ctx.beginPath(); ctx.arc(0,0,5,0,Math.PI*2); ctx.fill();
}

function drawShards(prog) {
  var spread=prog*80, al=1-prog;
  for (var i=0;i<10;i++) {
    var a=(i/10)*Math.PI*2, d=spread*(0.6+(i%3)*0.2);
    var len=(8+(i%4)*4)*(1-prog*0.5);
    ctx.save();
    ctx.globalAlpha=al*al;
    ctx.translate(Math.cos(a)*d,Math.sin(a)*d);
    ctx.rotate(a);
    ctx.strokeStyle=i%2===0?CLR.white:CLR.neon;
    ctx.lineWidth=1.5; ctx.shadowColor=CLR.neon; ctx.shadowBlur=8;
    ctx.beginPath(); ctx.moveTo(-len/2,0); ctx.lineTo(len/2,0); ctx.stroke();
    ctx.restore();
  }
}

// ─── Bullet ───────────────────────────────────────────────────────────────────
function makeBullet(fx, fy, ring) {
  return {
    sx:fx, sy:fy, tx:ring.x, ty:ring.y,
    dx:ring.x-fx, dy:ring.y-fy,
    angle:Math.atan2(ring.y-fy,ring.x-fx),
    prog:0, dead:false, ring:ring
  };
}

function updateBullet(b, dt) {
  b.prog += dt*4;
  if (b.prog>=1) {
    b.prog=1;
    if (!b.ring.hit) { b.ring.hit=true; b.ring.state='closing'; b.ring.closeP=0; }
    b.dead=true;
  }
}

function drawBullet(b) {
  if (b.dead) return;
  var t=b.prog;
  var ex=b.sx+b.dx*t, ey=b.sy+b.dy*t;
  ctx.save();
  ctx.translate(ex,ey); ctx.rotate(b.angle);
  var tl=22;
  var g=ctx.createLinearGradient(-tl,0,0,0);
  g.addColorStop(0,'transparent'); g.addColorStop(1,CLR.neon);
  ctx.strokeStyle=g; ctx.lineWidth=4; ctx.shadowColor=CLR.neon; ctx.shadowBlur=14;
  ctx.beginPath(); ctx.moveTo(-tl,0); ctx.lineTo(0,0); ctx.stroke();
  ctx.fillStyle=CLR.white; ctx.shadowBlur=20;
  ctx.beginPath(); ctx.arc(0,0,5,0,Math.PI*2); ctx.fill();
  ctx.fillStyle=CLR.neon;
  ctx.beginPath(); ctx.arc(0,0,3,0,Math.PI*2); ctx.fill();
  ctx.restore();
}

// ─── Particles ────────────────────────────────────────────────────────────────
function emitParticles(x, y, opts) {
  var c=opts.count||10, color=opts.color||CLR.neon, glow=opts.glow||CLR.neonG;
  var speed=opts.speed||4, life=opts.life||0.9, size=opts.size||4, shape=opts.shape||'circle';
  for (var i=0;i<c;i++) {
    var a=Math.random()*Math.PI*2, s=speed*(0.4+Math.random()*0.6);
    particles.push({
      x:x,y:y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,
      life:life,maxLife:life,color:color,glow:glow,
      size:size*(0.5+Math.random()*0.5),shape:shape,drag:0.94
    });
  }
}

function emitBurst(x, y, opts) {
  emitParticles(x, y, Object.assign({ count:24, speed:6, size:5, life:1.1 }, opts));
}

function emitSparks(x, y, opts) {
  emitParticles(x, y, Object.assign({
    count:16, speed:7, size:2, life:0.7, shape:'spark',
    color:CLR.white, glow:'rgba(255,255,255,0.8)'
  }, opts));
}

function updateParticles(dt) {
  for (var i=particles.length-1;i>=0;i--) {
    var p=particles[i];
    p.x+=p.vx; p.y+=p.vy; p.vy+=0.18; p.vx*=p.drag; p.vy*=p.drag; p.life-=dt;
    if (p.life<=0) particles.splice(i,1);
  }
}

function drawParticles() {
  for (var i=0;i<particles.length;i++) {
    var p=particles[i];
    var al=Math.min(1,p.life/p.maxLife);
    ctx.save(); ctx.globalAlpha=al;
    if (p.shape==='spark') {
      ctx.strokeStyle=p.color; ctx.lineWidth=p.size;
      ctx.shadowColor=p.glow; ctx.shadowBlur=8;
      ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(p.x-p.vx*4,p.y-p.vy*4); ctx.stroke();
    } else {
      ctx.fillStyle=p.color; ctx.shadowColor=p.glow; ctx.shadowBlur=12;
      ctx.beginPath(); ctx.arc(p.x,p.y,p.size*al,0,Math.PI*2); ctx.fill();
    }
    ctx.restore();
  }
}

// ─── Utensils ────────────────────────────────────────────────────────────────
var UCOLS = {
  spoon:{ fill:'#b0c8e8', stroke:'#7aaad4', glow:'rgba(140,190,230,0.6)' },
  fork: { fill:'#c8b0e8', stroke:'#9a7ad4', glow:'rgba(180,140,230,0.6)' },
  knife:{ fill:'#e8d0b0', stroke:'#d4a870', glow:'rgba(230,200,140,0.6)' }
};

function makeUtensil(type, x, y, wave) {
  return {
    type:type, x:x, y:y, wave:wave, alive:true,
    vx:(Math.random()-0.5)*1.8, vy:(Math.random()-0.5)*1.8,
    angle:Math.random()*Math.PI*2, spin:(Math.random()-0.5)*0.06,
    scale:0.2+Math.random()*0.5, pulse:Math.random()*Math.PI*2
  };
}

function updateUtensil(u, dt) {
  u.pulse+=dt*3; u.angle+=u.spin;
  u.x+=u.vx*0.5; u.y+=u.vy*0.5; u.vx*=0.995; u.vy*=0.995;
  if(u.x<30)u.vx=Math.abs(u.vx); if(u.x>360)u.vx=-Math.abs(u.vx);
  if(u.y<10)u.vy=Math.abs(u.vy); if(u.y>230)u.vy=-Math.abs(u.vy);
}

function drawUtensil(u) {
  if (!u.alive) return;
  var c=UCOLS[u.type], g=(Math.sin(u.pulse)+1)/2;
  ctx.save();
  ctx.translate(u.x,u.y); ctx.rotate(u.angle); ctx.scale(u.scale,u.scale);
  ctx.shadowColor=c.glow; ctx.shadowBlur=10+g*8;
  ctx.fillStyle=c.fill; ctx.strokeStyle=c.stroke; ctx.lineWidth=3;
  if (u.type==='spoon') {
    ctx.beginPath(); roundRect(ctx,-4,10,8,50,4); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0,-10,16,20,0,0,Math.PI*2); ctx.fill(); ctx.stroke();
    ctx.fillStyle='rgba(255,255,255,0.35)';
    ctx.beginPath(); ctx.ellipse(-5,-15,5,7,-0.4,0,Math.PI*2); ctx.fill();
  } else if (u.type==='fork') {
    ctx.beginPath(); roundRect(ctx,-4,10,8,52,4); ctx.fill(); ctx.stroke();
    [-8,-3,3,8].forEach(function(tx){
      ctx.beginPath(); ctx.moveTo(tx,8); ctx.lineTo(tx,-24); ctx.stroke();
      ctx.beginPath(); ctx.arc(tx,-24,2.5,0,Math.PI*2); ctx.fill();
    });
    ctx.beginPath(); ctx.moveTo(-8,-10); ctx.lineTo(8,-10); ctx.stroke();
  } else {
    ctx.beginPath(); roundRect(ctx,-5,18,10,44,5); ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-5,18);ctx.lineTo(-5,-10);ctx.lineTo(0,-28);ctx.lineTo(5,-10);ctx.lineTo(5,18);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle='rgba(255,255,255,0.25)';
    ctx.beginPath(); ctx.moveTo(-2,14);ctx.lineTo(-2,-6);ctx.lineTo(0,-22);ctx.lineTo(1,-6);ctx.lineTo(1,14); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

function utensilHit(u, px, py) {
  return Math.hypot(px-u.x,py-u.y) < 28*u.scale;
}

function spawnWave1() {
  utensils=[];
  for(var i=0;i<14;i++) utensils.push(makeUtensil('spoon',30+Math.random()*330,10+Math.random()*215,1));
  utensilWave=1; waveLabel='🥄  SPOON BREAK!  ×2';
}

function spawnWave2() {
  utensils=[];
  for(var i=0;i<10;i++) utensils.push(makeUtensil('fork', 30+Math.random()*330,10+Math.random()*215,2));
  for(var i=0;i<8; i++) utensils.push(makeUtensil('knife',30+Math.random()*330,10+Math.random()*215,2));
  utensilWave=2; waveLabel='🍴  FORK & KNIFE!  ×4';
}

// ─── UI helpers ───────────────────────────────────────────────────────────────
function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x+r,y); c.lineTo(x+w-r,y); c.arcTo(x+w,y,x+w,y+r,r);
  c.lineTo(x+w,y+h-r); c.arcTo(x+w,y+h,x+w-r,y+h,r);
  c.lineTo(x+r,y+h); c.arcTo(x,y+h,x,y+h-r,r);
  c.lineTo(x,y+r); c.arcTo(x,y,x+r,y,r);
  c.closePath();
}

function glassPanel(x,y,w,h,r) {
  r=r||20;
  ctx.shadowColor='rgba(0,212,255,0.1)'; ctx.shadowBlur=40;
  ctx.fillStyle='rgba(12,18,35,0.93)';
  roundRect(ctx,x,y,w,h,r); ctx.fill(); ctx.shadowBlur=0;
  ctx.strokeStyle=CLR.glassB; ctx.lineWidth=1;
  roundRect(ctx,x,y,w,h,r); ctx.stroke();
  var sh=ctx.createLinearGradient(x,y,x,y+60);
  sh.addColorStop(0,'rgba(255,255,255,0.07)'); sh.addColorStop(1,'transparent');
  ctx.fillStyle=sh; roundRect(ctx,x,y,w,60,r); ctx.fill();
}

function glassBtn(x,y,w,h,color,pulse) {
  pulse=pulse||0;
  var r=parseInt(color.slice(1,3),16), g=parseInt(color.slice(3,5),16), b=parseInt(color.slice(5,7),16);
  ctx.shadowColor=color; ctx.shadowBlur=8+pulse*8;
  ctx.fillStyle='rgba('+r+','+g+','+b+',0.12)';
  roundRect(ctx,x,y,w,h,14); ctx.fill(); ctx.shadowBlur=0;
  ctx.strokeStyle=color; ctx.lineWidth=1;
  roundRect(ctx,x,y,w,h,14); ctx.stroke();
}

// ─── Score popup ──────────────────────────────────────────────────────────────
function makePopup(x, y, text, color) {
  return { x:x, y:y, text:text, color:color||CLR.neon, life:1.0, vy:-1.5 };
}
function updatePopup(p, dt) { p.y+=p.vy; p.life-=dt*1.8; }
function drawPopup(p) {
  if (p.life<=0) return;
  ctx.save(); ctx.globalAlpha=Math.min(1,p.life*2);
  ctx.fillStyle=p.color; ctx.font='700 22px system-ui'; ctx.textAlign='center';
  ctx.shadowColor=p.color; ctx.shadowBlur=12;
  ctx.fillText(p.text,p.x,p.y);
  ctx.restore();
}

// ─── Big message ──────────────────────────────────────────────────────────────
function makeBig(text, sub, color, dur) {
  return { text:text, sub:sub||'', color:color||CLR.neon, life:dur||1.0, maxLife:dur||1.0, scale:1.4 };
}
function updateBig(m, dt) { m.life-=dt; m.scale=Math.max(1,m.scale-dt*3); }
function drawBig(m) {
  if (m.life<=0) return;
  var al=Math.min(1,m.life/m.maxLife*2);
  ctx.save(); ctx.globalAlpha=al; ctx.textAlign='center';
  ctx.fillStyle=m.color;
  ctx.font='900 '+(Math.round(52*m.scale))+'px system-ui';
  ctx.shadowColor=m.color; ctx.shadowBlur=30;
  ctx.strokeStyle='rgba(0,0,0,0.6)'; ctx.lineWidth=6; ctx.lineJoin='round';
  ctx.strokeText(m.text,CW/2,CH/2-20); ctx.fillText(m.text,CW/2,CH/2-20);
  if (m.sub) {
    ctx.font='600 18px system-ui'; ctx.shadowBlur=10;
    ctx.fillStyle='rgba(255,255,255,0.85)'; ctx.shadowColor='rgba(255,255,255,0.5)';
    ctx.fillText(m.sub,CW/2,CH/2+18);
  }
  ctx.restore();
}

// ─── Background ───────────────────────────────────────────────────────────────
function updateBg(dt) {
  bgTime+=dt;
  if (shakeDecay>0) {
    shakeX=(Math.random()-0.5)*shakeDecay; shakeY=(Math.random()-0.5)*shakeDecay;
    shakeDecay*=0.78; if(shakeDecay<0.3)shakeDecay=0;
  } else { shakeX=0; shakeY=0; }
  scanY=(scanY+1.5+bgUrgency*2)%CH;
  for (var i=0;i<ambients.length;i++) {
    var p=ambients[i]; p.x+=p.vx; p.y+=p.vy;
    if(p.y<-5){p.y=CH+5;p.x=Math.random()*CW;}
  }
}

function drawBg() {
  ctx.save();
  ctx.translate(shakeX,shakeY);
  // sky
  var bg=ctx.createRadialGradient(CW/2,CH*0.4,0,CW/2,CH/2,CH*0.75);
  bg.addColorStop(0,'#0d1528'); bg.addColorStop(0.5,'#080d1a'); bg.addColorStop(1,CLR.bg1);
  ctx.fillStyle=bg; ctx.fillRect(-shakeX,-shakeY,CW,CH);
  // urgency vignette
  if (bgUrgency>0) {
    var vig=ctx.createRadialGradient(CW/2,CH/2,CH*0.2,CW/2,CH/2,CH*0.7);
    vig.addColorStop(0,'transparent'); vig.addColorStop(1,'rgba(255,30,60,'+(0.18*bgUrgency)+')');
    ctx.fillStyle=vig; ctx.fillRect(-shakeX,-shakeY,CW,CH);
  }
  // grid
  var pulse=(Math.sin(bgTime*3)+1)/2;
  var baseA=0.06+pulse*0.04*bgPulse+bgUrgency*0.04;
  var gcx=CW/2, gcy=CH*0.42;
  ctx.strokeStyle=CLR.neon; ctx.lineWidth=0.5;
  for (var i=0;i<gridLines.length;i++) {
    var l=gridLines[i];
    if (l.type==='col') {
      ctx.globalAlpha=baseA;
      ctx.beginPath(); ctx.moveTo(l.x0,CH); ctx.lineTo(l.x1,l.y1); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(l.x0,0); ctx.lineTo(l.x1,l.y1); ctx.stroke();
    } else {
      var t=(l.y-gcy)/(CH-gcy), hw=CW/2*t;
      ctx.globalAlpha=baseA*t;
      ctx.beginPath(); ctx.moveTo(gcx-hw,l.y); ctx.lineTo(gcx+hw,l.y); ctx.stroke();
    }
  }
  ctx.globalAlpha=1;
  // combo pulse
  if (bgPulse>0) {
    var beat=(Math.sin(bgTime*8)+1)/2;
    var rr=(80+beat*60)*bgPulse;
    var gl=ctx.createRadialGradient(CW/2,CH*0.5,0,CW/2,CH*0.5,rr);
    gl.addColorStop(0,'rgba(124,58,237,'+(0.25*bgPulse)+')'); gl.addColorStop(1,'transparent');
    ctx.fillStyle=gl; ctx.fillRect(-shakeX,-shakeY,CW,CH);
  }
  // ambient dots
  for (var i=0;i<ambients.length;i++) {
    var p=ambients[i];
    ctx.globalAlpha=p.alpha; ctx.fillStyle=p.color;
    ctx.shadowColor=p.color; ctx.shadowBlur=6;
    ctx.beginPath(); ctx.arc(p.x,p.y,p.size,0,Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha=1; ctx.shadowBlur=0;
  // scan line
  var sa=0.04+bgUrgency*0.06;
  var sg=ctx.createLinearGradient(0,scanY-30,0,scanY+30);
  sg.addColorStop(0,'transparent'); sg.addColorStop(0.5,'rgba(0,212,255,'+sa+')'); sg.addColorStop(1,'transparent');
  ctx.fillStyle=sg; ctx.fillRect(-shakeX,scanY-30,CW,60);
  ctx.restore();
}

// ─── HUD ─────────────────────────────────────────────────────────────────────
function drawHUD() {
  var urgent=timeLeft<=10;
  ctx.save();
  // panel
  ctx.fillStyle='rgba(0,0,0,0.5)';
  roundRect(ctx,0,0,CW,74,0); ctx.fill();
  ctx.strokeStyle=CLR.glassB; ctx.lineWidth=0.5;
  roundRect(ctx,0,0,CW,74,0); ctx.stroke();

  // SCORE
  ctx.fillStyle=CLR.textM; ctx.font='500 11px system-ui'; ctx.textAlign='left';
  ctx.fillText('SCORE',20,22);
  ctx.fillStyle=CLR.textP; ctx.font='700 36px system-ui';
  ctx.shadowColor=CLR.neon; ctx.shadowBlur=urgent?16:6;
  ctx.fillText(String(score).padStart(6,'0'),20,58); ctx.shadowBlur=0;

  // TIME
  ctx.fillStyle=CLR.textM; ctx.font='500 11px system-ui'; ctx.textAlign='center';
  ctx.fillText('TIME',CW/2,22);
  var blink=urgent&&Math.floor(Date.now()/200)%2===0;
  ctx.fillStyle=urgent?(blink?'#ff3366':'#ff8899'):CLR.textP;
  ctx.font='700 36px system-ui';
  ctx.shadowColor=urgent?CLR.danger:CLR.neon; ctx.shadowBlur=urgent?20:6;
  ctx.fillText(Math.ceil(timeLeft),CW/2,58); ctx.shadowBlur=0;

  // COMBO
  ctx.fillStyle=CLR.textM; ctx.font='500 11px system-ui'; ctx.textAlign='right';
  ctx.fillText('COMBO',CW-20,22);
  if (combo>=2) {
    var cs=Math.min(36,22+combo);
    ctx.fillStyle=combo>=5?CLR.gold:CLR.neon;
    ctx.font='700 '+cs+'px system-ui';
    ctx.shadowColor=combo>=5?CLR.goldG:CLR.neonG; ctx.shadowBlur=14;
    ctx.fillText('×'+combo,CW-20,58);
  } else {
    ctx.fillStyle=CLR.textP; ctx.font='700 36px system-ui';
    ctx.fillText(combo>0?'×1':'-',CW-20,58);
  }
  ctx.shadowBlur=0;

  // wave label
  if (utensilWave>0&&waveLabel) {
    ctx.textAlign='center'; ctx.fillStyle=CLR.gold; ctx.font='700 13px system-ui';
    ctx.shadowColor=CLR.goldG; ctx.shadowBlur=10;
    ctx.fillText(waveLabel,CW/2,88); ctx.shadowBlur=0;
  }
  ctx.restore();
}

// ─── Start screen ─────────────────────────────────────────────────────────────
function drawStart() {
  ctx.save();
  ctx.fillStyle='rgba(6,8,16,0.88)'; ctx.fillRect(0,0,CW,CH);
  var cx=CW/2, cy=CH*0.34, pulse=(Math.sin(bgTime*2)+1)/2;
  // ring deco
  ctx.strokeStyle='rgba(0,212,255,'+(0.1+pulse*0.08)+')';
  ctx.lineWidth=28; ctx.shadowColor=CLR.neon; ctx.shadowBlur=30;
  ctx.beginPath(); ctx.arc(cx,cy,70,0.6,Math.PI*2-0.6); ctx.stroke();
  ctx.strokeStyle=CLR.neon; ctx.lineWidth=10; ctx.shadowBlur=18;
  ctx.beginPath(); ctx.arc(cx,cy,70,0.6,Math.PI*2-0.6); ctx.stroke();
  ctx.strokeStyle='rgba(255,255,255,0.6)'; ctx.lineWidth=2; ctx.shadowBlur=0;
  ctx.beginPath(); ctx.arc(cx,cy,62,0.6,Math.PI*2-0.6); ctx.stroke();
  // title
  ctx.textAlign='center';
  ctx.font='900 38px system-ui'; ctx.fillStyle=CLR.white;
  ctx.shadowColor=CLR.neon; ctx.shadowBlur=20;
  ctx.fillText('VISION',CW/2,cy+130);
  ctx.fillStyle=CLR.neon; ctx.shadowBlur=30;
  ctx.fillText('BREAK',CW/2,cy+176); ctx.shadowBlur=0;
  ctx.font='400 13px system-ui'; ctx.fillStyle=CLR.textM;
  ctx.fillText('近未来視覚トレーニング',CW/2,cy+206);
  if (bestScore>0) {
    ctx.font='500 12px system-ui';
    ctx.fillText('BEST  '+String(bestScore).padStart(6,'0'),CW/2,cy+232);
  }
  // start btn
  var bx=CW/2-90, by=CH*0.72;
  glassBtn(bx,by,180,54,CLR.neon,pulse);
  ctx.fillStyle=CLR.white; ctx.font='700 20px system-ui'; ctx.textAlign='center';
  ctx.shadowColor=CLR.neon; ctx.shadowBlur=10;
  ctx.fillText('TAP TO START',CW/2,by+34); ctx.shadowBlur=0;
  ctx.font='400 12px system-ui'; ctx.fillStyle=CLR.textM;
  ctx.fillText('フリック → C の向きへ ／ タップ → O を破壊',CW/2,CH-30);
  ctx.restore();
}

// ─── Result screen ────────────────────────────────────────────────────────────
function drawResult() {
  ctx.save();
  ctx.fillStyle='rgba(6,8,16,0.93)'; ctx.fillRect(0,0,CW,CH);
  var cx=CW/2, pulse=(Math.sin(bgTime*2.5)+1)/2;
  var pw=320,ph=440,px=(CW-pw)/2,py=(CH-ph)/2;
  glassPanel(px,py,pw,ph,24);

  ctx.textAlign='center';
  ctx.font='900 32px system-ui';
  ctx.fillStyle=missed?CLR.danger:CLR.neon;
  ctx.shadowColor=missed?CLR.dangerG:CLR.neonG; ctx.shadowBlur=18;
  ctx.fillText(missed?'GAME OVER':'TIME UP!',cx,py+52); ctx.shadowBlur=0;

  var isNB=score>bestScore;
  if (isNB) {
    ctx.font='700 13px system-ui'; ctx.fillStyle=CLR.gold;
    ctx.shadowColor=CLR.goldG; ctx.shadowBlur=12;
    ctx.fillText('★ NEW BEST ★',cx,py+78); ctx.shadowBlur=0;
  }

  var stats=[
    ['SCORE', String(score).padStart(6,'0'), CLR.neon],
    ['BREAK', breakCount, CLR.textP],
    ['COMBO', '×'+maxCombo, CLR.textP],
    ['BONUS', bonusBreak, CLR.gold],
    ['SURVIVE', surviveTime+'s', CLR.textM]
  ];
  for (var i=0;i<stats.length;i++) {
    var s=stats[i], ry=py+115+i*54;
    ctx.fillStyle=i%2===0?'rgba(255,255,255,0.03)':'transparent';
    ctx.fillRect(px+12,ry-16,pw-24,42);
    ctx.fillStyle=CLR.textM; ctx.font='500 11px system-ui'; ctx.textAlign='left';
    ctx.fillText(s[0],px+24,ry+4);
    ctx.fillStyle=s[2]; ctx.font='700 24px system-ui'; ctx.textAlign='right';
    ctx.shadowColor=s[2]; ctx.shadowBlur=6;
    ctx.fillText(s[1],px+pw-24,ry+4); ctx.shadowBlur=0;
  }

  // divider
  ctx.strokeStyle=CLR.glassB; ctx.lineWidth=0.5;
  ctx.beginPath(); ctx.moveTo(px+20,py+392); ctx.lineTo(px+pw-20,py+392); ctx.stroke();
  ctx.font='400 10px system-ui'; ctx.fillStyle=CLR.textM; ctx.textAlign='center';
  ctx.fillText('VISION BREAK  SCORE '+score+'  BREAK '+breakCount+'  #VISIONBREAK',cx,py+410);

  // buttons
  var bw=130,bh=52;
  var b1x=cx-bw-8, b2x=cx+8, bby=py+ph-68;
  glassBtn(b1x,bby,bw,bh,CLR.purple,pulse);
  ctx.fillStyle=CLR.white; ctx.font='700 16px system-ui'; ctx.textAlign='center';
  ctx.shadowColor=CLR.purple; ctx.shadowBlur=8;
  ctx.fillText('RETRY',b1x+bw/2,bby+34);
  glassBtn(b2x,bby,bw,bh,CLR.neon,pulse);
  ctx.fillStyle=CLR.white; ctx.shadowColor=CLR.neon; ctx.shadowBlur=8;
  ctx.fillText('SHARE',b2x+bw/2,bby+34); ctx.shadowBlur=0;

  retryBtn={x:b1x,y:bby,w:bw,h:bh};
  shareBtn={x:b2x,y:bby,w:bw,h:bh};
  resultBtnsValid=true;
  ctx.restore();
}

function inRect(x,y,r){return x>=r.x&&x<=r.x+r.w&&y>=r.y&&y<=r.y+r.h;}

// ─── Game logic ───────────────────────────────────────────────────────────────
function getRingCount(){
  if(timeLeft>20)return 1; if(timeLeft>10)return 2; return 3;
}

function spawnRing(){
  var dir=DIRS[Math.floor(Math.random()*4)];
  var x=SPAWN_X0+Math.random()*(SPAWN_X1-SPAWN_X0);
  var y=SPAWN_Y0+Math.random()*(SPAWN_Y1-SPAWN_Y0);
  rings.push(makeRing(x,y,dir));
}

function spawnBonus(){
  var x=SPAWN_X0+Math.random()*(SPAWN_X1-SPAWN_X0);
  var y=SPAWN_Y0+Math.random()*(SPAWN_Y1-SPAWN_Y0);
  rings.push(makeRing(x,y,null));
  bonusSpawned=true;
  bigMsgs.push(makeBig('BONUS!','O をタップ！',CLR.gold,1.0));
}

function hitRing(ring, fx, fy){
  ring.hit=true;
  bullets.push(makeBullet(fx,fy,ring));
  combo++; maxCombo=Math.max(maxCombo,combo); breakCount++;
  var base=100+combo*15;
  var pts=combo>=5?Math.round(base*1.2):base;
  score+=pts; saveScore();
  emitBurst(ring.x,ring.y,{color:CLR.neon,glow:CLR.neonG});
  emitSparks(ring.x,ring.y);
  popups.push(makePopup(ring.x,ring.y-20,'+'+pts,CLR.neon));
  if(combo>=10){bigMsgs.push(makeBig(combo+' COMBO!!','気持ちいい！',CLR.gold,0.9));shakeDecay=3;}
  else if(combo>=5){bigMsgs.push(makeBig(combo+' COMBO','',CLR.neon,0.7));}
  bgPulse=Math.min(1,combo/10);
}

function hitBonus(ring){
  ring.hit=true; ring.state='closing'; ring.closeP=0;
  bonusBreak++; score+=300; saveScore();
  emitBurst(ring.x,ring.y,{count:32,color:CLR.gold,glow:CLR.goldG,speed:8});
  emitSparks(ring.x,ring.y,{color:CLR.gold,glow:CLR.goldG});
  popups.push(makePopup(ring.x,ring.y-20,'+300 BONUS!',CLR.gold));
  bigMsgs.push(makeBig('BONUS!','スプーンをタップ！',CLR.gold,1.4));
  shakeDecay=5;
  setTimeout(function(){spawnWave1();},400);
}

function hitUtensil(u, px, py){
  u.alive=false;
  var pts=50*u.wave; score+=pts; bonusBreak++; saveScore();
  var col=u.wave===2?'#c8b0e8':'#b0c8e8';
  emitParticles(px,py,{count:14,color:col,glow:'rgba(140,190,230,0.6)',speed:5,size:4});
  popups.push(makePopup(px,py,'+'+pts,col));
  if(utensils.every(function(v){return !v.alive;})){
    if(utensilWave===1){
      setTimeout(function(){
        spawnWave2();
        bigMsgs.push(makeBig('WAVE 2!','フォーク＆ナイフ ×4','#c8b0e8',1.2));
        shakeDecay=4;
      },300);
    } else if(utensilWave===2){
      utensilWave=0; waveLabel='';
      bigMsgs.push(makeBig('PERFECT!','ボーナスクリア！',CLR.gold,1.2));
      shakeDecay=6;
    }
  }
}

function doMiss(){
  if(GS!=='playing')return;
  GS='result'; missed=true;
  surviveTime=Math.round((performance.now()-startTime)/1000);
  combo=0; missFlash=1; timeScale=0.15; shakeDecay=12;
  emitBurst(CW/2,CH/2,{count:30,color:CLR.danger,glow:CLR.dangerG,speed:10,size:6});
  emitSparks(CW/2,CH/2,{color:CLR.danger,glow:CLR.dangerG});
  setTimeout(function(){timeScale=1;saveScore();},600);
}

function saveScore(){
  if(score>bestScore){bestScore=score;localStorage.setItem('vb_best',String(score));}
}

// ─── Input ────────────────────────────────────────────────────────────────────
var touches={};
var mouseDown=null;

function canvasXY(clientX,clientY){
  var r=canvas.getBoundingClientRect();
  return {
    x:(clientX-r.left)*(CW/r.width),
    y:(clientY-r.top)*(CH/r.height)
  };
}

function resolveGesture(x0,y0,x1,y1){
  var dx=x1-x0,dy=y1-y0,dist=Math.hypot(dx,dy);
  if(dist<FLICK_MIN){
    onTap(x1,y1);
  } else {
    var dir=Math.abs(dx)>=Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'down':'up');
    onFlick(x0,y0,dir,dx,dy);
  }
}

function onTap(x,y){
  if(GS==='start'){startGame();return;}
  if(GS==='result'){
    if(resultBtnsValid){
      if(inRect(x,y,retryBtn)){startGame();return;}
      if(inRect(x,y,shareBtn)){doShare();return;}
    }
    return;
  }
  if(GS!=='playing')return;
  // bonus O
  for(var i=0;i<rings.length;i++){
    var r=rings[i];
    if(!r.isBonus||r.hit||r.state!=='alive')continue;
    if(Math.hypot(x-r.x,y-r.y)<60*r.scale){hitBonus(r);return;}
  }
  // utensils
  for(var i=0;i<utensils.length;i++){
    var u=utensils[i];
    if(!u.alive)continue;
    if(utensilHit(u,x,y)){hitUtensil(u,x,y);return;}
  }
}

function onFlick(x,y,dir,dx,dy){
  if(GS!=='playing')return;
  var best=null,bestD=9999;
  for(var i=0;i<rings.length;i++){
    var r=rings[i];
    if(r.hit||r.isBonus||r.state!=='alive')continue;
    var d=Math.hypot(x-r.x,y-r.y);
    if(d<110&&d<bestD){best=r;bestD=d;}
  }
  if(!best)return;
  if(dir===best.dir)hitRing(best,x,y);
  else doMiss();
}

canvas.addEventListener('touchstart',function(e){
  e.preventDefault();
  for(var i=0;i<e.changedTouches.length;i++){
    var t=e.changedTouches[i];
    var p=canvasXY(t.clientX,t.clientY);
    touches[t.identifier]={x0:p.x,y0:p.y,x:p.x,y:p.y};
  }
},{passive:false});

canvas.addEventListener('touchmove',function(e){
  e.preventDefault();
  for(var i=0;i<e.changedTouches.length;i++){
    var t=e.changedTouches[i];
    var p=canvasXY(t.clientX,t.clientY);
    if(touches[t.identifier]){touches[t.identifier].x=p.x;touches[t.identifier].y=p.y;}
  }
},{passive:false});

canvas.addEventListener('touchend',function(e){
  e.preventDefault();
  for(var i=0;i<e.changedTouches.length;i++){
    var t=e.changedTouches[i];
    var s=touches[t.identifier];
    if(s){var p=canvasXY(t.clientX,t.clientY);resolveGesture(s.x0,s.y0,p.x,p.y);}
    delete touches[t.identifier];
  }
},{passive:false});

canvas.addEventListener('mousedown',function(e){
  var p=canvasXY(e.clientX,e.clientY);
  mouseDown={x0:p.x,y0:p.y};
});
canvas.addEventListener('mouseup',function(e){
  if(!mouseDown)return;
  var p=canvasXY(e.clientX,e.clientY);
  resolveGesture(mouseDown.x0,mouseDown.y0,p.x,p.y);
  mouseDown=null;
});
canvas.addEventListener('mouseleave',function(){mouseDown=null;});

// ─── Share ────────────────────────────────────────────────────────────────────
function doShare(){
  var txt='VISION BREAK\n近未来視覚トレーニング\n\nSCORE: '+score+'\nBREAK: '+breakCount+'\nCOMBO: ×'+maxCombo+'\n\n君は見切れる？\n#VISIONBREAK';
  if(navigator.share){navigator.share({text:txt}).catch(function(){});}
  else{navigator.clipboard&&navigator.clipboard.writeText(txt).catch(function(){});
    bigMsgs.push(makeBig('COPIED!','クリップボードにコピー',CLR.neon,1.0));}
}

// ─── Start / Loop ─────────────────────────────────────────────────────────────
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

  if(GS==='playing'){
    var elapsed=(performance.now()-startTime)/1000;
    timeLeft=Math.max(0,30-elapsed);
    if(timeLeft<=0&&GS==='playing'){surviveTime=30;GS='result';saveScore();}
    bgUrgency=Math.max(0,Math.min(1,(10-timeLeft)/10));
    bgPulse=Math.min(1,combo/10);
  }

  updateBg(sdt);

  if(GS==='playing'){
    // spawn
    spawnTimer-=sdt;
    if(spawnTimer<=0){
      var alive=rings.filter(function(r){return !r.isBonus&&!r.hit&&r.state==='alive';});
      var need=getRingCount();
      if(alive.length<need)spawnRing();
      if(!bonusSpawned&&GS==='playing'){
        var el2=(performance.now()-startTime)/1000;
        if(el2>8&&Math.random()<0.02)spawnBonus();
      }
      var iv=timeLeft>20?2.5:timeLeft>10?1.6:1.0;
      spawnTimer=iv/need;
    }
    // update rings
    for(var i=0;i<rings.length;i++)updateRing(rings[i],sdt,bgTime);
    rings=rings.filter(function(r){return r.state!=='dead';});
    // bullets
    for(var i=0;i<bullets.length;i++)updateBullet(bullets[i],sdt);
    bullets=bullets.filter(function(b){return !b.dead;});
    // utensils
    for(var i=0;i<utensils.length;i++)updateUtensil(utensils[i],sdt);
    // particles
    updateParticles(sdt);
    // popups
    for(var i=0;i<popups.length;i++)updatePopup(popups[i],sdt);
    popups=popups.filter(function(p){return p.life>0;});
    // big msgs
    for(var i=0;i<bigMsgs.length;i++)updateBig(bigMsgs[i],sdt);
    bigMsgs=bigMsgs.filter(function(m){return m.life>0;});
    // slow-mo recovery
    if(timeScale<1)timeScale=Math.min(1,timeScale+dt*1.5);
    if(missFlash>0)missFlash-=dt*3;
  }

  // ─── DRAW ───
  drawBg();

  if(GS==='playing'||GS==='result'){
    for(var i=0;i<utensils.length;i++)drawUtensil(utensils[i]);
    for(var i=0;i<rings.length;i++)drawRing(rings[i]);
    for(var i=0;i<bullets.length;i++)drawBullet(bullets[i]);
    drawParticles();
    for(var i=0;i<popups.length;i++)drawPopup(popups[i]);
    for(var i=0;i<bigMsgs.length;i++)drawBig(bigMsgs[i]);
    // miss flash + glass crack
    if(missFlash>0){
      ctx.fillStyle='rgba(255,30,60,'+(missFlash*0.45)+')';
      ctx.fillRect(0,0,CW,CH);
      if(missFlash>0.5){
        ctx.save();
        ctx.strokeStyle='rgba(255,100,120,'+((missFlash-0.5)*2*0.6)+')';
        ctx.lineWidth=1.5;
        var ccx=CW/2,ccy=CH/2;
        for(var i=0;i<8;i++){
          var a=(i/8)*Math.PI*2;
          ctx.beginPath();
          ctx.moveTo(ccx+Math.cos(a)*40,ccy+Math.sin(a)*40);
          ctx.lineTo(ccx+Math.cos(a+0.15)*160,ccy+Math.sin(a+0.15)*160);
          ctx.stroke();
        }
        ctx.restore();
      }
    }
  }

  if(GS==='playing') drawHUD();
  if(GS==='start')   drawStart();
  if(GS==='result')  drawResult();

  requestAnimationFrame(loop);
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
initBg();
resetGame();
requestAnimationFrame(loop);
