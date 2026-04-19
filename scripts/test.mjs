import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

function hasTestFiles(dir) {
    try {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
            const full = join(dir, entry.name);
            if (entry.isDirectory() && hasTestFiles(full)) return true;
            if (entry.isFile() && /\.(test|spec)\.[jt]sx?$/.test(entry.name)) return true;
        }
    } catch {
        // directory does not exist
    }
    return false;
}

if (!hasTestFiles('src')) {
    console.log('No tests exist. Exiting...');
    process.exit(1);
}

const result = spawnSync(
    'pnpm',
    ['exec', 'jest', '--config', 'jest.config.cjs'],
    { stdio: 'inherit', shell: true },
);
process.exit(result.status ?? 1);
