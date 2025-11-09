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

  afterEach(() => {
    // Clean up any servers that might have been created
    vi.restoreAllMocks();
  });

  const createMockApp = (listenBehavior?: (port: number, callback: () => void) => http.Server) => {
    return {
      listen: vi.fn((port: number, callback: () => void) => {
        if (listenBehavior) {
          return listenBehavior(port, callback);
        }
        setTimeout(callback, 0);
        return {
          on: vi.fn(),
          close: vi.fn((callback?: () => void) => callback?.())
        } as unknown as http.Server;
      })
    };
  };

  const createMockRefreshTree = () => {
    return vi.fn().mockResolvedValue({
      tree: createTree(),
      lastUpdated: Date.now(),
      gitStats: null
    });
  };

  const setupCreateAppMock = (mockApp: ReturnType<typeof createMockApp>, mockRefreshTree: ReturnType<typeof createMockRefreshTree>) => {
    (createApp as ReturnType<typeof vi.fn>).mockReturnValue({
      app: mockApp,
      refreshTree: mockRefreshTree
    });
  };

  const closeServer = async (server: http.Server | undefined) => {
    await new Promise<void>((resolve) => {
      if (server && typeof server.close === 'function') {
        server.close(() => resolve());
      } else {
        resolve();
      }
    });
  };

  describe('startServer', () => {
    it('starts server on default port', async () => {
      const mockApp = createMockApp();
      const mockRefreshTree = createMockRefreshTree();
      setupCreateAppMock(mockApp, mockRefreshTree);

      const server = await startServer({ repoPath: '/repo' });

      expect(createApp).toHaveBeenCalledWith('/repo', 'HEAD', true);
      expect(mockRefreshTree).toHaveBeenCalledWith('HEAD');
      expect(mockApp.listen).toHaveBeenCalledWith(3000, expect.any(Function));
      expect(server).toBeDefined();

      await closeServer(server);
    });

    it('starts server on custom port', async () => {
      const mockApp = createMockApp();
      const mockRefreshTree = createMockRefreshTree();
      setupCreateAppMock(mockApp, mockRefreshTree);

      const server = await startServer({ repoPath: '/repo', port: 8080 });

      expect(mockApp.listen).toHaveBeenCalledWith(8080, expect.any(Function));

      await closeServer(server);
    });

    it('uses provided ref when specified', async () => {
      const mockApp = createMockApp();
      const mockRefreshTree = createMockRefreshTree();
      setupCreateAppMock(mockApp, mockRefreshTree);

      const server = await startServer({ repoPath: '/repo', ref: 'main' });

      expect(createApp).toHaveBeenCalledWith('/repo', 'main', false);
      expect(mockRefreshTree).toHaveBeenCalledWith('main');

      await closeServer(server);
    });


    it('does not log when silent is true', async () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const mockApp = createMockApp();
      const mockRefreshTree = createMockRefreshTree();
      setupCreateAppMock(mockApp, mockRefreshTree);

      const server = await startServer({ repoPath: '/repo', silent: true });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(consoleLogSpy).not.toHaveBeenCalled();

      consoleLogSpy.mockRestore();

      await closeServer(server);
    });

    it('logs when silent is false', async () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const mockApp = createMockApp();
      const mockRefreshTree = createMockRefreshTree();
      setupCreateAppMock(mockApp, mockRefreshTree);

      const server = await startServer({ repoPath: '/repo', silent: false });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Server listening'));

      consoleLogSpy.mockRestore();

      await closeServer(server);
    });

    it('throws error when repoPath is missing', async () => {
      await expect(startServer({ repoPath: '' })).rejects.toThrow('Server requires a repository path');
    });

    it('handles server errors', async () => {
      const mockError = new Error('Port already in use');
      const mockApp = createMockApp(() => {
        const server = {
          on: vi.fn((event: string, handler: (error: Error) => void) => {
            if (event === 'error') {
              setTimeout(() => handler(mockError), 0);
            }
          }),
          close: vi.fn()
        } as unknown as http.Server;
        return server;
      });
      const mockRefreshTree = createMockRefreshTree();
      setupCreateAppMock(mockApp, mockRefreshTree);

      await expect(startServer({ repoPath: '/repo' })).rejects.toThrow('Port already in use');
    });
  });
});

