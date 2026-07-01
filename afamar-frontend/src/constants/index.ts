// Currencies
export const CURRENCIES = {
  ARS: "ARS",
  USD: "USD",
} as const;

// Cash movement types
export const MOVEMENT_TYPES = {
  INCOME: "INCOME",
  EXPENSE: "EXPENSE",
} as const;

// Measurement statuses
export const MEASUREMENT_STATUSES = {
  PENDING: "PENDING",
  DONE: "DONE",
  CANCELLED: "CANCELLED",
} as const;

// Status colors for badges
export const STATUS_COLORS: Record<string, string> = {
  PENDING: "#f59e0b",
  ONLINE: "#3b82f6",
  APPROVED: "#22c55e",
  REJECTED: "#ef4444",
  CONVERTED_TO_OT: "#8b5cf6",
  MEASUREMENT: "#f59e0b",
  WORKSHOP: "#3b82f6",
  FINISHED: "#22c55e",
  DELIVERED: "#06b6d4",
  CANCELLED: "#ef4444",
} as const;

// Priority colors
export const PRIORITY_COLORS: Record<string, string> = {
  LOW: "#22c55e",
  NORMAL: "#3b82f6",
  HIGH: "#f59e0b",
  URGENT: "#ef4444",
} as const;
