import { describe, expect, it } from 'vitest';
import { RADIAL_TREE_SVG_SELECTOR, RADIAL_TREE_LINK_SELECTOR } from '@octotree/core';
import puppeteer from 'puppeteer';
import { withRepo, createTestFiles, createCommit } from './utils/repo';
import { startTestServer, closeTestServer } from './utils/server';

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

      const { server, url } = await startTestServer(repoPath);

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
        await closeTestServer(server);
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

      const { server, url } = await startTestServer(repoPath);
      const urlWithLevel = `${url}?level=1`;

      try {
        const browser = await puppeteer.launch({ headless: true });
        const page = await browser.newPage();

        try {
          await page.goto(urlWithLevel, { waitUntil: 'networkidle0' });
          
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
        await closeTestServer(server);
      }
    });
  }, 30000);
});

