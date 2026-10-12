
const D = __DATA__;
const stage = document.querySelector(".cm-stage");
const svg = stage.querySelector("svg");
const q = (sel) => svg.querySelector(sel);
const still = matchMedia("(prefers-reduced-motion: reduce)");
const LIGHT = document.body.dataset.theme === "light" ? 1 : 0;
const line1 = q('[data-part="line1"]');
const line2 = q('[data-part="line2"]');
const bar = q('[data-part="bar"]');
const glass = svg.querySelectorAll(".cm-glass");
const needle = q('[data-part="needle"]');
const liquid = q('[data-part="liquid"]');
const crema = q('[data-part="crema"]');
const column = q('[data-part="column"]');
const surface = q('[data-part="surface"]');
const cupEl = q('[data-part="cup"]');
const tankEl = q('[data-part="tank"]');
const svgStreamC = q('[data-part="svgstream-c"]');
const svgStreamW = q('[data-part="svgstream-w"]');
const btns = [0, 1].map((i) => q('[data-btn="' + i + '"]'));
const leds = [0, 1].map((i) => q('[data-led="' + i + '"]'));
const readout = document.querySelector("[data-readout]");
const status = document.querySelector("[data-status]");
const RECIPE_OF = ["espresso", "americano"];
const G = 9810, V0 = 150;
const AREA = Math.PI * D.cup[2] * D.cup[2];
const pressVec = axisVector(D.P, [0, -1.8, 0]);
const levelOf = (ml) => D.floorZ + (ml * 1000) / AREA;
const fall = (t) => (t > 0 ? V0 * t + 0.5 * G * t * t : 0);

