import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GitRepositoryError, type TreeNode, buildRepositoryTree, collectGitStats } from '@octotree/core';
import { createApp } from '../src/app';
import { createTree, createDeferred, getRouteHandler, createMockRequest, createMockResponse } from './utils';

describe('app', () => {
  describe('createApp', () => {
    let buildRepositoryTreeMock: ReturnType<typeof vi.fn>;
    let collectGitStatsMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      buildRepositoryTreeMock = vi.fn();
      collectGitStatsMock = vi.fn();
    });

    it('coalesces concurrent builds for the same ref', async () => {
      const deferred = createDeferred<TreeNode>();
      buildRepositoryTreeMock.mockReturnValueOnce(deferred.promise);
      collectGitStatsMock.mockResolvedValue({ totalCommits: 5, latestCommitTimestamp: 1700000000000 });

      const tree = createTree();
      const appInstance = createApp('/repo', 'HEAD', false, {
        buildRepositoryTreeFn: buildRepositoryTreeMock as typeof buildRepositoryTree,
        collectGitStatsFn: collectGitStatsMock as typeof collectGitStats
      });

      const first = appInstance.getTree();
      const second = appInstance.getTree();

      expect(buildRepositoryTreeMock).toHaveBeenCalledTimes(1);

      deferred.resolve(tree);
      const [firstResult, secondResult] = await Promise.all([first, second]);

      expect(firstResult.tree).toBe(tree);
      expect(secondResult.tree).toBe(tree);
      expect(collectGitStatsMock).toHaveBeenCalledTimes(2);
      expect(firstResult.gitStats).toEqual({ totalCommits: 5, latestCommitTimestamp: 1700000000000 });
    });

    it('forces a rebuild when refreshTree is invoked', async () => {
      const initialTree = createTree({ id: 'initial' });
      const refreshedTree = createTree({ id: 'refreshed' });
      buildRepositoryTreeMock
        .mockResolvedValueOnce(initialTree)
        .mockResolvedValueOnce(refreshedTree);
      collectGitStatsMock
        .mockResolvedValueOnce({ totalCommits: 1, latestCommitTimestamp: 1700000000000 })
        .mockResolvedValueOnce({ totalCommits: 2, latestCommitTimestamp: 1700000001000 });

      const appInstance = createApp('/repo', 'HEAD', false, {
        buildRepositoryTreeFn: buildRepositoryTreeMock as typeof buildRepositoryTree,
        collectGitStatsFn: collectGitStatsMock as typeof collectGitStats
      });

      const first = await appInstance.getTree();
      const refreshed = await appInstance.refreshTree();

      expect(first.tree).toBe(initialTree);
      expect(refreshed.tree).toBe(refreshedTree);
      expect(collectGitStatsMock).toHaveBeenCalledTimes(2);
      expect(buildRepositoryTreeMock).toHaveBeenCalledTimes(2);
      expect(refreshed.gitStats).toEqual({ totalCommits: 2, latestCommitTimestamp: 1700000001000 });
    });

    it('maps GitRepositoryError to a 400 response on /api/tree', async () => {
      buildRepositoryTreeMock.mockRejectedValueOnce(new GitRepositoryError('bad ref'));

      const appInstance = createApp('/repo', 'HEAD', false, {
        buildRepositoryTreeFn: buildRepositoryTreeMock as typeof buildRepositoryTree,
        collectGitStatsFn: collectGitStatsMock as typeof collectGitStats
      });
      const handler = getRouteHandler(appInstance.app, '/api/tree', 'get');
      const req = createMockRequest({ query: { ref: 'bad' } });
      const res = createMockResponse();

      await handler(req, res);

      const statusMock = (res as { status: ReturnType<typeof vi.fn> }).status;
      const jsonMock = (res as { json: ReturnType<typeof vi.fn> }).json;
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'bad ref' });
    });

    it('maps GitRepositoryError to a 400 response on /api/tree/refresh', async () => {
      buildRepositoryTreeMock.mockRejectedValueOnce(new GitRepositoryError('invalid ref'));

      const appInstance = createApp('/repo', 'HEAD', false, {
        buildRepositoryTreeFn: buildRepositoryTreeMock as typeof buildRepositoryTree,
        collectGitStatsFn: collectGitStatsMock as typeof collectGitStats
      });
      const handler = getRouteHandler(appInstance.app, '/api/tree/refresh', 'post');
      const req = createMockRequest({ query: { ref: 'invalid' } });
      const res = createMockResponse();

      await handler(req, res);

      const statusMock = (res as { status: ReturnType<typeof vi.fn> }).status;
      const jsonMock = (res as { json: ReturnType<typeof vi.fn> }).json;
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'invalid ref' });
    });

    it('handles different refs independently', async () => {
      const mainTree = createTree({ id: 'main' });
      const featureTree = createTree({ id: 'feature' });
      buildRepositoryTreeMock
        .mockResolvedValueOnce(mainTree)
        .mockResolvedValueOnce(featureTree);
      collectGitStatsMock.mockResolvedValue({ totalCommits: 1, latestCommitTimestamp: 1700000000000 });

      const appInstance = createApp('/repo', 'HEAD', false, {
        buildRepositoryTreeFn: buildRepositoryTreeMock as typeof buildRepositoryTree,
        collectGitStatsFn: collectGitStatsMock as typeof collectGitStats
      });

      const mainResult = await appInstance.getTree('main');
      const featureResult = await appInstance.getTree('feature');

      expect(mainResult.tree).toBe(mainTree);
      expect(featureResult.tree).toBe(featureTree);
      expect(buildRepositoryTreeMock).toHaveBeenCalledTimes(2);
    });

    it('uses default ref when no ref is provided', async () => {
      const tree = createTree();
      buildRepositoryTreeMock.mockResolvedValueOnce(tree);
      collectGitStatsMock.mockResolvedValue({ totalCommits: 1, latestCommitTimestamp: 1700000000000 });

      const appInstance = createApp('/repo', 'main', false, {
        buildRepositoryTreeFn: buildRepositoryTreeMock as typeof buildRepositoryTree,
        collectGitStatsFn: collectGitStatsMock as typeof collectGitStats
      });

      await appInstance.getTree();

      expect(buildRepositoryTreeMock).toHaveBeenCalledWith({
        repoPath: '/repo',
        ref: 'main',
        allowFallbackToWorkingTree: false
      });
    });

    it('allows fallback to working tree when configured', async () => {
      const tree = createTree();
      buildRepositoryTreeMock.mockResolvedValueOnce(tree);
      collectGitStatsMock.mockResolvedValue({ totalCommits: 1, latestCommitTimestamp: 1700000000000 });

      const appInstance = createApp('/repo', 'HEAD', true, {
        buildRepositoryTreeFn: buildRepositoryTreeMock as typeof buildRepositoryTree,
        collectGitStatsFn: collectGitStatsMock as typeof collectGitStats
      });

      await appInstance.getTree();

      expect(buildRepositoryTreeMock).toHaveBeenCalledWith({
        repoPath: '/repo',
        ref: 'HEAD',
        allowFallbackToWorkingTree: true
      });
    });


  });
});

