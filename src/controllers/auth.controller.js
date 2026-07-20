const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../utils/prisma');

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

function generarToken(usuario) {
  return jwt.sign(
    { id: usuario.id, rol: usuario.rol },
    process.env.JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function sanitizarUsuario(usuario) {
  const { password, ...resto } = usuario;
  return resto;
}

// POST /api/auth/login
async function login(req, res) {
  try {
    const { email, password, dispositivo } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña son requeridos' });
    }

    const usuario = await prisma.usuario.findUnique({ where: { email: email.toLowerCase().trim() } });

    if (!usuario || !usuario.activo) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const passwordValido = await bcrypt.compare(password, usuario.password);
    if (!passwordValido) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const token = generarToken(usuario);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 días

    await prisma.tokenSesion.create({
      data: {
        usuarioId: usuario.id,
        token,
        dispositivo: dispositivo || 'Desconocido',
        expiresAt,
      },
    });

    res.json({ token, usuario: sanitizarUsuario(usuario) });
  } catch (err) {
    console.error('Error en login:', err);
    res.status(500).json({ error: 'Error interno al iniciar sesión' });
  }
}

// POST /api/auth/logout
async function logout(req, res) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (token) {
      await prisma.tokenSesion.deleteMany({ where: { token } }).catch(() => {});
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('Error en logout:', err);
    res.status(500).json({ error: 'Error interno al cerrar sesión' });
  }
}

// GET /api/auth/me
async function me(req, res) {
  res.json({ usuario: sanitizarUsuario(req.usuario) });
}

module.exports = { login, logout, me };
