// ===== Autos Colombia – Iteración 1 =====

// ----- Code.js -----
/**
 * Entrada web e instalación.
 */

function doGet() {
  if (!PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID')) setup();
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Autos Colombia – Parqueadero')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/** Crea el Spreadsheet con sus hojas, las celdas y los operadores iniciales. */
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
    const celda = leer_('Celdas').find(c => c.tipo === tipo && c.estado === 'LIBRE');
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
  const abiertos = {};
  leer_('Registros').filter(r => r.estado === 'ABIERTO').forEach(r => { abiertos[r.celda] = r; });
  return leer_('Celdas').map(c => {
    const r = abiertos[c.codigo];
    return { codigo: c.codigo, tipo: c.tipo, estado: c.estado,
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

// ----- Db.js -----
/**
 * Acceso a datos: cada hoja del Spreadsheet es una tabla y la fila 1 son los encabezados.
 */

const ESQUEMA = {
  Operadores:    ['id', 'usuario', 'nombre', 'rol', 'hash', 'salt', 'activo'],
  Usuarios:      ['id', 'documento', 'nombre', 'telefono', 'email'],
  Vehiculos:     ['placa', 'tipo', 'marca', 'color', 'usuario_id'],
  Mensualidades: ['id', 'usuario_id', 'fecha_inicio', 'fecha_fin', 'valor', 'estado'],
  Celdas:        ['codigo', 'tipo', 'estado'],
  Registros:     ['id', 'placa', 'celda', 'fecha_entrada', 'fecha_salida',
                  'operador_entrada', 'operador_salida', 'estado'],
  Novedades:     ['id', 'registro_id', 'placa', 'descripcion', 'fecha', 'operador']
};

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

function insertar_(nombre, obj) {
  hoja_(nombre).appendRow(ESQUEMA[nombre].map(col => obj[col] ?? ''));
}

function insertarVarios_(nombre, objetos) {
  const filas = objetos.map(o => ESQUEMA[nombre].map(col => o[col] ?? ''));
  const sh = hoja_(nombre);
  sh.getRange(sh.getLastRow() + 1, 1, filas.length, filas[0].length).setValues(filas);
}

function actualizar_(nombre, fila, cambios) {
  const sh = hoja_(nombre);
  Object.keys(cambios).forEach(col => {
    sh.getRange(fila, ESQUEMA[nombre].indexOf(col) + 1).setValue(cambios[col]);
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