const FRAGMENT = `
uniform float uGlow;
uniform vec2 uBtn;
uniform vec4 uC;
uniform vec4 uW;
uniform float uLight;
uniform float uFront;
uniform float uGlassY;
uniform vec4 uGlass;
uniform vec4 uBezel;
uniform vec4 uButtons;
uniform float uRing;
uniform vec4 uSpouts;
uniform vec2 uSpout;
uniform vec4 uNozzle;
uniform vec3 uCup;
uniform float uRim;
float sdBox(vec2 p,vec2 a,vec2 b,float r){vec2 c=(a+b)*.5;vec2 h=(b-a)*.5-r;vec2 d=abs(p-c)-h;return length(max(d,0.))+min(max(d.x,d.y),0.)-r;}
float openAt(vec2 vb,float px){vec3 p=onFloor(vb,uRim);return 1.-smoothstep(-.7*px,.7*px,length(p.xy-uCup.xy)-uCup.z);}
vec4 over(vec4 a,vec4 b){return a+b*(1.-a.a);}
vec4 stream(vec2 vb,vec2 c,float zTop,float r0,vec4 s,float water,float px){
  if(s.x<=0.)return vec4(0.);
  vec2 a=project(vec3(c,0.));
  float z=(a.y-vb.y)/(uK*uCam.w);
  float zHi=zTop-s.z;
  float zLo=max(zTop-s.y,s.w);
  if(zHi<=zLo)return vec4(0.);
  float drop=max(zTop-z,0.);
  float v=sqrt(${V0.toFixed(1)}*${V0.toFixed(1)}+2.*${G.toFixed(1)}*drop);
  float r=max(r0*sqrt(s.x)*sqrt(${V0.toFixed(1)}/v),.5);
  float dx=(vb.x-a.x)/uK;
  float cover=1.-smoothstep(r-.7*px,r+.7*px,abs(dx));
  if(cover<=0.)return vec4(0.);
  float ends=smoothstep(zLo-.4,zLo+.8,z)*(1.-smoothstep(zHi-1.2,zHi+.2,z));
  ends*=mix(.8,1.,smoothstep(uRim-1.,uRim+1.,z));
  float n=clamp(dx/r,-1.,1.);
  float lit=exp(-pow((n+.38)/.28,2.));
  if(water<.5){
    float tiger=noise2(vec2(z*.11+uTime*5.2,c.x*.3));
    vec3 body=mix(vec3(.30,.15,.06),vec3(.70,.43,.19),smoothstep(.35,.85,tiger));
    body*=.75+.25*(1.-n*n);
    body+=vec3(.55,.42,.30)*lit*.55*(1.-uLight*.4);
    float al=cover*ends;
    return vec4(body*al,al);
  }
  vec3 tint=mix(vec3(.82,.9,1.),vec3(.36,.47,.58),uLight);
  float rim=pow(abs(n),3.);
  float al=cover*ends*(.16+.5*rim+.5*lit);
  return vec4(tint*al,al);
}
vec4 ripple(vec2 vb,vec2 c,vec4 s,vec3 col,float px){
  if(s.x<=0.)return vec4(0.);
  vec3 p=onFloor(vb,s.w);
  float inCup=1.-smoothstep(-.7*px,.7*px,length(p.xy-uCup.xy)-uCup.z+.6);
  float d=length(p.xy-c);
  float rings=.5+.5*sin(d*1.5-uTime*16.);
  float a=s.x*exp(-d/5.)*rings*smoothstep(.4,2.,d)*inCup*.35;
  return vec4(col*a,a);
}
void main(){
  vec2 vb=viewOf(gl_FragCoord.xy);
  float px=pixelOf();
  vec4 res=vec4(0.);
  float landC=step(uSpout.x-uC.y,uC.w)*(1.-step(uSpout.x-uC.z,uC.w));
  float landW=step(uNozzle.z-uW.y,uW.w)*(1.-step(uNozzle.z-uW.z,uW.w));
  res=over(ripple(vb,uSpouts.xy,vec4(uC.x*landC,uC.yzw),mix(vec3(.85,.62,.38),vec3(.55,.36,.2),uLight),px),res);
  res=over(ripple(vb,uSpouts.zw,vec4(uC.x*landC,uC.yzw),mix(vec3(.85,.62,.38),vec3(.55,.36,.2),uLight),px),res);
  res=over(ripple(vb,uNozzle.xy,vec4(uW.x*landW,uW.yzw),mix(vec3(.7,.6,.5),vec3(.4,.3,.22),uLight),px),res);
  res=over(stream(vb,uSpouts.xy,uSpout.x,uSpout.y,uC,0.,px),res);
  res=over(stream(vb,uSpouts.zw,uSpout.x,uSpout.y,uC,0.,px),res);
  res=over(stream(vb,uNozzle.xy,uNozzle.z,uNozzle.w,uW,1.,px),res);
  vec3 f=onWallY(vb,uFront);
  vec2 fp=vec2(f.x,f.z);
  vec3 g=onWallY(vb,uGlassY);
  vec2 gp=vec2(g.x,g.z);
  float dBezel=sdBox(fp,uBezel.xz,uBezel.yw,4.);
  float inBezel=1.-smoothstep(-.7*px,.7*px,dBezel);
  float inGlass=(1.-smoothstep(-.7*px,.7*px,sdBox(gp,uGlass.xz,uGlass.yw,3.)))*inBezel;
  vec2 centre=(uGlass.xz+uGlass.yw)*.5;
  vec2 rel=(gp-centre)/vec2(34.,20.);
  float wash=inGlass*(.45+.55*exp(-dot(rel,rel)*1.6));
  float onFace=window(f.x,-96.,96.,1.)*window(f.z,229.,320.,1.);
  float bloom=(1.-inBezel)*exp(-max(dBezel,0.)/4.5)*.5*onFace;
  float btn=0.;
  for(int i=0;i<2;i++){
    vec2 bc=i==0?uButtons.xy:uButtons.zw;
    float on=i==0?uBtn.x:uBtn.y;
    float d=length(fp-bc);
    btn+=on*(exp(-pow((d-uRing)/.9,2.))*.9+exp(-max(d-uRing,0.)/3.)*.22*step(uRing,d))*onFace;
  }
  vec3 amber=vec3(1.,.6,.24);
  vec3 warm=vec3(1.,.8,.52);
  vec3 light=warm*wash*.42*uGlow+amber*bloom*uGlow+amber*btn;
  vec3 glow=tonemap(light,1.25);
  float gl=max(glow.r,max(glow.g,glow.b));
  vec4 dark=vec4(glow,0.);
  vec3 ink=vec3(.93,.55,.18);
  float ia=gl*.55;
  vec4 paper=vec4(ink*ia,ia);
  vec4 glowOut=mix(dark,paper,uLight);
  gl_FragColor=over(res,glowOut);
}`;

