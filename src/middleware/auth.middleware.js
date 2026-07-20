const jwt = require('jsonwebtoken');
const prisma = require('../utils/prisma');

/**
 * Verifica el token JWT enviado en el header Authorization: Bearer <token>
 * y adjunta el usuario autenticado en req.usuario
 */
async function verificarToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({ error: 'Token no proporcionado' });
    }

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ error: 'Token inválido o expirado' });
    }

    const usuario = await prisma.usuario.findUnique({ where: { id: payload.id } });

    if (!usuario || !usuario.activo) {
      return res.status(401).json({ error: 'Usuario no encontrado o inactivo' });
    }

    req.usuario = usuario;
    next();
  } catch (err) {
    console.error('Error en verificarToken:', err);
    res.status(500).json({ error: 'Error interno de autenticación' });
  }
}

/**
 * Middleware factory: exige que el usuario tenga uno de los roles indicados
 * Uso: requiereRol('ADMIN', 'SUPERVISOR')
 */
function requiereRol(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({ error: 'No autenticado' });
    }
    if (!rolesPermitidos.includes(req.usuario.rol)) {
      return res.status(403).json({ error: 'No tienes permisos para esta acción' });
    }
    next();
  };
}

module.exports = { verificarToken, requiereRol };
