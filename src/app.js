require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const cron = require('node-cron');

const authRoutes = require('./routes/auth.routes');
const { generarCargosDelMes } = require('./utils/generarCargos');

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
app.use('/api/tecnicos', require('./routes/tecnicos.routes'));
app.use('/api/secretarios', require('./routes/secretarios.routes'));
app.use('/api/inventario', require('./routes/inventario.routes'));
app.use('/api/clientes', require('./routes/clientes.routes'));
app.use('/api/reniec', require('./routes/reniec.routes'));
app.use('/api/puntos-red', require('./routes/puntosRed.routes'));
app.use('/api/planes', require('./routes/planes.routes'));
app.use('/api/contratos', require('./routes/contratos.routes'));
app.use('/api/ordenes-servicio', require('./routes/ordenesServicio.routes'));
app.use('/api/tecnico', require('./routes/tecnicoPortal.routes'));
app.use('/api/cargos', require('./routes/cargos.routes'));
app.use('/api/pagos', require('./routes/pagos.routes'));
app.use('/api/empresa', require('./routes/empresa.routes'));
app.use('/api/egresos', require('./routes/egresos.routes'));


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

  // Genera los cargos mensuales pendientes al iniciar (por si el server estuvo caído
  // el día de corte de algún contrato) y luego una vez al día a la 1:00 am.
  generarCargosDelMes()
    .then(r => console.log(`💳 Cargos mensuales al iniciar: ${r.creados} creados (período ${r.periodo})`))
    .catch(err => console.error('Error generando cargos al iniciar:', err));

  cron.schedule('0 1 * * *', () => {
    generarCargosDelMes()
      .then(r => console.log(`💳 Cargos mensuales generados: ${r.creados} (período ${r.periodo})`))
      .catch(err => console.error('Error en cron de cargos mensuales:', err));
  });
});