import { useEffect } from 'react';
import { TopBar } from './components/TopBar';
import { Toolbar } from './components/Toolbar';
import { PagesPanel } from './components/PagesPanel';
import { ConditionsPanel } from './components/ConditionsPanel';
import { PlanCanvas } from './components/PlanCanvas';
import { EstimatePanel } from './components/EstimatePanel';
import { Toasts } from './components/Toasts';
import { SignInScreen } from './components/SignInScreen';
import { MigrationPrompt } from './components/MigrationPrompt';
import { useStore } from './store';
import { useAuth } from './auth';

export default function App() {
  const auth = useAuth();
  const setAuthContext = useStore((s) => s.setAuthContext);

  useEffect(() => {
    if (auth.loading) return;
    if (auth.session && auth.membership) {
      setAuthContext({
        userId: auth.session.user.id,
        workspaceId: auth.membership.workspaceId,
        email: auth.session.user.email ?? '',
      });
    } else {
      setAuthContext(null);
    }
  }, [auth.loading, auth.session, auth.membership, setAuthContext]);

  if (auth.loading) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-[#0d0f15] text-muted">
        Loading…
      </div>
    );
  }

  if (!auth.session) {
    return <SignInScreen />;
  }

  if (!auth.membership) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-[#0d0f15] text-ink">
        <div className="max-w-md text-center">
          <div className="text-lg font-semibold mb-2">No workspace access</div>
          <div className="text-sm text-muted">
            You're signed in but not a member of any workspace. Ask an owner to add
            your email to the invite list.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col">
      <TopBar />
      <Toolbar />
      <div className="flex-1 flex min-h-0">
        <aside className="w-72 bg-panel border-r border-[#222837] flex flex-col">
          <PagesPanel />
          <ConditionsPanel />
        </aside>
        <PlanCanvas />
        <aside className="w-80 bg-panel border-l border-[#222837] flex flex-col">
          <EstimatePanel />
        </aside>
      </div>
      <Toasts />
      <MigrationPrompt />
    </div>
  );
}
