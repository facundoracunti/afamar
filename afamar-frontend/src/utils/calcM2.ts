export function calcM2(largo: number, ancho: number): number {
  return Math.round(largo * ancho * 100000) / 100000;
}
