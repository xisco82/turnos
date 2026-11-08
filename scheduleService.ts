// ─────────────────────────────────────────────────────────────────────────────
//  MOTOR DE GENERACIÓN AUTOMÁTICA DE TURNOS
//
//  1. Las semanas se generan en cadena desde la fecha de inicio de rotación:
//     las rotaciones (noches, fin de semana libre, tardes) recuerdan quién hizo
//     qué, y las normas entre semanas (descanso, salida de noche) se cumplen
//     también de domingo a lunes.
//  2. Antes de resolver se fijan: cambios manuales, peticiones/bajas, turnos
//     fijos, libres fijos, noches del conserje, noches rotativas y el fin de
//     semana libre rotativo.
//  3. Para cada empleado se calculan todas sus semanas posibles que cumplen sus
//     normas personales (5+2, libres seguidos, descanso, salida de noche).
//  4. Una búsqueda con vuelta atrás elige una semana para cada empleado que
//     cumpla la cobertura de cada día con el reparto más justo. Si es imposible,
//     una búsqueda local deja el mínimo de incumplimientos y se informa de cada uno.
// ─────────────────────────────────────────────────────────────────────────────
import {
  AppConfig, DayOfWeek, EmployeeConfig, NightPlusResult, RoleKind, ScheduleIssue, ScheduleRow,
  Shift, WeekResult,
} from './types';
import { ABSENCE_SHIFTS, DAYS_OF_WEEK, EffectiveRules, effectiveRules, morningTeam, toISODate } from './constants';

// ───────────────────────── fechas ─────────────────────────

const parseISO = (iso: string): Date => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

export const addDaysISO = (iso: string, n: number): string => {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return toISODate(d);
};

export const mondayOfISO = (iso: string): string => {
  const d = parseISO(iso);
  const day = d.getDay();
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
  return toISODate(d);
};

export const isDateInRange = (dateStr: string, startDate: string, endDate: string): boolean =>
  dateStr >= startDate && dateStr <= endDate;

export const getDateForDay = (weekStart: string | Date, day: DayOfWeek): string => {
  const iso = typeof weekStart === 'string' ? weekStart : toISODate(weekStart);
  return addDaysISO(iso, DAYS_OF_WEEK.indexOf(day));
};

const weeksBetween = (fromISO: string, toISO: string) =>
  Math.round((parseISO(toISO).getTime() - parseISO(fromISO).getTime()) / (7 * 86400000));

// ───────────────────────── códigos internos ─────────────────────────

const C_L = 0, C_M = 1, C_T = 2, C_N = 3, C_S = 4, C_ABS = 5, C_CUSTOM = 6;
const CODE_TO_STR = ['L', 'M', 'T', 'N', 'S'];
const isWorkCode = (c: number) => c === C_M || c === C_T || c === C_N || c === C_S || c === C_CUSTOM;
const isOffLike = (c: number) => c === C_L || c === C_ABS;

const strToCode = (s: Shift | null | undefined): number => {
  if (!s) return C_L;
  const i = CODE_TO_STR.indexOf(s);
  if (i >= 0) return i;
  if (ABSENCE_SHIFTS.includes(s)) return C_ABS;
  return C_CUSTOM;
};

// ───────────────────────── horas y descanso ─────────────────────────

type Hours = { s: number; e: number };

const hourOf = (h: string): number => {
  const [hh, mm] = (h || '0').split(':').map(Number);
  return (hh || 0) + (mm || 0) / 60;
};

/** Un turno que empieza antes de las 06:00 es la noche que empieza al terminar ese día. */
const normalizeHours = (start: number, end: number): Hours => {
  let s = start, e = end;
  if (e <= s) e += 24;
  if (s < 6) { s += 24; e += 24; }
  return { s, e };
};

const parseCustomHours = (s: string): Hours | null => {
  const m = /^(\d{1,2})(?::(\d{2}))?\s*-\s*(\d{1,2})(?::(\d{2}))?$/.exec((s || '').trim());
  if (!m) return null;
  return normalizeHours(Number(m[1]) + Number(m[2] || 0) / 60, Number(m[3]) + Number(m[4] || 0) / 60);
};

// ───────────────────────── estado entre semanas ─────────────────────────

interface Hist { work: number; T: number; S: number; weekends: number; nights: number }

interface ChainState {
  weekendQueue: string[];
  nightQueue: string[];
  nightBlock: { empId: string; len: number } | null;
  prevWeek: Record<string, Shift[]>;
  hist: Record<string, Hist>;
}

const initialState = (): ChainState => ({ weekendQueue: [], nightQueue: [], nightBlock: null, prevWeek: {}, hist: {} });
const emptyHist = (): Hist => ({ work: 0, T: 0, S: 0, weekends: 0, nights: 0 });

// ───────────────────────── contexto de empleado ─────────────────────────

interface EmpCtx {
  emp: EmployeeConfig;
  kind: RoleKind;
  roleName: string;
  fixedStr: (Shift | null)[];
  dom: number[][];
  prevCodes: number[]; // [día -2, día -1] de la semana anterior
  prevLastHours: Hours | null;
  tMin: number;
  tMax: number;
  targetWork: number;
  postNight: 'Afternoon' | 'Off' | null;
  restOn: boolean;
  restHours: number;
  consecutive: boolean;
  forcedWeekendOff: boolean;
  expT: number;
  expS: number;
  relaxNotes: string[];
}

interface Pattern { cells: Int8Array; cost: number }

interface SolveParams { hoursByCode: (Hours | null)[] }

const hoursFor = (ctx: EmpCtx, d: number, code: number, p: SolveParams) =>
  code === C_CUSTOM ? (ctx.fixedStr[d] ? parseCustomHours(ctx.fixedStr[d]!) : null) : p.hoursByCode[code] || null;

// ───────────────────── semanas posibles de un empleado ─────────────────────

const PATTERN_CAP = 6000;

