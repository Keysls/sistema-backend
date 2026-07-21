const express = require('express');
const router = express.Router();
const { verificarToken } = require('../middleware/auth.middleware');

router.get('/dni/:numero', verificarToken, async (req, res) => {
  if (!process.env.APIS_TOKEN) {
    return res.status(503).json({ error: 'Consulta RENIEC no configurada (falta APIS_TOKEN)' });
  }
  try {
    const r = await fetch(`https://api.decolecta.com/v1/reniec/dni?numero=${req.params.numero}`, {
      headers: { Authorization: `Bearer ${process.env.APIS_TOKEN}`, Accept: 'application/json' },
    });
    const body = await r.json();
    if (!r.ok) return res.status(404).json({ error: 'DNI no encontrado' });
    res.json(body);
  } catch (err) {
    console.error('Error en reniec.dni:', err);
    res.status(500).json({ error: 'Error al consultar RENIEC' });
  }
});

router.get('/ruc/:numero', verificarToken, async (req, res) => {
  if (!process.env.APIS_TOKEN) {
    return res.status(503).json({ error: 'Consulta SUNAT no configurada (falta APIS_TOKEN)' });
  }
  try {
    const r = await fetch(`https://api.decolecta.com/v1/sunat/ruc?numero=${req.params.numero}`, {
      headers: { Authorization: `Bearer ${process.env.APIS_TOKEN}`, Accept: 'application/json' },
    });
    const body = await r.json();
    if (!r.ok) return res.status(404).json({ error: 'RUC no encontrado' });
    res.json(body);
  } catch (err) {
    console.error('Error en reniec.ruc:', err);
    res.status(500).json({ error: 'Error al consultar SUNAT' });
  }
});

module.exports = router;
