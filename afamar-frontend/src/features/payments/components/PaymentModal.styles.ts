/**
 * Estilos inline compartidos del modal de pago y sus subcomponentes —
 * escritos con `style` inline para que no dependan de Tailwind ni de un
 * CSS module. Esto garantiza que la modal SIEMPRE se renderice como overlay
 * fijo sobre `document.body` (portal), sin riesgo de quedar atrapada por
 * `transform`, `overflow`, `contain` u otro contexto que algún ancestro
 * haya podido crear.
 */
import type { CSSProperties } from 'react';

export const OVERLAY_STYLE: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 9999,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'rgba(15, 23, 42, 0.5)',
  padding: '16px',
};

export const CARD_STYLE: CSSProperties = {
  width: '100%',
  maxWidth: '448px',
  backgroundColor: '#ffffff',
  borderRadius: '8px',
  padding: '24px',
  boxShadow:
    '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
  maxHeight: '90vh',
  overflowY: 'auto',
};

export const INPUT_FIELD_STYLE: CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '8px 12px',
  border: '1px solid rgb(203, 213, 225)',
  borderRadius: '6px',
  fontSize: '14px',
  boxSizing: 'border-box',
};

export const FIELD_LABEL_STYLE: CSSProperties = {
  display: 'block',
  marginBottom: '4px',
  fontSize: '14px',
  fontWeight: 500,
  color: 'rgb(51, 65, 85)',
};

export const FIELD_LABEL_OPTIONAL_STYLE: CSSProperties = {
  color: 'rgb(148, 163, 184)',
};

export const FIELD_HINT_STYLE: CSSProperties = {
  margin: '4px 0 0',
  fontSize: '12px',
  color: 'rgb(100, 116, 139)',
};

export const CANCEL_BUTTON_STYLE: CSSProperties = {
  padding: '8px 16px',
  border: '1px solid rgb(203, 213, 225)',
  backgroundColor: '#ffffff',
  color: 'rgb(51, 65, 85)',
  borderRadius: '6px',
  fontSize: '14px',
  fontWeight: 500,
};

export const PRIMARY_BUTTON_STYLE: CSSProperties = {
  padding: '8px 16px',
  border: 'none',
  backgroundColor: '#2563eb',
  color: '#ffffff',
  borderRadius: '6px',
  fontSize: '14px',
  fontWeight: 500,
};

export const ACTION_ROW_STYLE: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '8px',
  paddingTop: '8px',
};