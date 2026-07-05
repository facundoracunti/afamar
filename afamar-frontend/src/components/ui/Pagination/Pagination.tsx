import React from 'react';
import styles from './Pagination.module.css';

const s = styles as unknown as Record<string, string>;

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  /** Optional label override; default "resultados". */
  label?: string;
}

export function Pagination({ page, pageSize, total, onPageChange, label = 'resultados' }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const isFirst = page <= 1;
  const isLast = page >= totalPages;

  // Build a compact window of page numbers: first, …, current-1, current, current+1, …, last
  const pages: (number | '…')[] = [];
  const push = (v: number | '…') => { if (pages[pages.length - 1] !== v) pages.push(v); };
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - page) <= 1) push(i);
    else push('…');
  }

  return (
    <div className={s['pagination']}>
      <button
        type="button"
        className={s['pagination__btn']}
        disabled={isFirst}
        onClick={() => onPageChange(page - 1)}
        aria-label="Pagina anterior"
      >
        ‹ Anterior
      </button>
      {pages.map((p, idx) =>
        p === '…' ? (
          <span key={`gap-${idx}`} className={s['pagination__gap']}>…</span>
        ) : (
          <button
            key={p}
            type="button"
            className={`${s['pagination__btn']}${p === page ? ' ' + s['pagination__btn--active'] : ''}`}
            onClick={() => onPageChange(p)}
            aria-current={p === page ? 'page' : undefined}
          >
            {p}
          </button>
        ),
      )}
      <button
        type="button"
        className={s['pagination__btn']}
        disabled={isLast}
        onClick={() => onPageChange(page + 1)}
        aria-label="Pagina siguiente"
      >
        Siguiente ›
      </button>
      <span className={s['pagination__info']}>
        {total === 0
          ? `Sin ${label}`
          : `${from}–${to} de ${total} ${label}`}
      </span>
    </div>
  );
}