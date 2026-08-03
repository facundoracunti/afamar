import { describe, expect, it } from 'vitest';
import {
  PORCELAIN_CUT_SERVICE,
  buildPorcelainFabricationDetail,
  calculatePorcelainCut,
  formatPorcelainPlateCm,
} from './porcelainCalculator';

describe('calculatePorcelainCut', () => {
  it('aplica la pérdida por espesor del disco: 600/100/3 → 5 cortes (no 6)', () => {
    const r = calculatePorcelainCut({
      largoM: 1.2,
      anchoM: 0.6,
      cajas: 2,
      piezasPorCaja: 4,
      alturaM: 0.1,
      discoMm: 3,
      precioPorMl: 5000,
    });
    expect(r.placas).toBe(8);
    expect(r.cortesPorPlaca).toBe(5);
    expect(r.cortesTotal).toBe(40);
    expect(r.ml).toBe(48);
    expect(r.total).toBe(240000);
  });

  it('sin disco (0 mm) cae en la división pura: 600/100 → 6', () => {
    const r = calculatePorcelainCut({
      largoM: 1.2,
      anchoM: 0.6,
      cajas: 1,
      piezasPorCaja: 1,
      alturaM: 0.1,
      discoMm: 0,
      precioPorMl: 1000,
    });
    expect(r.cortesPorPlaca).toBe(6);
    expect(r.cortesTotal).toBe(6);
    expect(r.ml).toBe(7.2);
  });

  it('el ancho justo se pierde por el kerf: 500/100/3 → 4 (500+3)/(103)=4.88 → 4', () => {
    const r = calculatePorcelainCut({
      largoM: 1,
      anchoM: 0.5,
      cajas: 1,
      piezasPorCaja: 1,
      alturaM: 0.1,
      discoMm: 3,
      precioPorMl: 0,
    });
    expect(r.cortesPorPlaca).toBe(4);
  });

  it('ancho menor a la altura solicitada → 0 cortes', () => {
    const r = calculatePorcelainCut({
      largoM: 1,
      anchoM: 0.05,
      cajas: 2,
      piezasPorCaja: 3,
      alturaM: 0.1,
      discoMm: 3,
      precioPorMl: 100,
    });
    expect(r.cortesPorPlaca).toBe(0);
    expect(r.cortesTotal).toBe(0);
    expect(r.ml).toBe(0);
    expect(r.total).toBe(0);
  });

  it('cajas o piezas por caja en 0 → placas 0 y totales 0', () => {
    const r = calculatePorcelainCut({
      largoM: 1.2,
      anchoM: 0.6,
      cajas: 0,
      piezasPorCaja: 4,
      alturaM: 0.1,
      discoMm: 3,
      precioPorMl: 5000,
    });
    expect(r.placas).toBe(0);
    expect(r.cortesTotal).toBe(0);
    expect(r.ml).toBe(0);
    expect(r.total).toBe(0);
  });

  it('valores decimales se redondean a 2 dígitos en ML y total', () => {
    const r = calculatePorcelainCut({
      largoM: 1.23,
      anchoM: 0.6,
      cajas: 1,
      piezasPorCaja: 2,
      alturaM: 0.1,
      discoMm: 3,
      precioPorMl: 3.3333,
    });
    expect(r.ml).toBeCloseTo(12.3);
    expect(r.total).toBeCloseTo(41);
  });

  it('altura final informativa = altura solicitada − espesor del disco', () => {
    const r = calculatePorcelainCut({
      largoM: 1.2,
      anchoM: 0.6,
      cajas: 1,
      piezasPorCaja: 1,
      alturaM: 0.1,
      discoMm: 3,
      precioPorMl: 0,
    });
    expect(r.alturaFinalM).toBeCloseTo(0.097);
  });
});

describe('formatPorcelainPlateCm', () => {
  it('convierte metros a centímetros sin decimales', () => {
    expect(formatPorcelainPlateCm(1.2, 0.6)).toBe('120x60');
    expect(formatPorcelainPlateCm(1.8, 0.6)).toBe('180x60');
  });
});

describe('buildPorcelainFabricationDetail', () => {
  it('arma el ítem OTHER con custom_concept, descripción y precios', () => {
    const d = buildPorcelainFabricationDetail(
      {
        largoM: 1.2,
        anchoM: 0.6,
        cajas: 2,
        piezasPorCaja: 4,
        alturaM: 0.1,
        discoMm: 3,
        precioPorMl: 5000,
      },
      'ARS',
    );
    expect(d.concept).toBe('OTHER');
    expect(d.custom_concept).toBe(PORCELAIN_CUT_SERVICE);
    expect(d.detail).toBe('120x60 · 8 placas · Altura solicitada 10 cm · Producción 48.00 ML');
    expect(d.length).toBe(48);
    expect(d.labor).toBe(5000);
    expect(d.currency).toBe('ARS');
    expect(d.quantity).toBe(1);
    expect(d.price).toBe(240000);
    expect(d.m2).toBe(0);
    expect(d.width).toBeNull();
  });

  it('respeta la moneda pasada (USD)', () => {
    const d = buildPorcelainFabricationDetail(
      {
        largoM: 1.2,
        anchoM: 0.6,
        cajas: 1,
        piezasPorCaja: 1,
        alturaM: 0.1,
        discoMm: 3,
        precioPorMl: 10,
      },
      'USD',
    );
    expect(d.currency).toBe('USD');
    expect(d.price).toBeCloseTo(60);
  });
});
