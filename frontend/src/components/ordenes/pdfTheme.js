export const COLORS = {
  primary: '#1a1a1a',
  secondary: '#b91c1c',
  accent: '#059669',
  bgLight: '#f8f9fa',
  border: '#e5e7eb',
  textMuted: '#6b7280',
  textDark: '#1e293b',
};

export const FONTS = {
  heading: 'Helvetica',
  body: 'Helvetica',
  title: 'Times-Roman',
};

export const formatARS = (val) =>
  `$ ${Number(val || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;

export const formatUSD = (val) =>
  `USD ${Number(val || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;

export const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString('es-AR') : '';
