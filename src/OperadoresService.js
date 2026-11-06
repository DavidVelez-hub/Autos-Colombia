/**
 * Iteración 2 – Gestión de usuarios del sistema (operadores y administradores).
 */

function buscarOperador_(id) {
  const op = leer_('Operadores').find(o => o.id === id);
  if (!op) throw new Error('El operador no existe.');
  return op;
}

function listarOperadores(token) {
  sesion_(token, 'ADMIN');
  return leer_('Operadores').map(o => ({ id: o.id, usuario: o.usuario, nombre: o.nombre, rol: o.rol, activo: o.activo === true }));
}

/** RF16: crea un operador o actualiza su nombre y rol. */
function guardarOperador(token, datos) {
  sesion_(token, 'ADMIN');
  const usuario = String(datos.usuario || '').trim().toLowerCase();
  const nombre = String(datos.nombre || '').trim();
  const rol = datos.rol === 'ADMIN' ? 'ADMIN' : 'OPERADOR';
  if (!usuario || !nombre) throw new Error('El usuario y el nombre son obligatorios.');

  return conBloqueo_(() => {
    if (leer_('Operadores').some(o => o.usuario === usuario && o.id !== datos.id)) throw new Error(`El usuario ${usuario} ya existe.`);
    if (datos.id) {
      actualizar_('Operadores', buscarOperador_(datos.id)._fila, { usuario, nombre, rol });
      return { id: datos.id };
    }
    if (!datos.clave) throw new Error('Escribe una contraseña para el nuevo operador.');
    crearOperador_(usuario, nombre, rol, String(datos.clave));
    return { usuario };
  });
}

/** RF16: activa o desactiva un operador. Nadie puede desactivarse a sí mismo. */
function cambiarEstadoOperador(token, id, activo) {
  const yo = sesion_(token, 'ADMIN');
  if (id === yo.id && !activo) throw new Error('No puedes desactivar tu propio usuario.');
  actualizar_('Operadores', buscarOperador_(id)._fila, { activo: !!activo });
  return { id, activo: !!activo };
}

/** RF16: asigna una contraseña nueva. */
function restablecerClave(token, id, clave) {
  sesion_(token, 'ADMIN');
  if (!clave) throw new Error('Escribe la nueva contraseña.');
  const salt = nuevoId_();
  actualizar_('Operadores', buscarOperador_(id)._fila, { hash: hash_(String(clave), salt), salt });
  return { id };
}
