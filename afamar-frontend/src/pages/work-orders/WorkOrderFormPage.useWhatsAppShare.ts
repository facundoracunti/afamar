/**
 * WhatsApp share of the work order form.
 *
 * Sends the full summary of the OT (número, cliente, materiales, Total,
 * Seña/Saldo pendiente, the signed public PDF link and the Payway checkout
 * link) to the client. NOTHING is downloaded on the operator's machine:
 * the handler only mints the public token, builds the message and opens
 * WhatsApp.
 */
import { useState } from 'react';
import { getWorkOrderPayments, getWorkOrderPublicPdfToken } from '@/api/resources/workOrders';
import type { CashMovement } from '../../types/cash';
import type { EntityFormState } from '../../types';
import { buildOrderShareMessage, buildWhatsAppUrl, resolvePublicDocumentPdfUrl } from '../../utils/whatsapp';

interface UseWorkOrderWhatsAppShareParams {
  form: EntityFormState;
  /** Id of the saved work order (`undefined` while creating). */
  id?: string;
  notify: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export function useWorkOrderWhatsAppShare({ form, id, notify }: UseWorkOrderWhatsAppShareParams) {
  const [whatsappSending, setWhatsappSending] = useState(false);

  const handleEnviarWhatsApp = async () => {
    if (!form.client_phone) {
      notify('El cliente no tiene teléfono cargado, no se puede enviar el WhatsApp.', 'error');
      return;
    }
    setWhatsappSending(true);
    let paywayLink: string | null = null;
    if (id) {
      try {
        const res = await getWorkOrderPayments(id);
        const payments = (res.data as CashMovement[]) ?? [];
        const latest = [...payments]
          .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
          .find((m) => !!m.payway_checkout_url);
        paywayLink = latest?.payway_checkout_url ?? null;
      } catch {
        // Sin movimientos / offline → el mensaje sale igual, el link es opcional.
      }
    }
    const mensaje = buildOrderShareMessage({
      clientName: form.client_name || null,
      documentLabel: 'la Orden de Trabajo',
      documentNumber: form.number || null,
      // Link público firmado (sin login) para que el cliente pueda abrir el
      // PDF desde el chat; '' si la OT no existe / offline → mensaje sin link.
      pdfUrl: id
        ? await resolvePublicDocumentPdfUrl('work_order', () => getWorkOrderPublicPdfToken(id))
        : '',
      paywayLink,
      currency: form.currency,
      total: form.total,
      depositReceived: form.deposit_received,
      balanceDue: form.balance_due,
      materials: (form.materials_data || []).map((m) => ({
        name: m.name,
        quantity: m.quantity,
        length: m.length,
        width: m.width,
        is_alternative: m.is_alternative,
      })),
    });
    const whatsappUrl = buildWhatsAppUrl(form.client_phone, mensaje);
    window.open(whatsappUrl, '_blank');
    setWhatsappSending(false);
  };

  return { whatsappSending, handleEnviarWhatsApp };
}
