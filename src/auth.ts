import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

export interface Membership {
  workspaceId: string;
  workspaceName: string;
  role: 'owner' | 'admin' | 'member';
}

export interface AuthState {
  loading: boolean;
  session: Session | null;
  membership: Membership | null;
  error: string | null;
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({
    loading: true,
    session: null,
    membership: null,
    error: null,
  });

  useEffect(() => {
    let active = true;

    async function loadMembership(session: Session | null): Promise<Membership | null> {
      if (!session) return null;
      const { data, error } = await supabase
        .from('workspace_members')
        .select('workspace_id, role, workspaces(name)')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error || !data) return null;
      return {
        workspaceId: data.workspace_id as string,
        role: data.role as Membership['role'],
        workspaceName:
          (data.workspaces as unknown as { name: string } | null)?.name ?? 'Workspace',
      };
    }

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      const session = data.session;
      const membership = await loadMembership(session);
      if (!active) return;
      setState({ loading: false, session, membership, error: null });
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (_evt, session) => {
      const membership = await loadMembership(session);
      if (!active) return;
      setState({ loading: false, session, membership, error: null });
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  return state;
}

export async function sendMagicLink(email: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return { ok: false, error: 'Enter your email.' };
  const { error } = await supabase.auth.signInWithOtp({
    email: normalized,
    options: {
      emailRedirectTo: `${window.location.origin}`,
      shouldCreateUser: true,
    },
  });
  if (error) {
    const msg = error.message.toLowerCase().includes('invite')
      ? 'This email isn\'t on the invite list. Ask an owner to add you.'
      : error.message;
    return { ok: false, error: msg };
  }
  return { ok: true };
}

export async function signOut() {
  await supabase.auth.signOut();
}
