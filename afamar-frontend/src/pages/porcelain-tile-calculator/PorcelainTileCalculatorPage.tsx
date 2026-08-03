import { Grid3x3 } from 'lucide-react';
import PorcelainTileCalculator from '../../components/calculator/PorcelainTileCalculator/PorcelainTileCalculator';
import styles from './PorcelainTileCalculatorPage.module.css';

const s = styles as unknown as Record<string, string>;

export default function PorcelainTileCalculatorPage() {
  return (
    <div className={s['porcelain-tile-calculator']}>
      <div className={s['porcelain-tile-calculator__header']}>
        <h1 className={s['porcelain-tile-calculator__title']}>
          <Grid3x3 size={24} /> Calculadora de Porcelanato
        </h1>
        <p className={s['porcelain-tile-calculator__subtitle']}>
          Calculá la producción de zócalos a partir de placas de porcelanato (solo el servicio de corte).
        </p>
      </div>
      <div className={`card ${s['porcelain-tile-calculator__card']}`}>
        <PorcelainTileCalculator currency="ARS" />
      </div>
    </div>
  );
}
