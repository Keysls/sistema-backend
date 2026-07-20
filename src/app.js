require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth.routes');

const app = express();

// ─── Seguridad ──────────────────────────────────────────────────
app.use(helmet());

// ─── CORS ───────────────────────────────────────────────────────
const origenesPermitidos = (process.env.CORS_ORIGIN || '*').split(',').map(o => o.trim());
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (origenesPermitidos.includes('*') || origenesPermitidos.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error(`CORS: origen no permitido — ${origin}`));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// ─── Logs ───────────────────────────────────────────────────────
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ─── Body parsing ───────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Rate limiting ───────────────────────────────────────────────
const limitadorGlobal = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes, intenta en 15 minutos' },
  skip: (req) => req.path === '/api/health',
});
app.use('/api', limitadorGlobal);

const limitadorLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos de login. Espera 15 minutos.' },
});
app.use('/api/auth/login', limitadorLogin);

// ─── Health check ────────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ ok: true, servicio: 'sistema-backend' }));

// ─── Rutas ───────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', require('./routes/dashboard.routes'));
app.use('/api/productos', require('./routes/productos.routes'));

// ─── 404 ─────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

// ─── Manejador de errores global ────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Error interno del servidor' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ sistema-backend corriendo en http://localhost:${PORT}`);
});
