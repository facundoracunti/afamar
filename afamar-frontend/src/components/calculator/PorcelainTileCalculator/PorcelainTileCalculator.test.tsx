import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import PorcelainTileCalculator from './PorcelainTileCalculator';

describe('PorcelainTileCalculator', () => {
  it('accepts millimetre precision for the requested baseboard height', () => {
    render(<PorcelainTileCalculator currency="ARS" onAddDetail={vi.fn()} />);

    const altura = screen.getByLabelText('Altura solicitada zócalo (m)') as HTMLInputElement;
    expect(altura.getAttribute('step')).toBe('0.001');

    fireEvent.change(screen.getByLabelText('Largo porcelanato (m)'), { target: { value: '0.8' } });
    fireEvent.change(screen.getByLabelText('Ancho porcelanato (m)'), { target: { value: '0.8' } });
    fireEvent.change(screen.getByLabelText('Cantidad de cajas'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Piezas por caja'), { target: { value: '6' } });
    fireEvent.change(altura, { target: { value: '0.075' } });
    fireEvent.change(screen.getByLabelText('Precio por ML ($)'), { target: { value: '5000' } });
    fireEvent.click(screen.getByRole('button', { name: /calcular/i }));

    expect(screen.getByText(/solicitada 7\.5 cm/)).toBeDefined();
  });
});
