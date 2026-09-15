import React from 'react';
import styles from './FormHeader.module.css';

const s = styles as unknown as Record<string, string>;

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
    <div className={`${s['form-header']}${className ? ` ${className}` : ''}`}>
      {logoUrl && (
        <div className={s['form-header__logo']}>
          <img src={logoUrl} alt="Logo AFAMAR" />
        </div>
      )}
      <div className={s['form-header__row']}>
        <div className={s['form-header__title']}>
          <span className={s['form-header__title-text']}>{title}</span>
          {badge}
        </div>
        <div className={s['form-header__actions']}>{children}</div>
      </div>
    </div>
  );
}