import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import EntityFormWizard, { type EntityFormWizardStep } from './EntityFormWizard';

const steps: EntityFormWizardStep[] = [
  {
    id: 'client',
    label: 'Cliente',
    description: 'Datos del cliente.',
    content: <input aria-label="Nombre del cliente" defaultValue="" />,
  },
  {
    id: 'materials',
    label: 'Materiales',
    description: 'Materiales principales.',
    content: <div>Materiales del presupuesto</div>,
  },
];

function WizardTestHost() {
  const [activeStep, setActiveStep] = React.useState(0);
  return (
    <EntityFormWizard
      steps={steps}
      activeStep={activeStep}
      onStepChange={setActiveStep}
      onCancel={vi.fn()}
      saving={false}
    />
  );
}

describe('EntityFormWizard', () => {
  it('shows the active step and advances without requiring fields', () => {
    render(<WizardTestHost />);

    expect(screen.getByRole('heading', { name: 'Cliente' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));

    expect(screen.getByRole('heading', { name: 'Materiales' })).toBeDefined();
    expect(screen.getByText('Paso 2 de 2')).toBeDefined();
  });

  it('preserves values when moving between steps', () => {
    render(<WizardTestHost />);
    const input = screen.getByRole('textbox', { name: 'Nombre del cliente' });

    fireEvent.change(input, { target: { value: 'Cliente de prueba' } });
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    fireEvent.click(screen.getByRole('button', { name: 'Anterior' }));

    expect((screen.getByRole('textbox', { name: 'Nombre del cliente' }) as HTMLInputElement).value)
      .toBe('Cliente de prueba');
  });
});
