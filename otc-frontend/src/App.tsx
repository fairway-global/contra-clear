import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import toast from 'react-hot-toast';
import { useAuth } from './hooks/useAuth';
import { useEmailRoleAuth } from './hooks/useEmailRoleAuth';

import Header from './components/layout/Header';
import RootDashboard from './components/home/RootDashboard';
import LoginPage from './components/auth/LoginPage';
import SignupPage from './components/auth/SignupPage';
import BalanceCard from './components/portfolio/BalanceCard';
import DepositPanel from './components/deposit/DepositPanel';
import WithdrawPanel from './components/withdraw/WithdrawPanel';
import OTCWorkspace from './components/otc/OTCWorkspace';
import AdminConsole from './components/admin/AdminConsole';
import KYCVerificationPage from './components/auth/KYCVerificationPage';
import FaucetPage from './components/faucet/FaucetPage';
import { CONTRA_GATEWAY_URL, SOLANA_VALIDATOR_URL } from './lib/constants';
import { submitPlatformAccessRequest } from './lib/otc/api';
import type { PlatformAccessRequestInput, User } from './lib/otc/types';
import { UserRole } from './lib/otc/types';

type AppRoute =
  | { kind: 'root'; path: '/' }
  | { kind: 'login'; path: '/login' }
  | { kind: 'signup'; path: '/signup' }
  | { kind: 'deposit'; path: '/deposit' }
  | { kind: 'withdraw'; path: '/withdraw' }
  | { kind: 'otc-rfqs'; path: '/otc/rfqs' }
  | { kind: 'otc-rfq-detail'; path: string; rfqId: string }
  | { kind: 'otc-escrow'; path: '/otc/escrow' }
  | { kind: 'otc-settlements'; path: '/otc/settlements' }
  | { kind: 'admin-otc'; path: '/admin/otc' }
  | { kind: 'admin-rfqs'; path: '/admin/rfqs' }
  | { kind: 'admin-users'; path: '/admin/users' }
  | { kind: 'admin-settlements'; path: '/admin/settlements' }
  | { kind: 'admin-escrow'; path: '/admin/escrow' }
  | { kind: 'kyc'; path: '/kyc' }
  | { kind: 'kyb'; path: '/kyb' }
  | { kind: 'faucet'; path: '/faucet' };

function normalizePathname(pathname: string): string {
  if (!pathname || pathname === '/') {
    return '/';
  }
  return pathname.replace(/\/+$/, '');
}

function parseRoute(pathname: string): AppRoute {
  const path = normalizePathname(pathname);

  if (path === '/') {
    return { kind: 'root', path: '/' };
  }
  if (path === '/login') {
    return { kind: 'login', path };
  }
  if (path === '/signup') {
    return { kind: 'signup', path };
  }
  if (path === '/deposit') {
    return { kind: 'deposit', path };
  }
  if (path === '/withdraw') {
    return { kind: 'withdraw', path };
  }
  if (path === '/otc' || path === '/trade') {
    return { kind: 'otc-rfqs', path: '/otc/rfqs' };
  }
  if (path === '/otc/rfqs') {
    return { kind: 'otc-rfqs', path };
  }
  if (path.startsWith('/otc/rfqs/')) {
    const rfqId = path.slice('/otc/rfqs/'.length);
    return { kind: 'otc-rfq-detail', path: `/otc/rfqs/${rfqId}`, rfqId };
  }
  if (path === '/otc/escrow') {
    return { kind: 'otc-escrow', path };
  }
  if (path === '/otc/settlements') {
    return { kind: 'otc-settlements', path };
  }
  if (path === '/admin' || path === '/admin/otc') {
    return { kind: 'admin-otc', path: '/admin/otc' };
  }
  if (path === '/admin/rfqs') {
    return { kind: 'admin-rfqs', path };
  }
  if (path === '/admin/users') {
    return { kind: 'admin-users', path };
  }
  if (path === '/admin/settlements') {
    return { kind: 'admin-settlements', path };
  }
  if (path === '/admin/escrow') {
    return { kind: 'admin-escrow', path };
  }
  if (path === '/kyc') {
    return { kind: 'kyc', path };
  }
  if (path === '/kyb') {
    return { kind: 'kyb', path };
  }
  if (path === '/faucet') {
    return { kind: 'faucet', path };
  }

  return { kind: 'root', path: '/' };
}

