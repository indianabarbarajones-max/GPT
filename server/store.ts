import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Collection, Entity, Settings, StudioState, Transaction, YogaClass } from '../shared/types.ts';
import { seedState } from './seed.ts';

export const collections: Collection[] = ['students', 'transactions', 'classes', 'tasks', 'content', 'goals'];

export class Store {
  private db: DatabaseSync;
  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000; CREATE TABLE IF NOT EXISTS records (collection TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, PRIMARY KEY(collection,id)); CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, data TEXT NOT NULL);');
    if (!this.db.prepare('SELECT key FROM metadata WHERE key = ?').get('settings')) {
      const seed = seedState();
      this.transaction(() => {
        for (const collection of collections) for (const record of seed[collection]) this.put(collection, record);
        this.meta('settings', seed.settings);
        this.meta('demo', true);
      });
    }
  }
  private transaction<T>(operation: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try { const result = operation(); this.db.exec('COMMIT'); return result; }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  private meta(key: string, data: unknown) {
    this.db.prepare('INSERT INTO metadata(key,data) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET data=excluded.data').run(key, JSON.stringify(data));
  }
  private readMeta<T>(key: string): T {
    const row = this.db.prepare('SELECT data FROM metadata WHERE key=?').get(key) as { data: string };
    return JSON.parse(row.data) as T;
  }
  list<T extends Entity>(collection: Collection): T[] {
    return (this.db.prepare('SELECT data FROM records WHERE collection=? ORDER BY rowid').all(collection) as { data: string }[]).map(row => JSON.parse(row.data) as T);
  }
  get(collection: Collection, id: string): Entity | undefined {
    const row = this.db.prepare('SELECT data FROM records WHERE collection=? AND id=?').get(collection, id) as { data: string } | undefined;
    return row ? JSON.parse(row.data) as Entity : undefined;
  }
  put(collection: Collection, entity: Entity) {
    this.db.prepare('INSERT INTO records(collection,id,data) VALUES (?,?,?) ON CONFLICT(collection,id) DO UPDATE SET data=excluded.data').run(collection, entity.id, JSON.stringify(entity));
    return entity;
  }
  create(collection: Collection, data: Record<string, unknown>) {
    return this.put(collection, { ...data, id: randomUUID() } as unknown as Entity);
  }
  delete(collection: Collection, id: string) {
    this.transaction(() => {
      if (collection === 'students') {
        for (const cls of this.list<YogaClass>('classes')) if (cls.studentIds.includes(id)) this.put('classes', { ...cls, studentIds: cls.studentIds.filter(value => value !== id) });
        for (const tx of this.list<Transaction>('transactions')) if (tx.studentId === id) { const { studentId: _removed, ...rest } = tx; this.put('transactions', rest); }
      }
      this.db.prepare('DELETE FROM records WHERE collection=? AND id=?').run(collection, id);
    });
  }
  settings() { return this.readMeta<Settings>('settings'); }
  setSettings(settings: Settings) { this.meta('settings', settings); return settings; }
  state(aiConfigured = false): StudioState {
    const result = { settings: this.settings(), demo: this.readMeta<boolean>('demo'), aiConfigured } as StudioState;
    for (const collection of collections) (result as unknown as Record<string, unknown>)[collection] = this.list(collection);
    return result;
  }
  close() { this.db.close(); }
}
