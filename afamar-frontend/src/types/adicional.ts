/** CRUD item for the `adicionales` catalogue. Wire format mirrors
 *  the backend Pydantic schema (currency is a string code; the service
 *  layer translates to `currency_id` FK on save). */
export interface Adicional {
  id: number;
  name: string;
  detail: string | null;
  price: number;
  currency: 'ARS' | 'USD';
  created_at?: string;
  updated_at?: string;
}
