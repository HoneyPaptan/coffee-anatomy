import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as M from "./model.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ANATOMY = process.env.ANATOMY ?? join(homedir(), ".claude/skills/anatomy");
const k = await import(pathToFileURL(join(ANATOMY, "kit/iso-kit.mjs")).href);
const { glCamera } = await import(pathToFileURL(join(ANATOMY, "kit/gl.mjs")).href);
const { kitScript, glScript } = await import(pathToFileURL(join(ANATOMY, "scripts/inline-kit.mjs")).href);
const theme = process.argv.includes("--light") ? "light" : "dark";

const WIDTH = 600;
const HEIGHT = 600;

const PLATE = { x: -150, y: -196, w: 300, d: 444, r: 12 };
const PLATE_H = 12;
const FOOT_H = 6;

const SIDE = 98;
const FEET_H = 5;
const BASE_TOP = 44;
const HEAD_Z = 228;
const TOP = 322;
const BASE = { x: -SIDE, y: -170, w: SIDE * 2, d: 316, r: 10 };
const TOWER = { x: -SIDE, y: -170, w: SIDE * 2, d: 198, r: 10 };
const UPPER = { x: -SIDE, y: -170, w: SIDE * 2, d: 298, r: 10 };
const BAY = TOWER.y + TOWER.d;
const FRONT = UPPER.y + UPPER.d;
const TRAY_Y = BASE.y + BASE.d;
const TRIM_Z = 246;

const GROUP = [0, 78];
const COLLAR = { r: 30, z0: 208 };
const BASKET = { r: 29, z0: 186 };
const BLOCK = { c: [0, 84], r: 9, z0: 176 };
const SPOUTS = [[-7, 86], [7, 86]];
const SPOUT = { r: 2.6, z0: 163 };
const NOZZLE = { c: [30, 100], r: 3.2, z0: 182 };
const GRATE = { x: -82, y: 34, w: 164, d: 108, r: 6 };
const GRATE_Z = BASE_TOP + 2.5;
const CUP = { c: [0, 86], r: 40, rIn: 36, z0: GRATE_Z, h: 92, floor: 10 };
const RIM_Z = CUP.z0 + CUP.h;
const FLOOR_Z = CUP.z0 + CUP.floor;
const CUP_ML = (Math.PI * CUP.rIn * CUP.rIn * (RIM_Z - FLOOR_Z)) / 1000;

const GAUGE = { x: -58, z: 276, r: 24, face: 21, proud: 3 };
const BEZEL = { x0: -30, x1: 30, z0: 256, z1: 294, r: 4, depth: 1.2 };
const GLASS = { x0: -26, x1: 26, z0: 260, z1: 290, r: 3, depth: 2.5 };
const BUTTONS = [
  { recipe: "espresso", x: 58, z: 285 },
  { recipe: "americano", x: 58, z: 263 },
];
const BTN = { collar: 10.5, cap: 7.8, ring: 9.2, proud: 2.6 };
const WINDOW = { x0: 126, x1: 150, z0: 96, z1: 300, r: 4, depth: 2 };
const TANK_Z = [WINDOW.z0 + 2, WINDOW.z1 - 12];

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), ...k.boxCorners(UPPER, 0, TOP), [0, 198, 204]],
  WIDTH,
  HEIGHT,
  { pad: 26, azimuth: 56 },
);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
const frontPlane = (y = FRONT) => k.sideMatrix([0, y], 0, P, "left");
const sidePlane = (x = SIDE) => k.sideMatrix([x, 0], 0, P, "right");
const flat = (x0, z0, x1, z1, r, steps = 6) => k.pathOf(k.roundedPlan({ x: x0, y: z0, w: x1 - x0, d: z1 - z0, r }, steps).map(([u, z]) => [u, -z]), true);
const circle = (cx, cz, r, steps = 48) => k.pathOf(k.circleRing(cx, -cz, r, steps), true);
const onFront = (y) => (u, z, d = 0) => [u, y - d, z];
const onSide = (x) => (u, z, d = 0) => [x - d, -u, z];

