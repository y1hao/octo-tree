import { describe, expect, it } from 'vitest';
import { RADIAL_TREE_SVG_SELECTOR, RADIAL_TREE_LINK_SELECTOR } from '@octotree/core';
import { startServer } from '@octotree/server';
import puppeteer from 'puppeteer';
import { mkdtempSync } from 'fs';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { execSync } from 'child_process';

// Test utilities (copied from core/test/utils.ts to avoid cross-package test dependencies)
const initRepo = (): string => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'octotree-cli-test-'));
  execSync('git init', { cwd: dir, stdio: 'ignore' });
  execSync('git config user.email "test@example.com"', { cwd: dir, stdio: 'ignore' });
  execSync('git config user.name "Octo Tree Test"', { cwd: dir, stdio: 'ignore' });
  return dir;
};

const cleanupRepo = async (repoPath: string): Promise<void> => {
  await fs.rm(repoPath, { recursive: true, force: true });
};

const withRepo = async <T>(testFn: (repoPath: string) => Promise<T>): Promise<T> => {
  const repoPath = initRepo();
  try {
    return await testFn(repoPath);
  } finally {
    await cleanupRepo(repoPath);
  }
};

const createTestFiles = async (repoPath: string, files: Record<string, string>): Promise<void> => {
  await Promise.all(
    Object.entries(files).map(async ([filePath, content]) => {
      const fullPath = path.join(repoPath, filePath);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, content);
    })
  );
};

const createCommit = (repoPath: string, message: string): void => {
  execSync('git add .', { cwd: repoPath, stdio: 'ignore' });
  execSync(`git commit -m "${message}"`, { cwd: repoPath, stdio: 'ignore' });
};

/**
 * Integration tests to verify that the CSS selectors used by the CLI
 * match the actual DOM structure rendered by the web package.
 * 
 * These tests ensure that if the web package changes its CSS classes,
 * the CLI screenshot/video functionality will fail tests rather than
 * silently timing out in production.
 */
describe('selector integration', () => {
  it('verifies radial tree SVG selector exists in rendered page', async () => {
    await withRepo(async (repoPath) => {
      await createTestFiles(repoPath, {
        'file1.txt': 'content1',
        'file2.txt': 'content2'
      });
      createCommit(repoPath, 'initial commit');

      const server = await startServer({ port: 0, repoPath, silent: true });
      const address = server.address();
      if (typeof address !== 'object' || !address || !('port' in address)) {
        throw new Error('Failed to get server port');
      }
      const port = address.port;
      const url = `http://localhost:${port}`;

      try {
        const browser = await puppeteer.launch({ headless: true });
        const page = await browser.newPage();

        try {
          await page.goto(url, { waitUntil: 'networkidle0' });
          
          // Verify the selector exists (this is what CLI uses)
          const svgElement = await page.$(RADIAL_TREE_SVG_SELECTOR);
          expect(svgElement).toBeTruthy();

          // Verify links exist (this is what CLI waits for)
          const linkCount = await page.evaluate((selector) => {
            return document.querySelectorAll(selector).length;
          }, RADIAL_TREE_LINK_SELECTOR);
          expect(linkCount).toBeGreaterThan(0);
        } finally {
          await browser.close();
        }
      } finally {
        await new Promise<void>((resolve, reject) => {
          server.close((error) => {
            if (error) reject(error);
            else resolve();
          });
        });
      }
    });
  }, 30000);

  it('verifies selectors work with level parameter', async () => {
    await withRepo(async (repoPath) => {
      await createTestFiles(repoPath, {
        'file1.txt': 'content1',
        'sub/file2.txt': 'content2'
      });
      createCommit(repoPath, 'initial commit');

      const server = await startServer({ port: 0, repoPath, silent: true });
      const address = server.address();
      if (typeof address !== 'object' || !address || !('port' in address)) {
        throw new Error('Failed to get server port');
      }
      const port = address.port;
      const url = `http://localhost:${port}?level=1`;

      try {
        const browser = await puppeteer.launch({ headless: true });
        const page = await browser.newPage();

        try {
          await page.goto(url, { waitUntil: 'networkidle0' });
          
          const svgElement = await page.$(RADIAL_TREE_SVG_SELECTOR);
          expect(svgElement).toBeTruthy();

          const linkCount = await page.evaluate((selector) => {
            return document.querySelectorAll(selector).length;
          }, RADIAL_TREE_LINK_SELECTOR);
          expect(linkCount).toBeGreaterThan(0);
        } finally {
          await browser.close();
        }
      } finally {
        await new Promise<void>((resolve, reject) => {
          server.close((error) => {
            if (error) reject(error);
            else resolve();
          });
        });
      }
    });
  }, 30000);
});

