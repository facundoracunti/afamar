import type { ReactNode } from "react";
import { LoadingSpinner } from "./LoadingSpinner";
import { ErrorBlock } from "./ErrorBlock";
import { EmptyState } from "./EmptyState";

interface ListPageProps {
  loading: boolean;
  error: string | null;
  items: unknown[];
  emptyMessage?: string;
  onRetry: () => void;
  children: ReactNode;
}

export function ListPage({ loading, error, items, emptyMessage = "Sin datos", onRetry, children }: ListPageProps) {
  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorBlock message={error} onRetry={onRetry} />;
  if (items.length === 0) return <EmptyState message={emptyMessage} />;
  return <>{children}</>;
}
