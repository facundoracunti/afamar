// Cash entity type. English field names matching backend API.

export interface CashMovement {
  id: number;
  workOrderId?: number;
  type: string;
  amount: number;
  paymentMethod?: string;
  remainingBalance?: number;
  observations?: string;
  createdAt?: string;
}
