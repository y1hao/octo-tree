import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { collectGitStats, runGitCommand } from '../src/git';

// Mock child_process at the module level
vi.mock('child_process', async () => {
  const actual = await vi.importActual<typeof import('child_process')>('child_process');
  return {
    ...actual,
    spawn: vi.fn()
  };
});

describe('git', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('collectGitStats', () => {
    it('handles failed git commands gracefully', async () => {
      const { spawn } = await import('child_process');
      const mockChild = createMockChildProcess();
      
      (spawn as ReturnType<typeof vi.fn>).mockReturnValue(mockChild);
      mockChild.on.mockImplementation((event: string, handler: (code: number) => void) => {
        if (event === 'close') {
          setTimeout(() => handler(1), 0);
        }
      });

      // collectGitStats catches errors from runGitCommand, so no console.warn is called
      const result = await collectGitStats('/repo', 'invalid-ref');

      expect(result.totalCommits).toBeNull();
      expect(result.latestCommitTimestamp).toBeNull();
    });

    it('handles invalid number parsing', async () => {
      const { spawn } = await import('child_process');
      const mockChild = createMockChildProcess();
      
      (spawn as ReturnType<typeof vi.fn>).mockReturnValue(mockChild);
      mockChild.stdout.on.mockImplementation((event: string, handler: (data: string) => void) => {
        if (event === 'data') {
          setTimeout(() => handler('not-a-number\n'), 0);
        }
      });
      mockChild.on.mockImplementation((event: string, handler: (code: number) => void) => {
        if (event === 'close') {
          setTimeout(() => handler(0), 0);
        }
      });

      const result = await collectGitStats('/repo', 'HEAD');

      expect(result.totalCommits).toBeNull();
      expect(result.latestCommitTimestamp).toBeNull();
    });

    it('handles empty output', async () => {
      const { spawn } = await import('child_process');
      const mockChild = createMockChildProcess();
      
      (spawn as ReturnType<typeof vi.fn>).mockReturnValue(mockChild);
      mockChild.on.mockImplementation((event: string, handler: (code: number) => void) => {
        if (event === 'close') {
          setTimeout(() => handler(0), 0);
        }
      });

      const result = await collectGitStats('/repo', 'HEAD');

      expect(result.totalCommits).toBeNull();
      expect(result.latestCommitTimestamp).toBeNull();
    });

    it('parses valid numbers correctly', async () => {
      const { spawn } = await import('child_process');
      let callCount = 0;
      const mockChild = createMockChildProcess();
      
      (spawn as ReturnType<typeof vi.fn>).mockReturnValue(mockChild);
      mockChild.stdout.on.mockImplementation((event: string, handler: (data: string) => void) => {
        if (event === 'data') {
          setTimeout(() => {
            callCount++;
            if (callCount === 1) {
              handler('42\n');
            } else {
              handler('1700000000\n');
            }
          }, 0);
        }
      });
      mockChild.on.mockImplementation((event: string, handler: (code: number) => void) => {
        if (event === 'close') {
          setTimeout(() => handler(0), 0);
        }
      });

      const result = await collectGitStats('/repo', 'HEAD');

      expect(result.totalCommits).toBe(42);
      expect(result.latestCommitTimestamp).toBe(1700000000000);
    });
  });
});

function createMockChildProcess() {
  return {
    stdout: {
      setEncoding: vi.fn(),
      on: vi.fn()
    },
    stderr: {
      setEncoding: vi.fn(),
      on: vi.fn()
    },
    on: vi.fn()
  };
}

