import { useEffect } from 'react';
import { TopBar } from './components/TopBar';
import { Toolbar } from './components/Toolbar';
import { PagesPanel } from './components/PagesPanel';
import { ConditionsPanel } from './components/ConditionsPanel';
import { PlanCanvas } from './components/PlanCanvas';
import { EstimatePanel } from './components/EstimatePanel';
import { Toasts } from './components/Toasts';
import { useStore } from './store';

export default function App() {
  const loadOrCreate = useStore((s) => s.loadOrCreate);

  useEffect(() => {
    loadOrCreate();
  }, [loadOrCreate]);

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
    </div>
  );
}
