import { useCallback, useEffect, useMemo, useState } from 'react';
import { authenticateUser, listUsers } from '../lib/otc/mockService';
import type { User } from '../lib/otc/types';

const SESSION_KEY = 'contra-email-role-auth';

interface StoredSession {
  userId: string;
}

export function useEmailRoleAuth() {
  const [users, setUsers] = useState<User[]>([]);
  const [session, setSession] = useState<StoredSession | null>(() => {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as StoredSession;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  const refreshUsers = useCallback(async () => {
    setLoading(true);
    try {
      const nextUsers = await listUsers(true);
      setUsers(nextUsers);
      if (session && !nextUsers.some((user) => user.id === session.userId)) {
        setSession(null);
      }
      return nextUsers;
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    void refreshUsers();
  }, [refreshUsers]);

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
    const user = await authenticateUser(email, password);
    const nextUsers = users.length ? users : await listUsers(true);
    setUsers(nextUsers);
    setSession({ userId: user.id });
    return user;
  }, [users]);

  const logout = useCallback(() => {
    setSession(null);
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
