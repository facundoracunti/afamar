import { useState, useRef, useEffect } from 'react';
import { User, Moon, Sun, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { useTheme } from '../../../context/ThemeContext';
import styles from './MainLayout.module.css';

const s = styles as unknown as Record<string, string>;

interface TopbarProps {
  pageTitle: string;
}

export function Topbar({ pageTitle }: TopbarProps) {
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className={s['main-layout__topbar']}>
      <div className={s['main-layout__page-title']}>{pageTitle}</div>
      <div className={s['main-layout__topbar-right']}>
        <div className={s['main-layout__date']}>
          {new Date().toLocaleDateString('es-AR', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </div>
        <div className={s['main-layout__profile']} ref={profileRef}>
          <button
            className={s['main-layout__profile-btn']}
            onClick={() => setProfileOpen((p) => !p)}
            title="Perfil"
          >
            <User size={20} />
          </button>
          {profileOpen && (
            <div className={s['main-layout__profile-dropdown']}>
              <div className={s['main-layout__profile-name']}>
                {user?.full_name || user?.username}
              </div>
              <div className={s['main-layout__profile-section']}>
                <div className={s['main-layout__profile-section-label']}>Tema</div>
                <div className={s['main-layout__profile-theme']}>
                  <button
                    className={`${s['main-layout__profile-theme-btn']}${theme === 'dark' ? ' ' + s['main-layout__profile-theme-btn--active'] : ''}`}
                    onClick={() => setTheme('dark')}
                    title="Tema oscuro"
                  >
                    <Moon size={14} />
                    Oscuro
                  </button>
                  <button
                    className={`${s['main-layout__profile-theme-btn']}${theme === 'light' ? ' ' + s['main-layout__profile-theme-btn--active'] : ''}`}
                    onClick={() => setTheme('light')}
                    title="Tema claro"
                  >
                    <Sun size={14} />
                    Claro
                  </button>
                </div>
              </div>
              <div className={s['main-layout__profile-divider']} />
              <button
                className={s['main-layout__profile-logout']}
                onClick={() => { logout(); navigate('/login'); }}
              >
                <LogOut size={16} />
                <span>Cerrar sesión</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
