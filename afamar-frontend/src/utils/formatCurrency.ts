export function formatARS(value: number): string {
  return `$ ${value.toFixed(2)}`;
}

export function formatUSD(value: number): string {
  if (value <= 0) return "-";
  return `US$ ${value.toFixed(2)}`;
}

export function formatBalance(due: number): string {
  return due > 0 ? `$ ${due.toFixed(2)}` : "Pagado";
}

export function formatDate(dateStr: string | Date): string {
  if (!dateStr) return '';
  const date = typeof dateStr === 'string' ? new Date(dateStr + 'T00:00:00') : new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}
