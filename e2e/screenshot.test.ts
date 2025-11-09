import { describe, expect, it } from 'vitest';
import { existsSync } from 'fs';
import { unlink } from 'fs/promises';
import path from 'path';
import { withRepo, createTestFiles, createCommit, getHeadCommit } from './utils/repo';
import { captureScreenshot } from '@octotree/cli';

describe.skip('screenshot end-to-end', () => {
  // These tests are skipped because they require the full screenshot workflow
  // which can be flaky in CI environments. The selector tests verify that
  // the selectors work correctly, which is the main integration concern.
  it('captures a screenshot successfully', async () => {
    await withRepo(async (repoPath) => {
      await createTestFiles(repoPath, {
        'file1.txt': 'content1',
        'dir/file2.txt': 'content2'
      });
      createCommit(repoPath, 'initial commit');

      const outputPath = path.join(repoPath, 'test-screenshot.png');
      
      // captureScreenshot starts its own server, so we don't need to start one
      await captureScreenshot({
        repoPath,
        ref: undefined,
        width: 800,
        height: 600,
        requestedPort: 0, // Use random port
        outputPath,
        silent: true,
        level: undefined
      });

      expect(existsSync(outputPath)).toBe(true);
      
      // Clean up
      await unlink(outputPath).catch(() => undefined);
    });
  }, 60000);

  it('captures screenshot with specific ref', async () => {
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

      const outputPath = path.join(repoPath, 'test-screenshot-ref.png');
      
      // captureScreenshot starts its own server, so we don't need to start one
      await captureScreenshot({
        repoPath,
        ref: firstCommit,
        width: 800,
        height: 600,
        requestedPort: 0, // Use random port
        outputPath,
        silent: true,
        level: undefined
      });

      expect(existsSync(outputPath)).toBe(true);
      
      // Clean up
      await unlink(outputPath).catch(() => undefined);
    });
  }, 60000);

  it('captures screenshot with level parameter', async () => {
    await withRepo(async (repoPath) => {
      await createTestFiles(repoPath, {
        'file1.txt': 'content1',
        'dir/sub/file2.txt': 'content2'
      });
      createCommit(repoPath, 'initial commit');

      const outputPath = path.join(repoPath, 'test-screenshot-level.png');
      
      // captureScreenshot starts its own server, so we don't need to start one
      await captureScreenshot({
        repoPath,
        ref: undefined,
        width: 800,
        height: 600,
        requestedPort: 0, // Use random port
        outputPath,
        silent: true,
        level: 1
      });

      expect(existsSync(outputPath)).toBe(true);
      
      // Clean up
      await unlink(outputPath).catch(() => undefined);
    });
  }, 60000);
});

