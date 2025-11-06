import { mkdtempSync } from 'fs';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { execSync } from 'child_process';

export const initRepo = async (): Promise<string> => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'octotree-core-test-'));
  execSync('git init', { cwd: dir, stdio: 'ignore' });
  execSync('git config user.email "test@example.com"', { cwd: dir, stdio: 'ignore' });
  execSync('git config user.name "Octo Tree Test"', { cwd: dir, stdio: 'ignore' });
  return dir;
};

export const cleanupRepo = async (repoPath: string): Promise<void> => {
  await fs.rm(repoPath, { recursive: true, force: true });
};

export const createCommit = async (repoPath: string, message: string): Promise<void> => {
  execSync('git add .', { cwd: repoPath, stdio: 'ignore' });
  execSync(`git commit -m "${message}"`, { cwd: repoPath, stdio: 'ignore' });
};

export const createTag = async (repoPath: string, tagName: string, message?: string): Promise<void> => {
  if (message) {
    execSync(`git tag -a ${tagName} -m "${message}"`, { cwd: repoPath, stdio: 'ignore' });
  } else {
    execSync(`git tag ${tagName}`, { cwd: repoPath, stdio: 'ignore' });
  }
};

