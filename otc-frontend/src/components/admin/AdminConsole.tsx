import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import AdminDashboard from './AdminDashboard';
import AdminRFQTable from './otc/AdminRFQTable';
import AdminEscrowMonitor from './otc/AdminEscrowMonitor';
import UserManagementTable from './users/UserManagementTable';
import UserFormModal from './users/UserFormModal';
import Panel from '../layout/Panel';
import EscrowTimeline from '../otc/escrow/EscrowTimeline';
import {
  createUser,
  deleteUser,
  getAdminEscrow,
  getAdminRFQs,
  getNegotiationThread,
  listUsers,
  updateUser,
} from '../../lib/otc/api';
import type { ActivityEvent, RFQ, User, UserMutationInput } from '../../lib/otc/types';
import { RFQStatus, UserRole } from '../../lib/otc/types';

interface AdminConsoleProps {
  route: '/admin/otc' | '/admin/rfqs' | '/admin/users' | '/admin/settlements' | '/admin/escrow';
  currentUser: User | null;
  onUsersChanged: () => Promise<void> | void;
  onNavigate: (path: string) => void;
}

export default function AdminConsole({ route, currentUser, onUsersChanged }: AdminConsoleProps) {
  const [rfqs, setRfqs] = useState<Array<RFQ & { quoteCount?: number; activityCount?: number }>>([]);
  const [escrows, setEscrows] = useState<any[]>([]);
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<'ALL' | 'RFQ_ORIGINATOR' | 'LIQUIDITY_PROVIDER'>('ALL');
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [savingUser, setSavingUser] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [nextRfqs, nextEscrows, nextUsers] = await Promise.all([
        getAdminRFQs(),
        getAdminEscrow(),
        listUsers(),
      ]);

      setRfqs(nextRfqs);
      setEscrows(nextEscrows);
      setUsers(nextUsers);

      const threads = await Promise.all(nextRfqs.slice(0, 6).map((rfq) => getNegotiationThread(rfq.id)));
      setActivities(
        threads
          .flat()
          .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
          .slice(0, 12),
      );
    } catch (error: any) {
      toast.error(error.message || 'Failed to load admin OTC views');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (route === '/admin/otc') {
      return;
    }
    void refresh();
  }, [refresh, route]);

  // WebSocket: auto-refresh on events
  useEffect(() => {
    const wsUrl = (import.meta as any).env?.VITE_WS_URL || 'ws://localhost:3002';
    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket(wsUrl);
      ws.onmessage = () => { void refresh(); };
      ws.onclose = () => { setTimeout(() => { /* reconnect handled by remount */ }, 5000); };
    } catch { /* ignore */ }
    return () => { if (ws) ws.close(); };
  }, [refresh]);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return userRoleFilter === 'ALL' ? users : users.filter((user) => user.role === userRoleFilter);
    }

    return users.filter((user) =>
      (userRoleFilter === 'ALL' || user.role === userRoleFilter) &&
      [user.fullName, user.email, user.role, user.status].some((value) => value.toLowerCase().includes(query)),
    );
  }, [search, userRoleFilter, users]);

  const settlementRFQs = useMemo(
    () => rfqs.filter((rfq) => [
      RFQStatus.AwaitingOriginatorDeposit,
      RFQStatus.AwaitingProviderDeposit,
      RFQStatus.ReadyToSettle,
      RFQStatus.Settling,
      RFQStatus.Settled,
    ].includes(rfq.status)),
    [rfqs],
  );

  const handleSaveUser = async (payload: UserMutationInput) => {
    setSavingUser(true);
    try {
      if (editingUser) {
        await updateUser(editingUser.id, payload);
        toast.success('User updated');
      } else {
        await createUser(payload);
        toast.success('User created');
      }

      setUserModalOpen(false);
      setEditingUser(null);
      await refresh();
      await onUsersChanged();
    } finally {
      setSavingUser(false);
    }
  };

  const handleDeleteUser = async (user: User) => {
    if (!window.confirm(`Delete ${user.fullName}?`)) {
      return;
    }

    await deleteUser(user.id);
    toast.success('User deleted');
    await refresh();
    await onUsersChanged();
  };

  if (currentUser?.role !== UserRole.ADMIN) {
    return (
      <Panel title="Admin Access">
        <div className="py-12 text-center font-mono text-sm text-terminal-dim">
          Switch the OTC role selector to Admin to view these routes.
        </div>
      </Panel>
    );
  }

  if (route === '/admin/otc') {
    return <AdminDashboard />;
  }

  if (route === '/admin/rfqs') {
    return (
      <AdminRFQTable
        title={loading ? 'RFQ Activity (loading...)' : 'RFQ Activity'}
        rfqs={rfqs}
      />
    );
  }

  if (route === '/admin/users') {
    return (
      <>
        <UserManagementTable
          users={filteredUsers}
          search={search}
          onSearchChange={setSearch}
          roleFilter={userRoleFilter}
          onRoleFilterChange={setUserRoleFilter}
          onCreate={() => {
            setEditingUser(null);
            setUserModalOpen(true);
          }}
          onEdit={(user) => {
            setEditingUser(user);
            setUserModalOpen(true);
          }}
          onDelete={handleDeleteUser}
        />
        <UserFormModal
          open={userModalOpen}
          user={editingUser}
          saving={savingUser}
          onClose={() => {
            setUserModalOpen(false);
            setEditingUser(null);
          }}
          onSubmit={handleSaveUser}
        />
      </>
    );
  }

  if (route === '/admin/settlements') {
    return (
      <div className="space-y-4">
        <AdminRFQTable title={loading ? 'Settlement Queue (loading...)' : 'Settlement Queue'} rfqs={settlementRFQs} />
        <EscrowTimeline events={activities} />
      </div>
    );
  }

  return <AdminEscrowMonitor escrows={escrows} />;
}
