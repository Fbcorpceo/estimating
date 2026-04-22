import { useState } from 'react';
import { signInWithGoogle, signInWithPassword } from '../auth';
import { supabaseConfigured } from '../supabase';

export function SignInScreen({ initialError }: { initialError?: string | null }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'signing-in' | 'error'>(
    initialError ? 'error' : 'idle'
  );
  const [message, setMessage] = useState<string>(initialError ?? '');
  const [showPasswordForm, setShowPasswordForm] = useState(false);

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

  async function google() {
    if (status === 'signing-in') return;
    setStatus('signing-in');
    setMessage('');
    const res = await signInWithGoogle();
    if (!res.ok) {
      setStatus('error');
      setMessage(res.error);
    }
    // On success the browser redirects to Google; nothing else to do.
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
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={google}
              disabled={status === 'signing-in'}
              className="px-3 py-2 rounded bg-white hover:bg-gray-100 text-gray-900 text-sm font-medium disabled:opacity-60 flex items-center justify-center gap-2"
            >
              <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34.5 6.5 29.5 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5 43.5 34.8 43.5 24c0-1.2-.1-2.4-.4-3.5z"/>
                <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 18.9 13 24 13c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34.5 6.5 29.5 4.5 24 4.5 16.3 4.5 9.7 8.9 6.3 14.7z"/>
                <path fill="#4CAF50" d="M24 43.5c5.4 0 10.3-2 14-5.3l-6.5-5.3c-2 1.4-4.6 2.3-7.5 2.3-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.6 39 16.2 43.5 24 43.5z"/>
                <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.5 5.3C41.5 36.1 43.5 30.5 43.5 24c0-1.2-.1-2.4-.4-3.5z"/>
              </svg>
              {status === 'signing-in' ? 'Redirecting…' : 'Continue with Google'}
            </button>
            {message && (
              <div className="text-xs text-rose-400">{message}</div>
            )}
            {!showPasswordForm ? (
              <button
                type="button"
                onClick={() => setShowPasswordForm(true)}
                className="text-[11px] text-muted hover:text-ink underline self-center"
              >
                Use email and password instead
              </button>
            ) : (
              <form onSubmit={submit} className="flex flex-col gap-3 pt-2 border-t border-[#222837]">
                <label className="text-xs text-muted">Work email</label>
                <input
                  type="email"
                  placeholder="you@fbcorp.io"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
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
              </form>
            )}
            <div className="text-[11px] text-muted leading-snug pt-2 border-t border-[#222837]">
              Sign in with your @fbcorp.io Google account. Only emails on the FB Corp
              invite list can sign in.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
