import { useCallback, useEffect, useMemo, useState } from 'react';
import { authenticateUser, listUsers, logoutUser } from '../lib/otc/api';
import { supabase } from '../lib/supabase';
import type { User } from '../lib/otc/types';

const SESSION_KEY = 'contra-email-role-auth';

interface StoredSession {
  userId: string;
}

export function useEmailRoleAuth() {
  const [users, setUsers] = useState<User[]>([]);
  const [session, setSession] = useState<StoredSession | null>(() => {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as StoredSession;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  // Listen to Supabase auth state changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, supaSession) => {
      if (!supaSession) {
        // Signed out
        setSession(null);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const refreshUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session: supaSession } } = await supabase.auth.getSession();
      if (!supaSession) {
        setUsers([]);
        setSession(null);
        return [];
      }
      const nextUsers = await listUsers(true);
      setUsers(nextUsers);
      if (session && !nextUsers.some((user) => user.id === session.userId)) {
        setSession(null);
      }
      return nextUsers;
    } catch {
      // If backend is unreachable or token invalid, clear
      setUsers([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, [session]);

  // On mount, check for existing Supabase session and restore
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: { session: supaSession } } = await supabase.auth.getSession();
      if (!supaSession) {
        if (mounted) {
          setSession(null);
          setLoading(false);
        }
        return;
      }
      // We have a Supabase session — try to fetch users
      if (mounted) {
        await refreshUsers();
      }
    })();
    return () => { mounted = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (session) {
      window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } else {
      window.localStorage.removeItem(SESSION_KEY);
    }
  }, [session]);

  const currentUser = useMemo(
    () => users.find((user) => user.id === session?.userId) || null,
    [session?.userId, users],
  );

  const login = useCallback(async (email: string, password: string) => {
    // authenticateUser now signs in via Supabase and fetches /auth/me
    const user = await authenticateUser(email, password);
    const nextUsers = await listUsers(true);
    setUsers(nextUsers);
    setSession({ userId: user.id });
    return user;
  }, []);

  const logout = useCallback(async () => {
    await logoutUser();
    setSession(null);
    setUsers([]);
  }, []);

  return {
    loading,
    users,
    currentUser,
    authenticated: Boolean(currentUser),
    login,
    logout,
    refreshUsers,
  };
}
