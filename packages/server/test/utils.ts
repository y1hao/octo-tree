import type { Express, Request, Response } from 'express';
import { vi } from 'vitest';
import type { TreeNode } from '@octotree/core';

export const createTree = (overrides: Partial<TreeNode> = {}): TreeNode => ({
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

export const createDeferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

export const getRouteHandler = (app: Express, path: string, method: 'get' | 'post') => {
  const stack = (app as unknown as { _router?: { stack: unknown[] } })._router?.stack ?? [];
  for (const layer of stack) {
    const routeLayer = layer as { route?: { path: string; methods: Record<string, boolean>; stack: Array<{ handle: unknown }> } };
    if (routeLayer.route && routeLayer.route.path === path && routeLayer.route.methods[method]) {
      return routeLayer.route.stack[0].handle as (req: Request, res: Response) => Promise<void> | void;
    }
  }
  throw new Error(`Route ${method.toUpperCase()} ${path} not found`);
};

export const createMockRequest = (overrides: Partial<Request> = {}): Request => {
  return {
    query: {},
    ...overrides
  } as unknown as Request;
};

export const createMockResponse = (): Response & { statusCode?: number; body?: unknown } => {
  const res: Partial<Response> & { statusCode?: number; body?: unknown } = {};
  res.status = vi.fn(function status(this: Response, code: number) {
    res.statusCode = code;
    return this;
  });
  res.json = vi.fn(function json(this: Response, payload: unknown) {
    res.body = payload;
    return this;
  });
  res.send = vi.fn(function send(this: Response, payload: unknown) {
    res.body = payload;
    return this;
  });
  res.sendFile = vi.fn(function sendFile(this: Response, _path: string) {
    return this;
  });
  res.redirect = vi.fn(function redirect(this: Response, _urlOrStatus: string | number, _url?: string) {
    return this;
  }) as Response['redirect'];
  return res as Response & { statusCode?: number; body?: unknown };
};

