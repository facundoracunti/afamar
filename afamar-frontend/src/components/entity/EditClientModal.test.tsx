import React, { useState } from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NotificationProvider } from '../../context/NotificationContext';
import type { Client } from '../../types/client';
import type { EntityFormState } from '../../types';
import EntityFormClient from './EntityFormClient';
import { updateClient } from '@/api/resources/clients';
import { upsertClientReference } from '../../hooks/useFormReferences';

vi.mock('@/api/resources/clients', () => ({
  updateClient: vi.fn(),
}));

const mockedUpdateClient = vi.mocked(updateClient);

const client: Client = {
  id: 42,
  name: 'Ana Pérez',
  phone: '1112345678',
  email: 'ana@example.com',
  address: 'Av. Principal 123',
  notes: 'Cliente habitual',
  totalPurchased: 900000,
  addresses: [
    { id: 7, client_id: 42, address: 'Av. Principal 123', is_default: true },
    { id: 8, client_id: 42, address: 'Obra alternativa 456', label: 'Obra', is_default: false },
  ],
};

const makeForm = (overrides: Record<string, unknown> = {}) => ({
  client_name: client.name,
  client_phone: client.phone,
  client_email: client.email,
  client_address: client.address,
  delivery_address_id: null,
  pieces: [{ id: 'piece-1' }],
  materials_data: 'materiales sin guardar',
  total: 123456,
  status: 'MEASUREMENT',
  ...overrides,
} as unknown as EntityFormState);

function Harness({ initialForm = makeForm() }: { initialForm?: EntityFormState }) {
  const [form, setForm] = useState(initialForm);
  const [clients, setClients] = useState([client]);
  const update = (field: string, value: unknown) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };
  const upsert = (updated: Client) => {
    setClients((prev) => upsertClientReference(prev, updated));
  };

  return (
    <NotificationProvider>
      <EntityFormClient
        form={form}
        readOnly={false}
        update={update}
        clientes={clients}
        onClientCreated={upsert}
      />
      <output data-testid="order-state">{JSON.stringify(form)}</output>
    </NotificationProvider>
  );
}

describe('EditClientModal', () => {
  beforeEach(() => {
    mockedUpdateClient.mockReset();
  });

  it('shows the button, opens with current data, and cancels without saving', () => {
    render(<Harness />);

    fireEvent.click(screen.getByRole('button', { name: 'Editar cliente' }));

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByDisplayValue('Ana Pérez')).toBeTruthy();
    expect(screen.getByDisplayValue('ana@example.com')).toBeTruthy();
    expect(screen.getByDisplayValue('Cliente habitual')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(mockedUpdateClient).not.toHaveBeenCalled();
  });

  it('updates the same client ID, visible data, and preserves unsaved order fields', async () => {
    mockedUpdateClient.mockResolvedValue({
      data: { ...client, name: 'Ana Actualizada', phone: '1199999999' },
    } as never);
    render(<Harness />);

    fireEvent.click(screen.getByRole('button', { name: 'Editar cliente' }));
    fireEvent.change(screen.getByDisplayValue('Ana Pérez'), { target: { value: 'Ana Actualizada' } });
    fireEvent.change(screen.getByDisplayValue('1112345678'), { target: { value: '1199999999' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(mockedUpdateClient).toHaveBeenCalledWith(42, expect.objectContaining({
      name: 'Ana Actualizada',
      phone: '1199999999',
    })));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByText('Ana Actualizada')).toBeTruthy();
    expect(screen.getByTestId('order-state').textContent).toContain('piece-1');
    expect(screen.getByTestId('order-state').textContent).toContain('materiales sin guardar');
    expect(screen.getByTestId('order-state').textContent).toContain('123456');
  });

  it.each([
    ['alternate delivery address', { delivery_address_id: 8, client_address: 'Obra alternativa 456' }],
    ['custom delivery address', { delivery_address_id: null, client_address: 'Domicilio personalizado' }],
  ])('preserves the %s when the primary address changes', async (_label, overrides) => {
    mockedUpdateClient.mockResolvedValue({ data: { ...client, address: 'Nueva principal' } } as never);
    const update = vi.fn();
    render(
      <NotificationProvider>
        <EntityFormClient
          form={makeForm(overrides)}
          readOnly={false}
          update={update}
          clientes={[client]}
          onClientCreated={vi.fn()}
        />
      </NotificationProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Editar cliente' }));
    fireEvent.change(screen.getByDisplayValue('Av. Principal 123'), { target: { value: 'Nueva principal' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(mockedUpdateClient).toHaveBeenCalled());

    expect(update).not.toHaveBeenCalledWith('client_address', 'Nueva principal');
  });

  it('updates the order primary address when the order uses the primary address', async () => {
    mockedUpdateClient.mockResolvedValue({ data: { ...client, address: 'Nueva principal' } } as never);
    const update = vi.fn();
    render(
      <NotificationProvider>
        <EntityFormClient
          form={makeForm()}
          readOnly={false}
          update={update}
          clientes={[client]}
          onClientCreated={vi.fn()}
        />
      </NotificationProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Editar cliente' }));
    fireEvent.change(screen.getByDisplayValue('Av. Principal 123'), { target: { value: 'Nueva principal' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(update).toHaveBeenCalledWith('client_address', 'Nueva principal'));
  });

  it('keeps the modal and entered values when the server rejects the update', async () => {
    mockedUpdateClient.mockRejectedValue(new Error('Servidor rechazó el cliente'));
    render(<Harness />);

    fireEvent.click(screen.getByRole('button', { name: 'Editar cliente' }));
    fireEvent.change(screen.getByDisplayValue('Ana Pérez'), { target: { value: 'Nombre fallido' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy());
    expect(screen.getByDisplayValue('Nombre fallido')).toBeTruthy();
    expect(screen.getByText('Servidor rechazó el cliente')).toBeTruthy();
  });

  it('prevents duplicate submissions while the update is pending', async () => {
    let resolveUpdate!: (value: unknown) => void;
    mockedUpdateClient.mockReturnValue(new Promise((resolve) => { resolveUpdate = resolve; }) as never);
    render(<Harness />);

    fireEvent.click(screen.getByRole('button', { name: 'Editar cliente' }));
    const save = screen.getByRole('button', { name: 'Guardar cambios' });
    fireEvent.click(save);
    fireEvent.click(save);
    expect(mockedUpdateClient).toHaveBeenCalledTimes(1);

    resolveUpdate({ data: client });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('keeps Quitar cliente working', () => {
    const update = vi.fn();
    render(
      <NotificationProvider>
        <EntityFormClient
          form={makeForm()}
          readOnly={false}
          update={update}
          clientes={[client]}
          onClientCreated={vi.fn()}
        />
      </NotificationProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Quitar cliente' }));
    expect(update).toHaveBeenCalledWith('client_name', '');
    expect(update).toHaveBeenCalledWith('delivery_address_id', null);
  });
});

describe('upsertClientReference', () => {
  it('replaces the same ID without duplicating and preserves enriched fields', () => {
    const existing = { ...client, totalPurchased: 1200000 };
    const updated = { id: client.id, name: 'Ana Actualizada' } as Client;
    const result = upsertClientReference([existing], updated);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 42,
      name: 'Ana Actualizada',
      totalPurchased: 1200000,
      addresses: client.addresses,
    });
  });
});
