const prisma = require('../utils/prisma');

// GET /api/dashboard/kpis
async function kpis(req, res) {
  try {
    // TODO: reemplazar con sumas reales cuando exista el modelo de Ordenes/Ventas
    res.json({
      data: {
        ventasHoy: 0,
        ventasSemana: 0,
        ventasMes: 0,
        ordenesAbiertas: 0,
      },
    });
  } catch (err) {
    console.error('Error en dashboard.kpis:', err);
    res.status(500).json({ error: 'Error al obtener KPIs' });
  }
}

// GET /api/dashboard/analitica?periodo=7d
function generarPuntos(periodo) {
  const CONFIG = {
    '3d': 3, '7d': 7, '30d': 30, '6m': 6, '1a': 12,
  };
  const n = CONFIG[periodo] || 7;
  const esMensual = periodo === '6m' || periodo === '1a';

  return Array.from({ length: n }, (_, i) => ({
    label: esMensual ? `Mes ${i + 1}` : `Día ${i + 1}`,
    monto: 0, // TODO: reemplazar con suma real agrupada por fecha
  }));
}

async function analitica(req, res) {
  try {
    const { periodo = '7d' } = req.query;
    res.json({ data: generarPuntos(periodo) });
  } catch (err) {
    console.error('Error en dashboard.analitica:', err);
    res.status(500).json({ error: 'Error al obtener analítica' });
  }
}

// GET /api/dashboard/historial
async function historial(req, res) {
  try {
    // TODO: reemplazar con las últimas 5 órdenes reales
    res.json({ data: [] });
  } catch (err) {
    console.error('Error en dashboard.historial:', err);
    res.status(500).json({ error: 'Error al obtener historial' });
  }
}

module.exports = { kpis, analitica, historial };
