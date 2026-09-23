import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());

// Persistent data directory
const DATA_DIR = path.resolve(__dirname, 'data');
const REQUESTS_FILE = path.resolve(DATA_DIR, 'requests.json');
const CONFIG_FILE = path.resolve(DATA_DIR, 'config.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 1. API: List all requests
app.get('/api/requests', (req, res) => {
  try {
    if (fs.existsSync(REQUESTS_FILE)) {
      const data = fs.readFileSync(REQUESTS_FILE, 'utf-8');
      return res.json(JSON.parse(data));
    }
    return res.json([]);
  } catch (err) {
    console.error('Error reading requests:', err);
    return res.status(500).json({ error: 'Error reading requests' });
  }
});

// 2. API: Employee submits a new vacation/shift request
app.post('/api/requests', (req, res) => {
  try {
    const newReq = req.body;
    if (!newReq.employeeId || !newReq.startDate || !newReq.endDate) {
      return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }

    let requests: any[] = [];
    if (fs.existsSync(REQUESTS_FILE)) {
      try {
        requests = JSON.parse(fs.readFileSync(REQUESTS_FILE, 'utf-8'));
      } catch (e) {
        requests = [];
      }
    }

    const createdItem = {
      id: newReq.id || Date.now().toString(),
      employeeId: newReq.employeeId,
      type: newReq.type || 'Vacaciones',
      startDate: newReq.startDate,
      endDate: newReq.endDate,
      reason: newReq.reason || '',
      status: newReq.status || 'pending',
      createdAt: newReq.createdAt || new Date().toISOString()
    };

    requests.push(createdItem);
    fs.writeFileSync(REQUESTS_FILE, JSON.stringify(requests, null, 2), 'utf-8');

    return res.status(201).json(createdItem);
  } catch (err) {
    console.error('Error creating request:', err);
    return res.status(500).json({ error: 'Error al registrar la solicitud' });
  }
});

// 3. API: Update all requests (approve, reject, bulk update)
app.put('/api/requests', (req, res) => {
  try {
    const list = req.body;
    if (!Array.isArray(list)) {
      return res.status(400).json({ error: 'Lista no válida' });
    }
    fs.writeFileSync(REQUESTS_FILE, JSON.stringify(list, null, 2), 'utf-8');
    return res.json({ success: true, count: list.length });
  } catch (err) {
    console.error('Error updating requests:', err);
    return res.status(500).json({ error: 'Error al actualizar solicitudes' });
  }
});

// 4. API: Delete a request
app.delete('/api/requests/:id', (req, res) => {
  try {
    const { id } = req.params;
    if (fs.existsSync(REQUESTS_FILE)) {
      let requests = JSON.parse(fs.readFileSync(REQUESTS_FILE, 'utf-8'));
      requests = requests.filter((r: any) => r.id !== id);
      fs.writeFileSync(REQUESTS_FILE, JSON.stringify(requests, null, 2), 'utf-8');
    }
    return res.json({ success: true });
  } catch (err) {
    console.error('Error deleting request:', err);
    return res.status(500).json({ error: 'Error al eliminar la solicitud' });
  }
});

// 5. API: Get / Save config
app.get('/api/config', (req, res) => {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
      return res.json(JSON.parse(data));
    }
    return res.json(null);
  } catch (err) {
    return res.status(500).json({ error: 'Error reading config' });
  }
});

app.post('/api/config', (req, res) => {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(req.body, null, 2), 'utf-8');
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Error saving config' });
  }
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    // Development: Vite middleware mode
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production: Serve static build files
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Corriendo en http://0.0.0.0:${PORT}`);
  });
}

startServer();
