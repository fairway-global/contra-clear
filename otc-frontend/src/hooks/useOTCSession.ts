import { useEffect, useMemo, useState } from 'react';
import { listUsers } from '../lib/otc/mockService';
import type { User } from '../lib/otc/types';
import { UserRole } from '../lib/otc/types';

const ROLE_KEY = 'contra-otc-role';
const USER_KEY = 'contra-otc-user';

function getStoredRole(): UserRole {
  const stored = window.localStorage.getItem(ROLE_KEY) as UserRole | null;
  if (stored && Object.values(UserRole).includes(stored)) {
    return stored;
  }
  return UserRole.RFQ_ORIGINATOR;
}

export function useOTCSession() {
  const [users, setUsers] = useState<User[]>([]);
  const [role, setRoleState] = useState<UserRole>(() => getStoredRole());
  const [selectedUserId, setSelectedUserId] = useState<string>(() => window.localStorage.getItem(USER_KEY) || '');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    listUsers(true)
      .then((nextUsers) => {
        if (mounted) {
          setUsers(nextUsers);
        }
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  const usersForRole = useMemo(
    () => users.filter((user) => user.role === role),
    [role, users],
  );

  useEffect(() => {
    if (!users.length) {
      return;
    }
    const validUser = usersForRole.find((user) => user.id === selectedUserId) || usersForRole[0];
    if (validUser && validUser.id !== selectedUserId) {
      setSelectedUserId(validUser.id);
    }
  }, [selectedUserId, users, usersForRole]);

  useEffect(() => {
    window.localStorage.setItem(ROLE_KEY, role);
  }, [role]);

  useEffect(() => {
    if (selectedUserId) {
      window.localStorage.setItem(USER_KEY, selectedUserId);
    }
  }, [selectedUserId]);

  const currentUser = useMemo(
    () => users.find((user) => user.id === selectedUserId) || usersForRole[0] || null,
    [selectedUserId, users, usersForRole],
  );

  return {
    loading,
    role,
    setRole: setRoleState,
    users,
    usersForRole,
    currentUser,
    selectedUserId: currentUser?.id || '',
    setSelectedUserId,
    refresh: async () => {
      setLoading(true);
      const nextUsers = await listUsers(true);
      setUsers(nextUsers);
      setLoading(false);
    },
  };
}
