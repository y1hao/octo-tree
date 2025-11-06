import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { buildTreeFromCommit, buildTreeFromWorkingTree } from '../src/tree-builder';
import { createDirectoryNode } from '../src/tree-node';
import { initRepo, cleanupRepo, createCommit } from './utils';

describe('tree-builder', () => {
  describe('buildTreeFromCommit', () => {
    it('builds tree from commit with files', async () => {
      const repoPath = await initRepo();
      try {
        const file1 = path.join(repoPath, 'file1.txt');
        const file2 = path.join(repoPath, 'sub', 'file2.txt');
        await fs.mkdir(path.dirname(file2), { recursive: true });
        await fs.writeFile(file1, 'content1');
        await fs.writeFile(file2, 'content2');
        await createCommit(repoPath, 'initial');

        const rootNode = createDirectoryNode('.', 'repo', 0);
        const nodeMap = new Map();
        const childIdMap = new Map();
        nodeMap.set('.', rootNode);
        childIdMap.set(rootNode.id, rootNode);

        const timestamp = await buildTreeFromCommit(repoPath, rootNode, nodeMap, childIdMap, 'HEAD');

        expect(timestamp).toBeGreaterThan(0);
        expect(rootNode.children.length).toBe(2);
        expect(rootNode.children.find((c) => c.name === 'file1.txt')).toBeTruthy();
        expect(rootNode.children.find((c) => c.name === 'sub')).toBeTruthy();
      } finally {
        await cleanupRepo(repoPath);
      }
    });

    it('handles tree hash directly', async () => {
      const repoPath = await initRepo();
      try {
        await fs.writeFile(path.join(repoPath, 'test.txt'), 'content');
        await createCommit(repoPath, 'initial');
        const treeHash = execSync('git rev-parse HEAD^{tree}', { cwd: repoPath, encoding: 'utf8' }).trim();

        const rootNode = createDirectoryNode('.', 'repo', 0);
        const nodeMap = new Map();
        const childIdMap = new Map();
        nodeMap.set('.', rootNode);
        childIdMap.set(rootNode.id, rootNode);

        const timestamp = await buildTreeFromCommit(repoPath, rootNode, nodeMap, childIdMap, treeHash);

        expect(timestamp).toBeNull(); // No commit hash for tree
        expect(rootNode.children.length).toBe(1);
      } finally {
        await cleanupRepo(repoPath);
      }
    });
  });

  describe('buildTreeFromWorkingTree', () => {
    it('builds tree from working directory', async () => {
      const repoPath = await initRepo();
      try {
        const file1 = path.join(repoPath, 'file1.txt');
        const file2 = path.join(repoPath, 'sub', 'file2.txt');
        await fs.mkdir(path.dirname(file2), { recursive: true });
        await fs.writeFile(file1, 'content1');
        await fs.writeFile(file2, 'content2');
        execSync('git add .', { cwd: repoPath, stdio: 'ignore' });

        const rootNode = createDirectoryNode('.', 'repo', 0);
        const nodeMap = new Map();
        const childIdMap = new Map();
        nodeMap.set('.', rootNode);
        childIdMap.set(rootNode.id, rootNode);

        await buildTreeFromWorkingTree(repoPath, rootNode, nodeMap, childIdMap);

        expect(rootNode.children.length).toBe(2);
        const fileNode = rootNode.children.find((c) => c.name === 'file1.txt');
        expect(fileNode).toBeTruthy();
        expect(fileNode?.size).toBe(Buffer.byteLength('content1'));
      } finally {
        await cleanupRepo(repoPath);
      }
    });

    it('handles missing files gracefully', async () => {
      const repoPath = await initRepo();
      try {
        const file1 = path.join(repoPath, 'file1.txt');
        await fs.writeFile(file1, 'content1');
        execSync('git add file1.txt', { cwd: repoPath, stdio: 'ignore' });
        await fs.unlink(file1); // Delete after adding to git

        const rootNode = createDirectoryNode('.', 'repo', 0);
        const nodeMap = new Map();
        const childIdMap = new Map();
        nodeMap.set('.', rootNode);
        childIdMap.set(rootNode.id, rootNode);

        await buildTreeFromWorkingTree(repoPath, rootNode, nodeMap, childIdMap);

        // Should not crash, but file won't be in tree
        expect(rootNode.children.length).toBe(0);
      } finally {
        await cleanupRepo(repoPath);
      }
    });
  });
});

