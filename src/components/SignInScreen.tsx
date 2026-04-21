import { useState } from 'react';
import { sendMagicLink } from '../auth';
import { supabaseConfigured } from '../supabase';

export function SignInScreen() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState<string>('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (status === 'sending') return;
    setStatus('sending');
    setMessage('');
    const res = await sendMagicLink(email);
    if (res.ok) {
      setStatus('sent');
      setMessage(`Magic link sent to ${email}. Check your inbox.`);
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
              disabled={status === 'sent'}
            />
            <button
              type="submit"
              disabled={status === 'sending' || status === 'sent'}
              className="px-3 py-2 rounded bg-accent hover:bg-blue-500 text-white text-sm disabled:opacity-60"
            >
              {status === 'sending'
                ? 'Sending…'
                : status === 'sent'
                  ? 'Link sent'
                  : 'Send magic link'}
            </button>
            {message && (
              <div
                className={`text-xs ${
                  status === 'error' ? 'text-rose-400' : 'text-emerald-400'
                }`}
              >
                {message}
              </div>
            )}
            <div className="text-[11px] text-muted leading-snug pt-2 border-t border-[#222837]">
              We'll email you a one-tap sign-in link. Only emails on the FB Corp invite
              list are allowed.
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