function enumeratePatterns(ctx: EmpCtx, p: SolveParams): Pattern[] {
  const out: Pattern[] = [];
  const seq = new Int8Array(7);
  const futureWorkable = new Array(8).fill(0);
  for (let d = 6; d >= 0; d--) futureWorkable[d] = futureWorkable[d + 1] + (ctx.dom[d].some(isWorkCode) ? 1 : 0);

  const cellAt = (i: number): number => (i >= 0 ? seq[i] : ctx.prevCodes[2 + i]);
  const isFixed = (i: number) => i >= 0 && ctx.fixedStr[i] !== null;

  const stepOk = (d: number): boolean => {
    const cur = seq[d];
    const prev = cellAt(d - 1);
    // Salida de noche
    if (ctx.postNight && prev === C_N && cur !== C_N && !isFixed(d)) {
      if (ctx.postNight === 'Afternoon' && cur !== C_T) return false;
      if (ctx.postNight === 'Off' && !isOffLike(cur)) return false;
    }
    if (ctx.postNight === 'Off' && cellAt(d - 2) === C_N && prev !== C_N && isOffLike(prev) && !isFixed(d) && !isOffLike(cur)) return false;
    // Descanso mínimo entre turnos
    if (ctx.restOn && isWorkCode(cur) && isWorkCode(prev)) {
      const ph = d === 0 ? ctx.prevLastHours : hoursFor(ctx, d - 1, prev, p);
      const ch = hoursFor(ctx, d, cur, p);
      if (ph && ch) {
        const exempt = ctx.postNight === 'Afternoon' && prev === C_N && cur === C_T;
        const bothFixed = isFixed(d) && (d === 0 || isFixed(d - 1));
        if (24 + ch.s - ph.e < ctx.restHours && !exempt && !bothFixed) return false;
      }
    }
    return true;
  };

  const finalOk = (): boolean => {
    if (!ctx.consecutive) return true;
    const runs: { start: number; end: number; hasL: boolean }[] = [];
    for (let d = 0; d < 7; d++) {
      if (!isOffLike(seq[d])) continue;
      const last = runs[runs.length - 1];
      if (last && last.end === d - 1) { last.end = d; last.hasL = last.hasL || seq[d] === C_L; }
      else runs.push({ start: d, end: d, hasL: seq[d] === C_L });
    }
    const lRuns = runs.filter(r => r.hasL);
    if (lRuns.length <= 1) return true;
    // Libres que enlazan con el domingo anterior (lunes) y con el lunes siguiente (domingo).
    return lRuns.length === 2 && lRuns[0].start === 0 && isOffLike(ctx.prevCodes[1]) && lRuns[1].end === 6;
  };

  const costOf = (): number => {
    let cost = 0, t = 0, s = 0, work = 0, last = -1;
    for (let d = 0; d < 7; d++) {
      const c = seq[d];
      if (isWorkCode(c)) work++;
      if (c === C_T) t++;
      if (c === C_S) s++;
      if (ctx.emp.preferredShift !== 'none' && (c === C_M || c === C_T) && ctx.fixedStr[d] === null
        && CODE_TO_STR[c] !== ctx.emp.preferredShift) cost += 3;
      if (c === C_M || c === C_T || c === C_S) {
        if (last >= 0 && last !== c) cost += 2;
        last = c;
      } else last = -1;
    }
    cost += 2 * (t - ctx.expT) ** 2 + 2 * (s - ctx.expS) ** 2;
    if (ctx.tMin !== ctx.tMax) cost += 10 * Math.abs(work - ctx.targetWork);
    if (ctx.emp.weekendRotation && !ctx.forcedWeekendOff && isOffLike(seq[5]) && isOffLike(seq[6])
      && ctx.fixedStr[5] === null && ctx.fixedStr[6] === null) cost += 25;
    return Math.round(cost * 10) / 10;
  };

  const dfs = (d: number, work: number) => {
    if (out.length >= PATTERN_CAP) return;
    if (d === 7) {
      if (work >= ctx.tMin && finalOk()) out.push({ cells: seq.slice(), cost: costOf() });
      return;
    }
    for (const v of ctx.dom[d]) {
      const w = work + (isWorkCode(v) ? 1 : 0);
      if (w > ctx.tMax || w + futureWorkable[d + 1] < ctx.tMin) continue;
      seq[d] = v;
      if (stepOk(d)) dfs(d + 1, w);
    }
  };
  dfs(0, 0);
  out.sort((a, b) => a.cost - b.cost);
  return out;
}

/** Relaja normas personales sólo si sus turnos fijos/peticiones las hacen imposibles. */
function patternsWithRelax(ctx: EmpCtx, p: SolveParams): Pattern[] {
  let pats = enumeratePatterns(ctx, p);
  if (pats.length) return pats;
  const steps: [string, () => void][] = [
    ['libres seguidos', () => { ctx.consecutive = false; }],
    ['salida de noche', () => { ctx.postNight = null; }],
    ['descanso mínimo', () => { ctx.restOn = false; }],
    ['días trabajados por semana', () => { ctx.tMin = 0; ctx.tMax = 7; }],
  ];
  for (const [label, apply] of steps) {
    apply();
    ctx.relaxNotes.push(label);
    pats = enumeratePatterns(ctx, p);
    if (pats.length) return pats;
  }
  return pats;
}

// ───────────────────── cobertura diaria ─────────────────────

interface DayLimits {
  minM: number; maxM: number; minT: number; maxT: number;
  minS: number; maxS: number; minN: number; maxN: number;
  helpersMax: number; recepRequired: boolean;
}

function buildLimits(config: AppConfig): DayLimits[] {
  const r = config.rules;
  return DAYS_OF_WEEK.map(day => {
    const c = config.coverage[day];
    return {
      minM: c.M.min, maxM: Math.max(c.M.min, c.M.max),
      minT: c.T.min, maxT: Math.max(c.T.min, c.T.max),
      minS: c.S.enabled ? c.S.min : 0, maxS: c.S.enabled ? Math.max(c.S.min, c.S.max) : 0,
      minN: r.nightRotation.enabled ? 0 : c.N,
      maxN: r.nightRotation.enabled ? 99 : c.N,
      helpersMax: r.noTwoHelpersAfternoon ? 1 : 99,
      recepRequired: r.receptionistRequiredAfternoon && c.T.min > 0,
    };
  });
}

// ───────────────────────── búsqueda exacta ─────────────────────────

