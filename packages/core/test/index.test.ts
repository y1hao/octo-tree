import { describe, it, expect } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { execSync } from 'child_process';
import { buildRepositoryTree, GitRepositoryError } from '../src';
import { initRepo, cleanupRepo, createCommit, createTag } from './utils';

describe('index', () => {
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
    } finally {
      await cleanupRepo(repoPath);
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
      await cleanupRepo(repoPath);
    }
  });

  it('throws a GitRepositoryError when the repository lacks commits and fallback is disabled', async () => {
    const repoPath = await initRepo();
    try {
      await expect(() => buildRepositoryTree({ repoPath })).rejects.toBeInstanceOf(
        GitRepositoryError
      );
    } finally {
      await cleanupRepo(repoPath);
    }
  });

  it('builds tree from a specific branch', async () => {
    const repoPath = await initRepo();
    try {
      await fs.writeFile(path.join(repoPath, 'file1.txt'), 'content1');
      await createCommit(repoPath, 'initial');
      execSync('git checkout -b feature', { cwd: repoPath, stdio: 'ignore' });
      await fs.writeFile(path.join(repoPath, 'file2.txt'), 'content2');
      await createCommit(repoPath, 'feature commit');

      const tree = await buildRepositoryTree({ repoPath, ref: 'feature' });

      expect(tree.children.length).toBe(2);
      expect(tree.children.find((c) => c.name === 'file1.txt')).toBeTruthy();
      expect(tree.children.find((c) => c.name === 'file2.txt')).toBeTruthy();
    } finally {
      await cleanupRepo(repoPath);
    }
  });

  it('builds tree from a tag', async () => {
    const repoPath = await initRepo();
    try {
      await fs.writeFile(path.join(repoPath, 'file.txt'), 'content');
      await createCommit(repoPath, 'initial');
      await createTag(repoPath, 'v1.0.0', 'Version 1.0.0');

      const tree = await buildRepositoryTree({ repoPath, ref: 'v1.0.0' });

      expect(tree.children.length).toBe(1);
      expect(tree.children[0].name).toBe('file.txt');
    } finally {
      await cleanupRepo(repoPath);
    }
  });

  it('builds tree from a tree hash', async () => {
    const repoPath = await initRepo();
    try {
      await fs.writeFile(path.join(repoPath, 'file.txt'), 'content');
      await createCommit(repoPath, 'initial');
      const treeHash = execSync('git rev-parse HEAD^{tree}', { cwd: repoPath, encoding: 'utf8' }).trim();

      const tree = await buildRepositoryTree({ repoPath, ref: treeHash });

      expect(tree.children.length).toBe(1);
      expect(tree.children[0].name).toBe('file.txt');
    } finally {
      await cleanupRepo(repoPath);
    }
  });

  it('handles deep directory structures', async () => {
    const repoPath = await initRepo();
    try {
      const deepPath = path.join(repoPath, 'a', 'b', 'c', 'd', 'file.txt');
      await fs.mkdir(path.dirname(deepPath), { recursive: true });
      await fs.writeFile(deepPath, 'content');
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
    } finally {
      await cleanupRepo(repoPath);
    }
  });

  it('aggregates directory sizes correctly', async () => {
    const repoPath = await initRepo();
    try {
      const file1 = path.join(repoPath, 'file1.txt');
      const file2 = path.join(repoPath, 'sub', 'file2.txt');
      await fs.mkdir(path.dirname(file2), { recursive: true });
      await fs.writeFile(file1, 'content1');
      await fs.writeFile(file2, 'content2');
      await createCommit(repoPath, 'initial');

      const tree = await buildRepositoryTree({ repoPath });

      const totalSize = Buffer.byteLength('content1') + Buffer.byteLength('content2');
      expect(tree.size).toBe(totalSize);

      const subNode = tree.children.find((c) => c.name === 'sub');
      expect(subNode?.size).toBe(Buffer.byteLength('content2'));
    } finally {
      await cleanupRepo(repoPath);
    }
  });

  it('sorts children correctly (directories first, then files)', async () => {
    const repoPath = await initRepo();
    try {
      await fs.writeFile(path.join(repoPath, 'z-file.txt'), 'content');
      await fs.writeFile(path.join(repoPath, 'a-file.txt'), 'content');
      // Git doesn't track empty directories, so add files to them
      await fs.mkdir(path.join(repoPath, 'z-dir'), { recursive: true });
      await fs.mkdir(path.join(repoPath, 'a-dir'), { recursive: true });
      await fs.writeFile(path.join(repoPath, 'z-dir', 'file.txt'), 'content');
      await fs.writeFile(path.join(repoPath, 'a-dir', 'file.txt'), 'content');
      await createCommit(repoPath, 'initial');

      const tree = await buildRepositoryTree({ repoPath });

      const names = tree.children.map((c) => c.name);
      expect(names).toEqual(['a-dir', 'z-dir', 'a-file.txt', 'z-file.txt']);
    } finally {
      await cleanupRepo(repoPath);
    }
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
    const repoPath = await initRepo();
    try {
      await fs.writeFile(path.join(repoPath, 'file.txt'), 'content');
      await createCommit(repoPath, 'initial');

      await expect(
        buildRepositoryTree({ repoPath, ref: 'nonexistent-branch' })
      ).rejects.toBeInstanceOf(GitRepositoryError);
    } finally {
      await cleanupRepo(repoPath);
    }
  });

  it('does not fallback for non-HEAD refs', async () => {
    const repoPath = await initRepo();
    try {
      await expect(
        buildRepositoryTree({
          repoPath,
          ref: 'nonexistent',
          allowFallbackToWorkingTree: true
        })
      ).rejects.toBeInstanceOf(GitRepositoryError);
    } finally {
      await cleanupRepo(repoPath);
    }
  });
  });
});
