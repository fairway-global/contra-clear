import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import type { AuthProfile, AcceptInviteInput, InviteUserInput } from '../types/platform';
import * as authService from '../lib/authService';
import { usePlatform } from './usePlatform';

interface AuthContextValue {
  profile: AuthProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthProfile>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<AuthProfile | null>;
  inviteUser: (input: InviteUserInput) => Promise<{ inviteToken: string; inviteUrl: string; userId: string }>;
  acceptInvite: (input: AcceptInviteInput) => Promise<AuthProfile>;
  forgotPassword: (email: string) => Promise<{ resetToken: string; resetUrl: string }>;
  resetPassword: (token: string, password: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const { refresh } = usePlatform();
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = async (): Promise<AuthProfile | null> => {
    const nextProfile = await authService.getCurrentUser();
    setProfile(nextProfile);
    return nextProfile;
  };

  useEffect(() => {
    void refreshProfile().finally(() => setLoading(false));
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    profile,
    loading,
    refreshProfile,
    login: async (email, password) => {
      const nextProfile = await authService.login(email, password);
      refresh();
      setProfile(nextProfile);
      return nextProfile;
    },
    logout: async () => {
      await authService.logout();
      setProfile(null);
      refresh();
    },
    inviteUser: async (input) => {
      if (!profile) throw new Error('You must be logged in to invite users.');
      const result = await authService.inviteUser(profile.user.id, input);
      refresh();
      return result;
    },
    acceptInvite: async (input) => {
      const nextProfile = await authService.acceptInvite(input);
      refresh();
      setProfile(nextProfile);
      return nextProfile;
    },
    forgotPassword: async (email) => {
      return authService.forgotPassword(email);
    },
    resetPassword: async (token, password) => {
      await authService.resetPassword(token, password);
      refresh();
    },
  }), [loading, profile, refresh]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
