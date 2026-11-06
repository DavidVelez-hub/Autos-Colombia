// Pruebas automáticas de la iteración 2: usuarios, vehículos, operadores y celdas
const vm = require('vm'), fs = require('fs');
const mock = require('./gas_mock');
const ctx = vm.createContext({ ...mock, console, Date, Math, JSON, Object, String, Number, Error, Intl });
vm.runInContext(fs.readFileSync(process.argv[2] || 'Codigo.gs', 'utf8'), ctx);
const g = ctx, leer = n => vm.runInContext('leer_', ctx)(n);
let ok = 0, mal = 0;
const prueba = (n, fn) => { try { fn(); ok++; console.log('  ✔ ' + n); } catch (e) { mal++; console.log('  ✘ ' + n + ' → ' + e.message); } };
const igual = (a, b) => { if (a !== b) throw new Error(`esperado ${JSON.stringify(b)}, obtenido ${JSON.stringify(a)}`); };
const falla = (fn, t) => { try { fn(); } catch (e) { if (!e.message.includes(t)) throw new Error('mensaje: ' + e.message); return; } throw new Error('no falló'); };

console.log('\nMigración desde la iteración 1');
prueba('una base de la iteración 1 recibe las columnas nuevas sin perder datos', () => {
  const ss = mock.SpreadsheetApp.create('vieja');
  mock.PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', ss.getId());
  const u = ss.insertSheet('Usuarios'); u.appendRow(['id', 'documento', 'nombre', 'telefono', 'email']); u.appendRow(['U001', '123', 'Laura', '300', 'l@x.co']);
  g.setup();
  igual(ss.getSheetByName('Usuarios').filas[0].join(','), 'id,documento,nombre,telefono,email,estado,fecha_registro');
  igual(leer('Usuarios')[0].nombre, 'Laura');
});
const admin = g.iniciarSesion('admin', 'Admin123*').token, oper = g.iniciarSesion('operador', 'Operador123*').token;

console.log('\nHU07–HU10 · Clientes');
let id;
prueba('el operador registra un cliente y queda ACTIVO', () => { id = g.guardarCliente(oper, { documento: '1.098.765.432', nombre: 'David Pérez', telefono: '3001234567' }).id; igual(g.listarClientes(oper).find(c => c.id === id).estado, 'ACTIVO'); });
prueba('documento repetido se rechaza', () => falla(() => g.guardarCliente(oper, { documento: '1098765432', nombre: 'Otro' }), 'ya pertenece'));
prueba('documento o nombre vacíos se rechazan', () => falla(() => g.guardarCliente(oper, { documento: '', nombre: 'X' }), 'obligatorios'));
prueba('actualizar el cliente conserva su documento', () => { g.guardarCliente(oper, { id, documento: '1098765432', nombre: 'David Pérez Ruiz' }); igual(g.listarClientes(oper).find(c => c.id === id).nombre, 'David Pérez Ruiz'); });
prueba('un cliente heredado sin estado se muestra ACTIVO', () => igual(g.listarClientes(oper).find(c => c.id === 'U001').estado, 'ACTIVO'));
prueba('el operador no puede inactivar clientes', () => falla(() => g.cambiarEstadoCliente(oper, id, false), 'solo para el administrador'));
prueba('el administrador inactiva y reactiva al cliente', () => { g.cambiarEstadoCliente(admin, id, false); igual(g.listarClientes(admin).find(c => c.id === id).estado, 'INACTIVO'); g.cambiarEstadoCliente(admin, id, true); });

console.log('\nHU11 · Vehículos');
prueba('asociar un vehículo nuevo', () => { g.asociarVehiculo(oper, id, { placa: 'awe-340', tipo: 'CARRO', marca: 'Kia' }); igual(g.listarClientes(oper).find(c => c.id === id).vehiculos[0].placa, 'AWE340'); });
prueba('un vehículo que entró sin dueño se asocia al cliente', () => {
  g.registrarEntrada(oper, 'SIN001', 'CARRO'); g.registrarSalida(oper, 'SIN001');
  igual(g.asociarVehiculo(oper, id, { placa: 'SIN001' }).existia, true);
  igual(leer('Vehiculos').filter(v => v.placa === 'SIN001').length, 1);
});
prueba('la placa de otro cliente se rechaza', () => falla(() => g.asociarVehiculo(oper, 'U001', { placa: 'AWE340' }), 'otro cliente'));
prueba('no se desasocia un vehículo que está dentro', () => { g.registrarEntrada(oper, 'AWE340'); falla(() => g.desasociarVehiculo(oper, 'AWE340'), 'está dentro'); g.registrarSalida(oper, 'AWE340'); });
prueba('desasociar conserva el vehículo para el historial', () => { g.desasociarVehiculo(oper, 'SIN001'); const v = leer('Vehiculos').find(v => v.placa === 'SIN001'); igual(v.usuario_id, ''); });

