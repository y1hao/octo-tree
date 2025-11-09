import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import http from 'http';
import { startServer } from '../src/index';
import { createApp } from '../src/app';
import { createTree } from './utils';

vi.mock('../src/app', () => ({
  createApp: vi.fn()
}));

describe('index', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    // Clean up any servers that might have been created
    vi.restoreAllMocks();
  });

  describe('startServer', () => {
    it('starts server on default port', async () => {
      const mockApp = {
        listen: vi.fn((port: number, callback: () => void) => {
          setTimeout(callback, 0);
          return {
            on: vi.fn(),
            close: vi.fn((callback?: () => void) => callback?.())
          } as unknown as http.Server;
        })
      };

      const mockRefreshTree = vi.fn().mockResolvedValue({
        tree: createTree(),
        lastUpdated: Date.now(),
        gitStats: null
      });

      (createApp as ReturnType<typeof vi.fn>).mockReturnValue({
        app: mockApp,
        refreshTree: mockRefreshTree
      });

      const server = await startServer({ repoPath: '/repo' });

      expect(createApp).toHaveBeenCalledWith('/repo', 'HEAD', true, { level: undefined });
      expect(mockRefreshTree).toHaveBeenCalledWith('HEAD');
      expect(mockApp.listen).toHaveBeenCalledWith(3000, expect.any(Function));
      expect(server).toBeDefined();

      await new Promise<void>((resolve) => {
        if (server && typeof server.close === 'function') {
          server.close(() => resolve());
        } else {
          resolve();
        }
      });
    });

    it('starts server on custom port', async () => {
      const mockApp = {
        listen: vi.fn((port: number, callback: () => void) => {
          setTimeout(callback, 0);
          return {
            on: vi.fn(),
            close: vi.fn((callback?: () => void) => callback?.())
          } as unknown as http.Server;
        })
      };

      const mockRefreshTree = vi.fn().mockResolvedValue({
        tree: createTree(),
        lastUpdated: Date.now(),
        gitStats: null
      });

      (createApp as ReturnType<typeof vi.fn>).mockReturnValue({
        app: mockApp,
        refreshTree: mockRefreshTree
      });

      const server = await startServer({ repoPath: '/repo', port: 8080 });

      expect(mockApp.listen).toHaveBeenCalledWith(8080, expect.any(Function));

      await new Promise<void>((resolve) => {
        if (server && typeof server.close === 'function') {
          server.close(() => resolve());
        } else {
          resolve();
        }
      });
    });

    it('uses provided ref when specified', async () => {
      const mockApp = {
        listen: vi.fn((port: number, callback: () => void) => {
          setTimeout(callback, 0);
          return {
            on: vi.fn(),
            close: vi.fn((callback?: () => void) => callback?.())
          } as unknown as http.Server;
        })
      };

      const mockRefreshTree = vi.fn().mockResolvedValue({
        tree: createTree(),
        lastUpdated: Date.now(),
        gitStats: null
      });

      (createApp as ReturnType<typeof vi.fn>).mockReturnValue({
        app: mockApp,
        refreshTree: mockRefreshTree
      });

      const server = await startServer({ repoPath: '/repo', ref: 'main' });

      expect(createApp).toHaveBeenCalledWith('/repo', 'main', false, { level: undefined });
      expect(mockRefreshTree).toHaveBeenCalledWith('main');

      await new Promise<void>((resolve) => {
        if (server && typeof server.close === 'function') {
          server.close(() => resolve());
        } else {
          resolve();
        }
      });
    });

    it('applies level option', async () => {
      const mockApp = {
        listen: vi.fn((port: number, callback: () => void) => {
          setTimeout(callback, 0);
          return {
            on: vi.fn(),
            close: vi.fn((callback?: () => void) => callback?.())
          } as unknown as http.Server;
        })
      };

      const mockRefreshTree = vi.fn().mockResolvedValue({
        tree: createTree(),
        lastUpdated: Date.now(),
        gitStats: null
      });

      (createApp as ReturnType<typeof vi.fn>).mockReturnValue({
        app: mockApp,
        refreshTree: mockRefreshTree
      });

      const server = await startServer({ repoPath: '/repo', level: 5 });

      expect(createApp).toHaveBeenCalledWith('/repo', 'HEAD', true, { level: 5 });

      await new Promise<void>((resolve) => {
        if (server && typeof server.close === 'function') {
          server.close(() => resolve());
        } else {
          resolve();
        }
      });
    });

    it('does not log when silent is true', async () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const mockApp = {
        listen: vi.fn((port: number, callback: () => void) => {
          setTimeout(callback, 0);
          return {
            on: vi.fn(),
            close: vi.fn((callback?: () => void) => callback?.())
          } as unknown as http.Server;
        })
      };

      const mockRefreshTree = vi.fn().mockResolvedValue({
        tree: createTree(),
        lastUpdated: Date.now(),
        gitStats: null
      });

      (createApp as ReturnType<typeof vi.fn>).mockReturnValue({
        app: mockApp,
        refreshTree: mockRefreshTree
      });

      const server = await startServer({ repoPath: '/repo', silent: true });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(consoleLogSpy).not.toHaveBeenCalled();

      consoleLogSpy.mockRestore();

      await new Promise<void>((resolve) => {
        if (server && typeof server.close === 'function') {
          server.close(() => resolve());
        } else {
          resolve();
        }
      });
    });

    it('logs when silent is false', async () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const mockApp = {
        listen: vi.fn((port: number, callback: () => void) => {
          setTimeout(callback, 0);
          return {
            on: vi.fn(),
            close: vi.fn((callback?: () => void) => callback?.())
          } as unknown as http.Server;
        })
      };

      const mockRefreshTree = vi.fn().mockResolvedValue({
        tree: createTree(),
        lastUpdated: Date.now(),
        gitStats: null
      });

      (createApp as ReturnType<typeof vi.fn>).mockReturnValue({
        app: mockApp,
        refreshTree: mockRefreshTree
      });

      const server = await startServer({ repoPath: '/repo', silent: false });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Server listening'));

      consoleLogSpy.mockRestore();

      await new Promise<void>((resolve) => {
        if (server && typeof server.close === 'function') {
          server.close(() => resolve());
        } else {
          resolve();
        }
      });
    });

    it('throws error when repoPath is missing', async () => {
      await expect(startServer({ repoPath: '' })).rejects.toThrow('Server requires a repository path');
    });

    it('handles server errors', async () => {
      const mockError = new Error('Port already in use');
      const mockApp = {
        listen: vi.fn(() => {
          const server = {
            on: vi.fn((event: string, handler: (error: Error) => void) => {
              if (event === 'error') {
                setTimeout(() => handler(mockError), 0);
              }
            }),
            close: vi.fn()
          } as unknown as http.Server;
          return server;
        })
      };

      const mockRefreshTree = vi.fn().mockResolvedValue({
        tree: createTree(),
        lastUpdated: Date.now(),
        gitStats: null
      });

      (createApp as ReturnType<typeof vi.fn>).mockReturnValue({
        app: mockApp,
        refreshTree: mockRefreshTree
      });

      await expect(startServer({ repoPath: '/repo' })).rejects.toThrow('Port already in use');
    });
  });
});

