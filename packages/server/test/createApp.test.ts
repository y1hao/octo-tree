import type { Express, Request, Response } from 'express';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GitRepositoryError, type TreeNode } from '@octotree/core';
import { createApp } from '../src';

interface GitStats {
  totalCommits: number | null;
  latestCommitTimestamp: number | null;
}

const createTree = (overrides: Partial<TreeNode> = {}): TreeNode => ({
  id: 'directory:.',
  name: 'repo',
  relativePath: '.',
  type: 'directory',
  size: 0,
  mtimeMs: 0,
  depth: 0,
  children: [],
  ...overrides
});

const createDeferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const getRouteHandler = (app: Express, path: string, method: 'get' | 'post') => {
  const stack = (app as unknown as { _router?: { stack: any[] } })._router?.stack ?? [];
  for (const layer of stack) {
    if (layer.route && layer.route.path === path && layer.route.methods[method]) {
      return layer.route.stack[0].handle as (req: Request, res: Response) => Promise<void> | void;
    }
  }
  throw new Error(`Route ${method.toUpperCase()} ${path} not found`);
};

const createMockResponse = () => {
  const res: Partial<Response> & { statusCode?: number; body?: unknown } = {};
  res.status = vi.fn(function status(this: Response, code: number) {
    res.statusCode = code;
    return this;
  });
  res.json = vi.fn(function json(this: Response, payload: unknown) {
    res.body = payload;
    return this;
  });
  return res as Response & { statusCode?: number; body?: unknown };
};

type BuildArgs = {
  repoPath: string;
  ref?: string;
  allowFallbackToWorkingTree?: boolean;
};

type BuildTreeFn = (parameters: BuildArgs) => Promise<TreeNode>;
type CollectStatsFn = (repoPath: string, ref: string) => Promise<GitStats>;

describe('createApp', () => {
  let buildRepositoryTreeMock: vi.MockedFunction<BuildTreeFn>;
  let collectGitStatsMock: vi.MockedFunction<CollectStatsFn>;

  beforeEach(() => {
    buildRepositoryTreeMock = vi.fn<BuildTreeFn>();
    collectGitStatsMock = vi.fn<CollectStatsFn>();
  });

  it('coalesces concurrent builds for the same ref', async () => {
    const deferred = createDeferred<TreeNode>();
    buildRepositoryTreeMock.mockReturnValueOnce(deferred.promise);
    collectGitStatsMock.mockResolvedValue({ totalCommits: 5, latestCommitTimestamp: 1700000000000 });

    const tree = createTree();
    const appInstance = createApp('/repo', 'HEAD', false, {
      buildRepositoryTreeFn: buildRepositoryTreeMock,
      collectGitStatsFn: collectGitStatsMock
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
      buildRepositoryTreeFn: buildRepositoryTreeMock,
      collectGitStatsFn: collectGitStatsMock
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
      buildRepositoryTreeFn: buildRepositoryTreeMock,
      collectGitStatsFn: collectGitStatsMock
    });
    const handler = getRouteHandler(appInstance.app, '/api/tree', 'get');
    const req = { query: { ref: 'bad' } } as unknown as Request;
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'bad ref' });
  });
});
