import { describe, expect, it } from 'vitest';
import { buildAdditionalWorksRows } from './buildSectionData.rows';
import { adicRowCells } from '../../components/ui/PdfPreviewModal/components/TableRows';

describe('MITER_45 PDF presentation', () => {
  it('keeps the frozen amount and prints the height without changing meters', () => {
    const [row] = buildAdditionalWorksRows({
      additional_works_data: JSON.stringify([{
        name: 'Frente Ingletado 45°',
        type: 'frente',
        front_kind: 'MITER_45',
        front_height_cm: 15,
        linear_meters: 2.5,
        quantity: 1,
        price: 42.5,
        total: 106.25,
        currency: 'USD',
      }]),
    }, 1000);

    expect(row.front_height_cm).toBe(15);
    expect(row.linear_meters).toBe(2.5);
    expect(row.subtotal_usd).toBe(106.25);
    expect(adicRowCells(row)[1]).toContain('Altura: 15,00 cm');
  });
});
