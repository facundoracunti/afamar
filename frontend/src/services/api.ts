export { default } from './apiClient';

export { getDashboard } from './dashboard';
export { getClientes, getCliente, createCliente, updateCliente, deleteCliente } from './clientes';
export {
  getPresupuestos, getPresupuestosUnificados, getPresupuesto,
  createPresupuesto, updatePresupuesto, deletePresupuesto,
  convertirAOrden, enviarPresupuestoEmail,
  getNextPresupuestoNumero, getPresupuestoPdf, convertirAlternativaAOrden,
} from './presupuestos';
export {
  getPresupuestosOnline, getPresupuestoOnline,
  createPresupuestoOnline, updatePresupuestoOnline, deletePresupuestoOnline,
  convertirOnlineAOrden, convertirOnlineAOrdenOpcion,
} from './presupuestosOnline';
export {
  getOrdenes, getOrden, createOrden, updateOrden, deleteOrden,
  getNextNumero, getOrdenPdf,
} from './ordenes';
export {
  getMateriales, getMaterial, createMaterial, updateMaterial, deleteMaterial,
  getPriceHistory, uploadMaterialFoto,
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
  getTrabajosRealizados, getTrabajoRealizado,
  createTrabajoRealizado, updateTrabajoRealizado, deleteTrabajoRealizado,
  uploadTrabajoFoto,
} from './trabajosRealizados';
export {
  getReportePresupuestos, getReporteOrdenes,
  getVentasMensuales, getMaterialesMasUsados,
} from './reportes';
export {
  crearMovimiento as crearMovimientoCaja,
  createMovimientoCaja, eliminarMovimiento,
  deleteMovimientoCaja, getCajaDiaria, cerrarCaja, putSaldoAnterior,
  getCajaHistorial,
} from './caja';
