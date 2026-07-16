import React, { useMemo, useRef, useState } from 'react';
import { Plus, ChevronDown } from 'lucide-react';
import type { ClientAddress } from '../../../types/client';
import styles from './ClientSection.module.css';

const s = styles as unknown as Record<string, string>;

interface AddressPickerProps {
  addresses: ClientAddress[];
  selectedAddressId: number | null;
  clientAddress: string;
  readOnly: boolean;
  onSelect: (addr: ClientAddress) => void;
  onClear: () => void;
  onAddNew: (text: string) => Promise<void>;
}

export function AddressPicker({
  addresses,
  selectedAddressId,
  clientAddress,
  readOnly,
  onSelect,
  onClear,
  onAddNew,
}: AddressPickerProps) {
  const [addrOpen, setAddrOpen] = useState(false);
  const [addrQuery, setAddrQuery] = useState('');
  const [newAddrText, setNewAddrText] = useState('');
  const [addingAddr, setAddingAddr] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const selectedAddress = selectedAddressId
    ? addresses.find((a) => a.id === selectedAddressId)
    : null;

  const filteredAddresses = useMemo(() => {
    const q = addrQuery.trim().toLowerCase();
    if (!q) return addresses;
    return addresses.filter((a) => {
      const addr = (a.address || '').toLowerCase();
      const label = (a.label || '').toLowerCase();
      return addr.includes(q) || label.includes(q);
    });
  }, [addresses, addrQuery]);

  const handleAddAddress = async () => {
    if (!newAddrText.trim()) return;
    setAddingAddr(true);
    try {
      await onAddNew(newAddrText.trim());
      setNewAddrText('');
      setAddrQuery('');
    } finally {
      setAddingAddr(false);
    }
  };

  if (readOnly) return null;

  return (
    <div ref={wrapperRef} className={s['client-section__addr-picker']}>
      <button
        type="button"
        className={s['client-section__addr-trigger']}
        onClick={() => setAddrOpen((v) => !v)}
      >
        <span className={s['client-section__addr-trigger-text']}>
          {selectedAddress
            ? `${selectedAddress.label ? selectedAddress.label + ' — ' : ''}${selectedAddress.address}`
            : 'Usar dirección principal'
          }
        </span>
        <ChevronDown size={14} />
      </button>
      {selectedAddress && (
        <button
          type="button"
          className={s['client-section__addr-clear']}
          onClick={onClear}
          title="Volver a dirección principal"
        >
          ✕
        </button>
      )}
      {addrOpen && (
        <div className={s['client-section__addr-dropdown']}>
          <input
            className={s['client-section__addr-search']}
            placeholder="Buscar dirección..."
            value={addrQuery}
            onChange={(e) => setAddrQuery(e.target.value)}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setAddrOpen(false);
                setAddrQuery('');
              }
            }}
          />
          <button
            type="button"
            className={`${s['client-section__addr-option']} ${!selectedAddressId ? s['client-section__addr-option--active'] : ''}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => { onClear(); setAddrOpen(false); }}
          >
            <span className={s['client-section__addr-option-label']}>Principal</span>
            <span className={s['client-section__addr-option-addr']}>{clientAddress || '—'}</span>
          </button>
          {filteredAddresses.filter((a) => !a.is_default).map((addr) => (
            <button
              key={addr.id}
              type="button"
              className={`${s['client-section__addr-option']} ${selectedAddressId === addr.id ? s['client-section__addr-option--active'] : ''}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onSelect(addr); setAddrOpen(false); }}
            >
              <span className={s['client-section__addr-option-label']}>
                {addr.label || `Alternativa ${addr.id}`}
              </span>
              <span className={s['client-section__addr-option-addr']}>{addr.address}</span>
            </button>
          ))}
          {filteredAddresses.filter((a) => !a.is_default).length === 0 && addrQuery.trim() && (
            <div className={s['client-section__addr-empty']}>
              Sin resultados para "{addrQuery.trim()}"
            </div>
          )}
          <div className={s['client-section__addr-new']}>
            <input
              className={s['client-section__addr-new-input']}
              placeholder="Nueva dirección..."
              value={newAddrText}
              onChange={(e) => setNewAddrText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddAddress(); } }}
              disabled={addingAddr}
            />
            <button
              type="button"
              className={s['client-section__addr-new-btn']}
              onClick={handleAddAddress}
              disabled={addingAddr || !newAddrText.trim()}
            >
              <Plus size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
