/**
 * Generic CRUD resource factory.
 *
 * Produces the 5 standard REST helpers (`list`, `get`, `create`, `update`,
 * `delete`) for a given collection. Use this when the resource follows the
 * regular `GET/POST/PUT/DELETE /<name>` shape — specialised endpoints
 * (`/search`, `/next-number`, `/latest`, `/{id}/movements`, etc.) and
 * payloads that need reshaping still belong in the per-resource file
 * alongside the factory export.
 *
 * Each helper returns the raw `AxiosResponse<T>` — callers that want the
 * unwrapped `data` field can either destructure `.data` directly or wrap
 * the helper in a domain-specific `getX()` function that pre-unwraps
 * (see `additionalWorks.ts` for the pattern).
 */
import type { AxiosResponse } from 'axios';
import http from '../http';

export interface Resource<T, CreatePayload = Partial<T>, UpdatePayload = Partial<T>> {
  list: (params?: Record<string, unknown>) => Promise<AxiosResponse<T[]>>;
  get: (id: number | string) => Promise<AxiosResponse<T>>;
  create: (data: CreatePayload) => Promise<AxiosResponse<T>>;
  update: (id: number | string, data: UpdatePayload) => Promise<AxiosResponse<T>>;
  delete: (id: number | string) => Promise<AxiosResponse<void>>;
}

export function createResource<T = unknown, CreatePayload = Partial<T>, UpdatePayload = Partial<T>>(
  name: string,
): Resource<T, CreatePayload, UpdatePayload> {
  return {
    list: (params?: Record<string, unknown>) =>
      http.get<T[]>(`/${name}`, { params }) as Promise<AxiosResponse<T[]>>,
    get: (id: number | string) =>
      http.get<T>(`/${name}/${id}`) as Promise<AxiosResponse<T>>,
    create: (data: CreatePayload) =>
      http.post<T>(`/${name}`, data) as Promise<AxiosResponse<T>>,
    update: (id: number | string, data: UpdatePayload) =>
      http.put<T>(`/${name}/${id}`, data) as Promise<AxiosResponse<T>>,
    delete: (id: number | string) =>
      http.delete<void>(`/${name}/${id}`) as Promise<AxiosResponse<void>>,
  };
}