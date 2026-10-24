// Simulación mínima de los servicios de Google Apps Script
const crypto = require('crypto');
function coercer(v) { // Sheets convierte textos que parecen números
  if (typeof v === 'string' && /^-?\d+(\.\d+)?(e[+-]?\d+)?$/i.test(v.trim())) return Number(v);
  return v;
}
function crearHoja(nombre) {
  const filas = [];
  const hoja = {
    nombre, filas,
    appendRow: r => { filas.push(r.map(coercer)); },
    getLastRow: () => filas.length,
    deleteRow: r => { filas.splice(r - 1, 1); },
    setFrozenRows: () => {},
    getDataRange: () => ({ getValues: () => filas.map(f => f.slice()) }),
    getRange: (r, c, nr = 1, nc = 1) => ({
      setFontWeight: () => {},
      setValue: v => { while (filas.length < r) filas.push([]); filas[r - 1][c - 1] = coercer(v); },
      setValues: vals => vals.forEach((fila, i) => { while (filas.length < r + i) filas.push([]); fila.forEach((v, j) => { filas[r - 1 + i][c - 1 + j] = coercer(v); }); })
    })
  };
  return hoja;
}
const libros = {};
function crearLibro(nombre) {
  const id = 'ss_' + Object.keys(libros).length;
  const hojas = [crearHoja('Hoja 1')];
  const ss = {
    getId: () => id, getUrl: () => 'https://docs.google.com/spreadsheets/d/' + id,
    getSheetByName: n => hojas.find(h => h.nombre === n) || null,
    insertSheet: n => { const h = crearHoja(n); hojas.push(h); return h; },
    deleteSheet: h => hojas.splice(hojas.indexOf(h), 1),
    getSheets: () => hojas, hojas
  };
  libros[id] = ss; return ss;
}
const props = {}, cache = {};
module.exports = {
  libros,
  SpreadsheetApp: { create: crearLibro, openById: id => libros[id], flush: () => {} },
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] ?? null, setProperty: (k, v) => { props[k] = v; } }) },
  CacheService: { getScriptCache: () => ({ get: k => cache[k] ?? null, put: (k, v) => { cache[k] = v; }, remove: k => { delete cache[k]; } }) },
  LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) },
  Utilities: {
    getUuid: () => crypto.randomUUID(),
    DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
    computeDigest: (alg, txt) => [...crypto.createHash(alg).update(txt, 'utf8').digest()].map(b => b > 127 ? b - 256 : b),
    formatDate: (d, tz) => {
      const p = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(d);
      const g = t => p.find(x => x.type === t).value;
      return `${g('year')}-${g('month')}-${g('day')} ${g('hour') === '24' ? '00' : g('hour')}:${g('minute')}`;
    }
  },
  Logger: { log: () => {} },
  HtmlService: {}
};
