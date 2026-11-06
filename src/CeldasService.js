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
