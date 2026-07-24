const express = require('express');
const router = express.Router();
const {
  listarPorContrato, previsualizar, generarManual, crearManual, aplicarDescuento, quitarDescuento,
  mesesSaltados, generarSaltados, descartarSaltados, previsualizarDescuentoMasivo, descuentoMasivo,
  quitarDescuentoMasivoCtrl,
} = require('../controllers/cargos.controller');
const { verificarToken, requiereRol } = require('../middleware/auth.middleware');

// Aplicar/quitar descuentos (individual o masivo) es una acción financiera sensible
// — solo ADMIN y SUPERVISOR, no SECRETARIA.
const soloAdminSupervisor = requiereRol('ADMIN', 'SUPERVISOR');

router.get('/contrato/:contratoId', verificarToken, listarPorContrato);
router.get('/preview', verificarToken, previsualizar);
router.post('/generar', verificarToken, generarManual);
router.patch('/:id/descuento', verificarToken, soloAdminSupervisor, aplicarDescuento);
router.delete('/:id/descuento', verificarToken, soloAdminSupervisor, quitarDescuento);
router.get('/descuento-masivo/preview', verificarToken, soloAdminSupervisor, previsualizarDescuentoMasivo);
router.post('/descuento-masivo', verificarToken, soloAdminSupervisor, descuentoMasivo);
router.post('/quitar-descuento-masivo', verificarToken, soloAdminSupervisor, quitarDescuentoMasivoCtrl);
router.get('/meses-saltados/:contratoId', verificarToken, mesesSaltados);
router.post('/generar-saltados', verificarToken, generarSaltados);
router.post('/descartar-saltados/:contratoId', verificarToken, descartarSaltados);
router.post('/', verificarToken, crearManual);

module.exports = router;
