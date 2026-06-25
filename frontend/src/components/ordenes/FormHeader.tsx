import React from 'react';
import { MoreVertical, Copy, FileDown, Save, Trash2, History } from 'lucide-react';

interface MenuItem {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}

interface FormHeaderProps {
  title: string;
  badge?: React.ReactNode;
  logoUrl: string;
  menuOpen: boolean;
  menuRef: React.RefObject<HTMLDivElement | null>;
  setMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  children?: React.ReactNode;
  menuItems?: MenuItem[];
  className?: string;
}

export default function FormHeader({
  title, badge, logoUrl, menuOpen, menuRef, setMenuOpen, children, menuItems, className,
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
          <div ref={menuRef} style={{ position: 'relative' }}>
            <button className="btn btn-outline" onClick={() => setMenuOpen(!menuOpen)} style={{ padding: '8px 10px' }}>
              <MoreVertical size={18} />
            </button>
            {menuOpen && menuItems && (
              <div className="dropdown-menu">
                {menuItems.map((item, i) => (
                  <div key={i} className="dropdown-item" style={item.danger ? { color: '#ef4444' } : undefined} onClick={item.onClick}>
                    {item.icon} {item.label}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
