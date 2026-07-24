const express = require('express');
const router = express.Router();
const { listar, listarMapa, obtener, crear, actualizar, eliminar, importarLote, siguienteNumero } = require('../controllers/contratos.controller');
const { verificarToken, requiereRol } = require('../middleware/auth.middleware');

router.get('/', verificarToken, listar);
router.get('/mapa', verificarToken, listarMapa);
router.get('/siguiente-numero', verificarToken, siguienteNumero);
router.post('/importar', verificarToken, importarLote);
router.get('/:id', verificarToken, obtener);
router.post('/', verificarToken, crear);
router.put('/:id', verificarToken, actualizar);
router.delete('/:id', verificarToken, requiereRol('ADMIN'), eliminar);

module.exports = router;
