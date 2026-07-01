export interface DashboardData {
  total_ordenes_activas: number;
  total_presupuestos: number;
  total_ordenes: number;
  total_ingresos: number;
  total_pendiente_cobro: number;
  ordenes_entregadas_mes: number;
  presupuestos_aprobados_mes: number;
  // Compatibilidad con el Dashboard actual
  ordenes_en_medicion: number;
  ordenes_en_taller: number;
  ordenes_terminadas: number;
  presupuestos_online: number;
}

export interface ReferenceItem {
  id: number;
  name: string;
  label: string;
  color: string | null;
  is_active: boolean;
  sort_order: number;
}