/** Nodos para encontrar una solución válida / para mejorar una ya encontrada. */
const FIND_BUDGET = 40000;
const IMPROVE_BUDGET = 15000;
/** Tiempo máximo buscando una solución perfecta antes de dar el mejor cuadrante posible. */
const SEARCH_TIME_MS = 600;

function solve(ctxs: EmpCtx[], pats: Pattern[][], limits: DayLimits[]): { choice: number[]; exact: boolean } {
  const n = ctxs.length;
  // La búsqueda local da primero una buena solución; la búsqueda exacta intenta encontrar/mejorar.
  const ls = localSearch(ctxs, pats, limits);
  let best = ls.violations === 0 ? ls.cost + 0.001 : Infinity;
  let bestChoice: number[] | null = ls.violations === 0 ? ls.choice : null;

  // Varios órdenes de prueba: si uno se atasca, otro suele encontrar la solución enseguida.
  const bySize = [...Array(n).keys()].sort((a, b) => pats[a].length - pats[b].length);
  const kindRank = (i: number) => (ctxs[i].kind === 'ayudante' ? 0 : ctxs[i].kind === 'recepcion' ? 1 : 2);
  const byKind = [...bySize].sort((a, b) => kindRank(a) - kindRank(b));
  let seed = 987;
  const shuffled = () => {
    const o = [...bySize];
    for (let i = o.length - 1; i > 0; i--) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; const j = seed % (i + 1); [o[i], o[j]] = [o[j], o[i]]; }
    return o;
  };
  const orders = [bySize, byKind, [...bySize].reverse()];
  const deadline = Date.now() + SEARCH_TIME_MS;
  for (let attempt = 0; ; attempt++) {
    const order = attempt < orders.length ? orders[attempt] : shuffled();
    const found = runBranchAndBound(ctxs, pats, limits, order, best);
    if (found) { best = found.cost; bestChoice = found.choice; break; }
    if (bestChoice || (attempt >= orders.length && Date.now() > deadline)) break;
  }
  if (bestChoice) return { choice: bestChoice, exact: true };
  return { choice: ls.choice, exact: false };
}

function runBranchAndBound(ctxs: EmpCtx[], pats: Pattern[][], limits: DayLimits[], order: number[], initialBest: number)
  : { choice: number[]; cost: number } | null {
  const n = ctxs.length;
  const kinds = order.map(i => ctxs[i].kind);
  const can = order.map(i => {
    const m = Array.from({ length: 7 }, () => new Int8Array(5));
    for (const pt of pats[i]) for (let d = 0; d < 7; d++) { const c = pt.cells[d]; if (c >= 1 && c <= 4) m[d][c] = 1; }
    return m;
  });
  const capN = new Int16Array(7), capRT = new Int16Array(7);
  // capU[d*8+q]: cuántas personas pendientes pueden cubrir algún turno del grupo q (bits M=1, T=2, S=4)
  const capU = new Int16Array(56);
  const masks = can.map(m => m.map(x => (x[C_M] ? 1 : 0) | (x[C_T] ? 2 : 0) | (x[C_S] ? 4 : 0)));
  const addCap = (k: number, sign: number) => {
    for (let d = 0; d < 7; d++) {
      const mk = masks[k][d];
      if (mk) for (let q = 1; q < 8; q++) if (mk & q) capU[d * 8 + q] += sign;
      capN[d] += sign * can[k][d][C_N];
      if (kinds[k] === 'recepcion') capRT[d] += sign * can[k][d][C_T];
    }
  };
  for (let k = 0; k < n; k++) addCap(k, 1);

  const cM = new Int16Array(7), cT = new Int16Array(7), cN = new Int16Array(7), cS = new Int16Array(7), cH = new Int16Array(7), cR = new Int16Array(7);
  const apply = (k: number, pt: Pattern, sign: number) => {
    for (let d = 0; d < 7; d++) {
      const c = pt.cells[d];
      if (c === C_M) cM[d] += sign; else if (c === C_N) cN[d] += sign; else if (c === C_S) cS[d] += sign;
      else if (c === C_T) { cT[d] += sign; if (kinds[k] === 'ayudante') cH[d] += sign; if (kinds[k] === 'recepcion') cR[d] += sign; }
    }
  };
  const feasible = (): boolean => {
    for (let d = 0; d < 7; d++) {
      const L = limits[d];
      if (cM[d] > L.maxM || cT[d] > L.maxT || cS[d] > L.maxS || cN[d] > L.maxN || cH[d] > L.helpersMax) return false;
      if (cN[d] + capN[d] < L.minN) return false;
      if (L.recepRequired && cR[d] + capRT[d] < 1) return false;
      // Cada persona sólo cubre un turno al día: lo que falta de cada grupo de turnos
      // no puede superar a las personas que todavía pueden cubrirlo.
      const nm = L.minM - cM[d], nt = L.minT - cT[d], ns = L.minS - cS[d];
      const needM = nm > 0 ? nm : 0, needT = nt > 0 ? nt : 0, needS = ns > 0 ? ns : 0;
      const b = d * 8;
      if (needM > capU[b + 1] || needT > capU[b + 2] || needS > capU[b + 4]
        || needM + needT > capU[b + 3] || needM + needS > capU[b + 5] || needT + needS > capU[b + 6]
        || needM + needT + needS > capU[b + 7]) return false;
    }
    return true;
  };

  const suffixMin = new Array(n + 1).fill(0);
  for (let k = n - 1; k >= 0; k--) suffixMin[k] = suffixMin[k + 1] + (pats[order[k]][0]?.cost ?? 0);

  let best = initialBest;
  let bestChoice: number[] | null = null;
  const cur = new Array(n).fill(0);
  let nodes = 0;
  const overBudget = () => nodes > (bestChoice || initialBest < Infinity ? IMPROVE_BUDGET : FIND_BUDGET);

  const dfs = (k: number, cost: number) => {
    if (k === n) { if (cost < best) { best = cost; bestChoice = [...cur]; nodes = 0; } return; }
    const i = order[k];
    addCap(k, -1);
    for (let j = 0; j < pats[i].length; j++) {
      const pt = pats[i][j];
      if (cost + pt.cost + suffixMin[k + 1] >= best) break;
      nodes++;
      if (overBudget()) break;
      apply(k, pt, 1);
      if (feasible()) { cur[i] = j; dfs(k + 1, cost + pt.cost); }
      apply(k, pt, -1);
    }
    addCap(k, 1);
  };
  if (feasible()) dfs(0, 0);
  return bestChoice ? { choice: bestChoice, cost: best } : null;
}

