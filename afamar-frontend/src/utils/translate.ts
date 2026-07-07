const enToEsLabels: Record<string, string> = {
  PENDING: "Pendiente",
  ONLINE: "Online",
  APPROVED: "Aprobado",
  REJECTED: "Rechazado",
  CONVERTED_TO_OT: "Convertido a OT",
  MEASUREMENT: "Medición",
  WORKSHOP: "Taller",
  FINISHED: "Terminado",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
  DONE: "Realizado",
  LOW: "Baja",
  NORMAL: "Normal",
  HIGH: "Alta",
  URGENT: "Urgente",
  CASH: "Efectivo",
  TRANSFER: "Transferencia",
  CREDIT_CARD: "Tarjeta de Crédito",
  DEBIT_CARD: "Tarjeta de Débito",
  CHECK: "Cheque",
  MIXED: "Mixto",
  BANK_TRANSFER: "Transf. Banco",
  INCOME: "Ingreso",
  EXPENSE: "Egreso",

  // Pool stock movement types (English values emitted by the backend's
  // auto-generated movements in `deduct_pool_stock` /
  // `restore_pool_stock` / `budget.py:delete` etc.). Manual entries from
  // the form already send Spanish ("Ingreso"/"Egreso") so the map is a
  // no-op for them, but it normalises the historical values the user
  // sees in the history table.
  entry: "Ingreso",
  exit: "Egreso",

  // Fabrication concepts (used by the fabrication details table on
  // budget / work-order forms and by the PDF preview).
  LENGTH: "Largo",
  BASEBOARD: "Zócalo",
  FRONT: "Frente",
  CUTOUT_SINK: "Traforo de pileta",
  CUTOUT_COOKTOP: "Traforo de anafe",
  CUTOUT_DROPIN_SINK: "Traforo de pileta de apoyo",
  OTHER: "Otra",
};

const t = (key: string): string => enToEsLabels[key] || key;

export { t, enToEsLabels };