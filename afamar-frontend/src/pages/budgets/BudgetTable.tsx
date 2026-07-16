import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2, FileDown, FileOutput, Eye, Send, Mail, Check, X } from 'lucide-react';
import { formatDate } from '../../utils/formatters';
import { t as translateStatus } from '../../utils/translate';
import CurrencyDisplay from '../../components/ui/CurrencyDisplay';
import { EmptyState } from '../../components/ui/EmptyState/EmptyState';
import type { UnifiedBudget } from '../../types/budget';
import styles from './BudgetsListPage.module.css';

const s = styles as unknown as Record<string, string>;

const btnCls = (variant?: 'success' | 'danger' | 'info' | 'ghost') => {
  const base = s['budgets__action-btn'];
  if (!variant) return base;
  if (variant === 'success') return `${base} ${s['budgets__action-btn--success']}`;
  if (variant === 'danger') return `${base} ${s['budgets__action-btn--danger']}`;
  if (variant === 'info') return `${base} ${s['budgets__action-btn--info']}`;
  return `${base} ${s['budgets__action-btn--ghost']}`;
};

interface BudgetTableProps {
  data: UnifiedBudget[];
  onView: (p: UnifiedBudget) => void;
  onOpenPdf: (p: UnifiedBudget) => void;
  onConvertir: (id: string | number) => void;
  onEnviarWhatsApp: (p: UnifiedBudget) => void;
  onEnviarEmail: (id: string | number) => void;
  onCambiarEstado: (budget: UnifiedBudget, nuevoEstado: string) => void;
  onSetDeleteId: (id: string | number) => void;
}

