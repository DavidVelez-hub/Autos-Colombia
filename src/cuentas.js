/**
 * Seguridad: inicio de sesión de operadores y control por rol.
 */

function hash_(texto, salt) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + texto, Utilities.Charset.UTF_8);
  return bytes.map(b => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');
}

function crearOperador_(usuario, nombre, rol, clave) {
  const salt = nuevoId_();
  insertar_('Operadores', { id: nuevoId_(), usuario, nombre, rol, hash: hash_(clave, salt), salt, activo: true });
}

function iniciarSesion(usuario, clave) {
  const op = leer_('Operadores').find(o => o.usuario === String(usuario).trim().toLowerCase() && o.activo === true);
  if (!op || hash_(String(clave), op.salt) !== op.hash) throw new Error('Usuario o contraseña incorrectos.');
  const token = Utilities.getUuid();
  CacheService.getScriptCache().put('sesion_' + token, JSON.stringify({ id: op.id, nombre: op.nombre, rol: op.rol }), 21600);
  return { token, nombre: op.nombre, rol: op.rol };
}

function cerrarSesion(token) {
  CacheService.getScriptCache().remove('sesion_' + token);
  return true;
}

/** Devuelve el operador de la sesión. Si se indica rol, lo exige. */
function sesion_(token, rol) {
  const datos = token && CacheService.getScriptCache().get('sesion_' + token);
  if (!datos) throw new Error('Tu sesión terminó. Inicia sesión de nuevo.');
  const op = JSON.parse(datos);
  if (rol && op.rol !== rol) throw new Error('Esta opción es solo para el administrador.');
  return op;
}
