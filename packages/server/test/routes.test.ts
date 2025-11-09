import { describe, it, expect, vi } from 'vitest';
import { GitRepositoryError } from '@octotree/core';
import type { Request } from 'express';
import {
  extractRefParam,
  handleTreeRequest,
  createTreeRoutes
} from '../src/routes';
import { createMockRequest, createMockResponse, createTree } from './utils';
import type { TreeResult } from '../src/types';

describe('routes', () => {
  describe('extractRefParam', () => {
    it('extracts ref from query string', () => {
      const req = createMockRequest({ query: { ref: 'main' } });
      expect(extractRefParam(req)).toBe('main');
    });

    it('trims whitespace from ref', () => {
      const req = createMockRequest({ query: { ref: '  main  ' } });
      expect(extractRefParam(req)).toBe('main');
    });

    it('returns undefined for empty string', () => {
      const req = createMockRequest({ query: { ref: '' } });
      expect(extractRefParam(req)).toBeUndefined();
    });

    it('returns undefined for whitespace-only string', () => {
      const req = createMockRequest({ query: { ref: '   ' } });
      expect(extractRefParam(req)).toBeUndefined();
    });

    it('returns undefined when ref is missing', () => {
      const req = createMockRequest({ query: {} });
      expect(extractRefParam(req)).toBeUndefined();
    });

    it('returns undefined when ref is not a string', () => {
      const req = createMockRequest({ query: { ref: 123 } as unknown as Request['query'] });
      expect(extractRefParam(req)).toBeUndefined();
    });
  });

  describe('handleTreeRequest', () => {
    it('handles successful tree request', async () => {
      const req = createMockRequest({ query: { ref: 'main' } });
      const res = createMockResponse();
      const tree = createTree();
      const entry: TreeResult = {
        tree,
        lastUpdated: 1000,
        gitStats: { totalCommits: 5, latestCommitTimestamp: 1700000000000 }
      };
      const handler = vi.fn().mockResolvedValue(entry);

      await handleTreeRequest(req, res, handler, 'Test error');

      expect(handler).toHaveBeenCalledWith('main');
      expect(res.json).toHaveBeenCalledWith({
        tree,
        lastUpdated: 1000,
        gitStats: { totalCommits: 5, latestCommitTimestamp: 1700000000000 }
      });
    });

    it('handles GitRepositoryError with 400 status', async () => {
      const req = createMockRequest({ query: { ref: 'bad-ref' } });
      const res = createMockResponse();
      const statusMock = (res as { status: ReturnType<typeof vi.fn> }).status;
      const jsonMock = (res as { json: ReturnType<typeof vi.fn> }).json;
      const error = new GitRepositoryError('Invalid ref');
      const handler = vi.fn().mockRejectedValue(error);
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await handleTreeRequest(req, res, handler, 'Test error');

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Invalid ref' });
      expect(consoleErrorSpy).not.toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('handles generic errors with 500 status', async () => {
      const req = createMockRequest({ query: {} });
      const res = createMockResponse();
      const statusMock = (res as { status: ReturnType<typeof vi.fn> }).status;
      const jsonMock = (res as { json: ReturnType<typeof vi.fn> }).json;
      const error = new Error('Unexpected error');
      const handler = vi.fn().mockRejectedValue(error);
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await handleTreeRequest(req, res, handler, 'Failed to build tree');

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Failed to build tree' });
      expect(consoleErrorSpy).toHaveBeenCalledWith(error);

      consoleErrorSpy.mockRestore();
    });

    it('handles request without ref parameter', async () => {
      const req = createMockRequest({ query: {} });
      const res = createMockResponse();
      const tree = createTree();
      const entry: TreeResult = {
        tree,
        lastUpdated: 2000,
        gitStats: null
      };
      const handler = vi.fn().mockResolvedValue(entry);

      await handleTreeRequest(req, res, handler, 'Test error');

      expect(handler).toHaveBeenCalledWith(undefined);
      expect(res.json).toHaveBeenCalledWith(entry);
    });
  });

  describe('createTreeRoutes', () => {
    it('creates getTree route handler', async () => {
      const req = createMockRequest({ query: { ref: 'main' } });
      const res = createMockResponse();
      const tree = createTree();
      const entry: TreeResult = {
        tree,
        lastUpdated: 1000,
        gitStats: null
      };
      const buildTreeForRef = vi.fn().mockResolvedValue(entry);
      const refreshTreeForRef = vi.fn();

      const routes = createTreeRoutes(buildTreeForRef, refreshTreeForRef);
      await routes.getTree(req, res);

      expect(buildTreeForRef).toHaveBeenCalledWith('main');
      expect(res.json).toHaveBeenCalledWith(entry);
    });

    it('creates refreshTree route handler', async () => {
      const req = createMockRequest({ query: { ref: 'feature' } });
      const res = createMockResponse();
      const tree = createTree();
      const entry: TreeResult = {
        tree,
        lastUpdated: 2000,
        gitStats: { totalCommits: 10, latestCommitTimestamp: 1700000000000 }
      };
      const buildTreeForRef = vi.fn();
      const refreshTreeForRef = vi.fn().mockResolvedValue(entry);

      const routes = createTreeRoutes(buildTreeForRef, refreshTreeForRef);
      await routes.refreshTree(req, res);

      expect(refreshTreeForRef).toHaveBeenCalledWith('feature');
      expect(res.json).toHaveBeenCalledWith(entry);
    });

    it('handles errors in getTree route', async () => {
      const req = createMockRequest({ query: {} });
      const res = createMockResponse();
      const statusMock = (res as { status: ReturnType<typeof vi.fn> }).status;
      const jsonMock = (res as { json: ReturnType<typeof vi.fn> }).json;
      const error = new GitRepositoryError('Bad ref');
      const buildTreeForRef = vi.fn().mockRejectedValue(error);
      const refreshTreeForRef = vi.fn();
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const routes = createTreeRoutes(buildTreeForRef, refreshTreeForRef);
      await routes.getTree(req, res);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Bad ref' });

      consoleErrorSpy.mockRestore();
    });

    it('handles errors in refreshTree route', async () => {
      const req = createMockRequest({ query: {} });
      const res = createMockResponse();
      const statusMock = (res as { status: ReturnType<typeof vi.fn> }).status;
      const jsonMock = (res as { json: ReturnType<typeof vi.fn> }).json;
      const error = new Error('Unexpected');
      const buildTreeForRef = vi.fn();
      const refreshTreeForRef = vi.fn().mockRejectedValue(error);
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const routes = createTreeRoutes(buildTreeForRef, refreshTreeForRef);
      await routes.refreshTree(req, res);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Failed to refresh repository tree' });

      consoleErrorSpy.mockRestore();
    });
  });
});

