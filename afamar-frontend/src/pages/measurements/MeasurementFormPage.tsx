import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { getMeasurement, createMeasurement, updateMeasurement } from '@/api/resources/measurements';
import { getClients } from '@/api/resources/clients';
import { getWorkOrders, getWorkOrder } from '@/api/resources/workOrders';
import { parseApiError } from '../../utils/error';
import { useGet, useList } from '../../api/hooks';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner/LoadingSpinner';
import type { Measurement, MeasurementFormData } from '../../types/measurement';
import type { Client } from '../../types/client';
import type { WorkOrderListItem } from '../../types/workOrder';
import { useNotify } from '../../context/NotificationContext';
import { MeasurementFormFields } from './MeasurementFormFields';
import { MeasurementClientCard } from './MeasurementClientCard';
import styles from './MeasurementFormPage.module.css';

const s = styles as unknown as Record<string, string>;

const WORK_ORDERS_LIMIT = 200;

interface MeasurementFormProps {
  /** Modal mode: cierra el modal en vez de navegar a /admin/measurements. */
  onSuccess?: () => void;
  /** Modal mode: cierra el modal en vez de navegar a /admin/measurements. */
  onCancel?: () => void;
  /** Modal mode: id de la medición a editar. Si no se pasa, usa useParams(). */
  entityId?: number | string;
  /** Modal mode: pre-rellena desde un work order, equivalente a ?workOrderId=. */
  presetWorkOrderId?: number | string;
}

async function fetchWorkOrdersForClient(clientId?: number | null): Promise<WorkOrderListItem[]> {
  const params: Record<string, unknown> = { limit: WORK_ORDERS_LIMIT };
  if (clientId) params.client_id = clientId;
  const res = await getWorkOrders(params);
  return (res.data as WorkOrderListItem[]) || [];
}

