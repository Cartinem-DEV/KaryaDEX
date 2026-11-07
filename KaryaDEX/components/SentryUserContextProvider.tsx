// components/SentryUserContextProvider.tsx
// Syncs authenticated user context to Sentry

import React, { useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { setUserContext, addBreadcrumb } from '@/services/monitoring/sentryService';

interface Props {
  children: React.ReactNode;
}

export function SentryUserContextProvider({ children }: Props) {
  const { user, isAuthenticated } = useAppStore();

  useEffect(() => {
    if (isAuthenticated && user) {
      setUserContext({
        id: user.id,
        email: user.email,
        name: user.name,
      });

      addBreadcrumb({
        category: 'auth',
        message: `User signed in: ${user.id}`,
        level: 'info',
        data: { userId: user.id },
      });
    } else {
      setUserContext(null);

      addBreadcrumb({
        category: 'auth',
        message: 'User signed out',
        level: 'info',
      });
    }
  }, [isAuthenticated, user]);

  return <>{children}</>;
}