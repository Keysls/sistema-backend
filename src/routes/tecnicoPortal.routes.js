const express = require('express');
const router = express.Router();
const {
  listarOrdenes, historialOrdenes, obtenerOrden, tomarOrden, aceptarOrden, iniciarOrden, completarOrden,
} = require('../controllers/tecnicoPortal.controller');
const { verificarTokenTecnico } = require('../middleware/auth.middleware');

router.get('/ordenes', verificarTokenTecnico, listarOrdenes);
router.get('/ordenes/historial', verificarTokenTecnico, historialOrdenes);
router.get('/ordenes/:id', verificarTokenTecnico, obtenerOrden);
router.post('/ordenes/:id/tomar', verificarTokenTecnico, tomarOrden);
router.patch('/ordenes/:id/aceptar', verificarTokenTecnico, aceptarOrden);
router.patch('/ordenes/:id/iniciar', verificarTokenTecnico, iniciarOrden);
router.patch('/ordenes/:id/completar', verificarTokenTecnico, completarOrden);

module.exports = router;
