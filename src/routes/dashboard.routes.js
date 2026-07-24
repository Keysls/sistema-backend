const express = require('express');
const router = express.Router();
const { kpis, analitica, historial, servicios } = require('../controllers/dashboard.controller');
const { verificarToken } = require('../middleware/auth.middleware');

router.get('/kpis', verificarToken, kpis);
router.get('/analitica', verificarToken, analitica);
router.get('/historial', verificarToken, historial);
router.get('/servicios', verificarToken, servicios);

module.exports = router;
