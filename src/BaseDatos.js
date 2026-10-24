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
