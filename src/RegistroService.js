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
