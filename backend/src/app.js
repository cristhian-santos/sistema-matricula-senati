const express = require('express');
const cors = require('cors');
const errorHandler = require('./middlewares/errorHandler');

const estudiantesRoutes = require('./routes/estudiantesRoutes');
const cursosRoutes = require('./routes/cursosRoutes');
const matriculasRoutes = require('./routes/matriculasRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');

const academicoRoutes = require('./routes/academicoRoutes');
const reportesRoutes = require('./routes/reportesRoutes');
const authRoutes = require('./routes/authRoutes');
const docenteRoutes = require('./routes/docenteRoutes');
const tesoreriaRoutes = require('./routes/tesoreriaRoutes');
const mallaRoutes = require('./routes/mallaRoutes');
const { authorize, requireAuth } = require('./middlewares/auth');
const app = express();

// Middlewares globales
const allowedOrigins = new Set([
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  process.env.FRONTEND_ORIGIN
].filter(Boolean));
app.use((req, res, next) => {
  const origin = req.get('origin');
  if (origin && !allowedOrigins.has(origin)) {
    return res.status(403).json({ success: false, message: 'Origen no autorizado.' });
  }
  return next();
});
app.use(cors({
  credentials: true,
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error('Origen no autorizado.'));
  }
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) req.body = {};
  next();
});

// Ruta de estado de la API
app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'API REST - Sistema de Matrícula SENATI operativa',
    version: '1.0.0',
    endpoints: [
      '/api/estudiantes',
      '/api/cursos',
      '/api/matriculas',
      '/api/dashboard/stats'
    ]
  });
});

// Rutas de la API
app.use('/api/auth', authRoutes);
app.use('/api/tesoreria', tesoreriaRoutes);
app.use('/api/malla', mallaRoutes);
app.use('/api/estudiantes', requireAuth, authorize('Administrador', 'Secretaría'), estudiantesRoutes);
app.use('/api/cursos', requireAuth, authorize('Administrador', 'Secretaría'), cursosRoutes);
app.use('/api/matriculas', requireAuth, authorize('Administrador', 'Secretaría'), matriculasRoutes);
app.use('/api/dashboard', requireAuth, authorize('Administrador', 'Secretaría'), dashboardRoutes);
app.use('/api/academico', requireAuth, authorize('Administrador', 'Secretaría'), academicoRoutes);
app.use('/api/reportes', requireAuth, authorize('Administrador', 'Secretaría'), reportesRoutes);
app.use('/api/docente', docenteRoutes);
app.get('/api/salud', async (req,res) => {
  try { await require('./config/db').query('SELECT 1'); res.json({success:true,baseDatos:'conectada'}); }
  catch { res.status(503).json({success:false,baseDatos:'sin conexión'}); }
});

// Manejo de ruta no encontrada (404)
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Ruta no encontrada: ${req.method} ${req.originalUrl}`
  });
});

// Middleware centralizado de errores
app.use(errorHandler);

module.exports = app;
