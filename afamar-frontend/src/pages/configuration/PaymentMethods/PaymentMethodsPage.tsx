/**
 * Payment-methods catalogue page.
 *
 * CRUD for the `payment_methods` table that powers the "Forma de pago"
 * `<select>` on the Budget/WorkOrder form. Each row's
 * `type` / `value` / `is_percentage` / `applies_to_installments`
 * fields drive the live total in `useBudgetCalculations` + the PDF
 * calculation in `buildPdfData`.
 *
 * Mounted as a tab under /admin/configuration at
 * /admin/configuration/payment-methods.
 */
import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import {
  getPaymentMethods,
  createPaymentMethod,
  updatePaymentMethod,
  deletePaymentMethod,
} from '@/api/resources/paymentMethods';
import { parseApiError } from '../../../utils/error';
import { Modal } from '../../../components/ui/Modal/Modal';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog/ConfirmDialog';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner/LoadingSpinner';
import { PageHeader } from '../../../components/ui/PageHeader/PageHeader';
import { Pagination } from '../../../components/ui/Pagination';
import { PaymentMethodsTable } from '../../../components/configuration/PaymentMethodsTable/PaymentMethodsTable';
import { PaymentMethodForm } from '../../../components/configuration/PaymentMethodForm/PaymentMethodForm';
import { useNotify } from '../../../context/NotificationContext';
import type { PaymentMethod, PaymentMethodType } from '../../../types/paymentMethod';

const PAYMENT_METHODS_KEY = ['payment-methods', 'admin'] as const;
const PAGE_SIZE = 25;

type PaymentMethodFormData = {
  name: string;
  label: string;
  type: PaymentMethodType;
  value: number;
  is_percentage: boolean;
  applies_to_installments: boolean;
  is_active: boolean;
  sort_order: number;
};

const EMPTY_FORM: PaymentMethodFormData = {
  name: '',
  label: '',
  type: 'NONE',
  value: 0,
  is_percentage: false,
  applies_to_installments: false,
  is_active: true,
  sort_order: 0,
};

function formFromItem(pm: PaymentMethod): PaymentMethodFormData {
  return {
    name: pm.name,
    label: pm.label,
    type: pm.type,
    value: Number(pm.value) || 0,
    is_percentage: !!pm.is_percentage,
    applies_to_installments: !!pm.applies_to_installments,
    is_active: pm.is_active,
    sort_order: pm.sort_order,
  };
}

export default function PaymentMethodsPage() {
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<PaymentMethod | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<PaymentMethodFormData>(EMPTY_FORM);
  const [page, setPage] = useState(1);
  const notify = useNotify();
  const queryClient = useQueryClient();

  const { data: rows = [], isLoading } = useQuery<PaymentMethod[]>({
    queryKey: [...PAYMENT_METHODS_KEY],
    queryFn: () => getPaymentMethods(),
  });

  const totalRows = rows.length;
  const paginatedRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleOpenForm = (item: PaymentMethod | null = null) => {
    if (item) {
      setEditItem(item);
      setForm(formFromItem(item));
    } else {
      setEditItem(null);
      setForm({ ...EMPTY_FORM });
    }
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      notify('El identificador (name) es obligatorio', 'error');
      return;
    }
    if (!form.label.trim()) {
      notify('La etiqueta visible es obligatoria', 'error');
      return;
    }
    if ((form.type === 'DISCOUNT' || form.type === 'SURCHARGE') && form.value < 0) {
      notify('El valor no puede ser negativo', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        label: form.label.trim(),
        type: form.type,
        value: Number(form.value) || 0,
        is_percentage: form.is_percentage,
        applies_to_installments: form.applies_to_installments,
        is_active: form.is_active,
        sort_order: form.sort_order,
      };
      if (editItem) {
        await updatePaymentMethod(editItem.id, payload);
        notify('Método de pago actualizado', 'success');
      } else {
        await createPaymentMethod(payload);
        notify('Método de pago creado', 'success');
      }
      // Invalidate BOTH the admin catalogue and the form reference cache so
      // the "Forma de pago" `<select>` on the form picks up the change.
      queryClient.invalidateQueries({ queryKey: [...PAYMENT_METHODS_KEY] });
      queryClient.invalidateQueries({ queryKey: ['payment-methods', 'reference'] });
      setShowForm(false);
    } catch (err: unknown) {
      notify(parseApiError(err, 'Error al guardar'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deletePaymentMethod(deleteId);
      queryClient.invalidateQueries({ queryKey: [...PAYMENT_METHODS_KEY] });
      queryClient.invalidateQueries({ queryKey: ['payment-methods', 'reference'] });
      notify('Método de pago eliminado', 'success');
      setDeleteId(null);
    } catch (err: unknown) {
      notify(parseApiError(err, 'Error al eliminar'), 'error');
    }
  };

  return (
    <div className="payment-methods">
      <PageHeader
        title="Métodos de Pago"
        actions={
          <button className="btn btn-primary" onClick={() => handleOpenForm()}>
            <Plus size={16} /> Nuevo Método de Pago
          </button>
        }
      />

      {isLoading ? <LoadingSpinner /> : (
        <>
          <PaymentMethodsTable
            data={paginatedRows}
            onEdit={handleOpenForm}
            onDelete={(id) => setDeleteId(id)}
          />
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={totalRows}
            onPageChange={setPage}
            label="métodos de pago"
          />
        </>
      )}

      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title={editItem ? 'Editar Método de Pago' : 'Nuevo Método de Pago'}
        width="640px"
      >
        <PaymentMethodForm
          editItem={editItem}
          form={form}
          saving={saving}
          onChange={setForm}
          onSubmit={handleSave}
          onCancel={() => setShowForm(false)}
        />
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        onCancel={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Eliminar método de pago"
        message="¿Estás seguro de que querés eliminar este método de pago? Los presupuestos y órdenes existentes que lo usen conservan su etiqueta (snapshot) y siguen funcionando."
        confirmLabel="Eliminar"
        danger
      />
    </div>
  );
}
