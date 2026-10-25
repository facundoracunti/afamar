import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import CalculatorPage from './CalculatorPage';

function numberInputs(): HTMLInputElement[] {
  return Array.from(document.querySelectorAll('input[type="number"]')) as HTMLInputElement[];
}

function plateTotalText(): string {
  return document.querySelector('[class*="plateTotal"]')?.textContent ?? '';
}

function fillPiece({ nombre = '', largo, ancho, cantidad = '1' }: {
  nombre?: string;
  largo: string;
  ancho: string;
  cantidad?: string;
}) {
  fireEvent.change(screen.getByPlaceholderText('Ej.: Mesa 1, Bajo mesada…'), {
    target: { value: nombre },
  });
  const inputs = numberInputs();
  fireEvent.change(inputs[3], { target: { value: largo } });
  fireEvent.change(inputs[4], { target: { value: ancho } });
  fireEvent.change(inputs[5], { target: { value: cantidad } });
}

describe('CalculatorPage — regresiones de funcionamiento', () => {
  it('carga las dimensiones de placa y actualiza su superficie', () => {
    render(<CalculatorPage />);

    const inputs = numberInputs();
    expect(inputs[0].value).toBe('3');
    expect(inputs[1].value).toBe('1.8');
    expect(plateTotalText()).toContain('Total: 5.40 m²');

    fireEvent.change(inputs[0], { target: { value: '2' } });
    expect(plateTotalText()).toContain('Total: 3.60 m²');
  });

  it('agrega una pieza con nombre, medidas y cantidad, y actualiza resultados', () => {
    render(<CalculatorPage />);
    fillPiece({ nombre: 'Mesa 1', largo: '1.20', ancho: '0.60', cantidad: '2' });

    fireEvent.click(screen.getByRole('button', { name: /agregar pieza/i }));

    const pieceCard = document.querySelector('article');
    expect(pieceCard).not.toBeNull();
    if (!pieceCard) return;
    expect(within(pieceCard).getByText('Pieza 1')).toBeDefined();
    expect(within(pieceCard).getByText('Mesa 1')).toBeDefined();
    expect(within(pieceCard).getByText('1.20 m')).toBeDefined();
    expect(within(pieceCard).getByText('0.60 m')).toBeDefined();
    expect(within(pieceCard).getByText('2')).toBeDefined();
    expect(within(pieceCard).getByText('0.72000')).toBeDefined();
    expect(within(pieceCard).getByText('1.44000 m²')).toBeDefined();

    expect(screen.getAllByText('Mesa 1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('1.20 m').length).toBeGreaterThan(0);
    expect(screen.getAllByText('0.60 m').length).toBeGreaterThan(0);
    expect(screen.getAllByText('2').length).toBeGreaterThan(0);
    expect(screen.getByText('1.44000')).toBeDefined();
    expect(screen.getByText('Piezas (m²)')).toBeDefined();
    expect(screen.getByText('1.44')).toBeDefined();
  });

  it('elimina una pieza individual y recalcula los resultados', () => {
    render(<CalculatorPage />);
    fillPiece({ nombre: 'Para eliminar', largo: '1', ancho: '1' });
    fireEvent.click(screen.getByRole('button', { name: /agregar pieza/i }));
    expect(screen.getAllByText('Para eliminar').length).toBeGreaterThan(0);

    const mobileDeleteButton = document.querySelector('article button');
    expect(mobileDeleteButton).not.toBeNull();
    if (!mobileDeleteButton) return;
    fireEvent.click(mobileDeleteButton);

    expect(screen.queryByText('Para eliminar')).toBeNull();
    expect(screen.getByText('Todavía no agregaste piezas.')).toBeDefined();
    expect(screen.getByText('Completá las medidas y presioná Agregar Pieza.')).toBeDefined();
  });

  it('muestra el estado vacío compacto cuando no hay piezas', () => {
    render(<CalculatorPage />);

    expect(screen.getByText('Todavía no agregaste piezas.')).toBeDefined();
    expect(screen.getByText('Completá las medidas y presioná Agregar Pieza.')).toBeDefined();
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.queryAllByRole('article')).toHaveLength(0);
  });

  it('limpia todas las piezas', () => {
    render(<CalculatorPage />);
    fillPiece({ nombre: 'Mesa 1', largo: '1', ancho: '1' });
    fireEvent.click(screen.getByRole('button', { name: /agregar pieza/i }));
    fillPiece({ nombre: 'Mesa 2', largo: '0.5', ancho: '0.5' });
    fireEvent.click(screen.getByRole('button', { name: /agregar pieza/i }));

    fireEvent.click(screen.getByRole('button', { name: /limpiar todo/i }));

    expect(screen.getByText('Todavía no agregaste piezas.')).toBeDefined();
    expect(screen.queryByText('Mesa 1')).toBeNull();
    expect(screen.queryByText('Mesa 2')).toBeNull();
  });

  it('conserva el control de rotación permitido', () => {
    render(<CalculatorPage />);
    const rotation = screen.getByRole('checkbox', { name: /permitir rotación 90°/i }) as HTMLInputElement;

    expect(rotation.checked).toBe(true);
    fireEvent.click(rotation);
    expect(rotation.checked).toBe(false);
  });

  it('agrega la pieza al presionar Enter, porque el formulario lo implementa', () => {
    render(<CalculatorPage />);
    fillPiece({ nombre: 'Enter', largo: '1', ancho: '0.5' });

    fireEvent.keyDown(numberInputs()[4], { key: 'Enter', code: 'Enter' });

    expect(screen.getAllByText('Enter').length).toBeGreaterThan(0);
  });
});
