// ===== Autos Colombia – Iteraciones 1 y 2 =====

// ----- Code.js -----
/**
 * Entrada web e instalación.
 */

function doGet() {
  if (PropertiesService.getScriptProperties().getProperty('VERSION_ESQUEMA') !== VERSION_ESQUEMA) setup();
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Autos Colombia – Parqueadero')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/** Crea o actualiza el Spreadsheet: hojas, columnas nuevas, celdas y operadores iniciales. */
function setup() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('SPREADSHEET_ID');
  const ss = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.create('Autos Colombia - Base de datos');
  props.setProperty('SPREADSHEET_ID', ss.getId());

  Object.keys(ESQUEMA).forEach(nombre => {
    const sh = ss.getSheetByName(nombre) || ss.insertSheet(nombre);
    if (sh.getLastRow() === 0) {
      sh.appendRow(ESQUEMA[nombre]);
      sh.setFrozenRows(1);
      sh.getRange(1, 1, 1, ESQUEMA[nombre].length).setFontWeight('bold');
    }
  });
  migrarColumnas_(ss);
  ['Hoja 1', 'Sheet1'].forEach(n => {
    const h = ss.getSheetByName(n);
    if (h) ss.deleteSheet(h);
  });

  if (leer_('Celdas').length === 0) {
    const celdas = [];
    for (let i = 1; i <= 20; i++) celdas.push({ codigo: 'C' + String(i).padStart(2, '0'), tipo: 'CARRO', estado: 'LIBRE' });
    for (let i = 1; i <= 10; i++) celdas.push({ codigo: 'M' + String(i).padStart(2, '0'), tipo: 'MOTO', estado: 'LIBRE' });
    insertarVarios_('Celdas', celdas);
  }
  if (leer_('Operadores').length === 0) {
    crearOperador_('admin', 'Administrador', 'ADMIN', 'Admin123*');
    crearOperador_('operador', 'Operador de turno', 'OPERADOR', 'Operador123*');
  }
  props.setProperty('VERSION_ESQUEMA', VERSION_ESQUEMA);
  Logger.log('Base de datos lista: ' + ss.getUrl());
}

// ----- Auth.js -----
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

// ----- RegistroService.js -----
/**
 * Negocio: entrada y salida de vehículos (Iteración 1).
 */

function placa_(texto) {
  const placa = String(texto || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!placa) throw new Error('Escribe la placa.');
  return placa;
}

function registroAbierto_(placa) {
  return leer_('Registros').find(r => String(r.placa) === placa && r.estado === 'ABIERTO');
}

/** Registra la entrada. Si el vehículo es nuevo, se guarda con el tipo elegido. */
function registrarEntrada(token, textoPlaca, tipoElegido) {
  const op = sesion_(token);
  const placa = placa_(textoPlaca);

  return conBloqueo_(() => {
    if (registroAbierto_(placa)) throw new Error(`${placa} ya está dentro del parqueadero.`);

    const vehiculo = leer_('Vehiculos').find(v => String(v.placa).trim().toUpperCase() === placa);
    const tipo = String(vehiculo ? vehiculo.tipo : tipoElegido).trim().toUpperCase() === 'MOTO' ? 'MOTO' : 'CARRO';
    const dueno = vehiculo && vehiculo.usuario_id ? leer_('Usuarios').find(u => u.id === vehiculo.usuario_id) : null;
    if (dueno && dueno.estado === 'INACTIVO') throw new Error(`El usuario ${dueno.nombre} está inactivo; ${placa} no puede ingresar.`);

    // Primero la celda fija del usuario; si no tiene o está ocupada, una celda libre sin asignar.
    const celdas = leer_('Celdas');
    const celda = (dueno && celdas.find(c => c.usuario_id === dueno.id && c.tipo === tipo && c.estado === 'LIBRE')) ||
                  celdas.find(c => c.tipo === tipo && c.estado === 'LIBRE' && !c.usuario_id);
    if (!celda) throw new Error(`No hay celdas libres para ${tipo === 'MOTO' ? 'motos' : 'carros'}.`);
    if (!vehiculo) insertar_('Vehiculos', { placa, tipo });

    const ahora = new Date();
    insertar_('Registros', { id: nuevoId_(), placa, celda: celda.codigo, fecha_entrada: ahora,
      operador_entrada: op.id, estado: 'ABIERTO' });
    actualizar_('Celdas', celda._fila, { estado: 'OCUPADA' });
    return { placa, celda: celda.codigo, hora: fmt_(ahora), nuevo: !vehiculo };
  });
}