/** Sin solución perfecta: cuadrante con los mínimos incumplimientos posibles. */
function localSearch(ctxs: EmpCtx[], pats: Pattern[][], limits: DayLimits[]): { choice: number[]; violations: number; cost: number } {
  const n = ctxs.length;
  const kinds = ctxs.map(c => c.kind);
  let seed = 12345;
  const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

  const dayViolation = (cnt: number[], L: DayLimits) => {
    const [m, t, nn, s, h, r] = cnt;
    // Si falta gente, mejor que falte de mañana que de tarde o de noche.
    let v = Math.max(0, L.minM - m) + Math.max(0, m - L.maxM) + Math.max(0, L.minT - t) * 3 + Math.max(0, t - L.maxT)
      + Math.max(0, L.minS - s) + Math.max(0, s - L.maxS) + Math.max(0, L.minN - nn) * 3 + Math.max(0, nn - L.maxN)
      + Math.max(0, h - L.helpersMax) * 3;
    if (L.recepRequired && r === 0) v += 3;
    return v;
  };
  const contrib = (k: number, pt: Pattern, d: number, cnt: number[], sign: number) => {
    const c = pt.cells[d];
    if (c === C_M) cnt[0] += sign; else if (c === C_N) cnt[2] += sign; else if (c === C_S) cnt[3] += sign;
    else if (c === C_T) { cnt[1] += sign; if (kinds[k] === 'ayudante') cnt[4] += sign; if (kinds[k] === 'recepcion') cnt[5] += sign; }
  };

  let bestChoice = new Array(n).fill(0);
  let bestScore = Infinity, bestV = Infinity, bestC = 0;
  for (let restart = 0; restart < 10 && bestV > 0; restart++) {
    const choice = pats.map(p => (restart === 0 ? 0 : Math.floor(rand() * Math.min(p.length, 25))));
    const counts = Array.from({ length: 7 }, () => [0, 0, 0, 0, 0, 0]);
    for (let k = 0; k < n; k++) for (let d = 0; d < 7; d++) contrib(k, pats[k][choice[k]], d, counts[d], 1);
    let lastMoved = -1, idle = 0;
    for (let iter = 0; iter < 60 * n && idle < 2 * n; iter++) {
      let k = Math.floor(rand() * n);
      if (k === lastMoved) k = (k + 1) % n;
      idle++;
      const curPt = pats[k][choice[k]];
      let bestJ = choice[k], bestDelta = 0;
      for (let j = 0; j < pats[k].length; j++) {
        if (j === choice[k]) continue;
        const pt = pats[k][j];
        let delta = pt.cost - curPt.cost;
        for (let d = 0; d < 7; d++) {
          if (pt.cells[d] === curPt.cells[d]) continue;
          const before = dayViolation(counts[d], limits[d]);
          contrib(k, curPt, d, counts[d], -1); contrib(k, pt, d, counts[d], 1);
          const after = dayViolation(counts[d], limits[d]);
          contrib(k, pt, d, counts[d], -1); contrib(k, curPt, d, counts[d], 1);
          delta += (after - before) * 1000;
        }
        if (delta < bestDelta || (delta === bestDelta && delta <= 0 && rand() < 0.05)) { bestDelta = delta; bestJ = j; }
      }
      if (bestDelta < 0) idle = 0;
      if (bestJ !== choice[k]) {
        for (let d = 0; d < 7; d++) { contrib(k, curPt, d, counts[d], -1); contrib(k, pats[k][bestJ], d, counts[d], 1); }
        choice[k] = bestJ;
        lastMoved = k;
      }
    }
    let v = 0, c = 0;
    for (let d = 0; d < 7; d++) v += dayViolation(counts[d], limits[d]);
    for (let k = 0; k < n; k++) c += pats[k][choice[k]].cost;
    if (v * 1000 + c < bestScore) { bestScore = v * 1000 + c; bestChoice = [...choice]; bestV = v; bestC = c; }
  }
  return { choice: bestChoice, violations: bestV, cost: bestC };
}

// ───────────────────────── una semana ─────────────────────────

const roleOf = (config: AppConfig, emp: EmployeeConfig) =>
  config.roles.find(r => r.id === emp.roleId) || { id: '', name: 'Sin rol', kind: 'otro' as RoleKind };

const syncQueue = (queue: string[], eligible: string[]): string[] => {
  const kept = queue.filter(id => eligible.includes(id));
  eligible.forEach(id => { if (!kept.includes(id)) kept.push(id); });
  return kept;
};

