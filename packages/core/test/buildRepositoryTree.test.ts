import { describe, it, expect } from 'vitest';
import { mkdtempSync } from 'fs';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { execSync } from 'child_process';
import { buildRepositoryTree, GitRepositoryError } from '../src';

const initRepo = async (): Promise<string> => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'octotree-core-test-'));
  execSync('git init', { cwd: dir, stdio: 'ignore' });
  execSync('git config user.email "test@example.com"', { cwd: dir, stdio: 'ignore' });
  execSync('git config user.name "Octo Tree Test"', { cwd: dir, stdio: 'ignore' });
  return dir;
};

describe('buildRepositoryTree', () => {
  it('builds a tree from the HEAD commit', async () => {
    const repoPath = await initRepo();
    try {
      const srcDir = path.join(repoPath, 'src');
      await fs.mkdir(srcDir, { recursive: true });
      const indexPath = path.join(srcDir, 'index.ts');
      const readmePath = path.join(repoPath, 'README.md');
      await fs.writeFile(indexPath, 'console.log("hi");\n');
      await fs.writeFile(readmePath, '# Test Repo\n');

      execSync('git add .', { cwd: repoPath, stdio: 'ignore' });
      execSync('git commit -m "initial"', { cwd: repoPath, stdio: 'ignore' });

      const tree = await buildRepositoryTree({ repoPath, ref: 'HEAD' });

      expect(tree.type).toBe('directory');
      expect(tree.children.map((child) => child.name)).toEqual(['src', 'README.md']);

      const srcNode = tree.children.find((child) => child.name === 'src');
      expect(srcNode?.type).toBe('directory');
      expect(srcNode?.children.map((child) => child.name)).toEqual(['index.ts']);

      const indexNode = srcNode?.children[0];
      expect(indexNode?.type).toBe('file');
      expect(indexNode?.size).toBe(Buffer.byteLength('console.log("hi");\n'));
      expect(tree.size).toBe(
        Buffer.byteLength('console.log("hi");\n') + Buffer.byteLength('# Test Repo\n')
      );
    } finally {
      await fs.rm(repoPath, { recursive: true, force: true });
    }
  });

  it('falls back to working tree when HEAD is unavailable and fallback is allowed', async () => {
    const repoPath = await initRepo();
    try {
      const notePath = path.join(repoPath, 'NOTE.txt');
      await fs.writeFile(notePath, 'hello world');
      execSync('git add .', { cwd: repoPath, stdio: 'ignore' });

      const tree = await buildRepositoryTree({ repoPath, allowFallbackToWorkingTree: true });

      const fileNode = tree.children.find((child) => child.name === 'NOTE.txt');
      expect(fileNode?.type).toBe('file');
      expect(fileNode?.size).toBe(Buffer.byteLength('hello world'));
      expect(tree.size).toBe(Buffer.byteLength('hello world'));
    } finally {
      await fs.rm(repoPath, { recursive: true, force: true });
    }
  });

  it('throws a GitRepositoryError when the repository lacks commits and fallback is disabled', async () => {
    const repoPath = await initRepo();
    try {
      await expect(() => buildRepositoryTree({ repoPath })).rejects.toBeInstanceOf(
        GitRepositoryError
      );
    } finally {
      await fs.rm(repoPath, { recursive: true, force: true });
    }
  });
});
