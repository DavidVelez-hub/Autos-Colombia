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
