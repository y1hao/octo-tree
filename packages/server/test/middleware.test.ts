import { describe, it, expect, vi } from 'vitest';
import { createLevelRedirectMiddleware } from '../src/middleware';
import { createMockRequest, createMockResponse } from './utils';
import type { Request, Response } from 'express';

describe('middleware', () => {
  describe('createLevelRedirectMiddleware', () => {
    it('redirects root requests without a level query parameter', () => {
      const middleware = createLevelRedirectMiddleware(3);
      const res = createMockResponse();
      const next = vi.fn();
      const req = createMockRequest({
        method: 'GET',
        path: '/',
        query: {},
        originalUrl: '/?ref=abc'
      });

      middleware(req, res, next);

      expect(res.redirect).toHaveBeenCalledWith('/?ref=abc&level=3');
      expect(next).not.toHaveBeenCalled();
    });

    it('falls through when level query parameter exists', () => {
      const middleware = createLevelRedirectMiddleware(2);
      const res = createMockResponse();
      const next = vi.fn();
      const req = createMockRequest({
        method: 'GET',
        path: '/',
        query: { level: '2' },
        originalUrl: '/?level=2'
      });

      middleware(req, res, next);

      expect(res.redirect).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('falls through for non-GET requests', () => {
      const middleware = createLevelRedirectMiddleware(2);
      const res = createMockResponse();
      const next = vi.fn();
      const req = createMockRequest({
        method: 'POST',
        path: '/',
        query: {},
        originalUrl: '/'
      });

      middleware(req, res, next);

      expect(res.redirect).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('falls through for non-root paths', () => {
      const middleware = createLevelRedirectMiddleware(2);
      const res = createMockResponse();
      const next = vi.fn();
      const req = createMockRequest({
        method: 'GET',
        path: '/api/tree',
        query: {},
        originalUrl: '/api/tree'
      });

      middleware(req, res, next);

      expect(res.redirect).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('handles URL parsing errors gracefully', () => {
      const middleware = createLevelRedirectMiddleware(5);
      const res = createMockResponse();
      const next = vi.fn();
      const req = createMockRequest({
        method: 'GET',
        path: '/',
        query: {},
        originalUrl: null as unknown as string
      });

      middleware(req, res, next);

      expect(res.redirect).toHaveBeenCalledWith('/?level=5');
      expect(next).not.toHaveBeenCalled();
    });

    it('handles missing originalUrl', () => {
      const middleware = createLevelRedirectMiddleware(4);
      const res = createMockResponse();
      const next = vi.fn();
      const req = createMockRequest({
        method: 'GET',
        path: '/',
        query: {},
        originalUrl: undefined as unknown as string
      });

      middleware(req, res, next);

      expect(res.redirect).toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });
  });
});

