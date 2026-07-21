const express = require('express');
const router = express.Router();
const {
  catalogo,
  categorias,
  crear,
  actualizar,
  variantes,
  crearVariante,
  actualizarVariante,
  eliminarVariante,
} = require('../controllers/productos.controller');
const { verificarToken, verificarTokenCualquiera } = require('../middleware/auth.middleware');

router.get('/catalogo', verificarTokenCualquiera, catalogo);
router.get('/categorias', verificarToken, categorias);
router.post('/', verificarToken, crear);
router.put('/:id', verificarToken, actualizar);

router.get('/:productoId/variantes', verificarToken, variantes);
router.post('/:productoId/variantes', verificarToken, crearVariante);
router.put('/variantes/:varianteId', verificarToken, actualizarVariante);
router.delete('/variantes/:varianteId', verificarToken, eliminarVariante);

module.exports = router;