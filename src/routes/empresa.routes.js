const express = require('express');
const router = express.Router();
const { obtener, actualizar, agregarMetodo, actualizarMetodo, eliminarMetodo } = require('../controllers/empresa.controller');
const { verificarToken } = require('../middleware/auth.middleware');

router.get('/', verificarToken, obtener);
router.put('/', verificarToken, actualizar);
router.post('/metodos', verificarToken, agregarMetodo);
router.put('/metodos/:id', verificarToken, actualizarMetodo);
router.delete('/metodos/:id', verificarToken, eliminarMetodo);

module.exports = router;
