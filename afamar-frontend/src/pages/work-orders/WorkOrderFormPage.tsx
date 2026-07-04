import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Eye, Save } from 'lucide-react';
import { useNotify } from '../../context/NotificationContext';
import { getWorkOrder, createWorkOrder, updateWorkOrder, deleteWorkOrder, getNextWorkOrderNumber, getWorkOrderPdf, previewWorkOrderPdf } from '@/api/resources/workOrders';
import { getMaterials } from '@/api/resources/materials';
import { getPoolStock } from '@/api/resources/poolStock';
import { getClients } from '@/api/resources/clients';
import { formatCurrency } from '../../utils/formatters';
import { StatusBadge } from '../../components/ui/StatusBadge';
import useEntityForm from '../../hooks/useEntityForm';
import CroquisEditor from '../../components/features/sketch/CroquisEditor';
import BudgetPanel from '../../components/features/budget/BudgetPanel';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import PdfPreviewModal from '../../components/common/PdfPreviewModal';
import TermsEditor from '../../components/common/TermsEditor';
import ApprovalSection from '../../components/features/orders/ApprovalSection';
import FormHeader from '../../components/features/orders/FormHeader';
import FormFooter from '../../components/features/orders/FormFooter';
import WorkOrderFormBasic from './WorkOrderFormBasic';
import WorkOrderFormSpecs from './WorkOrderFormSpecs';
import WorkOrderFormFinancial from './WorkOrderFormFinancial';
import FabricationSection from '../../components/features/budget/FabricationSection';
import WorkOrderFormObservations from './WorkOrderFormObservations';
import WorkOrderFormSnapshot from './WorkOrderFormSnapshot';
import type { EntityFormState, EntityServices, MaterialInForm, PoolInForm } from '../../types';
import styles from './WorkOrderFormPage.module.css';

const s = styles as unknown as Record<string, string>;

const ordenServices = {
  getById: getWorkOrder as EntityServices['getById'],
  create: createWorkOrder as EntityServices['create'],
  update: updateWorkOrder as EntityServices['update'],
  delete: deleteWorkOrder as EntityServices['delete'],
  getNextNumero: getNextWorkOrderNumber as EntityServices['getNextNumero'],
  getMaterials: getMaterials as EntityServices['getMaterials'],
  getPools: getPoolStock as EntityServices['getPools'],
  getClients: getClients as EntityServices['getClients'],
  getPdfUrl: getWorkOrderPdf,
  listPath: '/admin/work-orders',
};

