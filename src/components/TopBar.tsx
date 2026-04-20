import { useRef } from 'react';
import { useStore } from '../store';
import { loadPdfMetadata } from '../pdf';
import { v4 as uuid } from 'uuid';

export function TopBar() {
  const project = useStore((s) => s.project);
  const renameProject = useStore((s) => s.renameProject);
  const newProject = useStore((s) => s.newProject);
  const openProject = useStore((s) => s.openProject);
  const deleteProject = useStore((s) => s.deleteProject);
  const recent = useStore((s) => s.recentProjects);
  const addImagePage = useStore((s) => s.addImagePage);
  const addPdfPages = useStore((s) => s.addPdfPages);

  const fileInput = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files) return;
    for (const file of Array.from(files)) {
      if (file.type === 'application/pdf') {
        const buf = await file.arrayBuffer();
        try {
          const pages = await loadPdfMetadata(buf);
          addPdfPages(file.name.replace(/\.pdf$/i, ''), uuid(), buf, pages);
        } catch (err) {
          alert(`Failed to load PDF ${file.name}: ${(err as Error).message}`);
        }
      } else if (file.type.startsWith('image/')) {
        const dataUrl = await new Promise<string>((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(r.result as string);
          r.onerror = () => rej(r.error);
          r.readAsDataURL(file);
        });
        const dims = await new Promise<{ w: number; h: number }>((res, rej) => {
          const img = new Image();
          img.onload = () => res({ w: img.naturalWidth, h: img.naturalHeight });
          img.onerror = () => rej(new Error('Image failed to load'));
          img.src = dataUrl;
        });
        addImagePage(file.name.replace(/\.[^.]+$/, ''), dataUrl, dims.w, dims.h);
      }
    }
    if (fileInput.current) fileInput.current.value = '';
  }

  return (
    <div className="flex items-center gap-3 h-12 px-3 border-b border-[#222837] bg-panel">
      <div className="font-semibold text-ink">Takeoff</div>
      <div className="h-6 w-px bg-[#2a3142]" />
      <input
        className="bg-transparent border-0 px-2 py-1 text-ink min-w-[200px] focus:bg-[#1a1f2b] rounded"
        value={project.name}
        onChange={(e) => renameProject(e.target.value)}
        title="Project name"
      />
      <div className="flex-1" />
      <button
        className="px-3 py-1 rounded bg-[#2a3142] hover:bg-[#343c52] text-ink"
        onClick={() => fileInput.current?.click()}
      >
        Upload Plans
      </button>
      <input
        ref={fileInput}
        type="file"
        accept="application/pdf,image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <select
        className="text-ink"
        value={project.id}
        onChange={(e) => openProject(e.target.value)}
        title="Recent projects"
      >
        {recent.find((r) => r.id === project.id) ? null : (
          <option value={project.id}>{project.name} (current)</option>
        )}
        {recent.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>
      <button
        className="px-3 py-1 rounded bg-[#2a3142] hover:bg-[#343c52] text-ink"
        onClick={() => newProject()}
      >
        New
      </button>
      <button
        className="px-3 py-1 rounded bg-[#3a2532] hover:bg-[#4a2f3f] text-ink"
        onClick={() => {
          if (confirm(`Delete project "${project.name}"?`)) deleteProject(project.id);
        }}
      >
        Delete
      </button>
    </div>
  );
}
