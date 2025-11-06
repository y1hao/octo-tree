import { describe, it, expect } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { execSync } from 'child_process';
import { buildRepositoryTree, GitRepositoryError } from '../src';
import { withRepo, createCommit, createTag, createTestFiles, getGitHash } from './utils';

describe('index', () => {
  describe('buildRepositoryTree', () => {
    it('builds a tree from the HEAD commit', async () => {
      await withRepo(async (repoPath) => {
        await createTestFiles(repoPath, {
          'src/index.ts': 'console.log("hi");\n',
          'README.md': '# Test Repo\n'
        });
        await createCommit(repoPath, 'initial');

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
      });
    });

    it('falls back to working tree when HEAD is unavailable and fallback is allowed', async () => {
      await withRepo(async (repoPath) => {
        await createTestFiles(repoPath, { 'NOTE.txt': 'hello world' });
        execSync('git add .', { cwd: repoPath, stdio: 'ignore' });

        const tree = await buildRepositoryTree({ repoPath, allowFallbackToWorkingTree: true });

        const fileNode = tree.children.find((child) => child.name === 'NOTE.txt');
        expect(fileNode?.type).toBe('file');
        expect(fileNode?.size).toBe(Buffer.byteLength('hello world'));
        expect(tree.size).toBe(Buffer.byteLength('hello world'));
      });
    });

    it('throws a GitRepositoryError when the repository lacks commits and fallback is disabled', async () => {
      await withRepo(async (repoPath) => {
        await expect(() => buildRepositoryTree({ repoPath })).rejects.toBeInstanceOf(
          GitRepositoryError
        );
      });
    });

    it('builds tree from a specific branch', async () => {
      await withRepo(async (repoPath) => {
        await createTestFiles(repoPath, { 'file1.txt': 'content1' });
        await createCommit(repoPath, 'initial');
        execSync('git checkout -b feature', { cwd: repoPath, stdio: 'ignore' });
        await createTestFiles(repoPath, { 'file2.txt': 'content2' });
        await createCommit(repoPath, 'feature commit');

        const tree = await buildRepositoryTree({ repoPath, ref: 'feature' });

        expect(tree.children.length).toBe(2);
        expect(tree.children.find((c) => c.name === 'file1.txt')).toBeTruthy();
        expect(tree.children.find((c) => c.name === 'file2.txt')).toBeTruthy();
      });
    });

    it('builds tree from a tag', async () => {
      await withRepo(async (repoPath) => {
        await createTestFiles(repoPath, { 'file.txt': 'content' });
        await createCommit(repoPath, 'initial');
        await createTag(repoPath, 'v1.0.0', 'Version 1.0.0');

        const tree = await buildRepositoryTree({ repoPath, ref: 'v1.0.0' });

        expect(tree.children.length).toBe(1);
        expect(tree.children[0].name).toBe('file.txt');
      });
    });

    it('builds tree from a tree hash', async () => {
      await withRepo(async (repoPath) => {
        await createTestFiles(repoPath, { 'file.txt': 'content' });
        await createCommit(repoPath, 'initial');
        const treeHash = getGitHash(repoPath, 'HEAD^{tree}');

        const tree = await buildRepositoryTree({ repoPath, ref: treeHash });

        expect(tree.children.length).toBe(1);
        expect(tree.children[0].name).toBe('file.txt');
      });
    });

    it('handles deep directory structures', async () => {
      await withRepo(async (repoPath) => {
        await createTestFiles(repoPath, { 'a/b/c/d/file.txt': 'content' });
        await createCommit(repoPath, 'initial');

        const tree = await buildRepositoryTree({ repoPath });

        const aNode = tree.children.find((c) => c.name === 'a');
        expect(aNode?.type).toBe('directory');
        expect(aNode?.depth).toBe(1);

        const bNode = aNode?.children.find((c) => c.name === 'b');
        expect(bNode?.depth).toBe(2);

        const fileNode = bNode?.children
          .find((c) => c.name === 'c')
          ?.children.find((c) => c.name === 'd')
          ?.children.find((c) => c.name === 'file.txt');
        expect(fileNode?.type).toBe('file');
        expect(fileNode?.depth).toBe(5);
      });
    });

    it('aggregates directory sizes correctly', async () => {
      await withRepo(async (repoPath) => {
        await createTestFiles(repoPath, {
          'file1.txt': 'content1',
          'sub/file2.txt': 'content2'
        });
        await createCommit(repoPath, 'initial');

        const tree = await buildRepositoryTree({ repoPath });

        const totalSize = Buffer.byteLength('content1') + Buffer.byteLength('content2');
        expect(tree.size).toBe(totalSize);

        const subNode = tree.children.find((c) => c.name === 'sub');
        expect(subNode?.size).toBe(Buffer.byteLength('content2'));
      });
    });

    it('sorts children correctly (directories first, then files)', async () => {
      await withRepo(async (repoPath) => {
        await createTestFiles(repoPath, {
          'z-file.txt': 'content',
          'a-file.txt': 'content',
          'z-dir/file.txt': 'content',
          'a-dir/file.txt': 'content'
        });
        await createCommit(repoPath, 'initial');

        const tree = await buildRepositoryTree({ repoPath });

        const names = tree.children.map((c) => c.name);
        expect(names).toEqual(['a-dir', 'z-dir', 'a-file.txt', 'z-file.txt']);
      });
    });

    it('throws error for invalid repository path', async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'not-repo-'));
      try {
        await expect(buildRepositoryTree({ repoPath: tempDir })).rejects.toBeInstanceOf(
          GitRepositoryError
        );
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    });

    it('throws error for invalid ref when fallback is disabled', async () => {
      await withRepo(async (repoPath) => {
        await createTestFiles(repoPath, { 'file.txt': 'content' });
        await createCommit(repoPath, 'initial');

        await expect(
          buildRepositoryTree({ repoPath, ref: 'nonexistent-branch' })
        ).rejects.toBeInstanceOf(GitRepositoryError);
      });
    });

    it('does not fallback for non-HEAD refs', async () => {
      await withRepo(async (repoPath) => {
        await expect(
          buildRepositoryTree({
            repoPath,
            ref: 'nonexistent',
            allowFallbackToWorkingTree: true
          })
        ).rejects.toBeInstanceOf(GitRepositoryError);
      });
    });
  });
});
