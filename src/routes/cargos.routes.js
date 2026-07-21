const express = require('express');
const router = express.Router();
const { listarPorContrato, generarManual } = require('../controllers/cargos.controller');
const { verificarToken } = require('../middleware/auth.middleware');

router.get('/contrato/:contratoId', verificarToken, listarPorContrato);
router.post('/generar', verificarToken, generarManual);

module.exports = router;