/** Registra la salida, libera la celda y calcula la permanencia. */
function registrarSalida(token, textoPlaca) {
  const op = sesion_(token);
  const placa = placa_(textoPlaca);

  return conBloqueo_(() => {
    const reg = registroAbierto_(placa);
    if (!reg) throw new Error(`${placa} no tiene una entrada registrada.`);

    const ahora = new Date();
    actualizar_('Registros', reg._fila, { fecha_salida: ahora, operador_salida: op.id, estado: 'CERRADO' });
    const celda = leer_('Celdas').find(c => c.codigo === reg.celda);
    actualizar_('Celdas', celda._fila, { estado: 'LIBRE' });

    const minutos = Math.round((ahora - new Date(reg.fecha_entrada)) / 60000);
    return { placa, celda: reg.celda, hora: fmt_(ahora), permanencia: `${Math.floor(minutos / 60)} h ${minutos % 60} min` };
  });
}

function obtenerOcupacion(token) {
  sesion_(token);
  const abiertos = {}, nombres = {};
  leer_('Registros').filter(r => r.estado === 'ABIERTO').forEach(r => { abiertos[r.celda] = r; });
  leer_('Usuarios').forEach(u => { nombres[u.id] = u.nombre; });
  return leer_('Celdas').sort((a, b) => String(a.codigo).localeCompare(String(b.codigo))).map(c => {
    const r = abiertos[c.codigo];
    return { codigo: c.codigo, tipo: c.tipo, estado: c.estado, asignada: c.usuario_id ? (nombres[c.usuario_id] || 'Asignada') : '',
      placa: r ? String(r.placa) : '', entrada: r ? fmt_(r.fecha_entrada) : '' };
  });
}

