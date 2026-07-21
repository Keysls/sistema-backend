const express = require('express');
const router = express.Router();
const { listar, crear, actualizar, eliminar } = require('../controllers/puntosRed.controller');
const { verificarToken, verificarTokenCualquiera } = require('../middleware/auth.middleware');

router.get('/', verificarTokenCualquiera, listar);
router.post('/', verificarToken, crear);
router.put('/:id', verificarToken, actualizar);
router.delete('/:id', verificarToken, eliminar);

module.exports = router;
