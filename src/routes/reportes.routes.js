const express = require('express');
const router = express.Router();
const { morosidad } = require('../controllers/reportes.controller');
const { verificarToken } = require('../middleware/auth.middleware');

router.get('/morosidad', verificarToken, morosidad);

module.exports = router;