console.log('\nHU12 · Operadores');
let nuevo;
prueba('el administrador crea un operador que puede iniciar sesión', () => { g.guardarOperador(admin, { usuario: 'Ana', nombre: 'Ana Ruiz', rol: 'OPERADOR', clave: 'Ana2026*' }); igual(g.iniciarSesion('ana', 'Ana2026*').rol, 'OPERADOR'); nuevo = g.listarOperadores(admin).find(o => o.usuario === 'ana'); });
prueba('usuario repetido se rechaza', () => falla(() => g.guardarOperador(admin, { usuario: 'ANA', nombre: 'Otra', clave: 'x' }), 'ya existe'));
prueba('operador sin contraseña se rechaza', () => falla(() => g.guardarOperador(admin, { usuario: 'luis', nombre: 'Luis' }), 'contraseña'));
prueba('un operador desactivado no puede iniciar sesión', () => { g.cambiarEstadoOperador(admin, nuevo.id, false); falla(() => g.iniciarSesion('ana', 'Ana2026*'), 'incorrectos'); g.cambiarEstadoOperador(admin, nuevo.id, true); });
prueba('restablecer la contraseña cambia el acceso', () => { g.restablecerClave(admin, nuevo.id, 'Nueva123*'); g.iniciarSesion('ana', 'Nueva123*'); falla(() => g.iniciarSesion('ana', 'Ana2026*'), 'incorrectos'); });
prueba('el administrador no puede desactivarse a sí mismo', () => { const yo = g.listarOperadores(admin).find(o => o.usuario === 'admin'); falla(() => g.cambiarEstadoOperador(admin, yo.id, false), 'propio usuario'); });
prueba('el operador no ve la gestión de operadores', () => falla(() => g.listarOperadores(oper), 'solo para el administrador'));

console.log('\nHU13–HU15 · Celdas');
prueba('crear la celda C21', () => { g.crearCelda(admin, 'c-21', 'CARRO'); igual(leer('Celdas').some(c => c.codigo === 'C21'), true); });
prueba('código repetido se rechaza', () => falla(() => g.crearCelda(admin, 'C21', 'CARRO'), 'Ya existe'));
prueba('cambiar el tipo de una celda libre', () => { g.cambiarTipoCelda(admin, 'C21', 'MOTO'); igual(leer('Celdas').find(c => c.codigo === 'C21').tipo, 'MOTO'); });
prueba('no se modifica una celda ocupada', () => { g.registrarEntrada(oper, 'OCU001', 'CARRO'); falla(() => g.cambiarTipoCelda(admin, 'C01', 'MOTO'), 'ocupada'); falla(() => g.cambiarEstadoCelda(admin, 'C01', false), 'ocupada'); g.registrarSalida(oper, 'OCU001'); });
prueba('una celda inhabilitada no se asigna en la entrada', () => { g.cambiarEstadoCelda(admin, 'C01', false); igual(g.registrarEntrada(oper, 'INH001', 'CARRO').celda, 'C02'); g.registrarSalida(oper, 'INH001'); });
prueba('la ocupación muestra la celda INHABILITADA y en orden', () => { const o = g.obtenerOcupacion(oper); igual(o.find(c => c.codigo === 'C01').estado, 'INHABILITADA'); igual(o[0].codigo, 'C01'); });
prueba('habilitar la celda la deja LIBRE', () => { g.cambiarEstadoCelda(admin, 'C01', true); igual(leer('Celdas').find(c => c.codigo === 'C01').estado, 'LIBRE'); });
prueba('el operador no puede crear celdas', () => falla(() => g.crearCelda(oper, 'C99', 'CARRO'), 'solo para el administrador'));

console.log(`\nResultado: ${ok} correctas, ${mal} fallidas`);
process.exit(mal ? 1 : 0);