function hull(points) {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (const p of pts.reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

/** A round part standing proud of the front face: a short cylinder along +y from `y0`. */
function faceDisc(cx, cz, r, y0, depth, steps = 48) {
  const ring = (y) => k.circleRing(cx, cz, r, steps).map(([x, z]) => at([x, y, z]));
  const back = ring(y0);
  const front = ring(y0 + depth);
  const outline = k.pathOf(hull([...back, ...front]), true);
  const cap = k.pathOf(front, true);
  return { fill: outline, outline, crease: cap, top: cap, shades: ["", "", outline, ""] };
}

let clips = 0;
function recess({ x0, x1, z0, z1, r, depth }, face, plane, back = "", backClass = "cm-well", inside = "") {
  const id = `cm-clip-${clips++}`;
  const ring = k.roundedPlan({ x: x0, y: z0, w: x1 - x0, d: z1 - z0, r }, 6);
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const tops = [];
  const sides = [[], [], [], []];
  ring.forEach(([ax, az], index) => {
    const [bx, bz] = ring[(index + 1) % ring.length];
    const length = Math.hypot(bx - ax, bz - az) || 1;
    let [nx, nz] = [(bz - az) / length, -(bx - ax) / length];
    if (nx * (cx - (ax + bx) / 2) + nz * (cz - (az + bz) / 2) < 0) [nx, nz] = [-nx, -nz];
    if (nx <= 0 && nz <= 0) return;
    const quad = k.pathOf([at(face(ax, az)), at(face(bx, bz)), at(face(bx, bz, depth)), at(face(ax, az, depth))], true);
    if (nz >= nx) tops.push(quad);
    else sides[Math.min(3, Math.max(0, Math.floor(((1 - nx) / 2) * 4)))].push(quad);
  });
  const shape = flat(x0, z0, x1, z1, r);
  return [
    `<clipPath id="${id}"><path transform="${plane(0)}" d="${shape}"/></clipPath>`,
    `<g clip-path="url(#${id})">`,
    `<path class="iso-top" d="${tops.join("")}"/>`,
    ...sides.map((d, shade) => (d.length ? `<path class="iso-shade" data-shade="${shade}" d="${d.join("")}"/>` : "")),
    `<g transform="${plane(depth)}"><path class="${backClass}" d="${shape}"/>${back}<path class="iso-line" data-tone="faint" d="${shape}"/></g>`,
    inside,
    `</g>`,
    `<g transform="${plane(0)}"><path class="iso-line" data-tone="lo" d="${shape}"/></g>`,
  ].join("");
}
const frontRecess = (spec, y, ...rest) => recess(spec, onFront(y), (d) => frontPlane(y - d), ...rest);
const sideRecess = (spec, x, ...rest) => recess(spec, onSide(x), (d) => sidePlane(x - d), ...rest);

function plate() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(PLATE, 24))) {
    out.push(S(k.cylinder(x, y, 8, -PLATE_H - FOOT_H, 1.8, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 6.2, -PLATE_H - FOOT_H + 1.8, FOOT_H - 1.8, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 6), 0, P), { tone: "lo" }));
  const screws = k.corners(PLATE, 11);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.4, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  const ruler = { x: 116, y: -170, w: 22, d: 310, r: 2 };
  out.push(S(k.slabOf(ruler, 0, 0.8, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(-160, 130, 10, 5, ruler.x, 0.8, [4, 8], P, "y");
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }), L(k.lineOnTop([ruler.x + 8, ruler.y], [ruler.x + 8, ruler.y + ruler.d], 0.8, P), { tone: "lo" }));
  const label = { x: -136, y: 204, w: 64, d: 22, r: 2 };
  out.push(S(k.slabOf(label, 0, 0.8, P, 3), { tone: "lo", crease: "none" }));
  out.push(L([44, 34, 26].map((w, i) => k.lineOnTop([label.x + 5, label.y + 5 + i * 5], [label.x + 5 + w, label.y + 5 + i * 5], 0.8, P)).join(""), { tone: "lo", free: true }));
  out.push(D([at([label.x + label.w - 4, label.y + 4, 0.8]), at([label.x + label.w - 4, label.y + label.d - 4, 0.8])], { size: 0.45 }));
  return out.join("");
}

