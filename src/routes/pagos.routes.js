const express = require('express');
const router = express.Router();
const { listar, crear, comprobante, reporte } = require('../controllers/pagos.controller');
const { verificarToken } = require('../middleware/auth.middleware');

router.get('/', verificarToken, listar);
router.get('/reporte', verificarToken, reporte);
router.get('/:id/comprobante', verificarToken, comprobante);
router.post('/', verificarToken, crear);

module.exports = router;
