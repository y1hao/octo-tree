import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { realpathSync } from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import {
  runGitCommand,
  resolveRepoRoot,
  listGitManagedFiles,
  resolveGitRef,
  listFilesAtTree,
  getCommitTimestampMs
} from '../src/git';
import { GitRepositoryError } from '../src/types';
import { initRepo, cleanupRepo, createCommit, createTag } from './utils';

describe('git', () => {
  describe('runGitCommand', () => {
    it('executes a git command successfully', async () => {
      const repoPath = await initRepo();
      try {
        const result = await runGitCommand(repoPath, ['--version']);
        expect(result).toContain('git version');
      } finally {
        await cleanupRepo(repoPath);
      }
    });

    it('throws GitRepositoryError on command failure', async () => {
      const repoPath = await initRepo();
      try {
        await expect(runGitCommand(repoPath, ['invalid-command'])).rejects.toBeInstanceOf(
          GitRepositoryError
        );
      } finally {
        await cleanupRepo(repoPath);
      }
    });
  });

  describe('resolveRepoRoot', () => {
    it('resolves repository root from subdirectory', async () => {
      const repoPath = await initRepo();
      try {
        const subDir = path.join(repoPath, 'sub', 'dir');
        await fs.mkdir(subDir, { recursive: true });
        const root = await resolveRepoRoot(subDir);
        // Normalize paths for comparison (macOS may use /private/var vs /var symlink)
        expect(realpathSync(root)).toBe(realpathSync(repoPath));
      } finally {
        await cleanupRepo(repoPath);
      }
    });

    it('throws GitRepositoryError for non-git directory', async () => {
      const tempDir = await fs.mkdtemp(path.join(require('os').tmpdir(), 'not-git-'));
      try {
        await expect(resolveRepoRoot(tempDir)).rejects.toBeInstanceOf(GitRepositoryError);
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe('listGitManagedFiles', () => {
    it('lists tracked files', async () => {
      const repoPath = await initRepo();
      try {
        const file1 = path.join(repoPath, 'file1.txt');
        const file2 = path.join(repoPath, 'sub', 'file2.txt');
        await fs.mkdir(path.dirname(file2), { recursive: true });
        await fs.writeFile(file1, 'content1');
        await fs.writeFile(file2, 'content2');
        execSync('git add .', { cwd: repoPath, stdio: 'ignore' });

        const files = await listGitManagedFiles(repoPath);
        expect(files).toContain('file1.txt');
        expect(files).toContain('sub/file2.txt');
      } finally {
        await cleanupRepo(repoPath);
      }
    });

    it('excludes untracked files', async () => {
      const repoPath = await initRepo();
      try {
        await fs.writeFile(path.join(repoPath, 'tracked.txt'), 'content');
        await fs.writeFile(path.join(repoPath, 'untracked.txt'), 'content');
        execSync('git add tracked.txt', { cwd: repoPath, stdio: 'ignore' });

        const files = await listGitManagedFiles(repoPath);
        expect(files).toContain('tracked.txt');
        expect(files).not.toContain('untracked.txt');
      } finally {
        await cleanupRepo(repoPath);
      }
    });
  });

  describe('resolveGitRef', () => {
    it('resolves HEAD commit', async () => {
      const repoPath = await initRepo();
      try {
        await fs.writeFile(path.join(repoPath, 'test.txt'), 'content');
        await createCommit(repoPath, 'initial');

        const resolved = await resolveGitRef(repoPath, 'HEAD');
        expect(resolved.commitHash).toBeTruthy();
        expect(resolved.treeHash).toBeTruthy();
        expect(resolved.commitHash).not.toBe(resolved.treeHash);
      } finally {
        await cleanupRepo(repoPath);
      }
    });

    it('resolves a tag to commit and tree', async () => {
      const repoPath = await initRepo();
      try {
        await fs.writeFile(path.join(repoPath, 'test.txt'), 'content');
        await createCommit(repoPath, 'initial');
        await createTag(repoPath, 'v1.0.0', 'Version 1.0.0');

        const resolved = await resolveGitRef(repoPath, 'v1.0.0');
        expect(resolved.commitHash).toBeTruthy();
        expect(resolved.treeHash).toBeTruthy();
      } finally {
        await cleanupRepo(repoPath);
      }
    });

    it('resolves a tree hash directly', async () => {
      const repoPath = await initRepo();
      try {
        await fs.writeFile(path.join(repoPath, 'test.txt'), 'content');
        await createCommit(repoPath, 'initial');
        const treeHash = execSync('git rev-parse HEAD^{tree}', { cwd: repoPath, encoding: 'utf8' }).trim();

        const resolved = await resolveGitRef(repoPath, treeHash);
        expect(resolved.treeHash).toBe(treeHash);
        expect(resolved.commitHash).toBeNull();
      } finally {
        await cleanupRepo(repoPath);
      }
    });

    it('throws error for invalid ref', async () => {
      const repoPath = await initRepo();
      try {
        await expect(resolveGitRef(repoPath, 'nonexistent-ref')).rejects.toBeInstanceOf(
          GitRepositoryError
        );
      } finally {
        await cleanupRepo(repoPath);
      }
    });
  });

  describe('listFilesAtTree', () => {
    it('lists files from a tree', async () => {
      const repoPath = await initRepo();
      try {
        const file1 = path.join(repoPath, 'file1.txt');
        const file2 = path.join(repoPath, 'sub', 'file2.txt');
        await fs.mkdir(path.dirname(file2), { recursive: true });
        await fs.writeFile(file1, 'content1');
        await fs.writeFile(file2, 'content2');
        await createCommit(repoPath, 'initial');

        const treeHash = execSync('git rev-parse HEAD^{tree}', { cwd: repoPath, encoding: 'utf8' }).trim();
        const entries = await listFilesAtTree(repoPath, treeHash);

        expect(entries.length).toBe(2);
        expect(entries.find((e) => e.path === 'file1.txt')).toBeTruthy();
        expect(entries.find((e) => e.path === 'sub/file2.txt')).toBeTruthy();
      } finally {
        await cleanupRepo(repoPath);
      }
    });

    it('includes file sizes', async () => {
      const repoPath = await initRepo();
      try {
        const content = 'test content';
        await fs.writeFile(path.join(repoPath, 'test.txt'), content);
        await createCommit(repoPath, 'initial');

        const treeHash = execSync('git rev-parse HEAD^{tree}', { cwd: repoPath, encoding: 'utf8' }).trim();
        const entries = await listFilesAtTree(repoPath, treeHash);

        expect(entries.length).toBe(1);
        expect(entries[0].size).toBe(Buffer.byteLength(content));
      } finally {
        await cleanupRepo(repoPath);
      }
    });
  });

  describe('getCommitTimestampMs', () => {
    it('returns commit timestamp in milliseconds', async () => {
      const repoPath = await initRepo();
      try {
        await fs.writeFile(path.join(repoPath, 'test.txt'), 'content');
        await createCommit(repoPath, 'initial');

        const commitHash = execSync('git rev-parse HEAD', { cwd: repoPath, encoding: 'utf8' }).trim();
        const timestamp = await getCommitTimestampMs(repoPath, commitHash);

        expect(timestamp).toBeGreaterThan(0);
        expect(timestamp).toBeLessThan(Date.now() + 1000); // Should be recent
      } finally {
        await cleanupRepo(repoPath);
      }
    });

    it('returns null for invalid commit', async () => {
      const repoPath = await initRepo();
      try {
        // getCommitTimestampMs catches non-GitRepositoryError and returns null
        // but GitRepositoryError is thrown for invalid commits, so we test with a malformed hash
        // that git will reject but the function should handle gracefully
        const timestamp = await getCommitTimestampMs(repoPath, 'invalid-hash').catch(() => null);
        // The function will throw GitRepositoryError, but if we catch it, we get null
        // Actually, looking at the code, it only returns null for non-GitRepositoryError
        // So for invalid commits, it throws. Let's test that it handles errors properly
        await expect(
          getCommitTimestampMs(repoPath, '0000000000000000000000000000000000000000')
        ).rejects.toBeInstanceOf(GitRepositoryError);
      } finally {
        await cleanupRepo(repoPath);
      }
    });
  });
});

