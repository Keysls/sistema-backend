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

// PUT /api/auth/me
async function actualizarMe(req, res) {
  try {
    const { nombre, apellido, email } = req.body;
    if (!nombre?.trim() || !apellido?.trim() || !email?.trim()) {
      return res.status(400).json({ error: 'Nombre, apellido y email son requeridos' });
    }

    const usuario = await prisma.usuario.update({
      where: { id: req.usuario.id },
      data: { nombre: nombre.trim(), apellido: apellido.trim(), email: email.toLowerCase().trim() },
    });

    res.json({ usuario: sanitizarUsuario(usuario) });
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Ya existe un usuario registrado con ese email' });
    }
    console.error('Error en auth.actualizarMe:', err);
    res.status(500).json({ error: 'Error al actualizar el perfil' });
  }
}

// PUT /api/auth/me/password
async function cambiarPassword(req, res) {
  try {
    const { passwordActual, passwordNuevo } = req.body;
    if (!passwordActual || !passwordNuevo) {
      return res.status(400).json({ error: 'Contraseña actual y nueva son requeridas' });
    }
    if (passwordNuevo.length < 6) {
      return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' });
    }

    const usuario = await prisma.usuario.findUnique({ where: { id: req.usuario.id } });
    const passwordValido = await bcrypt.compare(passwordActual, usuario.password);
    if (!passwordValido) {
      return res.status(401).json({ error: 'La contraseña actual es incorrecta' });
    }

    const hash = await bcrypt.hash(passwordNuevo, 10);
    await prisma.usuario.update({ where: { id: usuario.id }, data: { password: hash } });

    res.json({ ok: true });
  } catch (err) {
    console.error('Error en auth.cambiarPassword:', err);
    res.status(500).json({ error: 'Error al cambiar la contraseña' });
  }
}

function generarTokenTecnico(tecnico) {
  return jwt.sign(
    { id: tecnico.id, tipo: 'tecnico' },
    process.env.JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

// POST /api/auth/tecnico/login
async function loginTecnico(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña son requeridos' });
    }

    const tecnico = await prisma.tecnico.findUnique({ where: { email: email.toLowerCase().trim() } });

    if (!tecnico || !tecnico.activo) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const passwordValido = await bcrypt.compare(password, tecnico.password);
    if (!passwordValido) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const token = generarTokenTecnico(tecnico);
    res.json({ token, tecnico: sanitizarUsuario(tecnico) });
  } catch (err) {
    console.error('Error en loginTecnico:', err);
    res.status(500).json({ error: 'Error interno al iniciar sesión' });
  }
}

// GET /api/auth/tecnico/me
async function meTecnico(req, res) {
  res.json({ tecnico: sanitizarUsuario(req.tecnico) });
}

module.exports = { login, logout, me, actualizarMe, cambiarPassword, loginTecnico, meTecnico };
