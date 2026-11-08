import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { normalizeConfig } from './configMigration';
import { DEFAULT_CONFIG, displayShift, shiftLegend } from './constants';
import { getNightPlusForWeek, getPublicWeekSchedule, mondayOfISO } from './scheduleService';
import { AppConfig, ScheduleRequest } from './types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
app.use(express.json({ limit: '5mb' }));

const DATA_DIR = path.resolve(__dirname, 'data');
const REQUESTS_FILE = path.resolve(DATA_DIR, 'requests.json');
const CONFIG_FILE = path.resolve(DATA_DIR, 'config.json');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const readJSON = <T>(file: string, fallback: T): T => {
  try { return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf-8')) : fallback; } catch { return fallback; }
};
const writeJSON = (file: string, data: unknown) => fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');

const storedConfig = (): AppConfig | null => {
  const raw = readJSON<any>(CONFIG_FILE, null);
  return raw ? normalizeConfig(raw) : null;
};
const effectiveConfig = (): AppConfig => storedConfig() || normalizeConfig(structuredClone(DEFAULT_CONFIG));
const readRequests = (): ScheduleRequest[] => readJSON<ScheduleRequest[]>(REQUESTS_FILE, []);

/** Configuración con todas las peticiones (las del panel y las enviadas desde el móvil). */
const configWithRequests = (): AppConfig => {
  const cfg = effectiveConfig();
  const ids = new Set(cfg.requests.map(r => r.id));
  return { ...cfg, requests: [...cfg.requests, ...readRequests().filter(r => !ids.has(r.id))] };
};

// ── Seguridad: sólo el administrador ve y cambia la configuración (roles incluidos) ──
const pinRequired = () => (effectiveConfig().security.adminPin || '') !== '';
const requireAdmin: express.RequestHandler = (req, res, next) => {
  const pin = effectiveConfig().security.adminPin || '';
  if (pin && req.header('x-admin-pin') !== pin) {
    res.status(401).json({ error: 'PIN incorrecto' });
    return;
  }
  next();
};

app.get('/api/auth/status', (_req, res) => { res.json({ pinRequired: pinRequired() }); });

app.get('/api/config', requireAdmin, (_req, res) => { res.json(storedConfig()); });

app.post('/api/config', requireAdmin, (req, res) => {
  try {
    writeJSON(CONFIG_FILE, normalizeConfig(req.body));
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Error al guardar la configuración' });
  }
});

// ── Público (empleados): sólo nombres y turnos, nunca roles ──
app.get('/api/public/employees', (_req, res) => {
  const cfg = effectiveConfig();
  res.json({
    managerName: cfg.managerName,
    employees: cfg.employees.filter(e => e.active && e.name.trim()).map(e => ({ id: e.id, name: e.name })),
  });
});

app.get('/api/public/schedule', (req, res) => {
  try {
    const week = mondayOfISO(String(req.query.week || new Date().toISOString().slice(0, 10)));
    const cfg = configWithRequests();
    const data = getPublicWeekSchedule(cfg, week);
    const np = cfg.rules.nightPlus.enabled ? getNightPlusForWeek(cfg, week) : null;
    res.json({
      weekStart: data.weekStart,
      legend: shiftLegend(cfg),
      nightPlus: np && { label: np.label, threshold: np.threshold, rows: np.rows.map(r => ({ employeeId: r.employeeId, hours: r.hours, plus: r.plus })) },
      rows: data.rows.map(r => ({
        employeeId: r.employeeId,
        employeeName: r.employeeName,
        shifts: r.shifts.map(s => ({ day: s.day, shift: s.shift, label: displayShift(s.shift, cfg) })),
      })),
    });
  } catch (err) {
    console.error('Error generando cuadrante público:', err);
    res.status(500).json({ error: 'No se pudo generar el cuadrante' });
  }
});

// ── Peticiones ──
app.get('/api/requests', (_req, res) => { res.json(readRequests()); });

app.post('/api/requests', (req, res) => {
  const b = req.body || {};
  if (!b.employeeId || !b.startDate || !b.endDate) {
    res.status(400).json({ error: 'Faltan campos obligatorios' });
    return;
  }
  const item: ScheduleRequest = {
    id: String(b.id || Date.now()),
    employeeId: String(b.employeeId),
    type: ['Vacaciones', 'Petición', 'Festivo', 'Baja'].includes(b.type) ? b.type : 'Vacaciones',
    startDate: String(b.startDate),
    endDate: String(b.endDate),
    reason: String(b.reason || '').slice(0, 500),
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  writeJSON(REQUESTS_FILE, [...readRequests(), item]);
  res.status(201).json(item);
});

app.put('/api/requests', requireAdmin, (req, res) => {
  if (!Array.isArray(req.body)) { res.status(400).json({ error: 'Lista no válida' }); return; }
  writeJSON(REQUESTS_FILE, req.body);
  res.json({ success: true, count: req.body.length });
});

app.delete('/api/requests/:id', requireAdmin, (req, res) => {
  writeJSON(REQUESTS_FILE, readRequests().filter(r => r.id !== req.params.id));
  res.json({ success: true });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.use((_req, res) => res.sendFile(path.resolve(distPath, 'index.html')));
  }
  app.listen(PORT, '0.0.0.0', () => console.log(`[Server] Corriendo en http://0.0.0.0:${PORT}`));
}

startServer();