function LoginRequired({
  title,
  body,
  onOpenLogin,
}: {
  title: string;
  body: string;
  onOpenLogin: () => void;
}) {
  return (
    <div className="panel p-8 text-center">
      <div className="font-mono text-lg text-terminal-text">{title}</div>
      <div className="mt-3 font-mono text-sm leading-7 text-terminal-dim">{body}</div>
      <button type="button" className="btn-primary mt-6" onClick={onOpenLogin}>
        Go To Login
      </button>
    </div>
  );
}

function WalletRequired({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="panel p-8 text-center">
      <div className="font-mono text-lg text-terminal-text">{title}</div>
      <div className="mt-3 font-mono text-sm leading-7 text-terminal-dim">{body}</div>
      <div className="mt-6 flex justify-center">
        <WalletMultiButton />
      </div>
    </div>
  );
}

function WalletAuthorizationRequired({
  loading,
  onAuthorize,
}: {
  loading: boolean;
  onAuthorize: () => Promise<void> | void;
}) {
  return (
    <div className="panel p-8 text-center">
      <div className="font-mono text-lg text-terminal-text">Authorize Wallet Access</div>
      <div className="mt-3 font-mono text-sm leading-7 text-terminal-dim">
        Deposit and withdrawal flows still require a wallet signature so the OTC server can authorize channel transactions.
      </div>
      <button type="button" className="btn-primary mt-6" disabled={loading} onClick={() => void onAuthorize()}>
        {loading ? 'Waiting For Signature...' : 'Authorize Wallet'}
      </button>
    </div>
  );
}

function RoleRestricted({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="panel p-8 text-center">
      <div className="font-mono text-lg text-terminal-text">{title}</div>
      <div className="mt-3 font-mono text-sm leading-7 text-terminal-dim">{body}</div>
    </div>
  );
}