export default function WorkOrderForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const notify = useNotify();
  const num = (v: string): number | null => v === '' ? null : parseFloat(v);

  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [pdfPreviewLoading, setPdfPreviewLoading] = useState(false);
  const [deliveryTerms, setDeliveryTerms] = useState<string[]>([]);
  const [warrantyTerms, setWarrantyTerms] = useState<string[]>([]);

  const {
    form, loading, saving, materiales, piletas, logoUrl, clientes, addOrRefreshClientes,
    menuOpen, deleteConfirm, showCroquis,
    readOnly, hayUSD, hayAlternativas,
    modoUSD, toggleModoUSD,
    menuRef,
    setForm,
    setSaving,
    setMenuOpen, setDeleteConfirm, setShowCroquis,
    update,
    handleTransportChange,
    handleDepositCurrencyChange, handleDepositAmountChange, handleUsdRateChange,
    handleDetailChange, addDetalle, removeDetalle,
    addMaterial, removeMaterial, updateMaterial,
    addPileta, removePileta, updatePileta,
    handleSubmit: legacyHandleSubmit, handleDelete, handleStatusChangeAction, handlePrint,
    buildPayload,
    M2_CONCEPTS,
  } = useEntityForm({
    entityType: 'work_order',
    services: ordenServices,
    defaultEstado: 'MEASUREMENT',
    id,
    navigate,
    extraPayloadFields: () => ({
      delivery_terms_override: encodeTerms(deliveryTerms),
      warranty_override: encodeTerms(warrantyTerms),
    }),
  });

  // Wrap the legacy submit so the work-orders list cache is invalidated
  // on every successful save (5min staleTime would otherwise keep the
  // previous list visible after navigation).
  const handleSubmit = async (e?: React.FormEvent) => {
    await legacyHandleSubmit(e);
    queryClient.invalidateQueries({ queryKey: ['work-orders'] });
  };

  const encodeTerms = (items: string[]) => JSON.stringify(items.filter((t) => t.trim() !== ''));

  const buildPayloadWithTerms = (): Record<string, unknown> => ({
    ...buildPayload(),
    delivery_terms_override: encodeTerms(deliveryTerms),
    warranty_override: encodeTerms(warrantyTerms),
  });

  if (loading) return <LoadingSpinner />;

  const matsMain = hayAlternativas ? (form.materials_data as unknown as MaterialInForm[] || []).filter((m) => !m.is_alternative) : (form.materials_data as unknown as MaterialInForm[] || []);
  const matsAlt = (form.materials_data as unknown as MaterialInForm[] || []).filter((m) => m.is_alternative);

  const handleConfirmarPago = async () => {
    if (!id) return;
    const nuevo = !form.balance_paid;
    const hoy = new Date().toISOString().split('T')[0];
    const payload: Record<string, unknown> = {
      balance_paid: nuevo,
      balance_paid_at: nuevo ? hoy : null,
    };
    if (nuevo) {
      payload.deposit_received = Number(form.total);
      payload.deposit_currency = 'ARS';
      payload.balance_due = 0;
      payload.deposit_usd = Number(form.total_usd);
      payload.balance_due_usd = 0;
    }
    await updateWorkOrder(id as string, payload);
    setForm((prev) => ({ ...prev, ...payload } as EntityFormState));
    queryClient.invalidateQueries({ queryKey: ['work-orders'] });
  };

  const handlePreviewPdf = async () => {
    setPdfPreviewLoading(true);
    setPdfPreviewUrl(null);
    try {
      const payload = buildPayloadWithTerms();
      const res = await previewWorkOrderPdf(payload);
      const blob = res.data as Blob;
      const url = URL.createObjectURL(blob);
      setPdfPreviewUrl(url);
    } catch (err) {
      const responseData = (err as { response?: { data?: unknown; status?: number } }).response?.data;
      const status = (err as { response?: { status?: number } }).response?.status;
      let detail: string | undefined;
      if (typeof responseData === 'string') {
        detail = responseData;
      } else if (responseData && typeof responseData === 'object' && 'detail' in responseData) {
        detail = (responseData as { detail?: string }).detail;
      } else if (responseData && typeof responseData === 'object' && 'error' in responseData) {
        detail = (responseData as { error?: string }).error;
      }
      console.error('[preview-pdf] status:', status, 'data:', responseData, 'err:', err);
      notify(detail ? `${detail} (status ${status})` : `Error al generar la vista previa del PDF (status ${status})`, 'error');
    } finally {
      setPdfPreviewLoading(false);
    }
  };

  const handleClosePdfPreview = () => {
    if (pdfPreviewUrl) {
      URL.revokeObjectURL(pdfPreviewUrl);
      setPdfPreviewUrl(null);
    }
  };

  const alternativasGrid = hayAlternativas ? (
    <div style={{ marginTop: 16 }}>
      <div style={{ marginBottom: 12, padding: '8px 12px', background: '#eff6ff', border: '1px solid #93c5fd', borderRadius: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#1e40af' }}>📋 PRESUPUESTO COMPARATIVO</span>
        <span style={{ fontSize: 11, color: '#3b82f6', marginLeft: 8 }}>{matsAlt.length} opciones alternativas</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
        {matsAlt.map((mat: MaterialInForm, idx: number) => {
          const letra = String.fromCharCode(65 + idx);
          const dd2 = Number(form.usd_rate);
          const m2 = Number(mat.length || 0) * Number(mat.width || 0) * (mat.quantity || 1);
          const costoMat = mat.currency === 'USD' ? m2 * (mat.price_m2_usd || 0) : m2 * (mat.price_m2 || 0);
          const costoMatArs = mat.currency === 'USD' ? (dd2 > 0 ? costoMat * dd2 : 0) : costoMat;
          const fijosArsAlt = (form.fabrication_details || []).reduce((s: number, d) => s + (Number(d.price) || 0) * (d.quantity || 1), 0)
            + (form.pools_data as unknown as PoolInForm[] || []).reduce((s: number, pt) => s + (Number(pt.price) || 0) * (Number(pt.quantity) || 1), 0)
            + (Number(form.transport) || 0);
          const totalArs = costoMatArs + fijosArsAlt;
          const mostrarUSDAlt = modoUSD && dd2 > 0;
          return (
            <div key={idx} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, background: '#fafafa', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', padding: '2px 8px', background: '#dbeafe', color: '#1e40af', borderRadius: 4 }}>Alternativa {letra}</span>
                  <span style={{ fontSize: 11, color: '#6b7280' }}>{mat.quantity || 1} pza. ({m2.toFixed(3)} m²)</span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', marginBottom: 2 }}>{mat.name}</div>
                {mat.currency === 'USD' && <div style={{ fontSize: 11, color: '#059669', fontWeight: 600, marginBottom: 8 }}>USD {costoMat.toFixed(2)}</div>}
                <div style={{ borderTop: '1px dashed #d1d5db', paddingTop: 6, fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Material:</span>
                    <span style={{ fontWeight: 600, color: '#374151' }}>{mostrarUSDAlt ? `USD ${(costoMatArs / dd2).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `$${costoMatArs.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Trabajos + Piletas + Traslado:</span>
                    <span style={{ fontWeight: 600, color: '#374151' }}>{mostrarUSDAlt ? `USD ${(fijosArsAlt / dd2).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `$${fijosArsAlt.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`}</span>
                  </div>
                </div>
              </div>
              <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 8, textAlign: 'center', background: '#fff', borderRadius: 6, padding: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' }}>Total alternativa {mostrarUSDAlt ? '(USD)' : ''}</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#dc2626' }}>{mostrarUSDAlt ? `USD ${(totalArs / dd2).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `$${Math.round(totalArs).toLocaleString('es-AR')}`}</div>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 10, color: '#9ca3af', textAlign: 'center', marginTop: 12, fontStyle: 'italic' }}>
        * Todos los totales incluyen la misma configuración de trabajos, piletas y traslados.
      </div>
    </div>
  ) : null;

  const descuentoBlock = (
    <>{form.payment_method === 'EFECTIVO' && (
      <div style={{ marginTop: 8, padding: '8px 10px', background: '#fffbe6', border: '1px solid #fde68a', borderRadius: 8 }}>
        <label style={{ fontSize: 12, fontWeight: 700, color: '#92400e', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
          🔒 Descuento Comercial (Solo Vendedor)
        </label>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>%</span>
            <input type="number" className="input" style={{ width: 70, textAlign: 'right' }}
              placeholder="0" min="0" max="100"
              value={form.discount_percentage || ''}
              onChange={(e) => {
                const val = Number(e.target.value) || 0;
                setForm({ ...form, discount_percentage: val, discount_fixed_amount: val > 0 ? 0 : form.discount_percentage });
              }}
              disabled={readOnly} />
          </div>
          <span style={{ fontSize: 12, color: '#9ca3af' }}>o</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>$</span>
            <input type="number" className="input" style={{ width: 100, textAlign: 'right' }}
              placeholder="Monto fijo"
              value={form.discount_fixed_amount || ''}
              onChange={(e) => {
                const val = Number(e.target.value) || 0;
                setForm({ ...form, discount_fixed_amount: val, discount_percentage: val > 0 ? 0 : form.discount_percentage });
              }}
              disabled={readOnly} />
          </div>
        </div>
        <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 4, fontStyle: 'italic' }}>
          Este descuento modifica el TOTAL ARS final pero no se muestra en el PDF del cliente.
        </div>
      </div>
    )}</>
  );

  return (
    <div className={s['work-order-form']}>
      <FormHeader
        className="orden-header"
        title={`Orden N° ${form.number || 'A-_____'}`}
        badge={<StatusBadge status={form.status} />}
        logoUrl={logoUrl}
      >
        {form.status === 'MEASUREMENT' && (
          <button className={s['work-order-form__btn-measurement']} onClick={() => handleStatusChangeAction('WORKSHOP')} disabled={saving}>
            🏭 Enviar a Taller
          </button>
        )}
        {form.status === 'WORKSHOP' && (
          <button className={s['work-order-form__btn-workshop']} onClick={() => handleStatusChangeAction('FINISHED')} disabled={saving}>
            ✅ Finalizar Trabajo
          </button>
        )}
        {form.status === 'FINISHED' && (
          <button className={s['work-order-form__btn-delivery']} onClick={() => handleStatusChangeAction('DELIVERED')} disabled={saving}>
            🚚 Entregar al Cliente
          </button>
        )}
        {form.status === 'DELIVERED' && (
          <span className={s['work-order-form__badge-delivered']}>
            📦 Trabajo Entregado
          </span>
        )}
        <button className="btn btn-outline" onClick={handlePreviewPdf} disabled={pdfPreviewLoading} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Eye size={16} /> {pdfPreviewLoading ? 'GENERANDO...' : 'VISTA PREVIA PDF'}
        </button>
        <button className={`btn btn-primary ${s['work-order-form__btn-save']}`} onClick={handleSubmit} disabled={saving}>
          <Save size={16} /> {saving ? 'GUARDANDO...' : 'GUARDAR'}
        </button>
      </FormHeader>

      <form onSubmit={handleSubmit} onKeyDown={(e: React.KeyboardEvent<HTMLFormElement>) => { if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') e.preventDefault(); }}>
        <WorkOrderFormBasic
          form={form}
          readOnly={readOnly}
          update={update as (field: string, value: unknown) => void}
          clientes={clientes as unknown as import('../../types/client').Client[]}
          onClientCreated={addOrRefreshClientes}
        />

        <WorkOrderFormSnapshot form={form} readOnly={readOnly} />

        <div className={`${s['work-order-form__layout']}${showCroquis ? '' : ' ' + s['work-order-form__layout--no-sketch']}`}>
          {showCroquis && (
            <div className={s['work-order-form__sketch']}>
              <CroquisEditor croquis={form.sketch_elements} onChange={(v: unknown) => update('sketch_elements', v)} readOnly={readOnly} />
            </div>
          )}
          <div className={s['work-order-form__right']}>
            <WorkOrderFormSpecs
              form={form}
              readOnly={readOnly}
              materiales={materiales}
              addMaterial={addMaterial}
              updateMaterial={updateMaterial}
              removeMaterial={removeMaterial}
              update={update}
              num={num}
            />
          </div>
        </div>

        <div className={s['work-order-form__bottom']}>
          <FabricationSection
            detalles={form.fabrication_details as unknown as Record<string, unknown>[]}
            readOnly={readOnly}
            materiales={materiales}
            M2_CONCEPTS={M2_CONCEPTS}
            num={num as (v: unknown) => number}
            handleDetailChange={handleDetailChange}
            addDetalle={addDetalle}
            removeDetalle={removeDetalle}
            showMeasurementComparison={form.status === 'MEASUREMENT'}
            materialsData={form.materials_data as unknown as import('../../types').MaterialInForm[]}
          />

          <WorkOrderFormFinancial
            form={form}
            modoUSD={modoUSD}
            toggleModoUSD={toggleModoUSD}
            hayUSD={hayUSD}
            hayAlternativas={hayAlternativas}
            readOnly={readOnly}
            saving={saving}
            handleTransportChange={handleTransportChange}
            handleDepositCurrencyChange={handleDepositCurrencyChange}
            handleDepositAmountChange={handleDepositAmountChange}
            handleUsdRateChange={handleUsdRateChange}
            setForm={setForm}
            update={update as (field: string, value: unknown) => void}
            num={num}
            piletas={piletas}
            addPileta={addPileta}
            updatePileta={updatePileta}
            removePileta={removePileta}
            alternativasGrid={alternativasGrid}
            descuentoBlock={descuentoBlock}
            onConfirmarPago={handleConfirmarPago}
            handleConfirmarPago={handleConfirmarPago}
            mostrarToggleTitle={true}
            mostrarToggleColumns={false}
          />

          <ApprovalSection form={form} readOnly={readOnly} update={update as (field: string, value: unknown) => void} />
        </div>

        <WorkOrderFormObservations
          form={form}
          readOnly={readOnly}
          showCroquis={showCroquis}
          setShowCroquis={setShowCroquis}
          update={update}
        />

        <div className={s['work-order-form__card']} style={{ marginTop: 16 }}>
          <h3 className={s['work-order-form__card-title']}>Condiciones de Entrega</h3>
          <TermsEditor
            items={deliveryTerms}
            onChange={setDeliveryTerms}
            placeholder="Ej: Entrega a convenir, transporte a cargo del cliente…"
            hint="Si dejás la lista vacía, se usarán las condiciones globales configuradas."
            disabled={readOnly}
          />
        </div>

        <div className={s['work-order-form__card']} style={{ marginTop: 16 }}>
          <h3 className={s['work-order-form__card-title']}>Garantía</h3>
          <TermsEditor
            items={warrantyTerms}
            onChange={setWarrantyTerms}
            placeholder="Ej: 12 meses por defectos de fabricación…"
            hint="Si dejás la lista vacía, se usará la garantía global configurada."
            disabled={readOnly}
          />
        </div>

        <FormFooter saving={saving} onCancel={() => navigate('/admin/work-orders')} />
      </form>

      <PdfPreviewModal
        isOpen={pdfPreviewUrl !== null || pdfPreviewLoading}
        onClose={handleClosePdfPreview}
        pdfUrl={pdfPreviewUrl}
        loading={pdfPreviewLoading}
        title="Vista previa — Orden de Trabajo"
      />
      <ConfirmDialog open={deleteConfirm} onCancel={() => setDeleteConfirm(false)} onConfirm={handleDelete} title="Eliminar orden" message="¿Estás seguro de eliminar esta orden de trabajo?" confirmLabel="Eliminar" danger />
    </div>
  );
}
