export interface ProductPhoto {
  id: number;
  file_path: string;
  title: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateProductPhotoData {
  title?: string;
  description?: string;
}