function sideScrew(y, z, x = SIDE) {
  const ring = k.pathOf(k.circleRing(-y, -z, 2.2, 16), true);
  return `<g transform="${sidePlane(x)}"><path class="iso-line" data-tone="lo" d="${ring}"/></g>` + D([at([x, y, z])], { size: 0.5 });
}

function lower() {
  const out = [`<path class="iso-halo" d="${k.haloOf(BASE, 0, 10, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(BASE, 20))) {
    out.push(S(k.cylinder(x, y, 9, 0, 1.4, P, 24), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 7.4, 1.4, FEET_H - 1.4, P, 24), { tone: "lo" }));
  }
  out.push(S(k.slabOf(BASE, FEET_H, BASE_TOP - FEET_H, P, 8, 1.2), { tone: "mid", inner: L(k.sideSeam(BASE, 12, P, 8), { tone: "faint" }) }));
  out.push(sideScrew(-150, 26), sideScrew(126, 26));
  out.push(tray());
  out.push(S(k.slabOf(TOWER, BASE_TOP, HEAD_Z - BASE_TOP, P, 8), { tone: "mid" }));
  const rowOf = (from, to, gap) => Array.from({ length: Math.floor((to - from) / gap + 1e-9) + 1 }, (_, i) => from + i * gap);
  const slot = (u, z0, z1, half = 1.1) => flat(u - half, z0, u + half, z1, half, 4);
  out.push(`<g transform="${sidePlane()}">${L(rowOf(20, 116, 6).map((u) => slot(u, 68, 124)).join(""), { tone: "faint" })}</g>`);
  out.push(`<g transform="${frontPlane(BAY)}">${L(flat(-86, 56, 86, 220, 6), { tone: "faint" })}</g>`);
  out.push(D([[-80, 62], [80, 62], [-80, 214], [80, 214]].map(([x, z]) => at([x, BAY, z])), { size: 0.45 }));
  out.push(`<g transform="${frontPlane(BAY)}">${L(circle(-80, 62, 2.2, 16) + circle(80, 62, 2.2, 16) + circle(-80, 214, 2.2, 16) + circle(80, 214, 2.2, 16), { tone: "lo" })}</g>`);
  return out.join("");
}

function tray() {
  const out = [];
  const panel = { x: -86, y: TRAY_Y, w: 172, d: 6, r: 3 };
  out.push(S(k.slabOf(panel, 9, BASE_TOP - 11, P, 4, 0.6), { tone: "mid" }));
  const face = TRAY_Y + panel.d;
  out.push(frontRecess({ x0: -32, x1: 32, z0: 28, z1: 34, r: 3, depth: 2.4 }, face, "", "cm-dark"));
  out.push(frontRecess({ x0: 56, x1: 74, z0: 16, z1: 24, r: 3, depth: 1.6 }, face, `<path class="cm-float" data-part="float" d="${flat(57, 16, 73, 19.5, 1.5)}"/>`, "cm-dark"));
  out.push(S(k.slabOf(GRATE, BASE_TOP, GRATE_Z - BASE_TOP, P, 6, 0.6), { tone: "mid" }));
  const slots = [];
  for (let x = -72; x <= 72.1; x += 9) slots.push(k.planOutline({ x: x - 1.6, y: GRATE.y + 8, w: 3.2, d: GRATE.d - 16, r: 1.6 }, GRATE_Z, P, 4));
  out.push(L(slots.join(""), { tone: "lo" }));
  return out.join("");
}

function cup() {
  const [cx, cy] = CUP.c;
  const out = [`<g data-part="cup">`, `<path class="iso-halo" d="${k.haloOf({ x: cx - CUP.r, y: cy - CUP.r, w: CUP.r * 2, d: CUP.r * 2, r: CUP.r }, CUP.z0, 4, P)}"/>`];
  const body = k.cylinder(cx, cy, CUP.r, CUP.z0, CUP.h, P, 72);
  const inner = k.cylinder(cx, cy, CUP.rIn, FLOOR_Z, RIM_Z - FLOOR_Z, P, 72);
  out.push(`<path class="cm-cup-tint" d="${body.fill}"/>`);
  out.push(L(inner.outline, { tone: "faint" }));
  out.push(L(k.ring(cx, cy, CUP.rIn, FLOOR_Z, P, 72), { tone: "faint" }));
  out.push(`<g data-part="liquid" style="opacity:0"><path class="cm-coffee" data-part="column" d=""/><path class="cm-surface" data-part="surface" d=""/><path class="cm-crema" data-part="crema" d=""/></g>`);
  out.push(`<path class="cm-cup-front" d="${body.fill}"/>`);
  const [vx, vy] = k.towardViewer(P);
  const facing = Math.atan2(vy, vx);
  const streak = (da, r, z0, z1) => k.fadeLineSvg([at([cx + r * Math.cos(facing + da), cy + r * Math.sin(facing + da), z0]), at([cx + r * Math.cos(facing + da), cy + r * Math.sin(facing + da), z1])], { fade: [10, 14], tone: "mid" });
  out.push(streak(0.55, CUP.r, CUP.z0 + 12, RIM_Z - 8), streak(0.7, CUP.r, CUP.z0 + 22, RIM_Z - 30), streak(-0.95, CUP.r, CUP.z0 + 16, RIM_Z - 14));
  const rim = k.ring(cx, cy, CUP.r, RIM_Z, P, 72) + k.ring(cx, cy, CUP.rIn, RIM_Z, P, 72);
  out.push(`<path class="cm-rim" fill-rule="evenodd" d="${rim}"/>`);
  out.push(L(k.ring(cx, cy, CUP.rIn, RIM_Z, P, 72), { tone: "lo" }));
  out.push(L(k.sideArc(cx, cy, CUP.r, CUP.z0 + CUP.floor - 4, P, 40), { tone: "faint" }));
  out.push(L(body.outline, { tone: "hi" }));
  out.push(`</g>`);
  return out.join("");
}

function group() {
  const [gx, gy] = GROUP;
  const out = [];
  out.push(S(k.cylinder(gx, gy, COLLAR.r, COLLAR.z0, HEAD_Z - COLLAR.z0, P, 64), { tone: "mid", inner: L(k.sideArc(gx, gy, COLLAR.r, COLLAR.z0 + 6, P, 40), { tone: "faint" }) }));
  const facing = Math.atan2(...k.towardViewer(P).slice().reverse());
  const bolts = [-0.7, 0.7].map((d) => at([gx + COLLAR.r * Math.cos(facing + d), gy + COLLAR.r * Math.sin(facing + d), COLLAR.z0 + 13]));
  out.push(D(bolts, { size: 0.5 }));
  out.push(S(k.cylinder(gx, gy, BASKET.r, BASKET.z0, COLLAR.z0 - BASKET.z0, P, 64, 0.8), { tone: "hi", inner: L(k.sideArc(gx, gy, BASKET.r, BASKET.z0 + 15, P, 40), { tone: "faint" }) }));
  for (const side of [-1, 1]) out.push(S(k.slabOf({ x: gx + side * (BASKET.r - 2) - 4, y: gy - 6, w: 8, d: 12, r: 2 }, COLLAR.z0 - 4, 4, P, 3), { tone: "mid" }));
  out.push(S(k.cylinder(...BLOCK.c, BLOCK.r, BLOCK.z0, BASKET.z0 - BLOCK.z0, P, 40, 0.5), { tone: "hi" }));
  for (const [sx, sy] of byDepth(SPOUTS)) {
    out.push(S(k.cylinder(sx, sy, SPOUT.r, SPOUT.z0 + 3, BLOCK.z0 - SPOUT.z0 - 3, P, 24), { tone: "hi" }));
    out.push(S(k.cylinder(sx, sy, SPOUT.r - 0.6, SPOUT.z0, 3, P, 20), { tone: "mid" }));
  }
  out.push(S(k.slabOf({ x: -5, y: gy + BASKET.r - 0.6, w: 10, d: 28, r: 3 }, 194, 7, P, 4, 0.5), { tone: "hi" }));
  const grip = { x: -7.5, y: 134, w: 15, d: 64, r: 7 };
  const ridges = [146, 152, 158, 164, 170, 176].map((y) => k.lineOnTop([grip.x, y], [grip.x + grip.w, y], 204, P)).join("");
  out.push(S(k.slabOf(grip, 191, 13, P, 6, 0.8), { tone: "mid", inner: L(ridges, { tone: "faint" }) }));
  out.push(L(k.ring(0, 191, 2.4, 204, P, 16), { tone: "lo" }));
  const [nx, ny] = NOZZLE.c;
  out.push(S(k.cylinder(nx, ny, NOZZLE.r, NOZZLE.z0 + 4, 216 - NOZZLE.z0 - 4, P, 24), { tone: "hi" }));
  out.push(S(k.cylinder(nx, ny, NOZZLE.r + 0.7, NOZZLE.z0, 4, P, 24), { tone: "mid" }));
  out.push(S(k.cylinder(nx, ny, NOZZLE.r + 2.4, 216, HEAD_Z - 216, P, 6), { tone: "mid" }));
  return out.join("");
}

function head() {
  const out = [];
  const seam = k.sideSeam(UPPER, TRIM_Z, P, 8);
  out.push(S(k.slabOf(UPPER, HEAD_Z, TOP - HEAD_Z, P, 8, 1.4), { tone: "mid", inner: L(seam, { tone: "lo" }) }));
  out.push(top());
  out.push(gauge(), screen(), ...BUTTONS.map(button));
  out.push(D([at([-86, FRONT, 237]), at([86, FRONT, 237])], { size: 0.5 }));
  out.push(`<g transform="${frontPlane()}">${L(circle(-86, 237, 2.2, 16) + circle(86, 237, 2.2, 16), { tone: "lo" })}</g>`);
  out.push(`<g data-part="power">${D([at([-58, FRONT, 237])], { size: 0.8, tone: "hi" })}</g>`);
  out.push(sideRecess(WINDOW, SIDE, tank(), "cm-dark"));
  const ticks = [TANK_Z[1], (TANK_Z[0] + TANK_Z[1]) / 2, TANK_Z[0] + 30].map((z, i) => `M${WINDOW.x1} ${-z}H${WINDOW.x1 + (i === 1 ? 4 : 7)}`).join("");
  const word = (text, z) => `<text class="cm-num" x="${WINDOW.x1 + 9}" y="${-z + 1.4}" font-size="4">${text}</text>`;
  out.push(`<g transform="${sidePlane()}">${L(ticks, { tone: "mid", free: "end" })}${word("MAX", TANK_Z[1])}${word("MIN", TANK_Z[0] + 30)}</g>`);
  out.push(sideScrew(-150, 300), sideScrew(-150, 248));
  return out.join("");
}

function top() {
  const out = [];
  const lid = { x: -86, y: -160, w: 172, d: 104, r: 8 };
  out.push(L(k.planOutline(lid, TOP, P), { tone: "lo" }), L(k.planOutline(k.insetPlan(lid, 3), TOP, P), { tone: "faint" }));
  out.push(L(k.planOutline({ x: -20, y: lid.y + lid.d - 12, w: 40, d: 6, r: 3 }, TOP, P, 4), { tone: "lo" }));
  out.push(L([-60, 44].map((x) => k.planOutline({ x, y: lid.y + 6, w: 16, d: 5, r: 1.5 }, TOP, P, 3)).join(""), { tone: "faint" }));
  const rows = [];
  for (let y = -30; y <= 100; y += 10) rows.push(k.planOutline({ x: -70, y, w: 140, d: 3, r: 1.5 }, TOP, P, 4));
  out.push(L(rows.join(""), { tone: "faint" }));
  return out.join("");
}

function tank() {
  const water = `<path class="cm-water" data-part="tank" d="${flat(WINDOW.x0, TANK_Z[0] - 4, WINDOW.x1, TANK_Z[1], 0, 1)}" transform=""/>`;
  const lines = [];
  for (let z = TANK_Z[0] + 10; z < TANK_Z[1]; z += 10) lines.push(`M${WINDOW.x0} ${-z}H${WINDOW.x0 + 5}`);
  return water + `<path class="iso-line" data-tone="lo" d="${lines.join("")}"/>`;
}

function gauge() {
  const { x, z, r, face, proud } = GAUGE;
  const out = [S(faceDisc(x, z, r, FRONT, proud, 64), { tone: "mid" })];
  const y = FRONT + proud;
  const dial = [`<path class="cm-dial" d="${circle(x, z, face, 64)}"/>`];
  const minor = [];
  const major = [];
  for (let bar = 0; bar <= 15; bar++) {
    const a = ((-135 + bar * 18) * Math.PI) / 180;
    const big = bar % 5 === 0;
    const r0 = face - (big ? 4.5 : 2.6);
    const seg = `M${(x + Math.sin(a) * r0).toFixed(2)} ${(-z - Math.cos(a) * r0).toFixed(2)}L${(x + Math.sin(a) * (face - 0.8)).toFixed(2)} ${(-z - Math.cos(a) * (face - 0.8)).toFixed(2)}`;
    (big ? major : minor).push(seg);
  }
  const band = (from, to, rr) => {
    const p = (b) => [x + Math.sin(((-135 + b * 18) * Math.PI) / 180) * rr, -z - Math.cos(((-135 + b * 18) * Math.PI) / 180) * rr];
    const [ax, ay] = p(from);
    const [bx, by] = p(to);
    return `M${ax.toFixed(2)} ${ay.toFixed(2)}A${rr} ${rr} 0 0 1 ${bx.toFixed(2)} ${by.toFixed(2)}`;
  };
  dial.push(`<path class="cm-band" d="${band(8, 10, face - 5.6)}"/>`);
  dial.push(L(minor.join(""), { tone: "lo" }), L(major.join(""), { tone: "hi" }));
  for (const bar of [0, 5, 10, 15]) {
    const a = ((-135 + bar * 18) * Math.PI) / 180;
    dial.push(`<text class="cm-num" x="${(x + Math.sin(a) * 11.2).toFixed(2)}" y="${(-z - Math.cos(a) * 11.2 + 1.3).toFixed(2)}" text-anchor="middle" font-size="3.6">${bar}</text>`);
  }
  dial.push(`<text class="cm-num" x="${x}" y="${-z + 9}" text-anchor="middle" font-size="2.8">BAR</text>`);
  dial.push(`<g data-part="needle" transform="rotate(-135 ${x} ${-z})"><path class="cm-needle" d="M${x} ${-z + 4}L${x} ${-z - (face - 3)}"/></g>`);
  dial.push(`<path class="cm-hub" d="${circle(x, z, 2.2, 20)}"/>`);
  dial.push(L(circle(x, z, face, 64), { tone: "lo" }));
  out.push(`<g transform="${frontPlane(y)}">${dial.join("")}</g>`);
  out.push(D([at([x, y, z])], { size: 0.5, tone: "hi" }));
  return out.join("");
}

function screen() {
  const textX = GLASS.x0 + 4;
  const scan = [];
  for (let z = GLASS.z0 + 1.4; z < GLASS.z1; z += 1.8) scan.push(`M${GLASS.x0} ${(-z).toFixed(1)}H${GLASS.x1}`);
  const back = [
    `<path class="cm-scan" d="${scan.join("")}"/>`,
    `<text class="cm-text" data-part="line1" x="${textX}" y="${-(GLASS.z0 + 18)}" font-size="7">READY</text>`,
    `<text class="cm-text cm-text-2" data-part="line2" x="${textX}" y="${-(GLASS.z0 + 6.5)}" font-size="6">93°C</text>`,
    `<path class="cm-text-bar" data-part="bar" d="M${textX} ${-(GLASS.z0 + 3)}H${textX}"/>`,
  ].join("");
  return frontRecess(BEZEL, FRONT, "", "cm-bezel", frontRecess(GLASS, FRONT - BEZEL.depth, back, "cm-glass"));
}

function button({ recipe, x, z }, index) {
  const out = [S(faceDisc(x, z, BTN.collar, FRONT, 0.8, 48), { tone: "lo" })];
  out.push(`<g transform="${frontPlane(FRONT + 0.8)}"><path class="cm-led" data-led="${index}" d="${circle(x, z, BTN.ring, 48)}"/></g>`);
  const capY = FRONT + 0.8;
  const icon = recipe === "espresso"
    ? `M${x - 3} ${-z - 1.6}H${x + 2}L${x + 1.4} ${-z + 2.4}H${x - 2.4}Z M${x + 2} ${-z - 0.6}H${x + 3.4}V${-z + 0.8}H${x + 1.7}`
    : `M${x - 3.4} ${-z - 3.4}H${x + 2.6}L${x + 1.8} ${-z + 3.2}H${x - 2.6}Z M${x + 2.4} ${-z - 2}H${x + 4}V${-z + 0.2}H${x + 2.1} M${x - 2.9} ${-z - 0.6}H${x + 2.2}`;
  out.push(`<g class="cm-btn" data-btn="${index}" role="button" aria-label="${recipe}">`);
  out.push(S(faceDisc(x, z, BTN.cap, capY, BTN.proud, 48), { tone: "hi" }));
  out.push(`<g transform="${frontPlane(capY + BTN.proud)}"><path class="cm-icon" d="${icon}"/></g>`);
  out.push(`</g>`);
  return out.join("");
}

function fallback() {
  return `<g class="cm-fallback"><path class="cm-svgstream" data-part="svgstream-c" d=""/><path class="cm-svgstream cm-svgstream-w" data-part="svgstream-w" d=""/></g>`;
}

const back = [plate(), lower(), cup(), group(), head(), fallback()];

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  className: "cm-back",
  label:
    "A compact espresso machine on a bench plate: a water tank at the back with a level window on its side, a group head with a 54 mm portafilter and two spouts, a hot water nozzle beside it, a drip tray with a grate, and a mug on the grate. On the front of the head sit a pressure gauge, a small display and two buttons, espresso and americano.",
  body: back,
});

const plane = (y) => k.sideMatrix([0, y], 0, P, "left");
const DATA = {
  W: WIDTH,
  H: HEIGHT,
  P,
  camera: glCamera(P),
  front: FRONT,
  glass: [GLASS.x0, GLASS.x1, GLASS.z0, GLASS.z1, GLASS.r],
  glassY: FRONT - BEZEL.depth - GLASS.depth,
  bezel: [BEZEL.x0, BEZEL.x1, BEZEL.z0, BEZEL.z1, BEZEL.r],
  buttons: BUTTONS.map(({ x, z }) => [x, z]),
  ring: BTN.ring,
  spouts: SPOUTS,
  spoutZ: SPOUT.z0,
  spoutR: SPOUT.r - 1.2,
  nozzle: NOZZLE.c,
  nozzleZ: NOZZLE.z0,
  nozzleR: NOZZLE.r - 1.1,
  cup: [...CUP.c, CUP.rIn],
  rimZ: RIM_Z,
  floorZ: FLOOR_Z,
  cupMl: CUP_ML,
  tankZ: TANK_Z,
  windowX: [WINDOW.x0, WINDOW.x1],
  gauge: [GAUGE.x, GAUGE.z],
  timelapse: M.TIMELAPSE,
  tank: M.TANK,
  liquidShift: k.axisVector(P, [0, 0, 1]),
  planes: { front: plane(FRONT) },
};

const model = readFileSync(join(HERE, "model.mjs"), "utf8").replace(/^export /gm, "");
const live = readFileSync(join(HERE, "live.js"), "utf8").replace("__DATA__", JSON.stringify(DATA));

const css = `<style>
.cm-stage{position:relative;touch-action:pan-y}
.cm-stage>svg,.cm-stage>canvas{display:block;width:100%;height:auto}
.cm-stage>.cm-gl{position:absolute;inset:0;height:100%!important;pointer-events:none}
.cm-stage:focus{outline:none}
.cm-stage:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:6px}
.cm-well{fill:var(--anatomy-shade-1)}
.cm-bezel{fill:var(--anatomy-shade-2)}
.cm-dark{fill:var(--anatomy-shade-0)}
.cm-glass{fill:var(--anatomy-shade-0);transition:fill .6s var(--anatomy-ease)}
.cm-glass[data-on]{fill:var(--anatomy-lit-shade)}
.cm-scan{fill:none;stroke:var(--anatomy-faint);stroke-width:.4px;vector-effect:non-scaling-stroke;opacity:.6}
.cm-text{fill:var(--anatomy-mid);font-family:var(--anatomy-mono);font-weight:600;letter-spacing:.04em;transition:fill .4s var(--anatomy-ease)}
.cm-text-2{font-weight:500}
[data-awake] .cm-text{fill:var(--anatomy-lit)}
.cm-text-bar{fill:none;stroke:var(--anatomy-lit);stroke-width:1.2px;vector-effect:non-scaling-stroke;stroke-linecap:round;opacity:.85}
.cm-dial{fill:var(--anatomy-top)}
.cm-band{fill:none;stroke:var(--anatomy-mid);stroke-width:2px;vector-effect:non-scaling-stroke}
.cm-num{fill:var(--anatomy-mid);font-family:var(--anatomy-mono)}
.cm-needle{fill:none;stroke:var(--anatomy-lit);stroke-width:1.1px;vector-effect:non-scaling-stroke;stroke-linecap:round}
.cm-hub{fill:var(--anatomy-mid)}
.cm-led{fill:none;stroke:var(--anatomy-faint);stroke-width:1px;vector-effect:non-scaling-stroke;transition:stroke .3s var(--anatomy-ease)}
.cm-led[data-on]{stroke:var(--anatomy-lit)}
.cm-icon{fill:none;stroke:var(--anatomy-mid);stroke-width:.7px;vector-effect:non-scaling-stroke;stroke-linejoin:round;stroke-linecap:round}
.cm-btn{cursor:pointer}
.cm-btn[data-on] .cm-icon{stroke:var(--anatomy-lit)}
.cm-cup-tint{fill:var(--anatomy-paper);opacity:.55}
.cm-cup-front{fill:var(--anatomy-lit);opacity:.035}
.cm-rim{fill:var(--anatomy-top)}
.cm-coffee{fill:#2c180b;opacity:.92}
.cm-surface{fill:#4a2a14}
.cm-crema{fill:#b98552}
.cm-float{fill:var(--anatomy-hi)}
.cm-water{fill:var(--anatomy-mid);opacity:.35}
[data-theme="light"] .cm-water{opacity:.28}
[data-theme="light"] .cm-coffee{fill:#4a2a14}
[data-theme="light"] .cm-surface{fill:#6b4226}
[data-theme="light"] .cm-crema{fill:#c89863}
[data-theme="light"] .cm-cup-front{fill:#000;opacity:.025}
.cm-svgstream{fill:none;stroke:#7a4a26;stroke-width:1.6px;vector-effect:non-scaling-stroke;stroke-linecap:round}
.cm-svgstream-w{stroke:var(--anatomy-mid);stroke-width:2.4px;opacity:.6}
.cm-stage[data-gl] .cm-fallback{display:none}
.cm-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
</style>`;

const body =
  css +
  k.plateHtml({
    fig: "Fig 1",
    title: "Espresso machine",
    hint: "Press a button · keys 1, 2",
    readout: "ready · 93 °C",
    keys: [
      { mark: "lit", label: "The display: it wakes and glows when a button is pressed" },
      { mark: "raised", label: "Two buttons, espresso and americano, with their rings" },
      { mark: "edge", label: "The gauge needle: pump pressure in bar" },
    ],
    caption:
      "A compact espresso machine sized like a Breville Bambino (197 × 324 × 318 mm, 54 mm portafilter). Espresso: the heater reaches 93 °C in 3 s, the pump pre-infuses 18 g of coffee at 3 bar, climbs to 9 bar, and the shot runs until 36 g is in the cup, about 30 s after the press. Americano: the same shot, then 144 ml of hot water from the nozzle beside the group (1:4). The puck keeps about 18 g of water, and the tank window drops by everything the machine drew. Played at 3× speed.",
    body: `<div class="cm-stage" tabindex="0" role="group" aria-label="Espresso machine. Press 1 for espresso or 2 for americano.">${svg}<canvas class="cm-gl" aria-hidden="true"></canvas><span class="cm-sr" role="status" aria-live="polite" data-status></span></div>`,
  });

const name = theme === "light" ? "coffee-machine-light.html" : "coffee-machine.html";
writeFileSync(join(HERE, name), k.pageHtml({ title: "Espresso machine", theme, body, script: kitScript() + glScript() + model + live }));
console.log("wrote", name);
