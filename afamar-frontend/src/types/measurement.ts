// Measurement entity type. English field names matching backend API.

export interface Measurement {
  id: number;
  clientName?: string;
  clientPhone?: string;
  clientAddress?: string;
  scheduledDate?: string;
  scheduledTime?: string;
  status?: string;
  photos?: string[];
  croquis?: unknown[];
  observations?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface MeasurementFormData {
  clientName: string;
  clientPhone: string;
  clientAddress: string;
  scheduledDate: string;
  scheduledTime: string;
  observations: string;
  croquis: unknown[];
  photos: string[];
  status: string;
}