export default function App() {
  const { publicKey } = useWallet();
  const {
    loading: authLoading,
    users,
    currentUser,
    authenticated,
    login: loginByEmail,
    logout,
    refreshUsers,
  } = useEmailRoleAuth();
  const {
    authenticated: walletAuthorized,
    loading: walletAuthLoading,
    login: authorizeWallet,
  } = useAuth();

  const [pathname, setPathname] = useState(() => normalizePathname(window.location.pathname));
  const [loginSubmitting, setLoginSubmitting] = useState(false);
  const [signupSubmitting, setSignupSubmitting] = useState(false);
  const route = useMemo(() => parseRoute(pathname), [pathname]);

  const navigate = useCallback((nextPath: string) => {
    const nextRoute = parseRoute(nextPath);
    if (nextRoute.path === pathname) {
      return;
    }
    window.history.pushState({}, '', nextRoute.path);
    setPathname(nextRoute.path);
  }, [pathname]);

  useEffect(() => {
    const handlePopState = () => {
      setPathname(normalizePathname(window.location.pathname));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (window.location.pathname !== route.path) {
      window.history.replaceState({}, '', route.path);
    }
  }, [route.path]);

  const [kycVerified, setKycVerified] = useState<boolean | null>(null);

  // Check KYC status whenever the user changes (try wallet first, then email)
  useEffect(() => {
    if (!currentUser || currentUser.role === UserRole.ADMIN) {
      setKycVerified(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        // Try wallet first
        if (publicKey) {
          const walletRes = await fetch(`/api/otc/kyc/status?wallet=${publicKey.toString()}`);
          if (walletRes.ok) {
            const walletData = await walletRes.json();
            if (walletData.kycStatus === 'verified') {
              if (!cancelled) setKycVerified(true);
              return;
            }
          }
        }
        // Fall back to email
        const emailRes = await fetch(`/api/otc/kyc/status?email=${encodeURIComponent(currentUser.email)}`);
        if (!emailRes.ok) { if (!cancelled) setKycVerified(false); return; }
        const emailData = await emailRes.json();
        if (!cancelled) setKycVerified(emailData.kycStatus === 'verified');
      } catch {
        if (!cancelled) setKycVerified(false);
      }
    })();
    return () => { cancelled = true; };
  }, [currentUser, publicKey]);

  const handleEmailLogin = async ({ email, password }: { email: string; password: string }) => {
    setLoginSubmitting(true);
    try {
      const user = await loginByEmail(email, password);
      toast.success(`Signed in as ${user.fullName}`);
      if (user.role === UserRole.ADMIN) {
        navigate('/admin/otc');
      } else {
        // Check KYC status — try wallet first, then email
        let verified = false;
        try {
          if (publicKey) {
            const wr = await fetch(`/api/otc/kyc/status?wallet=${publicKey.toString()}`);
            if (wr.ok) {
              const wd = await wr.json();
              if (wd.kycStatus === 'verified') verified = true;
            }
          }
          if (!verified) {
            const er = await fetch(`/api/otc/kyc/status?email=${encodeURIComponent(user.email)}`);
            if (er.ok) {
              const ed = await er.json();
              if (ed.kycStatus === 'verified') verified = true;
            }
          }
        } catch { /* fall through */ }
        setKycVerified(verified);
        if (verified) {
          navigate('/otc/rfqs');
        } else {
          navigate(user.role === UserRole.LIQUIDITY_PROVIDER ? '/kyb' : '/kyc');
        }
      }
    } catch (error: any) {
      toast.error(error.message || 'Email login failed');
    } finally {
      setLoginSubmitting(false);
    }
  };

  const handleSignupSubmit = async (payload: PlatformAccessRequestInput) => {
    setSignupSubmitting(true);
    try {
      const request = await submitPlatformAccessRequest(payload);
      // Auto-sign in after signup
      const password = (payload as any).password || 'contra123';
      const user = await loginByEmail(payload.email, password);
      toast.success(`Signed up and signed in as ${user.fullName}`);
      navigate(user.role === UserRole.LIQUIDITY_PROVIDER ? '/kyb' : '/kyc');
      return request;
    } finally {
      setSignupSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
    toast.success('Logged out');
  };

  const renderWalletFlow = (content: ReactNode) => {
    if (!authenticated) {
      return (
        <LoginRequired
          title="Platform Login Required"
          body="Sign in with an approved work email before accessing channel funding and wallet operations."
          onOpenLogin={() => navigate('/login')}
        />
      );
    }
    if (currentUser?.role === UserRole.ADMIN) {
      return (
        <RoleRestricted
          title="Wallet Funding Not Available For Admin"
          body="Admin users can monitor platform activity, escrow, settlements, and users, but they do not participate in desk funding actions."
        />
      );
    }
    if (!publicKey) {
      return (
        <WalletRequired
          title="Wallet Connection Required"
          body="Connect a Solana wallet to view balances, deposit to escrow, and withdraw from the channel."
        />
      );
    }
    return content;
  };

  // Show loading while auth is resolving (prevents "please log in" flash)
  if (authLoading && route.kind !== 'root' && route.kind !== 'login' && route.kind !== 'signup') {
    return (
      <div className="min-h-screen bg-terminal-bg flex flex-col">
        <Header activePath={route.path} currentUser={null} onNavigate={navigate} onOpenLogin={() => {}} onLogout={() => {}} />
        <main className="flex-1 p-4">
          <div className="panel p-12 text-center font-mono text-sm text-terminal-dim">Loading...</div>
        </main>
      </div>
    );
  }

  let mainContent: ReactNode = null;

  if (route.kind === 'root') {
    mainContent = (
      <RootDashboard
        currentUser={currentUser}
        onReadyToStart={() => navigate('/login')}
        onNavigate={navigate}
      />
    );
  } else if (route.kind === 'login') {
    mainContent = (
      <LoginPage
        submitting={loginSubmitting}
        onSubmit={handleEmailLogin}
        onNavigateHome={() => navigate('/')}
        onNavigateSignup={() => navigate('/signup')}
      />
    );
  } else if (route.kind === 'signup') {
    mainContent = (
      <SignupPage
        submitting={signupSubmitting}
        onSubmit={handleSignupSubmit}
        onNavigateHome={() => navigate('/')}
        onNavigateLogin={() => navigate('/login')}
        onNavigateKyc={() => navigate('/kyc')}
      />
    );
  } else if (route.kind === 'deposit') {
    mainContent = renderWalletFlow(
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-1"><DepositPanel /></div>
        <div className="xl:col-span-2"><BalanceCard /></div>
      </div>,
    );
  } else if (route.kind === 'withdraw') {
    mainContent = renderWalletFlow(
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-1"><WithdrawPanel /></div>
        <div className="xl:col-span-2"><BalanceCard /></div>
      </div>,
    );
  } else if (
    route.kind === 'otc-rfqs' ||
    route.kind === 'otc-rfq-detail' ||
    route.kind === 'otc-escrow' ||
    route.kind === 'otc-settlements'
  ) {
    if (!authenticated) {
      mainContent = (
        <LoginRequired
          title="OTC Access Requires Email Login"
          body="Sign in with your approved work email to access the OTC workflow, escrow, and settlement tabs assigned to your role."
          onOpenLogin={() => navigate('/login')}
        />
      );
    } else if (currentUser?.role !== UserRole.ADMIN && kycVerified === false) {
      mainContent = (
        <div className="panel p-8 text-center">
          <div className="font-mono text-lg text-terminal-text">KYC Verification Required</div>
          <div className="mt-3 font-mono text-sm leading-7 text-terminal-dim">
            Complete identity verification before accessing the OTC trading workspace.
          </div>
          <button type="button" className="btn-primary mt-6" onClick={() => navigate(currentUser?.role === UserRole.LIQUIDITY_PROVIDER ? '/kyb' : '/kyc')}>
            {currentUser?.role === UserRole.LIQUIDITY_PROVIDER ? 'Complete KYB Verification' : 'Complete KYC Verification'}
          </button>
        </div>
      );
    } else {
      mainContent = (
        <OTCWorkspace
          route={
            route.kind === 'otc-rfqs'
              ? '/otc/rfqs'
              : route.kind === 'otc-rfq-detail'
                ? '/otc/rfqs/[rfqId]'
                : route.kind === 'otc-escrow'
                  ? '/otc/escrow'
                  : '/otc/settlements'
          }
          rfqId={route.kind === 'otc-rfq-detail' ? route.rfqId : undefined}
          currentUser={currentUser as User | null}
          role={currentUser?.role || UserRole.RFQ_ORIGINATOR}
          onNavigate={navigate}
        />
      );
    }
  } else if (
    route.kind === 'admin-otc' ||
    route.kind === 'admin-rfqs' ||
    route.kind === 'admin-users' ||
    route.kind === 'admin-settlements' ||
    route.kind === 'admin-escrow'
  ) {
    mainContent = (
      <AdminConsole
        route={
          route.kind === 'admin-otc'
            ? '/admin/otc'
            : route.kind === 'admin-rfqs'
              ? '/admin/rfqs'
              : route.kind === 'admin-users'
              ? '/admin/users'
              : route.kind === 'admin-settlements'
                ? '/admin/settlements'
                : '/admin/escrow'
        }
        currentUser={currentUser as User | null}
        onUsersChanged={async () => {
          await refreshUsers();
        }}
        onNavigate={navigate}
      />
    );
  } else if (route.kind === 'faucet') {
    mainContent = <FaucetPage />;
  } else if (route.kind === 'kyc' || route.kind === 'kyb') {
    mainContent = <KYCVerificationPage onNavigate={navigate} currentUser={currentUser} authLoading={authLoading} forceType={route.kind === 'kyb' ? 'kyb' : undefined} />;
  }

  return (
    <div className="min-h-screen bg-terminal-bg flex flex-col">
      <Header
        activePath={route.path}
        currentUser={currentUser}
        onNavigate={navigate}
        onOpenLogin={() => navigate('/login')}
        onLogout={handleLogout}
      />

      <main className="flex-1 p-4">
        {mainContent}
      </main>

      <footer className="border-t border-terminal-border px-6 py-3 text-xs font-mono text-terminal-dim">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <span>ContraClear. Institutional OTC infrastructure on Solana.</span>
          <span>Gateway: {CONTRA_GATEWAY_URL} | Solana RPC: {SOLANA_VALIDATOR_URL}</span>
        </div>
      </footer>
    </div>
  );
}
