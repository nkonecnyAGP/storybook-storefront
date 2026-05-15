import { copyFile, mkdir, readdir, stat, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '../../prisma/dev.db');
const BACKUP_DIR = join(__dirname, '../../.backups');
const MAX_AGE_DAYS = 7;

function timestamp(): string {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

export async function snapshotDb(): Promise<void> {
  if (!existsSync(DB_PATH)) {
    return;
  }
  try {
    await mkdir(BACKUP_DIR, { recursive: true });
    const dest = join(BACKUP_DIR, `dev-${timestamp()}.db`);
    await copyFile(DB_PATH, dest);
    console.log(`[snapshot] dev.db -> ${dest}`);
    await pruneOldSnapshots();
  } catch (err) {
    console.error('[snapshot] failed:', err);
  }
}

async function pruneOldSnapshots(): Promise<void> {
  try {
    const files = await readdir(BACKUP_DIR);
    const cutoff = Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
    for (const f of files) {
      if (!f.startsWith('dev-') || !f.endsWith('.db')) continue;
      const path = join(BACKUP_DIR, f);
      const s = await stat(path);
      if (s.mtimeMs < cutoff) {
        await unlink(path);
        console.log(`[snapshot] pruned ${f}`);
      }
    }
  } catch {
    // Best-effort prune — ignore errors
  }
}
