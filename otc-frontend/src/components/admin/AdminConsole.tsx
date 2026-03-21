import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import AdminOTCDashboard from './otc/AdminOTCDashboard';
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
  getAdminOverview,
  getAdminRFQs,
  getNegotiationThread,
  listUsers,
  updateUser,
} from '../../lib/otc/mockService';
import type { ActivityEvent, OTCAdminOverview, RFQ, User, UserMutationInput } from '../../lib/otc/types';
import { RFQStatus, UserRole } from '../../lib/otc/types';

interface AdminConsoleProps {
  route: '/admin/otc' | '/admin/users' | '/admin/settlements' | '/admin/escrow';
  currentUser: User | null;
  onUsersChanged: () => Promise<void> | void;
  onNavigate: (path: string) => void;
}

export default function AdminConsole({ route, currentUser, onUsersChanged, onNavigate }: AdminConsoleProps) {
  const [overview, setOverview] = useState<OTCAdminOverview | null>(null);
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
      const [nextOverview, nextRfqs, nextEscrows, nextUsers] = await Promise.all([
        getAdminOverview(),
        getAdminRFQs(),
        getAdminEscrow(),
        listUsers(),
      ]);
      setOverview(nextOverview);
      setRfqs(nextRfqs);
      setEscrows(nextEscrows);
      setUsers(nextUsers);
      const threads = await Promise.all(nextRfqs.slice(0, 4).map((rfq) => getNegotiationThread(rfq.id)));
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
    void refresh();
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
    () => rfqs.filter((rfq) => [RFQStatus.AwaitingOriginatorDeposit, RFQStatus.AwaitingProviderDeposit, RFQStatus.ReadyToSettle, RFQStatus.Settling, RFQStatus.Settled].includes(rfq.status)),
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

  const sectionTabs = (
    <div className="flex flex-wrap items-center gap-1">
      {[
        { path: '/admin/otc', label: 'Overview' },
        { path: '/admin/users', label: 'Users' },
        { path: '/admin/settlements', label: 'Settlements' },
        { path: '/admin/escrow', label: 'Escrow' },
      ].map((tab) => (
        <button
          key={tab.path}
          type="button"
          onClick={() => onNavigate(tab.path)}
          className={`rounded px-3 py-1.5 font-mono text-xs transition-colors ${
            route === tab.path
              ? 'bg-terminal-accent/10 text-terminal-accent'
              : 'text-terminal-dim hover:text-terminal-text'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );

  if (route === '/admin/users') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="font-mono text-xl text-terminal-text">Admin User Management</h1>
            <p className="mt-1 font-mono text-xs text-terminal-dim">Manage RFQ Originator and Liquidity Provider records.</p>
          </div>
          {sectionTabs}
        </div>
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
      </div>
    );
  }

  if (route === '/admin/settlements') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="font-mono text-xl text-terminal-text">Settlement Monitoring</h1>
            <p className="mt-1 font-mono text-xs text-terminal-dim">Track bilateral funding, settlement readiness, and release activity.</p>
          </div>
          {sectionTabs}
        </div>
        <AdminRFQTable title={loading ? 'Settlement Queue (loading...)' : 'Settlement Queue'} rfqs={settlementRFQs} />
        <EscrowTimeline events={activities} />
      </div>
    );
  }

  if (route === '/admin/escrow') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="font-mono text-xl text-terminal-text">Escrow Monitor</h1>
            <p className="mt-1 font-mono text-xs text-terminal-dim">Watch both sides of each OTC obligation as funding progresses.</p>
          </div>
          {sectionTabs}
        </div>
        <AdminEscrowMonitor escrows={escrows} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-mono text-xl text-terminal-text">Admin OTC Overview</h1>
          <p className="mt-1 font-mono text-xs text-terminal-dim">Platform summary, live RFQ monitoring, escrow operations, and audit feed.</p>
        </div>
        {sectionTabs}
      </div>
      <AdminOTCDashboard
        overview={overview}
        rfqs={rfqs}
        escrows={escrows}
        activities={activities}
      />
    </div>
  );
}
