import { describe, it, expect } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { buildTreeFromCommit, buildTreeFromWorkingTree } from '../src/tree-builder';
import { withRepo, createCommit, createTestFiles, createTestTreeStructure, getGitHash } from './utils';

describe('tree-builder', () => {
  describe('buildTreeFromCommit', () => {
    it('builds tree from commit with files', async () => {
      await withRepo(async (repoPath) => {
        await createTestFiles(repoPath, {
          'file1.txt': 'content1',
          'sub/file2.txt': 'content2'
        });
        await createCommit(repoPath, 'initial');

        const { rootNode, nodeMap, childIdMap } = createTestTreeStructure();
        const timestamp = await buildTreeFromCommit(repoPath, rootNode, nodeMap, childIdMap, 'HEAD');

        expect(timestamp).toBeGreaterThan(0);
        expect(rootNode.children.length).toBe(2);
        expect(rootNode.children.find((c) => c.name === 'file1.txt')).toBeTruthy();
        expect(rootNode.children.find((c) => c.name === 'sub')).toBeTruthy();
      });
    });

    it('handles tree hash directly', async () => {
      await withRepo(async (repoPath) => {
        await createTestFiles(repoPath, { 'test.txt': 'content' });
        await createCommit(repoPath, 'initial');
        const treeHash = getGitHash(repoPath, 'HEAD^{tree}');

        const { rootNode, nodeMap, childIdMap } = createTestTreeStructure();
        const timestamp = await buildTreeFromCommit(repoPath, rootNode, nodeMap, childIdMap, treeHash);

        expect(timestamp).toBeNull();
        expect(rootNode.children.length).toBe(1);
      });
    });
  });

  describe('buildTreeFromWorkingTree', () => {
    it('builds tree from working directory', async () => {
      await withRepo(async (repoPath) => {
        await createTestFiles(repoPath, {
          'file1.txt': 'content1',
          'sub/file2.txt': 'content2'
        });
        execSync('git add .', { cwd: repoPath, stdio: 'ignore' });

        const { rootNode, nodeMap, childIdMap } = createTestTreeStructure();
        await buildTreeFromWorkingTree(repoPath, rootNode, nodeMap, childIdMap);

        expect(rootNode.children.length).toBe(2);
        const fileNode = rootNode.children.find((c) => c.name === 'file1.txt');
        expect(fileNode).toBeTruthy();
        expect(fileNode?.size).toBe(Buffer.byteLength('content1'));
      });
    });

    it('handles missing files gracefully', async () => {
      await withRepo(async (repoPath) => {
        await createTestFiles(repoPath, { 'file1.txt': 'content1' });
        execSync('git add file1.txt', { cwd: repoPath, stdio: 'ignore' });
        await fs.unlink(path.join(repoPath, 'file1.txt'));

        const { rootNode, nodeMap, childIdMap } = createTestTreeStructure();
        await buildTreeFromWorkingTree(repoPath, rootNode, nodeMap, childIdMap);

        expect(rootNode.children.length).toBe(0);
      });
    });
  });
});

