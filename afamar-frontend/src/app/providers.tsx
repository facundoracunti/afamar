// @ts-nocheck
import { QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/context/AuthContext';
import { NotificationProvider } from '@/context/NotificationContext';
import { ReferencesProvider } from '@/context/ReferencesContext';
import { queryClient } from '@/shared/api/queryClient';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <NotificationProvider>
          <ReferencesProvider>
            {children}
          </ReferencesProvider>
        </NotificationProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
