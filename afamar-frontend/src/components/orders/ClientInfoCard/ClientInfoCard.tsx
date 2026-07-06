import { Mail, Phone, MapPin } from 'lucide-react';
import type { Client } from '../../../types/client';
import styles from './ClientInfoCard.module.css';

const s = styles as unknown as Record<string, string>;

interface ClientInfoCardProps {
  client: Client | undefined;
}

export default function ClientInfoCard({ client }: ClientInfoCardProps) {
  return (
    <div>
      <h3 className={s['client-info-card__title']}>Cliente</h3>
      {client ? (
        <div className={s['client-info-card__details']}>
          <div className={s['client-info-card__name']}>{client.name}</div>
          {client.phone && (
            <div className={s['client-info-card__field']}>
              <Phone size={14} /> {client.phone}
            </div>
          )}
          {client.email && (
            <div className={s['client-info-card__field']}>
              <Mail size={14} /> {client.email}
            </div>
          )}
          {client.address && (
            <div className={s['client-info-card__field']}>
              <MapPin size={14} /> {client.address}
            </div>
          )}
        </div>
      ) : (
        <p className={s['client-info-card__empty']}>Seleccioná un cliente para ver sus datos.</p>
      )}
    </div>
  );
}
