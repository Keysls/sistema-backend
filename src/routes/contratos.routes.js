const express = require('express');
const router = express.Router();
const { listar, listarMapa, obtener, crear, actualizar, importarLote } = require('../controllers/contratos.controller');
const { verificarToken } = require('../middleware/auth.middleware');

router.get('/', verificarToken, listar);
router.get('/mapa', verificarToken, listarMapa);
router.post('/importar', verificarToken, importarLote);
router.get('/:id', verificarToken, obtener);
router.post('/', verificarToken, crear);
router.put('/:id', verificarToken, actualizar);

module.exports = router;
