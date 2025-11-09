import { describe, expect, it } from 'vitest';
import { ensureMp4Path, ensurePngPath } from '../src/utils';

describe('path helpers', () => {
  describe('ensurePngPath', () => {
    it('appends .png when missing', () => {
      expect(ensurePngPath('output')).toBe('output.png');
    });

    it('preserves existing .png extension (case insensitive)', () => {
      expect(ensurePngPath('snapshot.PNG')).toBe('snapshot.PNG');
      expect(ensurePngPath('image.png')).toBe('image.png');
      expect(ensurePngPath('photo.Png')).toBe('photo.Png');
    });

    it('handles paths with directories', () => {
      expect(ensurePngPath('dir/subdir/file')).toBe('dir/subdir/file.png');
      expect(ensurePngPath('dir/subdir/file.png')).toBe('dir/subdir/file.png');
    });
  });

  describe('ensureMp4Path', () => {
    it('appends .mp4 when missing', () => {
      expect(ensureMp4Path('video')).toBe('video.mp4');
    });

    it('preserves existing .mp4 extension (case insensitive)', () => {
      expect(ensureMp4Path('demo.MP4')).toBe('demo.MP4');
      expect(ensureMp4Path('movie.mp4')).toBe('movie.mp4');
      expect(ensureMp4Path('clip.Mp4')).toBe('clip.Mp4');
    });

    it('handles paths with directories', () => {
      expect(ensureMp4Path('videos/output')).toBe('videos/output.mp4');
      expect(ensureMp4Path('videos/output.mp4')).toBe('videos/output.mp4');
    });
  });
});
