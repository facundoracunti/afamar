// Measurement entity type. Field names are kept in Spanish to
// match the form layer (MeasurementFormPage.tsx). See client.ts
// header for the rename tracking note.

export interface Measurement {
  id: number;
  cliente_nombre?: string;
  cliente_telefono?: string;
  cliente_direccion?: string;
  fecha_programada?: string;
  hora_programada?: string;
  estado?: string;
  fotos?: string[];
  croquis?: unknown[];
  observaciones?: string;
  created_at?: string;
  updated_at?: string;
}

export interface MeasurementFormData {
  cliente_nombre: string;
  cliente_telefono: string;
  cliente_direccion: string;
  fecha_programada: string;
  hora_programada: string;
  observaciones: string;
  croquis: unknown[];
  fotos: string[];
  estado: string;
}