const layer = glLayer({
  canvas: stage.querySelector(".cm-gl"),
  fragment: FRAGMENT,
  view: [D.W, D.H],
  camera: D.camera,
  uniforms: ["uGlow", "uBtn", "uC", "uW"],
  fixed: {
    uLight: LIGHT,
    uFront: D.front,
    uGlassY: D.glassY,
    uGlass: [D.glass[0], D.glass[1], D.glass[2], D.glass[3]],
    uBezel: [D.bezel[0], D.bezel[1], D.bezel[2], D.bezel[3]],
    uButtons: [...D.buttons[0], ...D.buttons[1]],
    uRing: D.ring,
    uSpouts: [...D.spouts[0], ...D.spouts[1]],
    uSpout: [D.spoutZ, D.spoutR],
    uNozzle: [...D.nozzle, D.nozzleZ, D.nozzleR],
    uCup: D.cup,
    uRim: D.rimZ,
  },
});
if (layer) stage.setAttribute("data-gl", "");

let brew = null;
let pending = null;
let swap = null;
let held = { coffee: 0, water: 0 };
let tank = 1180;
let awake = 0;
let clock = 0;
const glowS = { x: 0, v: 0 };
const needleS = { x: 0, v: 0 };
const btnS = [{ x: 0, v: 0 }, { x: 0, v: 0 }];
const ledS = [{ x: 0, v: 0 }, { x: 0, v: 0 }];
const pressT = [-9, -9];
const flows = { c: { on: false, start: -9, stop: -9 }, w: { on: false, start: -9, stop: -9 } };
let frame = 0, previous = 0, visible = false;
let touring = !still.matches, idleTimer = 0;
let tour = { step: 0, wait: 2.2 };
let lastState = null;
let readPhase = "";

