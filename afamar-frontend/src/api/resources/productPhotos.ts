import http from '@/api/http';
import { createResource } from './createResource';

const productPhotos = createResource('product-photos');

export const getProductPhotos = (skip = 0, limit = 100) =>
  productPhotos.list({ skip, limit });

export const getProductPhoto = (id: number) => productPhotos.get(id);

// Multipart upload — uses the raw `http.post` because `createResource`
// only handles JSON bodies. Keep the helper alongside the rest so the
// resource shape stays in one place.
export const createProductPhoto = (formData: FormData) =>
  http.post('/product-photos', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

export const updateProductPhoto = (id: number, data: Record<string, unknown>) =>
  productPhotos.update(id, data);

export const deleteProductPhoto = (id: number) =>
  productPhotos.delete(id);

// Specialised endpoint.
export const getLatestProductPhotos = (limit = 12) =>
  http.get('/product-photos/latest', { params: { limit } });