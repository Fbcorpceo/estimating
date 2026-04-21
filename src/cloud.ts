import { supabase, PLANS_BUCKET } from './supabase';
import type { Project, PlanPage, Condition, Measurement } from './types';

// The cloud row stores the project shell; `data` JSONB contains pages
// (metadata only), conditions, measurements. PDF bytes live in Storage.
export interface ProjectRow {
  id: string;
  workspace_id: string;
  name: string;
  data: CloudProjectData;
  created_at: string;
  updated_at: string;
}

export interface CloudProjectData {
  pages: PlanPage[]; // PDF pages reference storage_path instead of carrying bytes
  conditions: Condition[];
  measurements: Measurement[];
  pdfFiles?: CloudPdfMeta[]; // metadata without bytes
}

export interface CloudPdfMeta {
  id: string;
  name: string;
  storagePath: string;
  sizeBytes?: number;
}

export interface ProjectSummary {
  id: string;
  name: string;
  updatedAt: number;
}

// Strip the ArrayBuffer from local Project's pdfFiles before sending to cloud.
export function projectToCloudData(p: Project): CloudProjectData {
  const pdfMetas: CloudPdfMeta[] = p.pdfFiles.map((f) => ({
    id: f.id,
    name: f.name,
    // storagePath is injected by uploader; if missing, synthesize from id
    storagePath: (f as unknown as { storagePath?: string }).storagePath ?? '',
    sizeBytes: (f.data as ArrayBuffer | undefined)?.byteLength,
  }));
  return {
    pages: p.pages,
    conditions: p.conditions,
    measurements: p.measurements,
    pdfFiles: pdfMetas,
  };
}

export function cloudRowToProject(row: ProjectRow): Project {
  const d = row.data;
  return {
    id: row.id,
    name: row.name,
    createdAt: Date.parse(row.created_at),
    updatedAt: Date.parse(row.updated_at),
    pages: d.pages ?? [],
    conditions: d.conditions ?? [],
    measurements: d.measurements ?? [],
    pdfFiles: (d.pdfFiles ?? []).map((m) => ({
      id: m.id,
      name: m.name,
      data: new ArrayBuffer(0), // bytes loaded on demand from Storage
      // attach storagePath for the loader
      storagePath: m.storagePath,
    })) as unknown as Project['pdfFiles'],
  };
}

// --------- Projects CRUD ---------

export async function listProjects(workspaceId: string): Promise<ProjectSummary[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('id, name, updated_at')
    .eq('workspace_id', workspaceId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    updatedAt: Date.parse(r.updated_at as string),
  }));
}

export async function loadProject(id: string): Promise<Project | null> {
  const { data, error } = await supabase
    .from('projects')
    .select('id, workspace_id, name, data, created_at, updated_at')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return cloudRowToProject(data as ProjectRow);
}

export async function upsertProject(
  workspaceId: string,
  project: Project,
  userId: string
): Promise<void> {
  const payload = {
    id: project.id,
    workspace_id: workspaceId,
    name: project.name,
    data: projectToCloudData(project),
    created_by: userId,
  };
  const { error } = await supabase.from('projects').upsert(payload, { onConflict: 'id' });
  if (error) throw error;
}

export async function renameProjectCloud(id: string, name: string): Promise<void> {
  const { error } = await supabase.from('projects').update({ name }).eq('id', id);
  if (error) throw error;
}

export async function deleteProjectCloud(id: string): Promise<void> {
  // Clean up storage objects under {workspace}/{projectId}/
  const { data: row } = await supabase
    .from('projects')
    .select('workspace_id')
    .eq('id', id)
    .maybeSingle();
  if (row?.workspace_id) {
    const prefix = `${row.workspace_id}/${id}/`;
    const { data: objs } = await supabase.storage.from(PLANS_BUCKET).list(prefix);
    if (objs && objs.length > 0) {
      await supabase.storage
        .from(PLANS_BUCKET)
        .remove(objs.map((o) => `${prefix}${o.name}`));
    }
  }
  const { error } = await supabase.from('projects').delete().eq('id', id);
  if (error) throw error;
}

// --------- PDF Storage ---------

export async function uploadPdf(
  workspaceId: string,
  projectId: string,
  fileId: string,
  fileName: string,
  bytes: ArrayBuffer
): Promise<string> {
  const path = `${workspaceId}/${projectId}/${fileId}.pdf`;
  const { error } = await supabase.storage
    .from(PLANS_BUCKET)
    .upload(path, bytes, {
      contentType: 'application/pdf',
      upsert: true,
    });
  if (error) throw error;
  // Record metadata row (helps with realtime & cleanup; harmless if duplicate upsert)
  await supabase.from('pdf_files').upsert(
    {
      id: fileId,
      project_id: projectId,
      workspace_id: workspaceId,
      storage_path: path,
      file_name: fileName,
      size_bytes: bytes.byteLength,
    },
    { onConflict: 'id' }
  );
  return path;
}

export async function downloadPdf(storagePath: string): Promise<ArrayBuffer> {
  const { data, error } = await supabase.storage.from(PLANS_BUCKET).download(storagePath);
  if (error) throw error;
  return await data.arrayBuffer();
}
