const express = require('express');
const router = express.Router();
const { listarPorContrato, previsualizar, generarManual, crearManual } = require('../controllers/cargos.controller');
const { verificarToken } = require('../middleware/auth.middleware');

router.get('/contrato/:contratoId', verificarToken, listarPorContrato);
router.get('/preview', verificarToken, previsualizar);
router.post('/generar', verificarToken, generarManual);
router.post('/', verificarToken, crearManual);

module.exports = router;
