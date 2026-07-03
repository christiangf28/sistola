// Fecha local YYYY-MM-DD (no UTC): evita que registros nocturnos cuenten como el día siguiente
export function localDateStr(d: Date | string = new Date()): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
