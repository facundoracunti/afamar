import { useState, useEffect, useRef, useCallback } from 'react';
import type { EntityFormState, FormField, UseEntityFormReturn, EntityServices } from '../types';
import { INITIAL_FORM, M2_CONCEPTS, buildPayload } from './entityFormHelpers';
import { useBudgetCalculations } from './useBudgetCalculations';
import { useFormReferences } from './useFormReferences';
import { useFormDetails } from './useFormDetails';
import { useFormMaterials } from './useFormMaterials';
import { useFormPools } from './useFormPools';
import { useFormClient } from './useFormClient';
import { useFormCalculationsInput } from './useFormCalculationsInput';
import { useFormActions } from './useFormActions';

export interface UseEntityFormParams {
  entityType: string;
  services: EntityServices;
  defaultEstado: string;
  id?: string;
  navigate: (path: string) => void;
  onLoaded?: (data: Record<string, unknown>) => void;
  /** Optional extra fields merged into the payload on every save
   *  (e.g. per-order terms override `delivery_terms_override`). */
  extraPayloadFields?: () => Record<string, unknown>;
  /** Forwarded to useFormActions — fires on submit/status-change errors
   *  so the parent form can surface a toast instead of the legacy `alert()`. */
  onError?: (message: string) => void;
}

export default function useEntityForm({
  entityType,
  services,
  defaultEstado,
  id,
  navigate,
  onLoaded,
  extraPayloadFields: _extraPayloadFields,
  onError,
}: UseEntityFormParams): UseEntityFormReturn {
  void entityType; // entityType kept for future per-type branching
  const isEdit = !!id;

  const [form, setForm] = useState<EntityFormState>({ ...INITIAL_FORM, status: defaultEstado });
  const [loading, setLoading] = useState<boolean>(isEdit);
  const [saving, setSaving] = useState<boolean>(false);
  const [showClientDropdown, setShowClientDropdown] = useState<boolean>(false);
  const [menuOpen, setMenuOpen] = useState<boolean>(false);
  const [deleteConfirm, setDeleteConfirm] = useState<boolean>(false);
  const [showCroquis, setShowCroquis] = useState<boolean>(false);
  const [modoUSD, setModoUSD] = useState<boolean>(false);
  const toggleModoUSD = useCallback(() => setModoUSD((p) => !p), []);

  const menuRef = useRef<HTMLDivElement | null>(null);
  const clientRef = useRef<HTMLDivElement | null>(null);

  const update = useCallback((field: FormField, value: unknown) => {
    setForm((prev) => ({ ...prev, [field]: value } as EntityFormState));
  }, []);

  // ----- References (materials/pools/clients/logo/next#/initial load)
  const { materials, pools, clientes, logoUrl, addOrRefreshClientes } = useFormReferences({
    services,
    defaultEstado,
    id,
    isEdit,
    setForm,
    setLoading,
    onLoaded,
  });

  // ----- Read-only derived flags
  const readOnly = ['WORKSHOP', 'FINISHED', 'DELIVERED', 'CONVERTED_TO_OT', 'REJECTED'].includes(
    form.status
  );

  // ----- Fabrication details CRUD
  const {
    handleDetailChange,
    addDetalle,
    removeDetalle,
    materialPrecioRef,
    materialUsdRef,
  } = useFormDetails({ form, setForm, update, materials });

  // ----- Materials CRUD
  const {
    handleMaterialChange,
    addMaterial,
    removeMaterial,
    updateMaterial,
    hayUSD,
    hayAlternativas,
  } = useFormMaterials({
    form,
    setForm,
    update,
    materials,
    materialPrecioRef,
    materialUsdRef,
  });

  // ----- Pools CRUD
  const { handlePoolImage, addPileta, removePileta, updatePileta } = useFormPools({
    form,
    setForm,
    update,
    pools,
  });

  // ----- Client autocomplete
  const { filteredClients, handleClientSelect } = useFormClient({ clientes, form, setForm });

  // ----- Calculations (subtotal/total/balance_due via useBudgetCalculations)
  useBudgetCalculations(form, setForm);

  // ----- Financial input handlers (transport/deposit/USD)
  const {
    handleTransportChange,
    handleDepositCurrencyChange,
    handleDepositAmountChange,
    handleUsdRateChange,
  } = useFormCalculationsInput({ form, setForm });

  // ----- Actions (submit/delete/status/print)
  const buildPayloadFn = useCallback(() => buildPayload(form), [form]);
  const { handleSubmit, handleDelete, handleStatusChangeAction, handlePrint } = useFormActions({
    form,
    setForm,
    setSaving,
    services,
    id,
    isEdit,
    navigate,
    buildPayload: buildPayloadFn,
    extraPayloadFields: _extraPayloadFields,
    onError,
  });

  // ----- Outside-click dismiss for menu/dropdown
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
      if (clientRef.current && !clientRef.current.contains(e.target as Node))
        setShowClientDropdown(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return {
    form,
    loading,
    saving,
    materials: materials as unknown as Record<string, unknown>[],
    pools: pools as unknown as Record<string, unknown>[],
    clientes: clientes as unknown as Record<string, unknown>[],
    addOrRefreshClientes,
    logoUrl,
    showClientDropdown,
    menuOpen,
    deleteConfirm,
    showCroquis,
    modoUSD,
    toggleModoUSD,
    setModoUSD,
    readOnly,
    hayUSD,
    hayAlternativas,
    filteredClients: filteredClients as unknown[],
    isEdit,
    menuRef,
    clientRef,
    materialPrecioRef,
    materialUsdRef,
    groupedMaterials: materials.filter((m) => m.name) as unknown[],
    M2_CONCEPTS,
    setForm,
    setLoading,
    setSaving,
    setMenuOpen,
    setDeleteConfirm,
    setShowClientDropdown,
    setShowCroquis,
    update,
    handleMaterialChange,
    handleClientSelect,
    handlePoolImage,
    handleTransportChange,
    handleDepositCurrencyChange,
    handleDepositAmountChange,
    handleUsdRateChange,
    handleDetailChange,
    addDetalle,
    removeDetalle,
    addMaterial,
    removeMaterial,
    updateMaterial,
    addPileta,
    removePileta,
    updatePileta,
    handleSubmit,
    handleDelete,
    handleStatusChangeAction,
    handlePrint,
    buildPayload: buildPayloadFn,
  };
}