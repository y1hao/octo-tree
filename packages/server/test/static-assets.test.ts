import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { existsSync } from 'fs';
import { resolveStaticAssets } from '../src/static-assets';

vi.mock('fs', () => ({
  existsSync: vi.fn()
}));

vi.mock('path', async () => {
  const actual = await vi.importActual('path');
  return {
    ...actual,
    resolve: vi.fn((...args: string[]) => args.join('/')),
    join: vi.fn((...args: string[]) => args.join('/'))
  };
});

describe('static-assets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('resolveStaticAssets', () => {
    it('returns paths when assets exist', () => {
      (existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);

      const result = resolveStaticAssets();

      expect(result.root).toContain('web/dist');
      expect(result.indexPath).toContain('web/dist/index.html');
    });

    it('warns when dist directory does not exist', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      (existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);

      resolveStaticAssets();

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Front-end build not found')
      );

      consoleWarnSpy.mockRestore();
    });

    it('warns when index.html does not exist', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      (existsSync as ReturnType<typeof vi.fn>).mockImplementation((path: string) => {
        return !path.includes('index.html');
      });

      resolveStaticAssets();

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Front-end build not found')
      );

      consoleWarnSpy.mockRestore();
    });

    it('returns paths even when assets do not exist', () => {
      (existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = resolveStaticAssets();

      expect(result.root).toBeDefined();
      expect(result.indexPath).toBeDefined();
      expect(consoleWarnSpy).toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });
  });
});

