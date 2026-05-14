import { execSync } from 'child_process';
import { resolve } from 'path';

export async function teardown() {
  const serverDir = resolve(import.meta.dirname, '../..');
  execSync('node ./node_modules/tsx/dist/cli.mjs prisma/seed.ts', {
    cwd: serverDir,
    stdio: 'pipe',
  });
}