export default function BudgetTable({
  data,
  onView,
  onOpenPdf,
  onConvertir,
  onEnviarWhatsApp,
  onEnviarEmail,
  onCambiarEstado,
  onSetDeleteId,
}: BudgetTableProps) {
  const navigate = useNavigate();

  const isConvertible = (p: UnifiedBudget): boolean =>
    p.status === 'APPROVED' && !p.workOrderNumber;

  const canAprobar = (p: UnifiedBudget): boolean =>
    p.status === 'PENDING';

  const canRechazar = (p: UnifiedBudget): boolean =>
    p.status === 'PENDING' || p.status === 'APPROVED';

  return (
    <div className={s['budgets__table']}>
      <table>
        <thead>
          <tr>
            <th className={s['budgets__th']} style={{ width: 90 }}>Número</th>
            <th className={s['budgets__th']} style={{ width: 95, fontSize: 12 }}>Fecha</th>
            <th className={s['budgets__th']} style={{ width: 160 }}>Cliente</th>
            <th className={s['budgets__th']} style={{ width: 110 }}>Telefono</th>
            <th className={s['budgets__th']} style={{ width: 110 }}>Total</th>
            <th className={s['budgets__th']} style={{ width: 100 }}>Estado</th>
            <th className={s['budgets__th']} style={{ width: 130 }}>Flujo</th>
            <th className={s['budgets__th']} style={{ width: 140 }}>Convertir OT</th>
            <th className={s['budgets__th']} style={{ width: 130 }}>Vista</th>
            <th className={s['budgets__th']} style={{ width: 150 }}>Notificar</th>
            <th className={s['budgets__th']} style={{ width: 70 }}>Eliminar</th>
          </tr>
        </thead>
        <tbody>
          {data.map((p: UnifiedBudget) => (
            <tr
              key={p.type + '-' + p.id}
              className={s['budgets__row']}
              onClick={() => onView(p)}
            >
              <td className={s['budgets__td']}>
                <div className={s['budgets__numero']}>{p.number}</div>
                {p.workOrderNumber && (
                  <div className={s['budgets__numeroSub']}>{'-> '}{p.workOrderNumber}</div>
                )}
              </td>
              <td className={s['budgets__td']}>
                {formatDate((p.date || '').split('T')[0]) || '-'}
              </td>
              <td className={s['budgets__td']}>{p.clientName || '-'}</td>
              <td className={s['budgets__td']}>{p.clientPhone || '-'}</td>
              <td className={s['budgets__td'] + ' ' + s['budgets__total']}>
                <CurrencyDisplay value={p.total} />
              </td>
              <td className={s['budgets__td']}>
                {p.status === 'CONVERTED_TO_OT' ? (
                  <span className={s['budgets__status'] + ' ' + s['budgets__status--done']}>
                    CONCRETADO
                  </span>
                ) : p.status === 'APPROVED' ? (
                  <span className={s['budgets__status'] + ' ' + s['budgets__status--approved']}>
                    APROBADO
                  </span>
                ) : p.status === 'REJECTED' ? (
                  <span className={s['budgets__status'] + ' ' + s['budgets__status--rejected']}>
                    RECHAZADO
                  </span>
                ) : (
                  <span className={s['budgets__status'] + ' ' + s['budgets__status--pending']}>
                    {translateStatus(p.status)}
                  </span>
                )}
              </td>

              <td
                className={`${s['budgets__td']} ${s['budgets__actions-cell']}`}
                onClick={(e: React.MouseEvent) => e.stopPropagation()}
              >
                <div className={s['budgets__action-pair']}>
                  {canAprobar(p) && (
                    <button type="button" className={btnCls('success')} onClick={() => onCambiarEstado(p, 'APPROVED')} title="Aprobar presupuesto">
                      <Check size={12} /> Aprobar
                    </button>
                  )}
                  {canRechazar(p) && (
                    <button type="button" className={btnCls('danger')} onClick={() => onCambiarEstado(p, 'REJECTED')} title="Rechazar presupuesto">
                      <X size={12} /> Rechazar
                    </button>
                  )}
                  {!canAprobar(p) && !canRechazar(p) && <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>—</span>}
                </div>
              </td>

              <td
                className={`${s['budgets__td']} ${s['budgets__actions-cell']}`}
                onClick={(e: React.MouseEvent) => e.stopPropagation()}
              >
                {isConvertible(p) ? (
                  <button type="button" className={btnCls('danger')} onClick={() => onConvertir(p.id)} title="Convertir presupuesto en Orden de Trabajo">
                    <FileOutput size={11} /> A OT
                  </button>
                ) : p.workOrderNumber ? (
                  <button type="button" className={btnCls('ghost')} onClick={() => navigate(`/admin/work-orders?search=${p.workOrderNumber}`)} title={`Ver Orden de Trabajo ${p.workOrderNumber}`}>
                    OT {p.workOrderNumber}
                  </button>
                ) : (
                  <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>—</span>
                )}
              </td>

              <td
                className={`${s['budgets__td']} ${s['budgets__actions-cell']}`}
                onClick={(e: React.MouseEvent) => e.stopPropagation()}
              >
                <div className={s['budgets__action-pair']}>
                  <button type="button" className={btnCls()} onClick={() => onView(p)} title="Ver / editar">
                    <Eye size={12} /> Ver
                  </button>
                  <button type="button" className={btnCls()} onClick={() => onOpenPdf(p)} title="Vista previa del PDF">
                    <FileDown size={12} /> PDF
                  </button>
                </div>
              </td>

              <td
                className={`${s['budgets__td']} ${s['budgets__actions-cell']}`}
                onClick={(e: React.MouseEvent) => e.stopPropagation()}
              >
                <div className={s['budgets__action-pair']}>
                  {p.clientPhone ? (
                    <button type="button" className={btnCls('success')} onClick={() => onEnviarWhatsApp(p)} title={`Enviar por WhatsApp a ${p.clientPhone}`}>
                      <Send size={12} /> WhatsApp
                    </button>
                  ) : (
                    <button type="button" className={btnCls()} disabled style={{ opacity: 0.4, cursor: 'not-allowed' }} title="Sin teléfono cargado">
                      <Send size={12} /> WhatsApp
                    </button>
                  )}
                  <button type="button" className={btnCls('info')} onClick={() => onEnviarEmail(p.id)} title="Enviar PDF por correo">
                    <Mail size={12} />Correo</button>
                </div>
              </td>

              <td
                className={`${s['budgets__td']} ${s['budgets__actions-cell']}`}
                onClick={(e: React.MouseEvent) => e.stopPropagation()}
              >
                <button type="button" className={btnCls('danger')} onClick={() => onSetDeleteId(p.id)} title="Eliminar presupuesto" style={{ padding: '4px 8px' }}>
                  <Trash2 size={12} />
                </button>
              </td>
            </tr>
          ))}
          {data.length === 0 && (
            <tr>
              <td colSpan={11}>
                <EmptyState message="No hay presupuestos" />
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
