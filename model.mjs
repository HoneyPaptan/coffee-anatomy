export const DOSE = 18;
export const SHOT = 36;
export const WATER = 144;
export const PUCK_HOLD = 18;
export const TANK = 1400;
export const READY_C = 93;
export const TIMELAPSE = 3;

const HEAT = 3;
const PRE_END = 8;
const RAMP_END = 10;
const FIRST_DROP = 9;
const FLOW_RAMP = 2.5;
const SHOT_RATE = SHOT / 19.5;
const HOT_GAP = 1.5;
const HOT_RATE = 4;
const RELEASE = 0.6;

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const ease = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

function flowArea(t) {
  const ramp = FLOW_RAMP / 2;
  if (t <= FIRST_DROP) return 0;
  if (t < FIRST_DROP + FLOW_RAMP) {
    const u = (t - FIRST_DROP) / FLOW_RAMP;
    return SHOT_RATE * FLOW_RAMP * (u * u * u - 0.5 * u * u * u * u);
  }
  return SHOT_RATE * (t - FIRST_DROP - ramp);
}

export const SHOT_END = (() => {
  let t = FIRST_DROP;
  while (flowArea(t) < SHOT) t += 0.001;
  return t;
})();
const HOT_START = SHOT_END + HOT_GAP;
const HOT_END = HOT_START + WATER / HOT_RATE;

export const RECIPES = {
  espresso: { name: "espresso", label: "ESPRESSO", end: SHOT_END + 1.2, hot: 0 },
  americano: { name: "americano", label: "AMERICANO", end: HOT_END + 1.2, hot: WATER },
};

/** Machine state t seconds after a button press, from published espresso numbers: 18 g in, 36 g out, 9 bar, 93 °C. */
export function stateAt(recipe, t) {
  const r = RECIPES[recipe];
  const hot = r.hot > 0;
  const temp = 60 + (READY_C - 60) * ease(0, HEAT, t);
  let pressure = 0;
  if (t > HEAT && t <= SHOT_END) pressure = 3 * ease(HEAT, HEAT + 1.5, t) + 6 * ease(PRE_END, RAMP_END, t);
  else if (t > SHOT_END) pressure = 9 * Math.exp(-(t - SHOT_END) / RELEASE);
  if (hot && t > HOT_START && t < HOT_END + 0.4) pressure = Math.max(pressure, 1.5 * ease(HOT_START, HOT_START + 0.6, t) * (1 - ease(HOT_END, HOT_END + 0.4, t)));
  const coffee = Math.min(SHOT, flowArea(Math.min(t, SHOT_END)));
  const coffeeFlow = t > FIRST_DROP && t < SHOT_END ? SHOT_RATE * ease(FIRST_DROP, FIRST_DROP + FLOW_RAMP, t) : 0;
  const water = hot ? HOT_RATE * Math.min(Math.max(0, t - HOT_START), WATER / HOT_RATE) : 0;
  const waterFlow = hot && t > HOT_START && t < HOT_END ? HOT_RATE : 0;
  let phase = "heating";
  if (t >= HEAT) phase = "pre-infusion";
  if (t >= PRE_END) phase = "extraction";
  if (t >= SHOT_END) phase = hot ? "hot water" : "done";
  if (hot && t >= HOT_END) phase = "done";
  if (t >= r.end) phase = "ready";
  const used = t > HEAT ? coffee + Math.min(PUCK_HOLD, PUCK_HOLD * ease(HEAT, FIRST_DROP, t)) + water : 0;
  return { phase, temp, pressure, coffee, coffeeFlow, water, waterFlow, used, done: t >= r.end };
}
