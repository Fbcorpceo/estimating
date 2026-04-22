import { useState } from 'react';
import { signInWithPassword } from '../auth';
import { supabaseConfigured } from '../supabase';

export function SignInScreen({ initialError }: { initialError?: string | null }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'signing-in' | 'error'>(
    initialError ? 'error' : 'idle'
  );
  const [message, setMessage] = useState<string>(initialError ?? '');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (status === 'signing-in') return;
    setStatus('signing-in');
    setMessage('');
    const res = await signInWithPassword(email, password);
    if (res.ok) {
      // Auth state listener in App will swap to the main UI.
      setStatus('idle');
    } else {
      setStatus('error');
      setMessage(res.error);
    }
  }

  return (
    <div className="h-full w-full flex items-center justify-center bg-[#0d0f15]">
      <div className="w-[360px] bg-panel border border-[#2a3142] rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <img src="/fb-logo.svg?v=2" alt="FB" className="h-8 w-auto" />
          <div className="text-lg font-semibold text-ink">Takeoff</div>
        </div>
        {!supabaseConfigured ? (
          <div className="text-rose-400 text-sm">
            Auth is not configured. Admin: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-3">
            <label className="text-xs text-muted">Work email</label>
            <input
              type="email"
              placeholder="you@fbcorp.io"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              autoComplete="username"
            />
            <label className="text-xs text-muted">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              minLength={6}
            />
            <button
              type="submit"
              disabled={status === 'signing-in'}
              className="px-3 py-2 rounded bg-accent hover:bg-blue-500 text-white text-sm disabled:opacity-60"
            >
              {status === 'signing-in' ? 'Signing in…' : 'Sign in'}
            </button>
            {message && (
              <div className="text-xs text-rose-400">{message}</div>
            )}
            <div className="text-[11px] text-muted leading-snug pt-2 border-t border-[#222837]">
              First time signing in? Use the initial password your admin gave you. Only
              emails on the FB Corp invite list can sign in.
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
