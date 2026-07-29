export function parseApiError(err: unknown, fallback = 'Error inesperado'): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
  return detail ?? fallback;
}
