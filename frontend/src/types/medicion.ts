export interface Medicion {
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

export interface MedicionFormData {
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
