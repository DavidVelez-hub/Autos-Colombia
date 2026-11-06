// Pruebas automáticas del servidor (se ejecutan con Node.js sobre una simulación de Google Apps Script)
const vm = require('vm'), fs = require('fs');
const mock = require('./gas_mock');
const ctx = vm.createContext({ ...mock, console, Date, Math, JSON, Object, String, Number, Error, Intl });
vm.runInContext(fs.readFileSync(process.argv[2] || 'Codigo.gs', 'utf8'), ctx);
const g = ctx, leer = n => vm.runInContext('leer_', ctx)(n);
let ok = 0, mal = 0;
const prueba = (n, fn) => { try { fn(); ok++; console.log('  ✔ ' + n); } catch (e) { mal++; console.log('  ✘ ' + n + ' → ' + e.message); } };
const igual = (a, b) => { if (a !== b) throw new Error(`esperado ${JSON.stringify(b)}, obtenido ${JSON.stringify(a)}`); };
const falla = (fn, t) => { try { fn(); } catch (e) { if (!e.message.includes(t)) throw new Error('mensaje: ' + e.message); return; } throw new Error('no falló'); };

g.setup();
prueba('setup crea 7 hojas, 30 celdas y 2 operadores, sin datos de ejemplo', () => {
  igual(leer('Celdas').length, 30); igual(leer('Operadores').length, 2); igual(leer('Vehiculos').length, 0);
});
let admin, oper;
prueba('inicio de sesión de admin y operador', () => { admin = g.iniciarSesion('admin', 'Admin123*'); oper = g.iniciarSesion('operador', 'Operador123*'); });
prueba('contraseña incorrecta se rechaza', () => falla(() => g.iniciarSesion('admin', 'x'), 'incorrectos'));
prueba('token inválido se rechaza', () => falla(() => g.obtenerOcupacion('x'), 'sesión terminó'));
const t = () => oper.token;
prueba('carro nuevo entra a C01 y queda registrado', () => { const r = g.registrarEntrada(t(), 'awe-340', 'CARRO'); igual(r.celda, 'C01'); igual(r.nuevo, true); igual(leer('Vehiculos')[0].tipo, 'CARRO'); });
prueba('moto nueva entra a M01', () => igual(g.registrarEntrada(t(), 'QWE12R', 'MOTO').celda, 'M01'));
prueba('cualquier placa sirve (también solo números)', () => igual(g.registrarEntrada(t(), '123456', 'CARRO').celda, 'C02'));
prueba('placa vacía se rechaza', () => falla(() => g.registrarEntrada(t(), '  ', 'CARRO'), 'Escribe la placa'));
prueba('doble ingreso se rechaza', () => falla(() => g.registrarEntrada(t(), 'AWE340', 'CARRO'), 'ya está dentro'));
prueba('ocupación muestra AWE340 en C01', () => igual(g.obtenerOcupacion(t()).find(c => c.codigo === 'C01').placa, 'AWE340'));
prueba('novedad para un vehículo dentro', () => igual(g.registrarNovedad(t(), 'AWE340', 'Rayón').placa, 'AWE340'));
prueba('novedad vacía se rechaza', () => falla(() => g.registrarNovedad(t(), 'AWE340', ' '), 'Describe'));
prueba('salida de AWE340 libera C01', () => { igual(g.registrarSalida(t(), 'AWE340').celda, 'C01'); igual(leer('Celdas')[0].estado, 'LIBRE'); });
prueba('salida sin entrada se rechaza', () => falla(() => g.registrarSalida(t(), 'AWE340'), 'no tiene una entrada'));
prueba('al volver, AWE340 usa su tipo registrado aunque se elija moto', () => igual(g.registrarEntrada(t(), 'AWE340', 'MOTO').celda, 'C01'));
prueba('un vehículo conocido no se duplica', () => igual(leer('Vehiculos').filter(v => v.placa === 'AWE340').length, 1));
prueba('sin celdas libres, la entrada se rechaza', () => {
  const f = mock.libros[Object.keys(mock.libros)[0]].getSheetByName('Celdas').filas;
  f.forEach((x, i) => { if (i && x[1] === 'MOTO') x[2] = 'OCUPADA'; });
  falla(() => g.registrarEntrada(t(), 'ZZZ99Z', 'MOTO'), 'No hay celdas libres para motos');
  igual(leer('Vehiculos').some(v => v.placa === 'ZZZ99Z'), false);
});
prueba('historial del administrador con filtro de placa', () => igual(g.consultarHistorial(admin.token, { placa: 'AWE340' }).length, 2));
prueba('el operador no ve el historial', () => falla(() => g.consultarHistorial(t(), {}), 'solo para el administrador'));
prueba('cerrar sesión invalida el token', () => { g.cerrarSesion(t()); falla(() => g.obtenerOcupacion(t()), 'sesión terminó'); });
console.log(`\nResultado: ${ok} correctas, ${mal} fallidas`);
process.exit(mal ? 1 : 0);