/** Historial filtrado por placa y fechas (solo administrador). */
function consultarHistorial(token, filtro) {
  sesion_(token, 'ADMIN');
  const placa = String(filtro.placa || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const desde = filtro.desde ? new Date(filtro.desde + 'T00:00:00') : null;
  const hasta = filtro.hasta ? new Date(filtro.hasta + 'T23:59:59') : null;
  const nombres = {};
  leer_('Operadores').forEach(o => { nombres[o.id] = o.nombre; });

  return leer_('Registros')
    .filter(r => (!placa || String(r.placa) === placa) &&
                 (!desde || new Date(r.fecha_entrada) >= desde) &&
                 (!hasta || new Date(r.fecha_entrada) <= hasta))
    .sort((a, b) => new Date(b.fecha_entrada) - new Date(a.fecha_entrada))
    .slice(0, 300)
    .map(r => ({ placa: String(r.placa), celda: r.celda, entrada: fmt_(r.fecha_entrada),
      salida: fmt_(r.fecha_salida), estado: r.estado, operador: nombres[r.operador_entrada] || '' }));
}

/** Registra una novedad sobre un vehículo que está dentro. */
function registrarNovedad(token, textoPlaca, descripcion) {
  const op = sesion_(token);
  const placa = placa_(textoPlaca);
  const texto = String(descripcion || '').trim();
  if (!texto) throw new Error('Describe la novedad.');

  const reg = registroAbierto_(placa);
  if (!reg) throw new Error(`${placa} no está dentro del parqueadero.`);
  insertar_('Novedades', { id: nuevoId_(), registro_id: reg.id, placa, descripcion: texto, fecha: new Date(), operador: op.id });
  return { placa };
}

function listarNovedades(token) {
  sesion_(token);
  const nombres = {};
  leer_('Operadores').forEach(o => { nombres[o.id] = o.nombre; });
  return leer_('Novedades')
    .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
    .slice(0, 50)
    .map(n => ({ placa: String(n.placa), descripcion: n.descripcion, fecha: fmt_(n.fecha), operador: nombres[n.operador] || '' }));
}

// ----- UsuariosService.js -----
/**
 * Iteración 2 – Gestión de usuarios (clientes del parqueadero) y sus vehículos.
 */

function buscarCliente_(id) {
  const cliente = leer_('Usuarios').find(u => u.id === id);
  if (!cliente) throw new Error('El cliente no existe.');
  return cliente;
}

/** RF11: clientes con sus placas y estado. */
function listarClientes(token) {
  sesion_(token);
  const vehiculos = leer_('Vehiculos');
  return leer_('Usuarios').map(u => ({
    id: u.id, documento: String(u.documento), nombre: u.nombre,
    telefono: String(u.telefono), email: u.email, estado: u.estado || 'ACTIVO',
    vehiculos: vehiculos.filter(v => v.usuario_id === u.id)
      .map(v => ({ placa: String(v.placa), tipo: v.tipo, marca: v.marca, color: v.color }))
  })).sort((a, b) => a.nombre.localeCompare(b.nombre));
}

/** RF10 y RF12: crea o actualiza un cliente. El documento no se repite. */
function guardarCliente(token, datos) {
  sesion_(token);
  const documento = String(datos.documento || '').replace(/\D/g, '');
  const nombre = String(datos.nombre || '').trim();
  if (!documento || !nombre) throw new Error('El documento y el nombre son obligatorios.');

  return conBloqueo_(() => {
    const usuarios = leer_('Usuarios');
    const otro = usuarios.find(u => String(u.documento) === documento && u.id !== datos.id);
    if (otro) throw new Error(`El documento ${documento} ya pertenece a ${otro.nombre}.`);

    const campos = { documento, nombre, telefono: String(datos.telefono || '').trim(), email: String(datos.email || '').trim() };
    if (datos.id) {
      actualizar_('Usuarios', buscarCliente_(datos.id)._fila, campos);
      return { id: datos.id };
    }
    const id = 'U' + nuevoId_().slice(1);
    insertar_('Usuarios', Object.assign({ id, estado: 'ACTIVO', fecha_registro: new Date() }, campos));
    return { id };
  });
}

/** RF13: activa o inactiva un cliente (solo administrador). */
function cambiarEstadoCliente(token, id, activo) {
  sesion_(token, 'ADMIN');
  actualizar_('Usuarios', buscarCliente_(id)._fila, { estado: activo ? 'ACTIVO' : 'INACTIVO' });
  return { id, estado: activo ? 'ACTIVO' : 'INACTIVO' };
}

/** RF14: asocia un vehículo nuevo, o uno sin dueño, a un cliente. */
function asociarVehiculo(token, clienteId, datos) {
  sesion_(token);
  const placa = placa_(datos.placa);
  const tipo = datos.tipo === 'MOTO' ? 'MOTO' : 'CARRO';

  return conBloqueo_(() => {
    const cliente = buscarCliente_(clienteId);
    const vehiculo = leer_('Vehiculos').find(v => String(v.placa) === placa);
    const campos = { usuario_id: cliente.id, marca: String(datos.marca || '').trim(), color: String(datos.color || '').trim() };
    if (vehiculo && vehiculo.usuario_id && vehiculo.usuario_id !== cliente.id) {
      throw new Error(`La placa ${placa} ya está asociada a otro cliente.`);
    }
    if (vehiculo) actualizar_('Vehiculos', vehiculo._fila, campos);
    else insertar_('Vehiculos', Object.assign({ placa, tipo }, campos));
    return { placa, existia: !!vehiculo };
  });
}

/** RF15: quita el dueño del vehículo, si no está dentro. El vehículo se conserva para el historial. */
function desasociarVehiculo(token, textoPlaca) {
  sesion_(token);
  const placa = placa_(textoPlaca);
  return conBloqueo_(() => {
    if (registroAbierto_(placa)) throw new Error(`${placa} está dentro del parqueadero. Registra su salida primero.`);
    const vehiculo = leer_('Vehiculos').find(v => String(v.placa) === placa);
    actualizar_('Vehiculos', vehiculo._fila, { usuario_id: '' });
    return { placa };
  });
}

// ----- CeldasService.js -----
/**
 * Iteración 2 – Gestión de celdas.
 */

function buscarCelda_(codigo) {
  const celda = leer_('Celdas').find(c => c.codigo === codigo);
  if (!celda) throw new Error(`La celda ${codigo} no existe.`);
  return celda;
}

/** RF17: registra una celda nueva con código único. */
function crearCelda(token, codigoTexto, tipoTexto) {
  sesion_(token, 'ADMIN');
  const codigo = String(codigoTexto || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!codigo) throw new Error('Escribe el código de la celda.');
  const tipo = tipoTexto === 'MOTO' ? 'MOTO' : 'CARRO';

  return conBloqueo_(() => {
    if (leer_('Celdas').some(c => c.codigo === codigo)) throw new Error(`Ya existe la celda ${codigo}.`);
    insertar_('Celdas', { codigo, tipo, estado: 'LIBRE' });
    return { codigo, tipo };
  });
}

/** RF19: cambia el tipo de una celda libre. */
function cambiarTipoCelda(token, codigo, tipoTexto) {
  sesion_(token, 'ADMIN');
  const tipo = tipoTexto === 'MOTO' ? 'MOTO' : 'CARRO';
  return conBloqueo_(() => {
    const celda = buscarCelda_(codigo);
    if (celda.estado === 'OCUPADA') throw new Error(`La celda ${codigo} está ocupada.`);
    actualizar_('Celdas', celda._fila, { tipo });
    return { codigo, tipo };
  });
}

/** RF20: inhabilita o habilita una celda que no esté ocupada. */
function cambiarEstadoCelda(token, codigo, habilitar) {
  sesion_(token, 'ADMIN');
  return conBloqueo_(() => {
    const celda = buscarCelda_(codigo);
    if (celda.estado === 'OCUPADA') throw new Error(`La celda ${codigo} está ocupada.`);
    const estado = habilitar ? 'LIBRE' : 'INHABILITADA';
    actualizar_('Celdas', celda._fila, { estado });
    return { codigo, estado };
  });
}

// ----- OperadoresService.js -----
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

// ----- Db.js -----
/**
 * Acceso a datos: cada hoja del Spreadsheet es una tabla y la fila 1 son los encabezados.
 */

const ESQUEMA = {
  Operadores:    ['id', 'usuario', 'nombre', 'rol', 'hash', 'salt', 'activo'],
  Usuarios:      ['id', 'documento', 'nombre', 'telefono', 'email', 'estado', 'fecha_registro'],
  Vehiculos:     ['placa', 'tipo', 'marca', 'color', 'usuario_id'],
  Mensualidades: ['id', 'usuario_id', 'fecha_inicio', 'fecha_fin', 'valor', 'estado'],
  Celdas:        ['codigo', 'tipo', 'estado'],
  Registros:     ['id', 'placa', 'celda', 'fecha_entrada', 'fecha_salida',
                  'operador_entrada', 'operador_salida', 'estado'],
  Novedades:     ['id', 'registro_id', 'placa', 'descripcion', 'fecha', 'operador']
};

const VERSION_ESQUEMA = '2';

/** Agrega a cada hoja las columnas nuevas del esquema (migración entre iteraciones). */
function migrarColumnas_(ss) {
  Object.keys(ESQUEMA).forEach(nombre => {
    const sh = ss.getSheetByName(nombre);
    const encabezados = sh.getDataRange().getValues()[0];
    ESQUEMA[nombre].forEach(col => {
      if (encabezados.indexOf(col) < 0) {
        encabezados.push(col);
        sh.getRange(1, encabezados.length).setValue(col).setFontWeight('bold');
      }
    });
  });
}

function hoja_(nombre) {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  return SpreadsheetApp.openById(id).getSheetByName(nombre);
}

/** Devuelve las filas como objetos; _fila guarda el número de fila real. */
function leer_(nombre) {
  const datos = hoja_(nombre).getDataRange().getValues();
  const encabezados = datos.shift() || [];
  return datos.map((fila, i) => {
    const obj = { _fila: i + 2 };
    encabezados.forEach((col, j) => { obj[col] = fila[j]; });
    return obj;
  });
}

/** Encabezados reales de la hoja (la escritura se hace por nombre de columna). */
function encabezados_(sh) {
  return sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
}

function insertar_(nombre, obj) {
  const sh = hoja_(nombre);
  sh.appendRow(encabezados_(sh).map(col => obj[col] ?? ''));
}

function insertarVarios_(nombre, objetos) {
  if (!objetos.length) return;
  const sh = hoja_(nombre), enc = encabezados_(sh);
  const filas = objetos.map(o => enc.map(col => o[col] ?? ''));
  sh.getRange(sh.getLastRow() + 1, 1, filas.length, enc.length).setValues(filas);
}

function actualizar_(nombre, fila, cambios) {
  const sh = hoja_(nombre), enc = encabezados_(sh);
  Object.keys(cambios).forEach(col => {
    const c = enc.indexOf(col) + 1;
    if (c > 0) sh.getRange(fila, c).setValue(cambios[col]);
  });
}

/** Empieza con letra para que Google Sheets no lo convierta en número. */
function nuevoId_() {
  return 'K' + Utilities.getUuid().replace(/-/g, '').slice(0, 9);
}

/** Evita que dos operadores tomen la misma celda al mismo tiempo. */
function conBloqueo_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const resultado = fn();
    SpreadsheetApp.flush();
    return resultado;
  } finally {
    lock.releaseLock();
  }
}

function fmt_(fecha) {
  return fecha ? Utilities.formatDate(new Date(fecha), 'America/Bogota', 'yyyy-MM-dd HH:mm') : '';
}