function startBrew(recipe) {
  brew = { recipe, t: 0, stopped: null };
  awake = 0;
  status.textContent = recipe + " started";
}
function press(index) {
  pressT[index] = clock;
  if (brew && !brew.stopped) { brew.stopped = brew.t; status.textContent = "stopped"; run(); return; }
  if (swap) return;
  const recipe = RECIPE_OF[index];
  if (held.coffee + held.water > 0.5 || brew) { swap = { t: 0 }; pending = recipe; }
  else startBrew(recipe);
  run();
}
function stateNow() {
  if (!brew) return null;
  const t = brew.stopped ?? brew.t;
  const s = stateAt(brew.recipe, t);
  if (brew.stopped != null) {
    const since = brew.t - brew.stopped;
    return { ...s, coffeeFlow: 0, waterFlow: 0, pressure: s.pressure * Math.exp(-since / 0.6), phase: "stopped", done: since > 1.5 };
  }
  return s;
}
function track(f, flowing, now) {
  if (flowing && !f.on) { f.on = true; f.start = now; }
  if (!flowing && f.on) { f.on = false; f.stop = now; }
  const head = fall(now - f.start);
  const tail = f.on ? 0 : fall(now - f.stop);
  return [head, tail];
}
const fmt = (n, d = 0) => n.toFixed(d);
function display(s) {
  let a = "READY", b = "93°C", frac = 0;
  if (brew && s) {
    a = RECIPES[brew.recipe].label;
    const secs = brew.stopped ?? brew.t;
    if (s.phase === "heating") b = "HEAT " + fmt(s.temp) + "°";
    else if (s.phase === "hot water") b = "+" + fmt(s.water) + " ML";
    else if (s.phase === "stopped") b = "STOP " + fmt(s.coffee) + "g";
    else if (s.phase === "done") b = brew.recipe === "americano" ? fmt(s.coffee + s.water) + " ML" : fmt(s.coffee) + "g DONE";
    else b = fmt(Math.max(0, secs - 3)) + "s " + fmt(s.coffee) + "g";
    frac = brew.recipe === "americano" ? (s.coffee + s.water) / (36 + 144) : s.coffee / 36;
  }
  if (line1.textContent !== a) line1.textContent = a;
  if (line2.textContent !== b) line2.textContent = b;
  const x0 = D.glass[0] + 4;
  bar.setAttribute("d", "M" + x0 + " " + -(D.glass[2] + 3) + "H" + (x0 + 44 * Math.min(1, frac)).toFixed(2));
  bar.style.opacity = frac > 0 ? "" : "0";
  let text = "ready · 93 °C · tank " + (tank / 1000).toFixed(2) + " L";
  if (brew && s && s.phase !== readPhase) { readPhase = s.phase; status.textContent = brew.recipe + ": " + s.phase; }
  if (brew && s) {
    text = brew.recipe + " · " + s.pressure.toFixed(1) + " bar · " + fmt(s.coffee) + " g";
    if (brew.recipe === "americano") text += " + " + fmt(s.water) + " ml";
  }
  if (readout.textContent !== text) readout.textContent = text;
}
function setTank() {
  const z = D.tankZ[0] + (D.tankZ[1] - D.tankZ[0]) * (tank / D.tank);
  tankEl.setAttribute("d", "M" + D.windowX[0] + " " + -(D.tankZ[0] - 4) + "H" + D.windowX[1] + "V" + -z.toFixed(2) + "H" + D.windowX[0] + "Z");
}
function svgStream(el, x, y, zTop, zLo, on) {
  if (!on || zLo >= zTop) { el.setAttribute("d", ""); return; }
  const a = iso([x, y, zTop - 1], D.P), b = iso([x, y, zLo], D.P);
  el.setAttribute("d", "M" + a[0].toFixed(1) + " " + a[1].toFixed(1) + "L" + b[0].toFixed(1) + " " + b[1].toFixed(1));
}
function tourStep(dt) {
  tour.wait -= dt;
  if (tour.wait > 0) return;
  if (brew && !brew.stopped && !lastState?.done) return;
  if (swap) return;
  if (tour.step === 0) { press(0); tour = { step: 1, wait: 1 }; }
  else if (tour.step === 1) { if (!brew) tour = { step: 2, wait: 3.2 }; }
  else if (tour.step === 2) { press(1); tour = { step: 3, wait: 1 }; }
  else if (tour.step === 3) { if (!brew) tour = { step: 0, wait: 4.5 }; }
}
function tick(now) {
  const dt = previous ? Math.min((now - previous) / 1000, 1 / 30) : 1 / 60;
  previous = now;
  clock += dt;
  const calm = still.matches;
  if (touring) tourStep(dt);
  if (swap) {
    swap.t += dt;
    const t = swap.t;
    const out = Math.min(1, t / 0.45), back = Math.max(0, (t - 0.55) / 0.45);
    if (t > 0.5 && pending) { held = { coffee: 0, water: 0 }; brew = null; }
    const shift = axisVector(D.P, [0, 70 * (out < 1 ? out * out : 0), 0]);
    cupEl.style.opacity = (t < 0.5 ? 1 - out : Math.min(1, back)).toFixed(3);
    cupEl.setAttribute("transform", t < 0.5 ? "translate(" + shift[0].toFixed(2) + " " + shift[1].toFixed(2) + ")" : "");
    if (t >= 1) { cupEl.style.opacity = ""; swap = null; if (pending) { startBrew(pending); pending = null; } }
  }
  let s = null;
  if (brew) {
    brew.t += dt * D.timelapse;
    s = stateNow();
    const before = lastState ? lastState.used : 0;
    tank = Math.max(0, tank - Math.max(0, s.used - before));
    if (s.done) {
      held = { coffee: held.coffee + s.coffee, water: held.water + s.water };
      brew = null;
      awake = 6;
      status.textContent = "ready";
      s = null;
    }
  } else if (awake > 0) awake -= dt;
  lastState = s;
  if (!brew && tank < 380) tank = Math.min(D.tank, tank + 600 * dt);
  const coffeeMl = held.coffee + (s ? s.coffee : 0);
  const waterMl = held.water + (s ? s.water : 0);
  const level = levelOf(coffeeMl + waterMl);
  const total = coffeeMl + waterMl;
  if (total > 0.05) {
    const solid = cylinder(D.cup[0], D.cup[1], D.cup[2], D.floorZ, Math.max(0.2, level - D.floorZ), D.P, 64);
    column.setAttribute("d", solid.fill);
    surface.setAttribute("d", solid.top);
    crema.setAttribute("d", ring(D.cup[0], D.cup[1], D.cup[2] * (0.97 - 0.3 * (waterMl / Math.max(1, total))), level, D.P, 64));
  }
  liquid.style.opacity = Math.min(1, total / 1.5).toFixed(3);
  crema.style.opacity = (0.95 - 0.6 * (waterMl / Math.max(1, total))).toFixed(3);
  const running = brew && !brew.stopped;
  const glowTarget = running ? 1 : brew || awake > 0 ? 0.6 : 0;
  const glowMoving = settle(glowS, glowTarget, dt, glowTarget > glowS.x ? 0.12 : 0.9, calm);
  stage.toggleAttribute("data-awake", glowS.x > 0.25);
  glass.forEach((el) => el.toggleAttribute("data-on", glowS.x > 0.25));
  const needleMoving = settle(needleS, s ? s.pressure : 0, dt, 0.12, calm);
  needle.setAttribute("transform", "rotate(" + (-135 + 18 * Math.max(0, needleS.x)).toFixed(2) + " " + D.gauge[0] + " " + -D.gauge[1] + ")");
  let moving = glowMoving || needleMoving;
  for (let i = 0; i < 2; i++) {
    const down = clock - pressT[i] < 0.14 ? 1 : 0;
    moving = settle(btnS[i], down, dt, down ? 0.03 : 0.08, calm) || moving || down > 0;
    btns[i].setAttribute("transform", "translate(" + (pressVec[0] * btnS[i].x).toFixed(2) + " " + (pressVec[1] * btnS[i].x).toFixed(2) + ")");
    const on = brew && brew.recipe === RECIPE_OF[i] ? 1 : 0;
    moving = settle(ledS[i], on * (running ? 1 : 0.5), dt, on ? 0.1 : 0.6, calm) || moving;
    leds[i].toggleAttribute("data-on", ledS[i].x > 0.4);
    btns[i].toggleAttribute("data-on", ledS[i].x > 0.4);
  }
  const [ch, ct] = track(flows.c, !!(s && s.coffeeFlow > 0), clock);
  const [wh, wt] = track(flows.w, !!(s && s.waterFlow > 0), clock);
  const cVisible = ct < D.spoutZ - level + 4 && ch > 0 && (flows.c.on || clock - flows.c.stop < 0.6);
  const wVisible = wt < D.nozzleZ - level + 4 && wh > 0 && (flows.w.on || clock - flows.w.stop < 0.6);
  const cQ = s && s.coffeeFlow > 0 ? s.coffeeFlow / 1.85 : cVisible ? 0.35 : 0;
  const wQ = s && s.waterFlow > 0 ? 1 : wVisible ? 0.5 : 0;
  setTank();
  display(s);
  svgStream(svgStreamC, 0, D.spouts[0][1], D.spoutZ, Math.max(level, D.spoutZ - ch), cVisible && cQ > 0);
  svgStream(svgStreamW, D.nozzle[0], D.nozzle[1], D.nozzleZ, Math.max(level, D.nozzleZ - wh), wVisible && wQ > 0);
  const active = glowS.x > 1e-3 || cVisible || wVisible || ledS[0].x > 1e-3 || ledS[1].x > 1e-3;
  if (layer) {
    if (active) layer.draw({ uGlow: glowS.x, uBtn: [ledS[0].x, ledS[1].x], uC: [cVisible ? cQ : 0, ch, ct, level], uW: [wVisible ? wQ : 0, wh, wt, level] }, calm ? 1 : clock);
    else layer.clear();
  }
  const busy = touring || brew || swap || awake > 0 || moving || cVisible || wVisible;
  frame = visible && busy ? requestAnimationFrame(tick) : 0;
}
function run() { if (!frame && visible) { previous = 0; frame = requestAnimationFrame(tick); } }
function takeOver() {
  touring = false;
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { if (still.matches) return; touring = true; tour = { step: 0, wait: 1.5 }; run(); }, 15000);
}
new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
svg.addEventListener("click", (event) => {
  const b = event.target.closest("[data-btn]");
  if (!b) return;
  takeOver();
  press(Number(b.dataset.btn));
  stage.focus({ preventScroll: true });
});
stage.addEventListener("keydown", (event) => {
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  const key = event.key.toLowerCase();
  const index = key === "1" || key === "e" ? 0 : key === "2" || key === "a" ? 1 : -1;
  if (index < 0) return;
  event.preventDefault();
  takeOver();
  press(index);
});
setTank();
display(null);
window.__cm = { press, seek: (t) => { if (brew) { brew.t = t; lastState = stateAt(brew.recipe, t); } run(); }, state: () => ({ brew, held, tank, glow: glowS.x }) };
