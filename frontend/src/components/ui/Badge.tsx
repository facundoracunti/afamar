import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'pending' | 'approved' | 'rejected' | 'production' | 'completed' | 'delivered' | 'cancelled' | 'converted' | 'info';
  style?: React.CSSProperties;
}

const variantColors: Record<string, { bg: string; text: string }> = {
  pending: { bg: '#fef3c7', text: '#92400e' },
  approved: { bg: '#d1fae5', text: '#065f46' },
  rejected: { bg: '#fee2e2', text: '#991b1b' },
  production: { bg: '#dbeafe', text: '#1e40af' },
  completed: { bg: '#d1fae5', text: '#065f46' },
  delivered: { bg: '#e0e7ff', text: '#3730a3' },
  cancelled: { bg: '#f3f4f6', text: '#6b7280' },
  converted: { bg: '#f3e8ff', text: '#6b21a8' },
  info: { bg: '#e0f2fe', text: '#075985' },
};

export default function Badge({ children, variant = 'pending', style }: BadgeProps) {
  const colors = variantColors[variant] || variantColors.pending;
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 4,
      fontSize: 11, fontWeight: 700,
      background: colors.bg, color: colors.text,
      ...style,
    }}>
      {children}
    </span>
  );
}
