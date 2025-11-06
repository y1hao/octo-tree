import { describe, it, expect } from 'vitest';
import {
  joinRelative,
  makeId,
  ensureChild,
  createDirectoryNode,
  createFileNode,
  sortChildrenRecursively,
  aggregateDirectoryMetadata
} from '../src/tree-node';
import type { TreeNode } from '../src/types';

describe('tree-node', () => {
  describe('joinRelative', () => {
    it('joins paths correctly', () => {
      expect(joinRelative('.', 'file.txt')).toBe('file.txt');
      expect(joinRelative('src', 'index.ts')).toBe('src/index.ts');
      expect(joinRelative('src/utils', 'helper.ts')).toBe('src/utils/helper.ts');
    });
  });

  describe('makeId', () => {
    it('creates correct IDs for files', () => {
      expect(makeId('file.txt', 'file')).toBe('file:file.txt');
      expect(makeId('src/index.ts', 'file')).toBe('file:src/index.ts');
    });

    it('creates correct IDs for directories', () => {
      expect(makeId('src', 'directory')).toBe('directory:src');
      expect(makeId('src/utils', 'directory')).toBe('directory:src/utils');
    });
  });

  describe('ensureChild', () => {
    it('adds child if not exists', () => {
      const parent = createDirectoryNode('.', 'root', 0);
      const child = createFileNode('file.txt', 'file.txt', 1, 100, 0);
      const childIdMap = new Map<string, TreeNode>();

      const result = ensureChild(parent, child, childIdMap);

      expect(result).toBe(child);
      expect(parent.children).toContain(child);
      expect(childIdMap.has(child.id)).toBe(true);
    });

    it('returns existing child if already added', () => {
      const parent = createDirectoryNode('.', 'root', 0);
      const child = createFileNode('file.txt', 'file.txt', 1, 100, 0);
      const childIdMap = new Map<string, TreeNode>();

      ensureChild(parent, child, childIdMap);
      const result = ensureChild(parent, child, childIdMap);

      expect(result).toBe(child);
      expect(parent.children.length).toBe(1);
    });
  });

  describe('createDirectoryNode', () => {
    it('creates directory node with correct properties', () => {
      const node = createDirectoryNode('src', 'src', 1, 1000);

      expect(node.id).toBe('directory:src');
      expect(node.name).toBe('src');
      expect(node.relativePath).toBe('src');
      expect(node.type).toBe('directory');
      expect(node.size).toBe(0);
      expect(node.mtimeMs).toBe(1000);
      expect(node.depth).toBe(1);
      expect(node.children).toEqual([]);
    });

    it('uses default mtimeMs when not provided', () => {
      const node = createDirectoryNode('src', 'src', 1);
      expect(node.mtimeMs).toBe(0);
    });
  });

  describe('createFileNode', () => {
    it('creates file node with correct properties', () => {
      const node = createFileNode('file.txt', 'file.txt', 1, 500, 2000);

      expect(node.id).toBe('file:file.txt');
      expect(node.name).toBe('file.txt');
      expect(node.relativePath).toBe('file.txt');
      expect(node.type).toBe('file');
      expect(node.size).toBe(500);
      expect(node.mtimeMs).toBe(2000);
      expect(node.depth).toBe(1);
      expect(node.children).toEqual([]);
    });
  });

  describe('sortChildrenRecursively', () => {
    it('sorts children by type (directories first), then by name', () => {
      const root = createDirectoryNode('.', 'root', 0);
      const fileB = createFileNode('b.txt', 'b.txt', 1, 100, 0);
      const fileA = createFileNode('a.txt', 'a.txt', 1, 100, 0);
      const dirZ = createDirectoryNode('z', 'z', 1);
      const dirM = createDirectoryNode('m', 'm', 1);

      root.children = [fileB, fileA, dirZ, dirM];
      sortChildrenRecursively(root);

      expect(root.children.map((c) => c.name)).toEqual(['m', 'z', 'a.txt', 'b.txt']);
    });

    it('sorts recursively through nested directories', () => {
      const root = createDirectoryNode('.', 'root', 0);
      const sub = createDirectoryNode('sub', 'sub', 1);
      const fileB = createFileNode('sub/b.txt', 'b.txt', 2, 100, 0);
      const fileA = createFileNode('sub/a.txt', 'a.txt', 2, 100, 0);

      sub.children = [fileB, fileA];
      root.children = [sub];
      sortChildrenRecursively(root);

      expect(sub.children.map((c) => c.name)).toEqual(['a.txt', 'b.txt']);
    });
  });

  describe('aggregateDirectoryMetadata', () => {
    it('returns file metadata for file nodes', () => {
      const file = createFileNode('file.txt', 'file.txt', 1, 500, 1000);
      const result = aggregateDirectoryMetadata(file);

      expect(result.size).toBe(500);
      expect(result.mtimeMs).toBe(1000);
    });

    it('aggregates size from all children', () => {
      const root = createDirectoryNode('.', 'root', 0);
      const file1 = createFileNode('file1.txt', 'file1.txt', 1, 100, 1000);
      const file2 = createFileNode('file2.txt', 'file2.txt', 1, 200, 2000);
      root.children = [file1, file2];

      aggregateDirectoryMetadata(root);

      expect(root.size).toBe(300);
    });

    it('uses latest mtimeMs from children', () => {
      const root = createDirectoryNode('.', 'root', 0);
      const file1 = createFileNode('file1.txt', 'file1.txt', 1, 100, 1000);
      const file2 = createFileNode('file2.txt', 'file2.txt', 1, 200, 3000);
      root.children = [file1, file2];

      aggregateDirectoryMetadata(root);

      expect(root.mtimeMs).toBe(3000);
    });

    it('aggregates recursively through nested directories', () => {
      const root = createDirectoryNode('.', 'root', 0);
      const sub = createDirectoryNode('sub', 'sub', 1);
      const file1 = createFileNode('sub/file1.txt', 'file1.txt', 2, 100, 1000);
      const file2 = createFileNode('file2.txt', 'file2.txt', 1, 200, 2000);

      sub.children = [file1];
      root.children = [sub, file2];

      aggregateDirectoryMetadata(root);

      expect(sub.size).toBe(100);
      expect(root.size).toBe(300);
      expect(root.mtimeMs).toBe(2000);
    });
  });
});

