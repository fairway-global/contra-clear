import { useCallback, useEffect, useMemo, useState } from 'react';

export type RouteMatch =
  | { name: 'landing' }
  | { name: 'login' }
  | { name: 'accept-invite' }
  | { name: 'forgot-password' }
  | { name: 'reset-password' }
  | { name: 'dashboard' }
  | { name: 'rfqs' }
  | { name: 'rfq-details'; rfqId: string }
  | { name: 'institutions' }
  | { name: 'users' }
  | { name: 'escrow' }
  | { name: 'settlements' }
  | { name: 'not-found' };

function matchRoute(pathname: string): RouteMatch {
  if (pathname === '/') return { name: 'landing' };
  if (pathname === '/login') return { name: 'login' };
  if (pathname === '/accept-invite') return { name: 'accept-invite' };
  if (pathname === '/forgot-password') return { name: 'forgot-password' };
  if (pathname === '/reset-password') return { name: 'reset-password' };
  if (pathname === '/dashboard') return { name: 'dashboard' };
  if (pathname === '/rfqs') return { name: 'rfqs' };
  if (pathname.startsWith('/rfqs/')) {
    return { name: 'rfq-details', rfqId: pathname.replace('/rfqs/', '') };
  }
  if (pathname === '/institutions') return { name: 'institutions' };
  if (pathname === '/users') return { name: 'users' };
  if (pathname === '/escrow') return { name: 'escrow' };
  if (pathname === '/settlements') return { name: 'settlements' };
  return { name: 'not-found' };
}

export function useRouter() {
  const [location, setLocation] = useState(() => ({
    pathname: window.location.pathname,
    search: window.location.search,
  }));

  useEffect(() => {
    const handlePopState = () => {
      setLocation({
        pathname: window.location.pathname,
        search: window.location.search,
      });
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = useCallback((to: string, replace = false) => {
    if (replace) {
      window.history.replaceState({}, '', to);
    } else {
      window.history.pushState({}, '', to);
    }
    setLocation({
      pathname: window.location.pathname,
      search: window.location.search,
    });
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  const route = useMemo(() => matchRoute(location.pathname), [location.pathname]);
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);

  return {
    pathname: location.pathname,
    searchParams,
    route,
    navigate,
  };
}
