import http from '@/api/http';

export const getProductPhotos = (skip = 0, limit = 100) =>
  http.get('/product-photos', { params: { skip, limit } });

export const getLatestProductPhotos = (limit = 12) =>
  http.get('/product-photos/latest', { params: { limit } });

export const getProductPhoto = (id: number) =>
  http.get(`/product-photos/${id}`);

export const createProductPhoto = (formData: FormData) =>
  http.post('/product-photos', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

export const updateProductPhoto = (id: number, data: Record<string, unknown>) =>
  http.put(`/product-photos/${id}`, data);

export const deleteProductPhoto = (id: number) =>
  http.delete(`/product-photos/${id}`);
