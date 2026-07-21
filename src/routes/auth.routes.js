const express = require('express');
const router = express.Router();
const { login, logout, me, actualizarMe, cambiarPassword, loginTecnico, meTecnico } = require('../controllers/auth.controller');
const { verificarToken, verificarTokenTecnico } = require('../middleware/auth.middleware');

router.post('/login', login);
router.post('/logout', verificarToken, logout);
router.get('/me', verificarToken, me);
router.put('/me', verificarToken, actualizarMe);
router.put('/me/password', verificarToken, cambiarPassword);

router.post('/tecnico/login', loginTecnico);
router.get('/tecnico/me', verificarTokenTecnico, meTecnico);

module.exports = router;
