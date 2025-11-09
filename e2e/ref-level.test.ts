import { describe, expect, it } from 'vitest';
import puppeteer from 'puppeteer';
import { RADIAL_TREE_SVG_SELECTOR } from '@octotree/core';
import { withRepo, createTestFiles, createCommit, getHeadCommit } from './utils/repo';
import { startTestServer, closeTestServer } from './utils/server';

describe('ref and level parameter integration', () => {
  it('renders page with specific ref parameter', async () => {
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

      const { server, url } = await startTestServer(repoPath);
      const urlWithRef = `${url}?ref=${firstCommit}`;

      try {
        const browser = await puppeteer.launch({ headless: true });
        const page = await browser.newPage();

        try {
          await page.goto(urlWithRef, { waitUntil: 'networkidle0' });
          
          const svgElement = await page.$(RADIAL_TREE_SVG_SELECTOR);
          expect(svgElement).toBeTruthy();
        } finally {
          await browser.close();
        }
      } finally {
        await closeTestServer(server);
      }
    });
  }, 30000);

  it('renders page with level parameter', async () => {
    await withRepo(async (repoPath) => {
      await createTestFiles(repoPath, {
        'file1.txt': 'content1',
        'dir/sub/file2.txt': 'content2'
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
        } finally {
          await browser.close();
        }
      } finally {
        await closeTestServer(server);
      }
    });
  }, 30000);

  it('renders page with both ref and level parameters', async () => {
    await withRepo(async (repoPath) => {
      await createTestFiles(repoPath, {
        'file1.txt': 'content1',
        'dir/sub/file2.txt': 'content2'
      });
      createCommit(repoPath, 'first commit');
      const firstCommit = getHeadCommit(repoPath);

      await createTestFiles(repoPath, {
        'file3.txt': 'content3'
      });
      createCommit(repoPath, 'second commit');

      const { server, url } = await startTestServer(repoPath);
      const urlWithParams = `${url}?ref=${firstCommit}&level=1`;

      try {
        const browser = await puppeteer.launch({ headless: true });
        const page = await browser.newPage();

        try {
          await page.goto(urlWithParams, { waitUntil: 'networkidle0' });
          
          const svgElement = await page.$(RADIAL_TREE_SVG_SELECTOR);
          expect(svgElement).toBeTruthy();
        } finally {
          await browser.close();
        }
      } finally {
        await closeTestServer(server);
      }
    });
  }, 30000);
});

