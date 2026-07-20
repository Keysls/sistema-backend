# Sistema Backend

API REST con autenticación JWT. Base para el nuevo sistema de gestión.

## 🛠️ Stack
- Node.js 18+
- Express
- Prisma ORM
- PostgreSQL
- JWT

## 🚀 Instalación

```bash
cd sistema-backend
npm install
```

### Variables de entorno
```bash
cp .env.example .env
# Edita .env con tus datos de PostgreSQL y un JWT_SECRET propio
```

### Base de datos
```sql
CREATE DATABASE sistema_gestion;
```

### Migraciones y cliente Prisma
```bash
npm run db:migrate
# Te pedirá un nombre, escribe: init
npm run db:generate
```

### Seed (usuario admin inicial)
```bash
npm run seed
```
Esto crea:
- Email: `admin@sistema.com`
- Password: `Admin123!`

### Levantar el servidor
```bash
npm run dev     # desarrollo, con auto-reload
npm start       # producción
```

El backend queda en `http://localhost:3000`.

## 📡 Endpoints disponibles

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/health` | Verifica que el servidor está vivo |
| POST | `/api/auth/login` | Inicia sesión — `{ email, password }` |
| POST | `/api/auth/logout` | Cierra sesión (requiere token) |
| GET | `/api/auth/me` | Devuelve el usuario autenticado |

## 🗃️ Modelos
- `Usuario` — nombre, apellido, email, password (hash), rol (ADMIN/SUPERVISOR/TECNICO/SECRETARIA), activo
- `TokenSesion` — control de sesiones activas

## ➕ Cómo seguir agregando módulos
Cada módulo nuevo (Clientes, Órdenes, Almacén, Técnicos...) sigue el mismo patrón:
1. Agrega el modelo en `prisma/schema.prisma`
2. `npm run db:migrate`
3. Crea `controllers/<modulo>.controller.js`
4. Crea `routes/<modulo>.routes.js`
5. Regístralo en `src/app.js`: `app.use('/api/<modulo>', require('./routes/<modulo>.routes'))`

## ➕ Crea el archivo de migración SQL en prisma/migrations/
npx prisma migrate dev --name nombre_descriptivo