function solveWeek(config: AppConfig, weekStart: string, state: ChainState): { result: WeekResult; next: ChainState } {
  const rules = config.rules;
  const employees = config.employees.filter(e => e.active && e.name.trim() !== '');
  const overrides = config.overridesByWeek?.[weekStart] || {};
  const eff: Record<string, EffectiveRules> = {};
  employees.forEach(e => { eff[e.id] = effectiveRules(config, e); });
  const offDaysOf = (id: string) => 7 - (eff[id].weeklyOn ? eff[id].workDays : 5);
  const notes: ScheduleIssue[] = [];

  const sh = config.shifts;
  const hoursByCode: (Hours | null)[] = [
    null,
    normalizeHours(hourOf(sh.M.start), hourOf(sh.M.end)),
    normalizeHours(hourOf(sh.T.start), hourOf(sh.T.end)),
    normalizeHours(hourOf(sh.N.start), hourOf(sh.N.end)),
    normalizeHours(hourOf(sh.S.start), hourOf(sh.S.end)),
  ];
  const params: SolveParams = { hoursByCode };

  // 1. Celdas fijas: cambio manual > petición/baja > turno fijo > libre fijo
  const fixed: Record<string, (Shift | null)[]> = {};
  employees.forEach(emp => {
    fixed[emp.id] = DAYS_OF_WEEK.map((day, d) => {
      const ov = overrides[`${emp.id}|${day}`];
      if (ov) return ov;
      const date = addDaysISO(weekStart, d);
      const req = config.requests?.find(r => r.employeeId === emp.id && r.status !== 'rejected' && isDateInRange(date, r.startDate, r.endDate));
      if (req) return req.type === 'Baja' ? 'BP' : req.type === 'Vacaciones' ? 'V' : req.type === 'Festivo' ? 'F' : 'P';
      const fs = emp.fixedShifts?.[day];
      if (fs) return fs;
      if (emp.fixedOffDays?.includes(day)) return 'L';
      return null;
    });
  });
  const isFree = (id: string, d: number) => fixed[id][d] === null;
  const morningOnly = (id: string, d: number) => !!employees.find(e => e.id === id)?.morningOnlyDays?.includes(DAYS_OF_WEEK[d]);
  const freeForNight = (id: string, d: number) => isFree(id, d) && !morningOnly(id, d);
  const absCount = (id: string) => fixed[id].filter(s => s !== null && ABSENCE_SHIFTS.includes(s)).length;
  const targetWorkOf = (id: string) => {
    const abs = absCount(id);
    const offDays = offDaysOf(id);
    return eff[id].absencesAsOff ? Math.max(0, 7 - abs - Math.max(0, offDays - abs)) : Math.max(0, 7 - abs - offDays);
  };

  // 2. Conserje(s) de noche fijo(s)
  employees.filter(e => e.permanentNight).forEach(emp => {
    const f = fixed[emp.id];
    let offs = f.filter(s => s === 'L' || (s !== null && ABSENCE_SHIFTS.includes(s) && eff[emp.id].absencesAsOff)).length;
    const need = eff[emp.id].weeklyOn ? offDaysOf(emp.id) : 0;
    for (let d = 0; d < 7 && offs < need; d++) {
      if (f[d] === null && (d === 6 || f[d + 1] === null || f[d + 1] === 'L')) { f[d] = 'L'; offs++; }
    }
    for (let d = 0; d < 7; d++) if (f[d] === null) f[d] = 'N';
  });

  // 3. Noches rotativas (cubren las noches que no cubre nadie fijo)
  const nightRotationIds: string[] = [];
  let nightQueue = syncQueue(state.nightQueue, employees.filter(e => e.nightRotation && e.canNight && !e.permanentNight).map(e => e.id));
  let block: { empId: string; len: number; lastDay: number } | null =
    state.nightBlock && employees.some(e => e.id === state.nightBlock!.empId) ? { ...state.nightBlock, lastDay: -1 } : null;
  const uncoveredNights: string[] = [];
  const nightNeed = DAYS_OF_WEEK.map((day, d) => config.coverage[day].N - employees.filter(e => fixed[e.id][d] === 'N').length);

  if (rules.nightRotation.enabled) {
    const maxLen = Math.max(1, rules.nightRotation.nightsPerBlock);
    for (let d = 0; d < 7; d++) {
      let need = nightNeed[d];
      if (need <= 0) { block = null; continue; }
      while (need > 0) {
        let chosen: string | null = null;
        if (block && block.lastDay === d - 1 && block.len < maxLen && freeForNight(block.empId, d)) {
          chosen = block.empId;
          block.len++;
        } else {
          let runLen = 0;
          for (let k = d; k < 7 && nightNeed[k] > 0 && runLen < maxLen; k++) runLen++;
          const avail = nightQueue.filter(id => freeForNight(id, d) && !nightRotationIds.includes(id));
          const fully = avail.find(id => { for (let k = d; k < d + runLen; k++) if (!freeForNight(id, k)) return false; return true; });
          chosen = fully || avail[0] || null;
          if (chosen) {
            block = { empId: chosen, len: 1, lastDay: d };
            const c = chosen;
            nightQueue = [...nightQueue.filter(id => id !== c), c];
          }
        }
        if (!chosen) { uncoveredNights.push(DAYS_OF_WEEK[d]); break; }
        fixed[chosen][d] = 'N';
        if (!nightRotationIds.includes(chosen)) nightRotationIds.push(chosen);
        block!.lastDay = d;
        need--;
      }
    }
  }
  const nextBlock = block && block.lastDay === 6 ? { empId: block.empId, len: block.len } : null;

  // 4. Contextos
  const totalT = DAYS_OF_WEEK.reduce((a, day) => a + config.coverage[day].T.min, 0);
  const totalS = DAYS_OF_WEEK.reduce((a, day) => a + (config.coverage[day].S.enabled ? config.coverage[day].S.min : 0), 0);
  const sumWork = (list: EmployeeConfig[]) => list.reduce((a, e) => a + targetWorkOf(e.id), 0) || 1;
  const tShare = (e: EmployeeConfig) => (7 - (e.morningOnlyDays?.length || 0)) / 7;
  const tCapable = employees.filter(e => e.canAfternoon && !e.permanentNight && tShare(e) > 0);
  const ratioT = totalT / (tCapable.reduce((a, e) => a + targetWorkOf(e.id) * tShare(e), 0) || 1);
  const ratioS = totalS / sumWork(employees.filter(e => e.canSpecial && !e.permanentNight));

  const buildCtx = (emp: EmployeeConfig, forcedWeekendOff: boolean): EmpCtx => {
    const role = roleOf(config, emp);
    const f = fixed[emp.id];
    const prev = state.prevWeek[emp.id] || [];
    const prevLast = prev[6] ?? null;
    const prevLastCode = strToCode(prevLast);
    const dom = DAYS_OF_WEEK.map((day, d) => {
      if (f[d] !== null) return [strToCode(f[d])];
      if (emp.permanentNight) return [C_N, C_L];
      // Día marcado como «solo de mañana»: si trabaja, de mañana.
      if (emp.morningOnlyDays?.includes(day)) return [C_M, C_L];
      const c = config.coverage[day];
      const opts: number[] = [];
      if (emp.canMorning) opts.push(C_M);
      if (emp.canAfternoon) opts.push(C_T);
      if (emp.canSpecial && c.S.enabled && c.S.max > 0) opts.push(C_S);
      if (emp.canNight && !rules.nightRotation.enabled) opts.push(C_N);
      opts.push(C_L);
      return opts;
    });
    const target = targetWorkOf(emp.id);
    const h = state.hist[emp.id] || emptyHist();
    const er = eff[emp.id];
    const fair = er.fair ? 0.5 : 0;
    const expT = emp.canAfternoon && !emp.permanentNight && tShare(emp) > 0
      ? Math.max(0, Math.min(target, ratioT * target * tShare(emp) + fair * (ratioT * h.work * tShare(emp) - h.T))) : 0;
    const expS = emp.canSpecial && !emp.permanentNight ? Math.max(0, Math.min(target, ratioS * target + fair * (ratioS * h.work - h.S))) : 0;
    const fixedLs = f.map((s, d) => (s === 'L' ? d : -1)).filter(d => d >= 0);
    const fixedLsContiguous = fixedLs.every((d, i) => i === 0 || d === fixedLs[i - 1] + 1);
    return {
      emp, kind: role.kind, roleName: role.name, fixedStr: f, dom,
      prevCodes: [strToCode(prev[5] ?? null), prevLastCode],
      prevLastHours: prevLastCode === C_CUSTOM ? parseCustomHours(prevLast!) : (isWorkCode(prevLastCode) ? hoursByCode[prevLastCode] : null),
      tMin: er.weeklyOn ? target : 0,
      tMax: er.weeklyOn ? target : 7 - absCount(emp.id),
      targetWork: target,
      postNight: er.postNight,
      restOn: er.restOn,
      restHours: er.restHours,
      consecutive: er.consecutive && fixedLsContiguous,
      forcedWeekendOff, expT, expS, relaxNotes: [],
    };
  };

  // 5. Fin de semana libre rotativo
  let weekendQueue = syncQueue(state.weekendQueue, employees.filter(e => e.weekendRotation && !e.permanentNight).map(e => e.id));
  let weekendOffId: string | null = null;
  if (rules.weekendRotation) {
    const candidates = [
      ...weekendQueue.filter(id => !nightRotationIds.includes(id)),
      ...weekendQueue.filter(id => nightRotationIds.includes(id)),
    ];
    for (const id of candidates) {
      const f = fixed[id];
      if (!isFree(id, 5) || !isFree(id, 6)) continue;
      f[5] = 'L'; f[6] = 'L';
      const emp = employees.find(e => e.id === id)!;
      if (enumeratePatterns(buildCtx(emp, true), params).length > 0) {
        weekendOffId = id;
        weekendQueue = [...weekendQueue.filter(x => x !== id), id];
        break;
      }
      f[5] = null; f[6] = null;
    }
  }

  // 6. Patrones + búsqueda
  const ctxs = employees.map(emp => buildCtx(emp, emp.id === weekendOffId));
  const pats = ctxs.map(c => patternsWithRelax(c, params));
  ctxs.forEach(c => {
    if (c.relaxNotes.length) notes.push({ level: 'warning', rule: 'Normas personales', message: `${c.emp.name}: no se pudo cumplir «${c.relaxNotes.join(', ')}» por sus turnos fijos, peticiones o cambios manuales.` });
  });
  const { choice, exact } = solve(ctxs, pats, buildLimits(config));

  // 7. Resultado
  const rows: ScheduleRow[] = ctxs.map((c, i) => {
    const pt = pats[i][choice[i]];
    return {
      employeeId: c.emp.id,
      employeeName: c.emp.name,
      role: c.roleName,
      shifts: DAYS_OF_WEEK.map((day, d) => ({
        day,
        shift: c.fixedStr[d] !== null ? c.fixedStr[d]! : (CODE_TO_STR[pt ? pt.cells[d] : C_L] ?? 'L'),
      })),
    };
  });

  // 7b. Turno especial automático: los días con 4 (o las que se configuren) de mañana,
  //     una de esas personas pasa a hacer el especial (10-18). Se reparte por turnos.
  if (rules.autoSpecial.enabled) {
    const weekS: Record<string, number> = {};
    DAYS_OF_WEEK.forEach((day, d) => {
      const morning = rows.filter(r => r.shifts[d].shift === 'M');
      if (morning.length < Math.max(1, rules.autoSpecial.threshold)) return;
      const candidates = morning.filter(r => {
        const c = ctxs.find(x => x.emp.id === r.employeeId)!;
        return c.fixedStr[d] === null && c.emp.canSpecial && !c.emp.morningOnlyDays?.includes(day);
      });
      candidates.sort((a, b) => {
        const wa = weekS[a.employeeId] || 0, wb = weekS[b.employeeId] || 0;
        if (wa !== wb) return wa - wb;
        const ha = (state.hist[a.employeeId]?.S || 0), hb = (state.hist[b.employeeId]?.S || 0);
        if (ha !== hb) return ha - hb;
        const ia = employees.findIndex(e => e.id === a.employeeId), ib = employees.findIndex(e => e.id === b.employeeId);
        return ((ia + d) % employees.length) - ((ib + d) % employees.length);
      });
      const n = Math.min(Math.max(1, rules.autoSpecial.count), morning.length - 1, candidates.length);
      for (let k = 0; k < n; k++) {
        candidates[k].shifts[d].shift = 'S';
        weekS[candidates[k].employeeId] = (weekS[candidates[k].employeeId] || 0) + 1;
      }
      if (candidates.length === 0) {
        notes.push({ level: 'info', rule: 'Especial automático', message: `${day}: nadie de mañana puede hacer el turno especial.` });
      }
    });
  }

  if (!exact) notes.unshift({ level: 'error', rule: 'Generación', message: 'No hay forma de cumplir todas las normas a la vez con el personal disponible esta semana. Se ha generado el cuadrante con el menor número posible de incumplimientos (detalle abajo).' });
  uncoveredNights.forEach(d => notes.push({ level: 'error', rule: 'Noches rotativas', message: `${d}: no hay nadie disponible en la rotación de noches.` }));
  if (rules.weekendRotation && !weekendOffId && weekendQueue.length) {
    notes.push({ level: 'warning', rule: 'Fin de semana libre', message: 'Esta semana nadie de la rotación ha podido librar sábado y domingo (bajas, vacaciones o turnos fijos).' });
  }

  const issues = [...notes, ...validateSchedule(config, rows, ctxs.map(c => ({
    id: c.emp.id, kind: c.kind, targetWork: c.targetWork, postNight: c.postNight, prev: state.prevWeek[c.emp.id] || [],
    weeklyOn: eff[c.emp.id].weeklyOn, restOn: eff[c.emp.id].restOn, restHours: eff[c.emp.id].restHours,
    morningOnlyDays: c.emp.morningOnlyDays || [],
  })), params)];

  // 8. Estado para la semana siguiente
  const hist = { ...state.hist };
  const prevWeek: Record<string, Shift[]> = {};
  rows.forEach(r => {
    const h = { ...(hist[r.employeeId] || emptyHist()) };
    r.shifts.forEach(s => {
      if (isWorkCode(strToCode(s.shift))) h.work++;
      if (s.shift === 'T') h.T++;
      if (s.shift === 'S') h.S++;
      if (s.shift === 'N') h.nights++;
    });
    if (r.employeeId === weekendOffId) h.weekends++;
    hist[r.employeeId] = h;
    prevWeek[r.employeeId] = r.shifts.map(s => s.shift);
  });

  return {
    result: { weekStart, rows, issues, weekendOffEmployeeId: weekendOffId, nightRotationEmployeeIds: nightRotationIds },
    next: { weekendQueue, nightQueue, nightBlock: nextBlock, prevWeek, hist },
  };
}

