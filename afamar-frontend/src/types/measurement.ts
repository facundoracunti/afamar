// Measurement entity type. Fields match backend API (snake_case).

export interface Measurement {
  id: number;
  client_id?: number | null;
  client_name?: string | null;
  client_phone?: string | null;
  client_email?: string | null;
  client_address?: string | null;
  scheduled_date?: string;
  scheduled_time?: string;
  status?: string;
  sketch_data?: string;
  photos_data?: string;
  notes?: string;
  work_order_id?: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface MeasurementFormData {
  clientId: number | null;
  scheduledDate: string;
  scheduledTime: string;
  observations: string;
  sketch: unknown[];
  photos: string[];
  status: string;
  workOrderId?: number | '';
}