export default function MeasurementForm(props: MeasurementFormProps = {}) {
  const params = useParams<{ id: string }>();
  const paramId = params.id;
  const id = props.entityId != null ? String(props.entityId) : paramId;
  const [searchParams] = useSearchParams();
  const queryWorkOrderId = searchParams.get('workOrderId');
  const presetWorkOrderId = props.presetWorkOrderId != null
    ? String(props.presetWorkOrderId)
    : queryWorkOrderId;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = !!id;
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<MeasurementFormData>({
    clientId: null,
    scheduledDate: '',
    scheduledTime: '',
    observations: '',
    sketch: [],
    photos: [],
    status: 'PENDING',
    workOrderId: props.presetWorkOrderId != null
      ? Number(props.presetWorkOrderId)
      : (presetWorkOrderId ? Number(presetWorkOrderId) : ''),
  });

  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);

  // Track which id we've already loaded into the form. Without this guard, a
  // TanStack Query refetch (which returns a new object reference even when
  // the data is byte-identical) re-fires the load effect and wipes whatever
  // the user has typed since. This was the root cause of "I add notes, save,
  // re-open, the form is empty" — the in-flight refetch of the cached
  // measurement was overwriting the user's input before the PUT went out.
  const loadedIdRef = useRef<string | null>(null);

  const { data: measurement, loading } = useGet<Measurement>(
    ['measurement', id],
    async () => {
      if (!id) return {} as Measurement;
      const res = await getMeasurement(id);
      return res.data as Measurement;
    },
    !!id
  );

  // Clients list — TanStack Query with 5min staleTime. The query key is
  // shared across the form pages so navigating between Budget/WorkOrder/
  // Measurement forms reuses the cached client list (no extra fetch).
  const CLIENTS_KEY = ['clients', { limit: 500 }] as const;
  const { items: clientes } = useList<Client>(
    CLIENTS_KEY,
    async () => {
      const res = await getClients({ limit: 500 });
      return (res.data as Client[]) || [];
    },
  );

  const [woKey] = useState(0);
  const { items: workOrders, loading: loadingWorkOrders } = useList<WorkOrderListItem>(
    ['work-orders', 'measurement-candidates', woKey, selectedClientId],
    () => fetchWorkOrdersForClient(selectedClientId)
  );

  useEffect(() => {
    if (!measurement || !measurement.id) return;
    // Only seed the form on the FIRST load for this id. Any subsequent
    // refetch of the same id keeps the user's current input. Also guards
    // against a stale refetch for the *previous* id hanging around while
    // the user navigates to a new measurement.
    const measurementIdStr = String(measurement.id);
    if (id && id !== measurementIdStr) return;
    if (loadedIdRef.current === measurementIdStr) return;
    loadedIdRef.current = measurementIdStr;

    let sketch: unknown[] = [];
    let photos: string[] = [];
    try { if (measurement.sketch_data) sketch = JSON.parse(measurement.sketch_data); } catch { sketch = []; }
    try { if (measurement.photos_data) photos = JSON.parse(measurement.photos_data); } catch { photos = []; }
    setForm({
      clientId: measurement.client_id ?? null,
      scheduledDate: measurement.scheduled_date ? measurement.scheduled_date.split('T')[0] : '',
      scheduledTime: measurement.scheduled_time || '',
      observations: measurement.notes || '',
      sketch,
      photos,
      status: measurement.status || 'PENDING',
      workOrderId: measurement.work_order_id ?? '',
    });
    setSelectedClientId(measurement.client_id ?? null);
  }, [measurement, id]);

  // Reset the "loaded" marker when the route id changes so the next
  // measurement seeds the form fresh.
  useEffect(() => {
    if (!id) loadedIdRef.current = null;
    else if (loadedIdRef.current && loadedIdRef.current !== id) loadedIdRef.current = null;
  }, [id]);

  useEffect(() => {
    loadedIdRef.current = null;
  }, [props.entityId, props.presetWorkOrderId]);

  // When arriving via `?workOrderId=` from the pending-measurement cards, fetch
  // the source work order and pre-fill client + delivery date so the user only
  // has to pick the time + add notes.
  useEffect(() => {
    if (isEdit || !presetWorkOrderId) return;
    let cancelled = false;
    getWorkOrder(presetWorkOrderId)
      .then((res) => {
        if (cancelled) return;
        const wo = res.data as Record<string, unknown> | undefined;
        if (!wo) return;
        const clientId = (wo.client_id as number | null) ?? null;
        const deliveryDate = wo.delivery_date
          ? String(wo.delivery_date).split('T')[0]
          : '';
        setForm((prev) => ({
          ...prev,
          clientId: prev.clientId ?? clientId,
          scheduledDate: prev.scheduledDate || deliveryDate,
        }));
        if (clientId) setSelectedClientId(clientId);
      })
      .catch((err) => {
        console.warn('Pre-fill from work order failed (user can fill manually):', err);
      });
    return () => { cancelled = true; };
  }, [presetWorkOrderId, isEdit]);

  const notify = useNotify();

  const handleChange = (field: keyof MeasurementFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleWorkOrderChange = (workOrderId: number | '') => {
    setForm((prev) => {
      if (!workOrderId) return { ...prev, workOrderId: '' };
      const wo = workOrders.find((w) => w.id === workOrderId);
      return {
        ...prev,
        workOrderId,
        clientId: prev.clientId ?? wo?.client_id ?? null,
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        client_id: form.clientId,
        work_order_id: form.workOrderId === '' || form.workOrderId === undefined ? null : Number(form.workOrderId),
        // Send the date as a YYYY-MM-DD string (without a timezone shift) so
        // the backend stores it as midnight on the day the user picked, not
        // as the previous/next day depending on the server's tz.
        scheduled_date: form.scheduledDate || null,
        scheduled_time: form.scheduledTime || null,
        // Send empty string as empty string (not null) so the user can clear
        // notes by deleting the text. The backend's `value is not None`
        // guard then writes the empty string over the previous value.
        notes: form.observations,
        status: form.status,
        photos_data: JSON.stringify(form.photos),
        sketch_data: JSON.stringify(form.sketch),
      };

      if (isEdit) {
        await updateMeasurement(id as string, payload);
      } else {
        await createMeasurement(payload);
      }
      queryClient.invalidateQueries({ queryKey: ['measurements'] });
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
      notify('Medición guardada correctamente', 'success');
      if (props.onSuccess) {
        props.onSuccess();
      } else {
        navigate('/admin/measurements');
      }
    } catch (err: unknown) {
      notify(parseApiError(err, 'Error al guardar'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (props.onCancel) props.onCancel();
    else navigate('/admin/measurements');
  };

  if (loading || (isEdit && !measurement)) return <LoadingSpinner />;

  const selectedClient = clientes.find((c) => c.id === form.clientId);

  const isModal = Boolean(props.onCancel || props.onSuccess);

  return (
    <div className={s['measurement-form']}>
      {!isModal && (
        <div className={s['measurement-form__header']}>
          <h1 className={s['measurement-form__title']}>{isEdit ? 'Editar Medición' : 'Nueva Medición'}</h1>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className={s['measurement-form__layout']}>
          {/* Left column: WO + measurement fields */}
          <div className={s['measurement-form__left']}>
            <MeasurementFormFields
              form={form}
              workOrders={workOrders}
              loadingWorkOrders={loadingWorkOrders}
              saving={saving}
              isEdit={isEdit}
              onChange={handleChange}
              onWorkOrderChange={handleWorkOrderChange}
              onAddPhotos={(newFotos) => setForm((prev) => ({ ...prev, photos: newFotos }))}
              onRemovePhoto={(idx) => setForm((prev) => ({ ...prev, photos: prev.photos.filter((_, i) => i !== idx) }))}
              onCancel={handleCancel}
            />
          </div>

          {/* Right column: client card */}
          <div className={s['measurement-form__right']}>
            <MeasurementClientCard client={selectedClient} />
          </div>
        </div>
      </form>
    </div>
  );
}