// ───────────────────────── validación independiente ─────────────────────────

interface ValidationEmp { id: string; kind: RoleKind; targetWork: number; postNight: 'Afternoon' | 'Off' | null; prev: Shift[]; weeklyOn: boolean; restOn: boolean; restHours: number; morningOnlyDays: DayOfWeek[] }

function validateSchedule(config: AppConfig, rows: ScheduleRow[], emps: ValidationEmp[], p: SolveParams): ScheduleIssue[] {
  const issues: ScheduleIssue[] = [];
  const rules = config.rules;
  const kindOf = (id: string) => emps.find(e => e.id === id)?.kind || 'otro';
  const hoursOfStr = (s: string) => (strToCode(s) === C_CUSTOM ? parseCustomHours(s) : p.hoursByCode[strToCode(s)]);

  DAYS_OF_WEEK.forEach((day, d) => {
    const c = config.coverage[day];
    const at = (code: string) => rows.filter(r => r.shifts[d].shift === code);
    const t = at('T').length, s = at('S').length, n = at('N').length;
    const m = morningTeam(config, day, at('M').length, s);
    if (m < c.M.min) issues.push({ level: 'error', rule: 'Cobertura', message: `${day}: faltan ${c.M.min - m} de mañana (${m}/${c.M.min}).` });
    if (m > c.M.max) issues.push({ level: 'warning', rule: 'Cobertura', message: `${day}: sobran ${m - c.M.max} de mañana (${m}, máx. ${c.M.max}).` });
    if (t < c.T.min) issues.push({ level: 'error', rule: 'Cobertura', message: `${day}: faltan ${c.T.min - t} de tarde (${t}/${c.T.min}).` });
    if (t > c.T.max) issues.push({ level: 'warning', rule: 'Cobertura', message: `${day}: sobran ${t - c.T.max} de tarde (${t}, máx. ${c.T.max}).` });
    if (c.S.enabled && s < c.S.min) issues.push({ level: 'error', rule: 'Turno especial', message: `${day}: falta el turno especial (${s}/${c.S.min}).` });
    if (n < c.N) issues.push({ level: 'error', rule: 'Noche', message: `${day}: noche sin cubrir (${n}/${c.N}).` });
    const tRows = at('T');
    const helpers = tRows.filter(r => kindOf(r.employeeId) === 'ayudante').length;
    const receps = tRows.filter(r => kindOf(r.employeeId) === 'recepcion').length;
    if (rules.noTwoHelpersAfternoon && helpers > 1) issues.push({ level: 'error', rule: 'Ayudantes', message: `${day}: hay ${helpers} ayudantes juntos de tarde.` });
    if (rules.receptionistRequiredAfternoon && t > 0 && receps === 0) issues.push({ level: 'error', rule: 'Recepcionista de tarde', message: `${day}: la tarde no tiene ningún recepcionista.` });
  });

  rows.forEach(r => {
    const e = emps.find(x => x.id === r.employeeId);
    if (!e) return;
    const shifts = r.shifts.map(s => s.shift);
    const work = shifts.filter(s => isWorkCode(strToCode(s))).length;
    r.shifts.forEach(s => {
      if (e.morningOnlyDays.includes(s.day) && isWorkCode(strToCode(s.shift)) && s.shift !== 'M') {
        issues.push({ level: 'warning', rule: 'Solo de mañana', message: `${r.employeeName}: el ${s.day} debería trabajar de mañana y tiene «${s.shift}».` });
      }
    });
    if (e.weeklyOn && work !== e.targetWork) {
      issues.push({ level: 'error', rule: 'Días trabajados', message: `${r.employeeName}: trabaja ${work} días (le tocan ${e.targetWork}).` });
    }
    const all: (string | null)[] = [...(e.prev.length ? e.prev.slice(-2) : [null, null]), ...shifts];
    for (let i = 2; i < all.length; i++) {
      const a = all[i - 1], b = all[i]!;
      const day = DAYS_OF_WEEK[i - 2];
      if (e.restOn && a && isWorkCode(strToCode(a)) && isWorkCode(strToCode(b))) {
        const ha = hoursOfStr(a), hb = hoursOfStr(b);
        const exempt = e.postNight === 'Afternoon' && a === 'N' && b === 'T';
        if (ha && hb && !exempt && 24 + hb.s - ha.e < e.restHours) {
          issues.push({ level: 'warning', rule: 'Descanso', message: `${r.employeeName}: el ${day} entra con menos de ${e.restHours} h de descanso.` });
        }
      }
      if (e.postNight && a === 'N' && b !== 'N') {
        if (e.postNight === 'Afternoon' && b !== 'T' && !isOffLike(strToCode(b))) {
          issues.push({ level: 'warning', rule: 'Salida de noche', message: `${r.employeeName}: el ${day} debería entrar de tarde al salir de noche.` });
        }
        if (e.postNight === 'Off' && !isOffLike(strToCode(b))) {
          issues.push({ level: 'warning', rule: 'Salida de noche', message: `${r.employeeName}: el ${day} debería librar al salir de noche.` });
        }
      }
    }
  });
  return issues;
}

