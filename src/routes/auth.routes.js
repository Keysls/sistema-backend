const express = require('express');
const router = express.Router();
const { login, logout, me } = require('../controllers/auth.controller');
const { verificarToken } = require('../middleware/auth.middleware');

router.post('/login', login);
router.post('/logout', verificarToken, logout);
router.get('/me', verificarToken, me);

module.exports = router;
