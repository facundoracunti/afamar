/**
 * The ADDITIONAL-WORKS CATALOGUE used by the pieces-flow
 * (`useBudgetPieces`).
 *
 * The catalogue (traforos, frentes, …) is fetched once and exposed as a
 * `Map` keyed by catalogue id so the re-pricing helpers can resolve a
 * row's formula (multiplier) in O(1).
 */
import { useEffect, useMemo, useState } from 'react';
import type { AdditionalWork } from '@/types/additionalWork';
import { getAdditionalWorks } from '@/api/resources/additionalWorks';

export interface FrontCatalogue {
  /** The raw catalogue rows. */
  frontCatalogue: AdditionalWork[];
  /** The same rows indexed by catalogue id. */
  catalogueById: Map<number, AdditionalWork>;
}

export function useFrontCatalogue(): FrontCatalogue {
  const [frontCatalogue, setFrontCatalogue] = useState<AdditionalWork[]>([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getAdditionalWorks();
        if (!cancelled) setFrontCatalogue(data as AdditionalWork[]);
      } catch {
        if (!cancelled) setFrontCatalogue([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const catalogueById = useMemo(
    () => new Map(frontCatalogue.map((c) => [c.id, c])),
    [frontCatalogue],
  );

  return { frontCatalogue, catalogueById };
}