// ───────────────────────── API con caché ─────────────────────────

const stepCache = new Map<string, { result: WeekResult; next: ChainState }>();

const weekInputsKey = (config: AppConfig, weekStart: string) => {
  const end = addDaysISO(weekStart, 6);
  const reqs = (config.requests || []).filter(r => r.startDate <= end && r.endDate >= weekStart)
    .map(r => `${r.id}:${r.employeeId}:${r.type}:${r.startDate}:${r.endDate}:${r.status || ''}`);
  return JSON.stringify([config.overridesByWeek?.[weekStart] || {}, reqs]);
};

const coreKey = (config: AppConfig) => JSON.stringify({
  e: config.employees, r: config.roles, s: config.shifts, c: config.coverage, ru: config.rules, a: config.rotationStartDate,
});

/** Cuadrante de la semana que empieza en weekStart (lunes, yyyy-mm-dd). */
export function getWeekSchedule(config: AppConfig, weekStartInput: string | Date): WeekResult {
  const weekStart = mondayOfISO(typeof weekStartInput === 'string' ? weekStartInput : toISODate(weekStartInput));
  if (!config.isConfigured) return { weekStart, rows: [], issues: [], weekendOffEmployeeId: null, nightRotationEmployeeIds: [] };
  if (stepCache.size > 3000) stepCache.clear();

  const anchor = mondayOfISO(config.rotationStartDate || weekStart);
  const core = coreKey(config);
  let start = weekStart < anchor ? weekStart : anchor;
  if (weeksBetween(start, weekStart) > 520) start = addDaysISO(weekStart, -7 * 520);

  let state = initialState();
  let w = start;
  let last: WeekResult | null = null;
  while (w <= weekStart) {
    const key = `${core}|${w}|${weekInputsKey(config, w)}|${JSON.stringify(state)}`;
    let step = stepCache.get(key);
    if (!step) { step = solveWeek(config, w, state); stepCache.set(key, step); }
    last = step.result;
    state = step.next;
    w = addDaysISO(w, 7);
  }
  return last!;
}

