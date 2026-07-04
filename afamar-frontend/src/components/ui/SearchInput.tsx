import type { ReactNode } from "react";
import styles from "./SearchInput.module.css";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  leftIcon?: ReactNode;
}

export function SearchInput({ value, onChange, placeholder = "Buscar...", leftIcon }: SearchInputProps) {
  return (
    <div className={styles.wrapper}>
      {leftIcon && <span className={styles.wrapper__icon}>{leftIcon}</span>}
      <input
        className={styles.input}
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
