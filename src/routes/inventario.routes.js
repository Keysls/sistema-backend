const express = require('express');
const router = express.Router();
const {
  listarMovimientos,
  listarMovimientosTodos,
  registrarEntrada,
  registrarSalida,
  listarProductosConMovimiento,
  stats,
} = require('../controllers/inventario.controller');
const { verificarToken, verificarTokenCualquiera } = require('../middleware/auth.middleware');

router.get('/stats', verificarToken, stats);
router.get('/productos', verificarTokenCualquiera, listarProductosConMovimiento);
router.get('/movimientos', verificarToken, listarMovimientos);
router.get('/movimientos/todos', verificarToken, listarMovimientosTodos);
router.post('/entradas', verificarToken, registrarEntrada);
router.post('/salidas', verificarToken, registrarSalida);

module.exports = router;