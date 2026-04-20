import Dexie, { type Table } from 'dexie';
import type { Project } from './types';

class TakeoffDB extends Dexie {
  projects!: Table<Project, string>;

  constructor() {
    super('takeoff');
    this.version(1).stores({
      projects: 'id, name, updatedAt',
    });
  }
}

export const db = new TakeoffDB();
