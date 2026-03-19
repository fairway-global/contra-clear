import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import AppShell from './components/layout/AppShell';
import Panel from './components/layout/Panel';
import CreateRFQModal from './components/platform/CreateRFQModal';
import { useAuth } from './hooks/useAuth';
import { usePlatform } from './hooks/usePlatform';
import { useRouter } from './hooks/useRouter';
import {
  AcceptInvitePage,
  ForgotPasswordPage,
  LoginPage,
  ResetPasswordPage,
} from './pages/AuthPages';
import DashboardPage from './pages/DashboardPage';
import EscrowPage from './pages/EscrowPage';
import InstitutionsPage from './pages/InstitutionsPage';
import LandingPage from './pages/LandingPage';
import RFQDetailsPage from './pages/RFQDetailsPage';
import RFQsPage from './pages/RFQsPage';
import SettlementsPage from './pages/SettlementsPage';
import UsersPage from './pages/UsersPage';

const PUBLIC_ROUTES = new Set(['landing', 'login', 'accept-invite', 'forgot-password', 'reset-password']);
const AUTH_ROUTES = new Set(['login', 'accept-invite', 'forgot-password', 'reset-password']);
const BANK_ONLY_ROUTES = new Set(['institutions', 'users']);

function FullScreenState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="min-h-screen bg-terminal-bg px-4 py-10 text-terminal-text">
      <div className="mx-auto max-w-xl">
        <Panel title={title}>
          <div className="space-y-4">
            <p className="text-sm leading-7 text-terminal-dim">{description}</p>
            {actionLabel && onAction ? (
              <button type="button" className="btn-primary" onClick={onAction}>
                {actionLabel}
              </button>
            ) : null}
          </div>
        </Panel>
      </div>
    </div>
  );
}

export default function App() {
  const { profile, loading, login, logout, refreshProfile, acceptInvite, forgotPassword, resetPassword } = useAuth();
  const { createRFQ, resetDemoData } = usePlatform();
  const { pathname, searchParams, route, navigate } = useRouter();
  const [showCreateRFQModal, setShowCreateRFQModal] = useState(false);

  const isPublicRoute = PUBLIC_ROUTES.has(route.name);
  const isAuthRoute = AUTH_ROUTES.has(route.name);
  const isBankOnlyRoute = BANK_ONLY_ROUTES.has(route.name);

  useEffect(() => {
    if (loading) return;

    if (!profile && !isPublicRoute) {
      navigate('/login', true);
      return;
    }

    if (profile && isAuthRoute) {
      navigate('/dashboard', true);
      return;
    }

    if (profile && profile.user.role !== 'BANK' && isBankOnlyRoute) {
      navigate('/dashboard', true);
    }
  }, [isAuthRoute, isBankOnlyRoute, isPublicRoute, loading, navigate, profile]);

  const protectedContent = useMemo(() => {
    if (!profile) return null;

    switch (route.name) {
      case 'dashboard':
        return <DashboardPage profile={profile} onNavigate={navigate} />;
      case 'rfqs':
        return (
          <RFQsPage
            profile={profile}
            onNavigate={navigate}
            onOpenCreateModal={() => setShowCreateRFQModal(true)}
          />
        );
      case 'rfq-details':
        return <RFQDetailsPage profile={profile} rfqId={route.rfqId} />;
      case 'institutions':
        return <InstitutionsPage profile={profile} />;
      case 'users':
        return <UsersPage profile={profile} />;
      case 'escrow':
        return <EscrowPage profile={profile} />;
      case 'settlements':
        return <SettlementsPage profile={profile} />;
      case 'not-found':
      default:
        return (
          <FullScreenState
            title="Page Not Found"
            description="That route is not configured in this bank workspace."
            actionLabel="Return to Dashboard"
            onAction={() => navigate('/dashboard', true)}
          />
        );
    }
  }, [navigate, profile, route]);

  if (loading) {
    return (
      <FullScreenState
        title="Loading Workspace"
        description="Rehydrating your tenant-scoped session and bank workflow data."
      />
    );
  }

  if (!profile && !isPublicRoute) {
    return (
      <FullScreenState
        title="Redirecting"
        description="Your session is not active, so the platform is returning you to the login screen."
      />
    );
  }

  if (profile && isAuthRoute) {
    return (
      <FullScreenState
        title="Opening Workspace"
        description="Your session is active. Redirecting to your dashboard now."
      />
    );
  }

  if (route.name === 'landing') {
    return (
      <LandingPage
        isAuthenticated={Boolean(profile)}
        onPrimaryAction={() => navigate(profile ? '/dashboard' : '/login')}
      />
    );
  }

  if (profile && profile.user.role !== 'BANK' && isBankOnlyRoute) {
    return (
      <FullScreenState
        title="Access Restricted"
        description="That page is reserved for bank-side operators. Redirecting you to your institution dashboard."
      />
    );
  }

  if (!profile) {
    switch (route.name) {
      case 'accept-invite':
        return (
          <AcceptInvitePage
            token={searchParams.get('token') ?? ''}
            onAccept={async (input) => {
              await acceptInvite(input);
            }}
          />
        );
      case 'forgot-password':
        return <ForgotPasswordPage onSubmit={forgotPassword} />;
      case 'reset-password':
        return (
          <ResetPasswordPage
            token={searchParams.get('token') ?? ''}
            onSubmit={resetPassword}
          />
        );
      case 'login':
      case 'not-found':
      default:
        return <LoginPage onLogin={login} onNavigate={navigate} />;
    }
  }

  return (
    <>
      <AppShell
        profile={profile}
        activePath={pathname}
        onNavigate={navigate}
        onLogout={() => {
          void logout().then(() => navigate('/login', true));
        }}
        onResetDemoData={() => {
          resetDemoData();
          void refreshProfile().then((nextProfile) => {
            if (!nextProfile) {
              navigate('/login', true);
              return;
            }
            toast.success('Demo data reset');
          });
        }}
      >
        {protectedContent}
      </AppShell>

      {profile.user.role === 'INSTITUTION' ? (
        <CreateRFQModal
          open={showCreateRFQModal}
          tenant={profile.tenant}
          onClose={() => setShowCreateRFQModal(false)}
          onSubmit={async (input) => {
            try {
              const rfq = await createRFQ(profile.user.id, input);
              toast.success('RFQ submitted to bank');
              navigate(`/rfqs/${rfq.id}`);
            } catch (err: any) {
              toast.error(err.message || 'Unable to submit RFQ');
              throw err;
            }
          }}
        />
      ) : null}
    </>
  );
}
