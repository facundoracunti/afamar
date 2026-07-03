import React from 'react';

interface FormHeaderProps {
  title: string;
  badge?: React.ReactNode;
  logoUrl: string;
  children?: React.ReactNode;
  className?: string;
}

export default function FormHeader({
  title, badge, logoUrl, children, className,
}: FormHeaderProps) {
  return (
    <div className={className} style={{ position: 'relative', overflow: 'hidden' }}>
      {logoUrl && (
        <div style={{
          position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
          opacity: 0.10, pointerEvents: 'none', zIndex: 0,
        }}>
          <img src={logoUrl} alt="Logo AFAMAR" style={{ height: 90, width: 'auto', objectFit: 'contain' }} />
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 1, width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 22, fontWeight: 700 }}>{title}</span>
          {badge}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {children}
        </div>
      </div>
    </div>
  );
}
