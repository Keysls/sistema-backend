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

/**
 * Verifica el token JWT de un técnico (tabla Tecnico, no Usuario)
 * y adjunta el técnico autenticado en req.tecnico
 */
async function verificarTokenTecnico(req, res, next) {
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

    if (payload.tipo !== 'tecnico') {
      return res.status(401).json({ error: 'Token no corresponde a un técnico' });
    }

    const tecnico = await prisma.tecnico.findUnique({ where: { id: payload.id } });

    if (!tecnico || !tecnico.activo) {
      return res.status(401).json({ error: 'Técnico no encontrado o inactivo' });
    }

    req.tecnico = tecnico;
    next();
  } catch (err) {
    console.error('Error en verificarTokenTecnico:', err);
    res.status(500).json({ error: 'Error interno de autenticación' });
  }
}

/**
 * Acepta tanto un token de Usuario (admin/supervisor/secretaria) como de Técnico.
 * Útil para rutas de solo lectura compartidas (catálogos, puntos de red).
 */
async function verificarTokenCualquiera(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Token no proporcionado' });

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ error: 'Token inválido o expirado' });
    }

    if (payload.tipo === 'tecnico') {
      const tecnico = await prisma.tecnico.findUnique({ where: { id: payload.id } });
      if (!tecnico || !tecnico.activo) return res.status(401).json({ error: 'Técnico no encontrado o inactivo' });
      req.tecnico = tecnico;
      return next();
    }

    const usuario = await prisma.usuario.findUnique({ where: { id: payload.id } });
    if (!usuario || !usuario.activo) return res.status(401).json({ error: 'Usuario no encontrado o inactivo' });
    req.usuario = usuario;
    next();
  } catch (err) {
    console.error('Error en verificarTokenCualquiera:', err);
    res.status(500).json({ error: 'Error interno de autenticación' });
  }
}

module.exports = { verificarToken, requiereRol, verificarTokenTecnico, verificarTokenCualquiera };
