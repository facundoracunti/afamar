import type { PaymentMethod, PaymentStatus, PaymentTransaction } from '../../payments/types/payment.types';
import { PaymentMethodSelector } from '../../payments/components/PaymentMethodSelector';
import { PaywayLinkCard } from '../../payments/components/PaywayLinkCard';

const HISTORY_METHOD_LABELS: Record<PaymentMethod, string> = {
  efectivo: 'Efectivo',
  efectivo_usd: 'Efectivo (USD)',
  transferencia: 'Transferencia',
  tarjeta: 'Tarjeta',
  payway_link: 'Link de pago',
};

const HISTORY_DATETIME_FORMATTER = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function formatHistoryDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return HISTORY_DATETIME_FORMATTER.format(d);
}

interface PaymentHistoryEntry extends PaymentTransaction {
  tarjeta_surcharge_percent?: number | null;
}

const STATUS_BADGE_STYLES: Record<PaymentStatus, { label: string; className: string }> = {
  Pendiente: {
    label: 'Pendiente',
    className: 'bg-slate-100 text-slate-700 ring-slate-200',
  },
  'Señado Parcial': {
    label: 'Señado Parcial',
    className: 'bg-amber-100 text-amber-800 ring-amber-200',
  },
  Pagado: {
    label: 'Pagado',
    className: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
  },
};

const CURRENCY_FORMATTERS: Record<'ARS' | 'USD', Intl.NumberFormat> = {
  ARS: new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }),
  USD: new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'USD' }),
};

function formatCurrency(value: number, currency: 'ARS' | 'USD'): string {
  return CURRENCY_FORMATTERS[currency].format(value);
}

export interface OrderPaymentSummaryProps {
  montoTotal: number;
  montoSeniaRequerida: number;
  montoPagadoAcumulado: number;
  saldoPendiente: number;
  status: PaymentStatus;
  preferredMethod: PaymentMethod | null;
  currency?: 'ARS' | 'USD';
  onRegisterPayment?: () => void;
  /** Persistir la preferencia de método en el form. Requerido: este
   *  componente es el único lugar donde se renderiza el selector de
   *  método preferido (la modal NO expone otro). */
  onPreferredMethodChange: (method: PaymentMethod) => void;
  /** Historial de pagos registrados en esta sesión del form. En memoria:
   *  se pierde al recargar la página. Para un historial persistente
   *  hace falta un endpoint `GET /work-orders/{id}/payments`. */
  paymentHistory?: PaymentHistoryEntry[];
  /** WhatsApp target (sin `+`) — habilita el botón WhatsApp en los
   *  links de Payway mostrados en el historial. */
  clientPhone?: string | null;
  className?: string;
}

export function OrderPaymentSummary({
  montoTotal,
  montoSeniaRequerida,
  montoPagadoAcumulado,
  saldoPendiente,
  status,
  preferredMethod = null,
  currency = 'ARS',
  onRegisterPayment,
  onPreferredMethodChange,
  paymentHistory = [],
  clientPhone = null,
  className,
}: OrderPaymentSummaryProps) {
  const badge = STATUS_BADGE_STYLES[status];
  const isPagado = saldoPendiente <= 0;

  // Most recent payway_link payment → render the PaywayLinkCard below
  // the history table so the operator can re-copy / re-send it.
  const latestPaywayLink = paymentHistory.find((tx) => tx.payway_link_url);

  return (
    <div className={`rounded-lg border border-slate-200 bg-white p-4 shadow-sm ${className ?? ''}`}>
      <div className="mb-4 flex items-start justify-between gap-2">
        <h3 className="text-base font-semibold text-slate-900">Resumen de cobro</h3>
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${badge.className}`}
        >
          {badge.label}
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryItem label="Total" value={montoTotal} currency={currency} />
        <SummaryItem
          label="Seña requerida"
          value={montoSeniaRequerida}
          currency={currency}
          muted={montoSeniaRequerida === 0}
        />
        <SummaryItem
          label="Pagado acumulado"
          value={montoPagadoAcumulado}
          currency={currency}
          tone={montoPagadoAcumulado > 0 ? 'positive' : 'neutral'}
        />
        <SummaryItem
          label="Saldo pendiente"
          value={saldoPendiente}
          currency={currency}
          tone={saldoPendiente > 0 ? 'negative' : 'positive'}
        />
      </dl>

      <div className="mt-4">
        <PaymentMethodSelector
          label="Método de pago preferido"
          value={preferredMethod}
          onChange={onPreferredMethodChange}
        />
      </div>

      {onRegisterPayment && (
        <button
          type="button"
          onClick={onRegisterPayment}
          disabled={isPagado}
          className="mt-4 w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPagado ? 'Cobro completo' : 'Registrar pago'}
        </button>
      )}

      {paymentHistory.length > 0 && (
        <div className="mt-4 border-t border-slate-200 pt-3">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Pagos registrados en esta sesión
          </h4>
          <div className="overflow-hidden rounded-md border border-slate-200">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-2 py-2 text-left font-medium">Fecha</th>
                  <th className="px-2 py-2 text-left font-medium">Método</th>
                  <th className="px-2 py-2 text-right font-medium">Monto</th>
                  <th className="px-2 py-2 text-left font-medium">Lote/Cupón</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paymentHistory.map((tx) => (
                  <tr key={tx.id} className="text-slate-700">
                    <td className="px-2 py-1.5">{formatHistoryDate(tx.registered_at)}</td>
                    <td className="px-2 py-1.5">
                      {HISTORY_METHOD_LABELS[tx.method]}
                      {tx.tarjeta_surcharge_percent != null && tx.tarjeta_surcharge_percent > 0 && (
                        <span className="ml-1 text-slate-400">(+{tx.tarjeta_surcharge_percent}%)</span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-right font-semibold">
                      {formatCurrency(tx.amount, tx.currency)}
                    </td>
                    <td className="px-2 py-1.5 text-slate-500">{tx.lote_cupon ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-slate-400">
            El historial se conserva solo durante esta sesión. Para verlo
            tras recargar la página se necesita el endpoint{' '}
            <code className="rounded bg-slate-100 px-1">GET /work-orders/{'{'}id{'}'}/payments</code>.
          </p>

          {latestPaywayLink && (
            <PaywayLinkCard
              url={latestPaywayLink.payway_link_url ?? ''}
              whatsappPhone={clientPhone}
              label="Último link de pago Payway"
            />
          )}
        </div>
      )}
    </div>
  );
}

interface SummaryItemProps {
  label: string;
  value: number;
  currency: 'ARS' | 'USD';
  tone?: 'positive' | 'negative' | 'neutral';
  muted?: boolean;
}

function SummaryItem({ label, value, currency, tone = 'neutral', muted = false }: SummaryItemProps) {
  const valueClass =
    tone === 'positive'
      ? 'text-emerald-700'
      : tone === 'negative'
        ? 'text-rose-700'
        : muted
          ? 'text-slate-400'
          : 'text-slate-900';

  return (
    <div className="rounded-md bg-slate-50 px-3 py-2">
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className={`mt-1 text-sm font-semibold ${valueClass}`}>{formatCurrency(value, currency)}</dd>
    </div>
  );
}

export default OrderPaymentSummary;
