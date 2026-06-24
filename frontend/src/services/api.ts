export { default } from './apiClient';

export { getDashboard } from './dashboard';
export { getClientes, getCliente, createCliente, updateCliente, deleteCliente } from './clientes';
export {
  getPresupuestos, getPresupuestosUnificados, getPresupuesto,
  createPresupuesto, updatePresupuesto, deletePresupuesto,
  convertirAOrden, enviarPresupuestoWhatsApp, enviarPresupuestoEmail,
  getNextPresupuestoNumero, getPresupuestoPdf, convertirAlternativaAOrden,
} from './presupuestos';
export {
  getPresupuestosOnline, getPresupuestoOnline,
  createPresupuestoOnline, updatePresupuestoOnline, deletePresupuestoOnline,
  convertirOnlineAOrden,
} from './presupuestosOnline';
export {
  getOrdenes, getOrden, createOrden, updateOrden, deleteOrden,
  getNextNumero, getOrdenPdf,
} from './ordenes';
export {
  getMateriales, getMaterial, createMaterial, updateMaterial, deleteMaterial,
  getPriceHistory,
} from './materiales';
export {
  getPiletas, getPileta, createPileta, updatePileta, deletePileta,
  getMovimientos, createMovimiento,
} from './stockPiletas';
export {
  getMediciones, getMedicion, createMedicion, updateMedicion, deleteMedicion,
} from './mediciones';
export { getConfig, getConfigByKey, updateConfig, uploadLogo } from './configuracion';
export {
  getPresupuestosReport, getOrdenesReport, getMaterialesReport,
  getReportePresupuestos, getReporteOrdenes,
  getVentasMensuales, getMaterialesMasUsados,
} from './reportes';
export {
  getMovimientos as getMovimientosCaja, crearMovimiento as crearMovimientoCaja,
  createMovimientoCaja, actualizarMovimiento, eliminarMovimiento,
  deleteMovimientoCaja, getCajaDiaria, abrirCaja, cerrarCaja, putSaldoAnterior,
  getCajaHistorial,
} from './caja';
