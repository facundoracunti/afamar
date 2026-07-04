const DOLAR_API_URL = 'https://dolarapi.com/v1/dolares/oficial';

interface DolarApiResponse {
  moneda: string;
  casa: string;
  nombre: string;
  compra: number;
  venta: number;
  fechaActualizacion: string;
}

export async function fetchUsdVenta(): Promise<number> {
  const res = await fetch(DOLAR_API_URL);
  if (!res.ok) throw new Error(`Error HTTP ${res.status}`);
  const data: DolarApiResponse = await res.json();
  return data.venta;
}
