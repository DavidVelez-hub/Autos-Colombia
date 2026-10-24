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
