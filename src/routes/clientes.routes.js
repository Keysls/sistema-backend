const express = require('express');
const router = express.Router();
const { listar, crear, actualizar } = require('../controllers/clientes.controller');
const { verificarToken } = require('../middleware/auth.middleware');

router.get('/', verificarToken, listar);
router.post('/', verificarToken, crear);
router.put('/:id', verificarToken, actualizar);

module.exports = router;
