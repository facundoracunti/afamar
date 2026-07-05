// Measurement entity type. Fields match backend API (snake_case).

export interface Measurement {
  id: number;
  client_name?: string;
  client_phone?: string;
  client_address?: string;
  scheduled_date?: string;
  scheduled_time?: string;
  status?: string;
  sketch_data?: string;
  photos_data?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
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