/** Versión para empleados: sólo nombres y turnos, nunca roles. */
export function getPublicWeekSchedule(config: AppConfig, weekStart: string) {
  const res = getWeekSchedule(config, weekStart);
  return {
    weekStart: res.weekStart,
    rows: res.rows.map(r => ({ employeeId: r.employeeId, employeeName: r.employeeName, shifts: r.shifts })),
  };
}

// ───────────────────────── plus de nocturnidad ─────────────────────────

/** Horas nocturnas (franja 22:00–06:00) de un turno. Solo cuentan la tarde y la noche:
 *  T (16:00–00:00) = 2 h y N (00:00–08:00) = 6 h. Mañana, especial, libres y horarios manuales = 0 h. */
export function nightHoursOfShift(shift: Shift, config: Pick<AppConfig, 'shifts' | 'rules'>): number {
  if (shift !== 'T' && shift !== 'N') return 0;
  const def = config.shifts[shift];
  const h: Hours = normalizeHours(hourOf(def.start), hourOf(def.end));
  const np = config.rules.nightPlus;
  const ws = hourOf(np.start);
  let we = hourOf(np.end);
  if (we <= ws) we += 24;
  let total = 0;
  for (let k = -1; k <= 1; k++) {
    total += Math.max(0, Math.min(h.e, we + 24 * k) - Math.max(h.s, ws + 24 * k));
  }
  return Math.round(total * 100) / 100;
}

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** El plus es mensual y su resultado se da el último día del mes.
 *  - Semana que contiene el último día de un mes → mes completo y resultado definitivo.
 *  - Resto de semanas → horas acumuladas del mes desde el día 1 hasta el domingo de esa semana. */
export function nightPlusPeriodForWeek(_config: AppConfig, weekStart: string) {
  const monday = mondayOfISO(weekStart);
  for (let d = 0; d < 7; d++) {
    const date = addDaysISO(monday, d);
    if (addDaysISO(date, 1).slice(0, 7) !== date.slice(0, 7)) {
      const dt = parseISO(date);
      return { from: `${date.slice(0, 7)}-01`, to: date, closingDate: date, final: true, label: `${MONTHS[dt.getMonth()]} ${dt.getFullYear()}` };
    }
  }
  const dt = parseISO(monday);
  const closingDate = toISODate(new Date(dt.getFullYear(), dt.getMonth() + 1, 0));
  return { from: `${monday.slice(0, 7)}-01`, to: addDaysISO(monday, 6), closingDate, final: false, label: `${MONTHS[dt.getMonth()]} ${dt.getFullYear()}` };
}

/** El conserje de noche (trabaja siempre de noche) no entra en el plus: la noche ya es su trabajo. */
export const countsForNightPlus = (config: AppConfig, employeeId: string) =>
  !config.employees.find(e => e.id === employeeId)?.permanentNight;

/** Horas nocturnas y plus de cada empleado entre dos fechas (incluidas). */
export function getNightPlus(config: AppConfig, from: string, to: string, label = ''): NightPlusResult {
  const totals = new Map<string, { name: string; hours: number }>();
  let w = mondayOfISO(from);
  while (w <= to) {
    const res = getWeekSchedule(config, w);
    res.rows.filter(r => countsForNightPlus(config, r.employeeId)).forEach(r => {
      const t = totals.get(r.employeeId) || { name: r.employeeName, hours: 0 };
      r.shifts.forEach((s, d) => {
        const date = addDaysISO(w, d);
        if (date >= from && date <= to) t.hours += nightHoursOfShift(s.shift, config);
      });
      totals.set(r.employeeId, t);
    });
    w = addDaysISO(w, 7);
  }
  const threshold = config.rules.nightPlus.threshold;
  return {
    from, to, label, threshold,
    rows: [...totals.entries()].map(([employeeId, t]) => ({
      employeeId, employeeName: t.name, hours: Math.round(t.hours * 100) / 100, plus: t.hours >= threshold,
    })),
  };
}

export function getNightPlusForWeek(config: AppConfig, weekStart: string): NightPlusResult {
  const p = nightPlusPeriodForWeek(config, weekStart);
  return { ...getNightPlus(config, p.from, p.to, p.label), final: p.final, closingDate: p.closingDate };
}
