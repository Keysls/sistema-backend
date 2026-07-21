const express = require('express');
const router = express.Router();
const { listar, crear, actualizar, eliminar } = require('../controllers/tecnicos.controller');
const { verificarToken } = require('../middleware/auth.middleware');

router.get('/', verificarToken, listar);
router.post('/', verificarToken, crear);
router.put('/:id', verificarToken, actualizar);
router.delete('/:id', verificarToken, eliminar);

module.exports = router;