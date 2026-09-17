import { describe, expect, it } from 'vitest';
import {
  isIntegratedSinkWork,
  materialAllowsIntegratedSink,
} from './integratedSink';
import { POOL_MATERIAL_GLOBAL, type MaterialInForm } from '../types/budget';

function mat(name: string, allows?: boolean): MaterialInForm {
  return {
    id: 1,
    name,
    category: '',
    color: '',
    price_m2: 0,
    price_m2_usd: 0,
    currency: 'ARS',
    quantity: 1,
    m2_used: 0,
    m2_budgeted: 0,
    length: 0,
    width: 0,
    is_alternative: false,
    ...(allows === undefined ? {} : { allows_integrated_sink: allows }),
  };
}

describe('isIntegratedSinkWork', () => {
  it('matches the seeded "Bacha Integrada" name (case/space insensitive)', () => {
    expect(isIntegratedSinkWork('Bacha Integrada')).toBe(true);
    expect(isIntegratedSinkWork('BACHA INTEGRADA')).toBe(true);
    expect(isIntegratedSinkWork('bacha integrada 45°')).toBe(true);
  });

  it('does not match unrelated additional works', () => {
    expect(isIntegratedSinkWork('Bacha de Apoyo')).toBe(false);
    expect(isIntegratedSinkWork('Traforo de Anafe')).toBe(false);
    expect(isIntegratedSinkWork(null)).toBe(false);
    expect(isIntegratedSinkWork(undefined)).toBe(false);
  });
});

describe('materialAllowsIntegratedSink', () => {
  const materials = [mat('DALLAS', false), mat('NEGRO BRASIL', true), mat('SIN FLAG')];

  it('returns false when the assigned material forbids the sink', () => {
    expect(materialAllowsIntegratedSink('DALLAS', materials)).toBe(false);
  });

  it('returns true when the assigned material allows it', () => {
    expect(materialAllowsIntegratedSink('NEGRO BRASIL', materials)).toBe(true);
  });

  it('strips the __ALT__: prefix before the lookup', () => {
    expect(materialAllowsIntegratedSink('__ALT__:DALLAS', materials)).toBe(false);
    expect(materialAllowsIntegratedSink('__ALT__:NEGRO BRASIL', materials)).toBe(true);
  });

  it('defaults to true for global / empty / missing materials (optimistic)', () => {
    expect(materialAllowsIntegratedSink(POOL_MATERIAL_GLOBAL, materials)).toBe(true);
    expect(materialAllowsIntegratedSink(null, materials)).toBe(true);
    expect(materialAllowsIntegratedSink('', materials)).toBe(true);
    expect(materialAllowsIntegratedSink('MATERIAL QUE NO ESTA', materials)).toBe(true);
  });

  it('defaults to true for rows without the flag (legacy)', () => {
    expect(materialAllowsIntegratedSink('SIN FLAG', materials)).toBe(true);
  });
});
