import { describe, expect, it } from 'vitest';
import { withRepo, createTestFiles, createCommit, getHeadCommit } from './utils/repo';
import { startTestServer, closeTestServer } from './utils/server';

describe('server API integration', () => {
  it('GET /api/tree returns tree structure', async () => {
    await withRepo(async (repoPath) => {
      await createTestFiles(repoPath, {
        'file1.txt': 'content1',
        'dir/file2.txt': 'content2',
        'dir/sub/file3.txt': 'content3'
      });
      createCommit(repoPath, 'initial commit');

      const { server, url } = await startTestServer(repoPath);

      try {
        const response = await fetch(`${url}/api/tree`);
        expect(response.ok).toBe(true);
        
        const data = await response.json();
        expect(data).toHaveProperty('tree');
        expect(data).toHaveProperty('lastUpdated');
        expect(data).toHaveProperty('gitStats');
        
        expect(data.tree).toHaveProperty('name');
        expect(data.tree).toHaveProperty('children');
        expect(Array.isArray(data.tree.children)).toBe(true);
      } finally {
        await closeTestServer(server);
      }
    });
  }, 30000);

  it('GET /api/tree with ref parameter returns tree for specific commit', async () => {
    await withRepo(async (repoPath) => {
      await createTestFiles(repoPath, {
        'file1.txt': 'content1'
      });
      createCommit(repoPath, 'first commit');
      const firstCommit = getHeadCommit(repoPath);

      await createTestFiles(repoPath, {
        'file2.txt': 'content2'
      });
      createCommit(repoPath, 'second commit');
      const secondCommit = getHeadCommit(repoPath);

      const { server, url } = await startTestServer(repoPath);

      try {
        // Get tree for first commit
        const response1 = await fetch(`${url}/api/tree?ref=${firstCommit}`);
        expect(response1.ok).toBe(true);
        const data1 = await response1.json();
        
        // Get tree for second commit
        const response2 = await fetch(`${url}/api/tree?ref=${secondCommit}`);
        expect(response2.ok).toBe(true);
        const data2 = await response2.json();

        // Second commit should have more files
        const countFiles = (node: any): number => {
          if (!node.children || node.children.length === 0) {
            return 1;
          }
          return node.children.reduce((sum: number, child: any) => sum + countFiles(child), 0);
        };

        const files1 = countFiles(data1.tree);
        const files2 = countFiles(data2.tree);
        expect(files2).toBeGreaterThan(files1);
      } finally {
        await closeTestServer(server);
      }
    });
  }, 30000);

  it('POST /api/tree/refresh refreshes the tree', async () => {
    await withRepo(async (repoPath) => {
      await createTestFiles(repoPath, {
        'file1.txt': 'content1'
      });
      createCommit(repoPath, 'initial commit');

      const { server, url } = await startTestServer(repoPath);

      try {
        // Get initial tree
        const response1 = await fetch(`${url}/api/tree`);
        expect(response1.ok).toBe(true);
        const data1 = await response1.json();
        const initialLastUpdated = data1.lastUpdated;

        // Wait a bit to ensure timestamp difference
        await new Promise(resolve => setTimeout(resolve, 100));

        // Refresh tree
        const response2 = await fetch(`${url}/api/tree/refresh`, {
          method: 'POST'
        });
        expect(response2.ok).toBe(true);
        const data2 = await response2.json();

        // Last updated should be different (or at least the tree should be valid)
        expect(data2).toHaveProperty('tree');
        expect(data2).toHaveProperty('lastUpdated');
        expect(data2.lastUpdated).not.toBe(initialLastUpdated);
        expect(data2.tree).toHaveProperty('name');
      } finally {
        await closeTestServer(server);
      }
    });
  }, 30000);

  it('GET /api/tree returns 400 for invalid ref', async () => {
    await withRepo(async (repoPath) => {
      await createTestFiles(repoPath, {
        'file1.txt': 'content1'
      });
      createCommit(repoPath, 'initial commit');

      const { server, url } = await startTestServer(repoPath);

      try {
        const response = await fetch(`${url}/api/tree?ref=invalid-ref-12345`);
        expect(response.status).toBe(400);
        
        const data = await response.json();
        expect(data).toHaveProperty('error');
        expect(typeof data.error).toBe('string');
      } finally {
        await closeTestServer(server);
      }
    });
  }, 30000);
});

