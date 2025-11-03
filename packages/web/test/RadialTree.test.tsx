import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RadialTree, formatBytes } from '../src/components/RadialTree';
import type { TreeNode } from '../src/types';

const buildTree = (): TreeNode => ({
  id: 'directory:.',
  name: 'repo',
  relativePath: '.',
  type: 'directory',
  size: 26,
  mtimeMs: 0,
  depth: 0,
  children: [
    {
      id: 'directory:src',
      name: 'src',
      relativePath: 'src',
      type: 'directory',
      size: 12,
      mtimeMs: 0,
      depth: 1,
      children: [
        {
          id: 'file:src/index.ts',
          name: 'index.ts',
          relativePath: 'src/index.ts',
          type: 'file',
          size: 12,
          mtimeMs: 0,
          depth: 2,
          children: []
        }
      ]
    },
    {
      id: 'file:README.md',
      name: 'README.md',
      relativePath: 'README.md',
      type: 'file',
      size: 14,
      mtimeMs: 0,
      depth: 1,
      children: []
    }
  ]
});

describe('RadialTree', () => {
  it('renders the radial tree structure with expected links', () => {
    const { container } = render(<RadialTree data={buildTree()} />);

    const svg = screen.getByRole('img', { name: /radial file tree/i });
    expect(svg).toBeInTheDocument();

    const links = container.querySelectorAll('.radial-tree__link');
    expect(links).toHaveLength(3);
  });

  it('limits rendered depth when a level override is provided', () => {
    const { container } = render(<RadialTree data={buildTree()} level={1} />);

    const links = container.querySelectorAll('.radial-tree__link');
    expect(links).toHaveLength(2);

    const levels = container.querySelectorAll('.radial-tree__levels circle');
    expect(levels).toHaveLength(2);
  });

  it('displays tooltip information for files and directories', () => {
    const { container } = render(<RadialTree data={buildTree()} />);

    const fileLink = container.querySelector('[data-node-id="file:README.md"]');
    expect(fileLink).toBeTruthy();
    fireEvent.mouseEnter(fileLink as Element, { clientX: 42, clientY: 24 });

    const tooltip = screen.getByRole('status');
    expect(tooltip).toHaveTextContent('README.md');
    expect(tooltip).toHaveTextContent('Size');
    expect(tooltip).toHaveTextContent('14 B');

    const directoryLink = container.querySelector('[data-node-id="directory:src"]');
    expect(directoryLink).toBeTruthy();
    fireEvent.mouseEnter(directoryLink as Element, { clientX: 10, clientY: 10 });

    expect(tooltip).toHaveTextContent('src');
    expect(tooltip).toHaveTextContent('Entries');
    expect(tooltip).toHaveTextContent('1');
  });
});

describe('formatBytes', () => {
  it('formats byte counts with sensible units', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1)).toBe('1 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
  });
});
