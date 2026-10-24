/**
 * Header + info row of the "FICHA DE TALLER" PDF.
 *
 * Extracted verbatim from `WorkshopSheet.tsx`: same styles, same texts.
 */
import { Image, Text, View } from '@react-pdf/renderer';
import { API_URL } from '../../../api/http';
import type { WorkshopPdfData } from '../../../utils/pdf/buildWorkshopPdfData';
import { styles } from './WorkshopSheet.styles';

/** Absolute URL for the company logo (served from /uploads/logo.png). */
function logoUrl(company: WorkshopPdfData['company']): string | null {
  const path = company.company_logo || '/uploads/logo.png';
  if (!path) return null;
  const base = API_URL.endsWith('/api/v1') ? API_URL.slice(0, -'/api/v1'.length) : '';
  return path.startsWith('http') ? path : `${base}${path}`;
}

interface WorkshopHeaderProps {
  company: WorkshopPdfData['company'];
  number: string;
  date: string;
}

/** Logo + datos de la empresa (izquierda) y título + número de orden (derecha). */
export function WorkshopHeader({ company, number, date }: WorkshopHeaderProps) {
  const logo = logoUrl(company);

  return (
    <View style={styles.headerRow}>
      <View style={styles.headerLeft}>
        {logo ? (
          <View style={styles.headerLeftLogo}>
            <Image style={styles.logo} src={logo} />
          </View>
        ) : null}
        <View style={styles.headerLeftInfo}>
          <Text style={styles.tagline}>
            {company.company_tagline || company.company_name || 'AFAMAR'}
          </Text>
          <Text style={styles.contactLine}>{company.company_address}</Text>
          <Text style={styles.contactLine}>
            {[company.company_phone, company.company_email]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </View>
      </View>
      <View style={styles.headerRight}>
        <Text style={styles.docTitle}>FICHA DE TALLER</Text>
        <Text style={styles.docNumber}>N° {number || '—'}</Text>
        {date ? <Text style={styles.contactLine}>Fecha: {date}</Text> : null}
      </View>
    </View>
  );
}

interface WorkshopInfoGridProps {
  materials: string[];
  clientName: string;
}

/** Material + cliente de la orden. */
export function WorkshopInfoGrid({ materials, clientName }: WorkshopInfoGridProps) {
  return (
    <View style={styles.infoGrid}>
      <View style={styles.infoCell}>
        <Text>
          <Text style={styles.infoLabel}>Material: </Text>
          <Text style={styles.infoValue}>
            {materials.length > 0 ? materials.join('\n') : '—'}
          </Text>
        </Text>
      </View>
      {clientName ? (
        <View style={styles.infoCell}>
          <Text>
            <Text style={styles.infoLabel}>Cliente: </Text>
            <Text style={styles.infoValue}>{clientName}</Text>
          </Text>
        </View>
      ) : null}
    </View>
  );
}
