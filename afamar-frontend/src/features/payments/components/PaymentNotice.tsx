/**
 * Banner informativo del modal de pago.
 *  - `success`: aviso de saldo completo ("No hay saldo pendiente…").
 *  - `warning`: aviso de método no elegido ("Seleccioná un método…").
 */
import type { CSSProperties, ReactNode } from 'react';

interface PaymentNoticeProps {
  tone: 'success' | 'warning';
  children: ReactNode;
}

const TONE_STYLES: Record<'success' | 'warning', CSSProperties> = {
  success: {
    padding: '8px 12px',
    backgroundColor: 'rgb(236, 253, 245)',
    border: '1px solid rgb(167, 243, 208)',
    color: 'rgb(6, 78, 59)',
    borderRadius: '6px',
    fontSize: '14px',
  },
  warning: {
    padding: '8px 12px',
    border: '1px solid rgb(252, 211, 77)',
    backgroundColor: 'rgb(254, 243, 199)',
    color: 'rgb(146, 64, 14)',
    borderRadius: '6px',
    fontSize: '14px',
  },
};

export function PaymentNotice({ tone, children }: PaymentNoticeProps) {
  return <div style={TONE_STYLES[tone]}>{children}</div>;
}