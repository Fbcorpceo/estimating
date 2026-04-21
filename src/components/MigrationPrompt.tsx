import { useEffect, useState } from 'react';
import { clearLegacyProject, listLegacyProjects, useStore } from '../store';
import { uploadPdf, upsertProject } from '../cloud';
import type { Project } from '../types';

export function MigrationPrompt() {
  const auth = useStore((s) => s.auth);
  const toast = useStore((s) => s.toast);
  const refreshRecent = useStore((s) => s.refreshRecent);
  const openProject = useStore((s) => s.openProject);
  const [legacy, setLegacy] = useState<Project[] | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!auth) return;
    listLegacyProjects().then((ps) => {
      // Only surface projects that actually have content worth migrating
      const withContent = ps.filter(
        (p) =>
          p.pages.length > 0 ||
          p.conditions.length > 0 ||
          p.measurements.length > 0
      );
      setLegacy(withContent);
    });
  }, [auth]);

  if (!auth || dismissed || !legacy || legacy.length === 0) return null;

  async function migrate() {
    if (!auth || !legacy) return;
    setBusy(true);
    try {
      for (const p of legacy) {
        // Upload any PDF bytes to Storage first, capturing storage paths.
        const pdfFiles = [];
        for (const f of p.pdfFiles) {
          if (f.data && (f.data as ArrayBuffer).byteLength > 0) {
            try {
              const path = await uploadPdf(
                auth.workspaceId,
                p.id,
                f.id,
                f.name,
                f.data as ArrayBuffer
              );
              pdfFiles.push({ ...f, storagePath: path });
            } catch (err) {
              console.error('Legacy PDF upload failed', err);
              pdfFiles.push(f); // skip; project will still save, PDF won't render
            }
          } else {
            pdfFiles.push(f);
          }
        }
        const cloudProject: Project = { ...p, pdfFiles };
        await upsertProject(auth.workspaceId, cloudProject, auth.userId);
        await clearLegacyProject(p.id);
      }
      toast(`Uploaded ${legacy.length} project${legacy.length > 1 ? 's' : ''} to the cloud.`, 'success');
      await refreshRecent();
      // Open the most recent one
      const mostRecent = [...legacy].sort((a, b) => b.updatedAt - a.updatedAt)[0];
      if (mostRecent) await openProject(mostRecent.id);
      setDismissed(true);
    } catch (e) {
      toast(`Migration failed: ${(e as Error).message}`, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-[#1a1f2b] border border-accent rounded-lg shadow-xl p-4 w-[440px]">
      <div className="text-ink font-semibold mb-1">
        Move local projects to the cloud?
      </div>
      <div className="text-sm text-muted mb-3">
        Found {legacy.length} project{legacy.length > 1 ? 's' : ''} saved in this
        browser's local storage. Uploading them to your FB Corp workspace makes them
        available on any device you sign in to.
      </div>
      <div className="flex justify-end gap-2">
        <button
          className="px-3 py-1 rounded bg-[#2a3142] hover:bg-[#343c52] text-sm"
          onClick={() => setDismissed(true)}
          disabled={busy}
        >
          Not now
        </button>
        <button
          className="px-3 py-1 rounded bg-accent hover:bg-blue-500 text-white text-sm disabled:opacity-60"
          onClick={migrate}
          disabled={busy}
        >
          {busy ? 'Uploading…' : 'Upload to cloud'}
        </button>
      </div>
    </div>
  );
}
