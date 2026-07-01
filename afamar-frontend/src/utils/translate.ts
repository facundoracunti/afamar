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
  CREDIT_CARD: "Tarjeta de Crédito",
  DEBIT_CARD: "Tarjeta de Débito",
  BANK_TRANSFER: "Transf. Banco",
  CHECK: "Cheque",
  EXPENSE: "Gasto",
};

const t = (key: string): string => enToEsLabels[key] || key;

export { t, enToEsLabels };
