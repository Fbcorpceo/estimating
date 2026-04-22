import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, supabaseConfigured } from './supabase';

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
      try {
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
      } catch {
        return null;
      }
    }

    // If env vars are missing, don't hang on network calls that can never
    // succeed — drop straight to the sign-in screen with an error.
    if (!supabaseConfigured) {
      setState({
        loading: false,
        session: null,
        membership: null,
        error: 'Auth is not configured.',
      });
      return () => {
        active = false;
      };
    }

    // Safety net: if getSession() or the realtime auth channel hangs (bad
    // persisted token, network blip, detectSessionInUrl stuck on a stale
    // fragment), don't leave the user staring at "Loading…" forever.
    const timeout = window.setTimeout(() => {
      if (!active) return;
      setState((s) =>
        s.loading
          ? {
              loading: false,
              session: null,
              membership: null,
              error: 'Sign-in is taking too long. Please try again.',
            }
          : s
      );
    }, 6000);

    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!active) return;
        const session = data.session;
        const membership = await loadMembership(session);
        if (!active) return;
        window.clearTimeout(timeout);
        setState({ loading: false, session, membership, error: null });
      } catch (e: unknown) {
        if (!active) return;
        window.clearTimeout(timeout);
        const message = e instanceof Error ? e.message : 'Auth error';
        setState({ loading: false, session: null, membership: null, error: message });
      }
    })();

    const { data: listener } = supabase.auth.onAuthStateChange(async (_evt, session) => {
      try {
        const membership = await loadMembership(session);
        if (!active) return;
        window.clearTimeout(timeout);
        setState({ loading: false, session, membership, error: null });
      } catch (e: unknown) {
        if (!active) return;
        window.clearTimeout(timeout);
        const message = e instanceof Error ? e.message : 'Auth error';
        setState({ loading: false, session, membership: null, error: message });
      }
    });

    return () => {
      active = false;
      window.clearTimeout(timeout);
      listener.subscription.unsubscribe();
    };
  }, []);

  return state;
}

export async function signInWithPassword(
  email: string,
  password: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return { ok: false, error: 'Enter your email.' };
  if (!password) return { ok: false, error: 'Enter your password.' };

  // Try to sign in first; if the account doesn't exist yet, fall back to
  // signup so first-time users can join with the shared initial password.
  const signIn = await supabase.auth.signInWithPassword({
    email: normalized,
    password,
  });
  if (!signIn.error) return { ok: true };

  const msg = (signIn.error.message || '').toLowerCase();
  const isBadCreds = msg.includes('invalid login credentials') || msg.includes('invalid');
  if (!isBadCreds) {
    return { ok: false, error: signIn.error.message };
  }

  // Account may not exist yet — try signup. The handle_new_user trigger
  // enforces the invite allowlist.
  const signUp = await supabase.auth.signUp({
    email: normalized,
    password,
  });
  if (signUp.error) {
    const m = (signUp.error.message || '').toLowerCase();
    if (m.includes('invite')) {
      return {
        ok: false,
        error: "This email isn't on the invite list. Ask an owner to add you.",
      };
    }
    if (m.includes('already registered') || m.includes('already exists')) {
      return { ok: false, error: 'Wrong password for this account.' };
    }
    return { ok: false, error: signUp.error.message };
  }
  if (!signUp.data.session) {
    return {
      ok: false,
      error:
        "Account created but email confirmation is enabled. Ask an admin to turn off 'Confirm email' in Supabase → Authentication → Sign In / Providers.",
    };
  }
  return { ok: true };
}

// Kept for future opt-in; not wired to the UI right now.
export async function sendMagicLink(email: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return { ok: false, error: 'Enter your email.' };
  const { error } = await supabase.auth.signInWithOtp({
    email: normalized,
    options: {
      emailRedirectTo: `${window.location.origin}/`,
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
