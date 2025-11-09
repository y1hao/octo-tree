import { execSync } from 'child_process';
import { describe, expect, it } from 'vitest';
import { withRepo, createTestFiles, createCommit, getAllCommits } from './utils/repo';
import { startTestServer, closeTestServer } from './utils/server';

describe('git repository scenarios', () => {
  it('handles repository with single commit', async () => {
    await withRepo(async (repoPath) => {
      await createTestFiles(repoPath, {
        'file1.txt': 'content1'
      });
      createCommit(repoPath, 'single commit');

      const { server, url } = await startTestServer(repoPath);

      try {
        const response = await fetch(`${url}/api/tree`);
        expect(response.ok).toBe(true);
        
        const data = await response.json();
        expect(data.tree).toBeDefined();
        expect(data.gitStats).toBeDefined();
      } finally {
        await closeTestServer(server);
      }
    });
  }, 30000);

  it('handles repository with multiple commits', async () => {
    await withRepo(async (repoPath) => {
      await createTestFiles(repoPath, {
        'file1.txt': 'content1'
      });
      createCommit(repoPath, 'first commit');

      await createTestFiles(repoPath, {
        'file2.txt': 'content2'
      });
      createCommit(repoPath, 'second commit');

      await createTestFiles(repoPath, {
        'file3.txt': 'content3'
      });
      createCommit(repoPath, 'third commit');

      const commits = getAllCommits(repoPath);
      expect(commits.length).toBe(3);

      const { server, url } = await startTestServer(repoPath);

      try {
        const response = await fetch(`${url}/api/tree`);
        expect(response.ok).toBe(true);
        
        const data = await response.json();
        expect(data.tree).toBeDefined();
        
        // Should have all three files
        const countFiles = (node: any): number => {
          if (!node.children || node.children.length === 0) {
            return 1;
          }
          return node.children.reduce((sum: number, child: any) => sum + countFiles(child), 0);
        };
        
        const fileCount = countFiles(data.tree);
        expect(fileCount).toBeGreaterThanOrEqual(3);
      } finally {
        await closeTestServer(server);
      }
    });
  }, 30000);

  it('handles repository with nested directory structure', async () => {
    await withRepo(async (repoPath) => {
      await createTestFiles(repoPath, {
        'root.txt': 'root',
        'dir1/file1.txt': 'file1',
        'dir1/subdir/file2.txt': 'file2',
        'dir2/file3.txt': 'file3',
        'dir2/file4.txt': 'file4'
      });
      createCommit(repoPath, 'nested structure');

      const { server, url } = await startTestServer(repoPath);

      try {
        const response = await fetch(`${url}/api/tree`);
        expect(response.ok).toBe(true);
        
        const data = await response.json();
        expect(data.tree).toBeDefined();
        expect(data.tree.children).toBeDefined();
        expect(Array.isArray(data.tree.children)).toBe(true);
        
        // Should have root.txt and at least two directories
        // The tree structure may vary, so we check that we have children
        expect(data.tree.children.length).toBeGreaterThan(0);
        
        // Count files and directories recursively
        const countNodes = (node: any): { files: number; dirs: number } => {
          if (!node.children || node.children.length === 0) {
            return { files: 1, dirs: 0 };
          }
          const counts = node.children.reduce(
            (acc: { files: number; dirs: number }, child: any) => {
              const childCounts = countNodes(child);
              return {
                files: acc.files + childCounts.files,
                dirs: acc.dirs + childCounts.dirs + (child.children ? 1 : 0)
              };
            },
            { files: 0, dirs: 0 }
          );
          return counts;
        };
        
        const counts = countNodes(data.tree);
        expect(counts.files).toBeGreaterThanOrEqual(4); // root.txt + 3 other files
        expect(counts.dirs).toBeGreaterThanOrEqual(2); // dir1 and dir2
      } finally {
        await closeTestServer(server);
      }
    });
  }, 30000);

  it('handles repository with empty commit', async () => {
    await withRepo(async (repoPath) => {
      // Create an empty commit (allow-empty flag)
      execSync('git commit --allow-empty -m "empty commit"', {
        cwd: repoPath,
        stdio: 'ignore'
      });

      const { server, url } = await startTestServer(repoPath);

      try {
        const response = await fetch(`${url}/api/tree`);
        expect(response.ok).toBe(true);
        
        const data = await response.json();
        expect(data.tree).toBeDefined();
        // Empty repo should still have a root node
        expect(data.tree.name).toBeDefined();
      } finally {
        await closeTestServer(server);
      }
    });
  }, 30000);
});

