const express = require('express');
const router = express.Router();
const { listar, obtener, crear, actualizar, cambiarEstado, stats } = require('../controllers/ordenesServicio.controller');
const { verificarToken } = require('../middleware/auth.middleware');

router.get('/', verificarToken, listar);
router.get('/stats', verificarToken, stats);
router.get('/:id', verificarToken, obtener);
router.post('/', verificarToken, crear);
router.put('/:id', verificarToken, actualizar);
router.patch('/:id/estado', verificarToken, cambiarEstado);

module.exports = router;
