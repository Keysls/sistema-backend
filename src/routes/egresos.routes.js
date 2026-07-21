const express = require('express');
const router = express.Router();
const { listar, crear, eliminar } = require('../controllers/egresos.controller');
const { verificarToken } = require('../middleware/auth.middleware');

router.get('/', verificarToken, listar);
router.post('/', verificarToken, crear);
router.delete('/:id', verificarToken, eliminar);

module.exports = router;
