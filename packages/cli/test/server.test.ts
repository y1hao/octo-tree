import http from 'http';
import { describe, expect, it, vi } from 'vitest';
import { buildClientUrl, closeServer, getServerPort } from '../src/server';

describe('buildClientUrl', () => {
  it('appends ref and level parameters to the base URL', () => {
    const url = buildClientUrl('http://localhost:3000', { ref: 'abc', level: 5 });
    expect(url).toBe('http://localhost:3000/?ref=abc&level=5');
  });

  it('appends only ref when level is not provided', () => {
    const url = buildClientUrl('http://localhost:3000', { ref: 'abc' });
    expect(url).toBe('http://localhost:3000/?ref=abc');
  });

  it('appends only level when ref is not provided', () => {
    const url = buildClientUrl('http://localhost:3000', { level: 5 });
    expect(url).toBe('http://localhost:3000/?level=5');
  });

  it('omits parameters when not provided', () => {
    expect(buildClientUrl('http://localhost:3000', {})).toBe('http://localhost:3000/');
  });

  it('preserves existing query parameters', () => {
    const url = buildClientUrl('http://localhost:3000?existing=param', { ref: 'abc' });
    expect(url).toBe('http://localhost:3000/?existing=param&ref=abc');
  });

  it('handles URLs with paths', () => {
    const url = buildClientUrl('http://localhost:3000/path', { ref: 'abc' });
    expect(url).toBe('http://localhost:3000/path?ref=abc');
  });
});

describe('server helpers', () => {
  describe('closeServer', () => {
    it('resolves immediately when server is null', async () => {
      await expect(closeServer(null)).resolves.toBeUndefined();
    });

    it('closes server successfully', async () => {
      const close = vi.fn((callback?: (error?: Error | null) => void) => {
        callback?.(null);
        return {} as http.Server;
      });
      const server = { close } as unknown as http.Server;

      await expect(closeServer(server)).resolves.toBeUndefined();
      expect(close).toHaveBeenCalledTimes(1);
    });

    it('propagates close errors', async () => {
      const close = vi.fn((callback?: (error?: Error | null) => void) => {
        callback?.(new Error('boom'));
        return {} as http.Server;
      });
      const server = { close } as unknown as http.Server;

      await expect(closeServer(server)).rejects.toThrow('boom');
    });
  });

  describe('getServerPort', () => {
    it('extracts dynamic ports from address objects', () => {
      const server = {
        address: () => ({ port: 4321 })
      } as unknown as http.Server;
      expect(getServerPort(server)).toBe(4321);
    });

    it('handles port 0', () => {
      const server = {
        address: () => ({ port: 0 })
      } as unknown as http.Server;
      expect(getServerPort(server)).toBe(0);
    });

    it('throws when address returns null', () => {
      const server = {
        address: () => null
      } as unknown as http.Server;
      expect(() => getServerPort(server)).toThrow('Failed to determine server port');
    });

    it('throws when address returns a string', () => {
      const server = {
        address: () => '127.0.0.1:3000'
      } as unknown as http.Server;
      expect(() => getServerPort(server)).toThrow('Failed to determine server port');
    });

    it('throws when address object does not have port property', () => {
      const server = {
        address: () => ({ host: 'localhost' })
      } as unknown as http.Server;
      expect(() => getServerPort(server)).toThrow('Failed to determine server port');
    });
  });
});

