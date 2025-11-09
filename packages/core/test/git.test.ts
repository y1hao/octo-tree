import { describe, it, expect } from 'vitest';
import { promises as fs } from 'fs';
import { realpathSync } from 'fs';
import os from 'os';
import path from 'path';
import { execSync } from 'child_process';
import {
  runGitCommand,
  resolveRepoRoot,
  listGitManagedFiles,
  resolveGitRef,
  listFilesAtTree,
  getCommitTimestampMs,
  listCommitsForBranch
} from '../src/git';
import { GitRepositoryError } from '../src/types';
import { withRepo, createCommit, createTag, createTestFiles, getGitHash } from './utils';

describe('git', () => {
  describe('runGitCommand', () => {
    it('executes a git command successfully', async () => {
      await withRepo(async (repoPath) => {
        const result = await runGitCommand(repoPath, ['--version']);
        expect(result).toContain('git version');
      });
    });

    it('throws GitRepositoryError on command failure', async () => {
      await withRepo(async (repoPath) => {
        await expect(runGitCommand(repoPath, ['invalid-command'])).rejects.toBeInstanceOf(
          GitRepositoryError
        );
      });
    });
  });

  describe('resolveRepoRoot', () => {
    it('resolves repository root from subdirectory', async () => {
      await withRepo(async (repoPath) => {
        const subDir = path.join(repoPath, 'sub', 'dir');
        await fs.mkdir(subDir, { recursive: true });
        const root = await resolveRepoRoot(subDir);
        // Normalize paths for comparison (macOS may use /private/var vs /var symlink)
        expect(realpathSync(root)).toBe(realpathSync(repoPath));
      });
    });

    it('throws GitRepositoryError for non-git directory', async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'not-git-'));
      try {
        await expect(resolveRepoRoot(tempDir)).rejects.toBeInstanceOf(GitRepositoryError);
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe('listGitManagedFiles', () => {
    it('lists tracked files', async () => {
      await withRepo(async (repoPath) => {
        await createTestFiles(repoPath, {
          'file1.txt': 'content1',
          'sub/file2.txt': 'content2'
        });
        execSync('git add .', { cwd: repoPath, stdio: 'ignore' });

        const files = await listGitManagedFiles(repoPath);
        expect(files).toContain('file1.txt');
        expect(files).toContain('sub/file2.txt');
      });
    });

    it('excludes untracked files', async () => {
      await withRepo(async (repoPath) => {
        await createTestFiles(repoPath, {
          'tracked.txt': 'content',
          'untracked.txt': 'content'
        });
        execSync('git add tracked.txt', { cwd: repoPath, stdio: 'ignore' });

        const files = await listGitManagedFiles(repoPath);
        expect(files).toContain('tracked.txt');
        expect(files).not.toContain('untracked.txt');
      });
    });
  });

  describe('resolveGitRef', () => {
    it('resolves HEAD commit', async () => {
      await withRepo(async (repoPath) => {
        await createTestFiles(repoPath, { 'test.txt': 'content' });
        createCommit(repoPath, 'initial');

        const resolved = await resolveGitRef(repoPath, 'HEAD');
        expect(resolved.commitHash).toBeTruthy();
        expect(resolved.treeHash).toBeTruthy();
        expect(resolved.commitHash).not.toBe(resolved.treeHash);
      });
    });

    it('resolves a tag to commit and tree', async () => {
      await withRepo(async (repoPath) => {
        await createTestFiles(repoPath, { 'test.txt': 'content' });
        createCommit(repoPath, 'initial');
        createTag(repoPath, 'v1.0.0', 'Version 1.0.0');

        const resolved = await resolveGitRef(repoPath, 'v1.0.0');
        expect(resolved.commitHash).toBeTruthy();
        expect(resolved.treeHash).toBeTruthy();
      });
    });

    it('resolves a tree hash directly', async () => {
      await withRepo(async (repoPath) => {
        await createTestFiles(repoPath, { 'test.txt': 'content' });
        createCommit(repoPath, 'initial');
        const treeHash = getGitHash(repoPath, 'HEAD^{tree}');

        const resolved = await resolveGitRef(repoPath, treeHash);
        expect(resolved.treeHash).toBe(treeHash);
        expect(resolved.commitHash).toBeNull();
      });
    });

    it('throws error for invalid ref', async () => {
      await withRepo(async (repoPath) => {
        await expect(resolveGitRef(repoPath, 'nonexistent-ref')).rejects.toBeInstanceOf(
          GitRepositoryError
        );
      });
    });
  });

  describe('listFilesAtTree', () => {
    it('lists files from a tree', async () => {
      await withRepo(async (repoPath) => {
        await createTestFiles(repoPath, {
          'file1.txt': 'content1',
          'sub/file2.txt': 'content2'
        });
        createCommit(repoPath, 'initial');

        const treeHash = getGitHash(repoPath, 'HEAD^{tree}');
        const entries = await listFilesAtTree(repoPath, treeHash);

        expect(entries.length).toBe(2);
        expect(entries.find((e) => e.path === 'file1.txt')).toBeTruthy();
        expect(entries.find((e) => e.path === 'sub/file2.txt')).toBeTruthy();
      });
    });

    it('includes file sizes', async () => {
      await withRepo(async (repoPath) => {
        const content = 'test content';
        await createTestFiles(repoPath, { 'test.txt': content });
        createCommit(repoPath, 'initial');

        const treeHash = getGitHash(repoPath, 'HEAD^{tree}');
        const entries = await listFilesAtTree(repoPath, treeHash);

        expect(entries.length).toBe(1);
        expect(entries[0].size).toBe(Buffer.byteLength(content));
      });
    });
  });

  describe('getCommitTimestampMs', () => {
    it('returns commit timestamp in milliseconds', async () => {
      await withRepo(async (repoPath) => {
        await createTestFiles(repoPath, { 'test.txt': 'content' });
        createCommit(repoPath, 'initial');

        const commitHash = getGitHash(repoPath, 'HEAD');
        const timestamp = await getCommitTimestampMs(repoPath, commitHash);

        expect(timestamp).toBeGreaterThan(0);
        expect(timestamp).toBeLessThan(Date.now() + 1000);
      });
    });

    it('throws GitRepositoryError for invalid commit hash', async () => {
      await withRepo(async (repoPath) => {
        await expect(
          getCommitTimestampMs(repoPath, '0000000000000000000000000000000000000000')
        ).rejects.toBeInstanceOf(GitRepositoryError);
      });
    });
  });

  describe('listCommitsForBranch', () => {
    it('returns array of commit SHAs in reverse chronological order', async () => {
      await withRepo(async (repoPath) => {
        await createTestFiles(repoPath, { 'file1.txt': 'content1' });
        createCommit(repoPath, 'first commit');
        const firstCommit = getGitHash(repoPath, 'HEAD');

        await createTestFiles(repoPath, { 'file2.txt': 'content2' });
        createCommit(repoPath, 'second commit');
        const secondCommit = getGitHash(repoPath, 'HEAD');

        const commits = await listCommitsForBranch(repoPath);
        expect(commits.length).toBeGreaterThanOrEqual(2);
        expect(commits).toContain(firstCommit);
        expect(commits).toContain(secondCommit);
        // Should be in reverse order (oldest first)
        expect(commits[0]).toBe(firstCommit);
        expect(commits[commits.length - 1]).toBe(secondCommit);
      });
    });

    it('filters out empty lines', async () => {
      await withRepo(async (repoPath) => {
        await createTestFiles(repoPath, { 'test.txt': 'content' });
        createCommit(repoPath, 'initial');

        const commits = await listCommitsForBranch(repoPath);
        expect(commits.length).toBeGreaterThan(0);
        commits.forEach((commit) => {
          expect(commit.length).toBeGreaterThan(0);
        });
      });
    });

    it('trims whitespace from commit SHAs', async () => {
      await withRepo(async (repoPath) => {
        await createTestFiles(repoPath, { 'test.txt': 'content' });
        createCommit(repoPath, 'initial');

        const commits = await listCommitsForBranch(repoPath);
        commits.forEach((commit) => {
          expect(commit).toBe(commit.trim());
        });
      });
    });
  });
});

