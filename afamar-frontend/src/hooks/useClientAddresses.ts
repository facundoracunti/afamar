/**
 * Client address CRUD hook for ClientFormPage.
 */

import { useState, useCallback } from 'react';
import type { ClientAddress } from '../types/client';
import {
  getClientAddresses,
  createClientAddress,
  updateClientAddress,
  deleteClientAddress,
} from '../api/resources/clientAddresses';
import { useNotify } from '../context/NotificationContext';

interface UseClientAddressesParams {
  clientId: string | undefined;
}

interface UseClientAddressesReturn {
  addresses: ClientAddress[];
  setAddresses: React.Dispatch<React.SetStateAction<ClientAddress[]>>;
  showAddressModal: boolean;
  setShowAddressModal: (v: boolean) => void;
  editingAddress: ClientAddress | null;
  addressForm: { address: string; label: string; is_default: boolean };
  setAddressForm: React.Dispatch<React.SetStateAction<{ address: string; label: string; is_default: boolean }>>;
  addressSaving: boolean;
  openNewAddress: () => void;
  openEditAddress: (a: ClientAddress) => void;
  handleSaveAddress: () => Promise<void>;
  handleDeleteAddress: (a: ClientAddress) => Promise<void>;
  handleSetDefault: (a: ClientAddress) => Promise<void>;
  reloadAddresses: () => Promise<void>;
}

export function useClientAddresses({ clientId }: UseClientAddressesParams): UseClientAddressesReturn {
  const notify = useNotify();
  const [addresses, setAddresses] = useState<ClientAddress[]>([]);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [editingAddress, setEditingAddress] = useState<ClientAddress | null>(null);
  const [addressForm, setAddressForm] = useState({ address: '', label: '', is_default: false });
  const [addressSaving, setAddressSaving] = useState(false);

  const reloadAddresses = useCallback(async (): Promise<void> => {
    if (!clientId) return;
    const res = await getClientAddresses(Number(clientId));
    setAddresses((res as unknown as ClientAddress[]) || []);
  }, [clientId]);

  const openNewAddress = useCallback((): void => {
    setEditingAddress(null);
    setAddressForm({ address: '', label: '', is_default: addresses.length === 0 });
    setShowAddressModal(true);
  }, [addresses.length]);

  const openEditAddress = useCallback((a: ClientAddress): void => {
    setEditingAddress(a);
    setAddressForm({
      address: a.address,
      label: a.label || '',
      is_default: !!a.is_default,
    });
    setShowAddressModal(true);
  }, []);

  const handleSaveAddress = useCallback(async (): Promise<void> => {
    if (!clientId || !addressForm.address.trim()) return;
    setAddressSaving(true);
    try {
      const payload = {
        address: addressForm.address.trim(),
        label: addressForm.label.trim() || null,
        is_default: addressForm.is_default,
      };
      if (editingAddress) {
        await updateClientAddress(Number(clientId), editingAddress.id, payload);
        notify('Domicilio actualizado', 'success');
      } else {
        await createClientAddress(Number(clientId), payload);
        notify('Domicilio agregado', 'success');
      }
      await reloadAddresses();
      setShowAddressModal(false);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        || (err as Error).message
        || 'Error al guardar domicilio';
      notify(detail, 'error');
    } finally {
      setAddressSaving(false);
    }
  }, [clientId, addressForm, editingAddress, reloadAddresses, notify]);

  const handleDeleteAddress = useCallback(async (a: ClientAddress): Promise<void> => {
    if (!clientId) return;
    if (!window.confirm(`¿Eliminar el domicilio "${a.label || a.address}"?`)) return;
    try {
      await deleteClientAddress(Number(clientId), a.id);
      notify('Domicilio eliminado', 'success');
      await reloadAddresses();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        || (err as Error).message
        || 'Error al eliminar domicilio';
      notify(detail, 'error');
    }
  }, [clientId, reloadAddresses, notify]);

  const handleSetDefault = useCallback(async (a: ClientAddress): Promise<void> => {
    if (!clientId || a.is_default) return;
    try {
      await updateClientAddress(Number(clientId), a.id, { is_default: true });
      notify('Domicilio principal actualizado', 'success');
      await reloadAddresses();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        || (err as Error).message
        || 'Error al cambiar domicilio principal';
      notify(detail, 'error');
    }
  }, [clientId, reloadAddresses, notify]);

  return {
    addresses, setAddresses,
    showAddressModal, setShowAddressModal,
    editingAddress,
    addressForm, setAddressForm,
    addressSaving,
    openNewAddress, openEditAddress,
    handleSaveAddress, handleDeleteAddress, handleSetDefault,
    reloadAddresses,
  };
}
