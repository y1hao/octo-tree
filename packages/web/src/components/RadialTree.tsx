import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  hierarchy,
  tree,
  type HierarchyPointNode,
  type HierarchyPointLink
} from 'd3-hierarchy';
import { linkRadial } from 'd3-shape';
import type { TreeNode } from '../types';

interface RadialTreeProps {
  data: TreeNode;
}

interface TooltipState {
  node: TreeNode;
  x: number;
  y: number;
}

const separation = (
  a: HierarchyPointNode<TreeNode>,
  b: HierarchyPointNode<TreeNode>
): number => {
  return a.parent === b.parent ? 1 : 2;
};

const formatBytes = (bytes: number): string => {
  if (bytes === 0) {
    return '0 B';
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const magnitude = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, magnitude);
  return `${value.toFixed(value >= 10 || magnitude === 0 ? 0 : 1)} ${units[magnitude]}`;
};

export const RadialTree: React.FC<RadialTreeProps> = ({ data }) => {
  const startColor = { r: 21, g: 94, b: 51 }; // #155e33
  const endColor = { r: 209, g: 250, b: 229 }; // #d1fae5

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const { root, radius, maxDepth, maxFileSizeMap, sizePercentile90 } = useMemo(() => {
    const hierarchyRoot = hierarchy<TreeNode>(data, (node) => node.children);
    hierarchyRoot.sum((node) => (node.type === 'file' ? 1 : 0));
    const layout = tree<TreeNode>()
      .size([2 * Math.PI, 1])
      .separation(separation);
    const positionedRoot = layout(hierarchyRoot);

    const computedMaxDepth = Math.max(1, positionedRoot.height);
    const baseRadius = 160;
    const depthSpacing = 110;
    const computedRadius = baseRadius + computedMaxDepth * depthSpacing;
    const maxRadius = 800;
    const radius = Math.min(computedRadius, maxRadius);

    positionedRoot.each((node) => {
      node.y = (node.depth / computedMaxDepth) * radius;
    });

    const maxFileSizeMap = new Map<string, number>();
    const fileSizes: number[] = [];

    const computeMaxFileSize = (node: HierarchyPointNode<TreeNode>): number => {
      let maxSize = node.data.type === 'file' ? node.data.size : 0;
      if (node.data.type === 'file') {
        fileSizes.push(node.data.size);
      }
      if (node.children) {
        for (const child of node.children) {
          maxSize = Math.max(maxSize, computeMaxFileSize(child));
        }
      }
      maxFileSizeMap.set(node.data.id, maxSize);
      return maxSize;
    };

    computeMaxFileSize(positionedRoot);

    let sizePercentile90 = 0;
    if (fileSizes.length > 0) {
      fileSizes.sort((a, b) => a - b);
      const index = Math.min(fileSizes.length - 1, Math.floor(fileSizes.length * 0.9));
      sizePercentile90 = fileSizes[index];
    }

    if (sizePercentile90 === 0 && fileSizes.length > 0) {
      sizePercentile90 = fileSizes[fileSizes.length - 1];
    }

    return {
      root: positionedRoot,
      radius,
      maxDepth: computedMaxDepth,
      maxFileSizeMap,
      sizePercentile90
    };
  }, [data]);

  const maxFiles = useMemo(() => {
    let max = 0;
    for (const node of root.descendants()) {
      const files = node.value ?? (node.data.type === 'file' ? 1 : 0);
      if (files > max) {
        max = files;
      }
    }
    return max;
  }, [root]);

  const linkPath = useMemo(() => {
    return linkRadial<HierarchyPointLink<TreeNode>, HierarchyPointNode<TreeNode>>()
      .angle((node) => node.x)
      .radius((node) => node.y);
  }, []);

  const depthLevels = useMemo(() => {
    return Array.from({ length: maxDepth + 1 }, (_, index) => (index / maxDepth) * radius);
  }, [maxDepth, radius]);

  const canvasPadding = 200;
  const canvasSize = radius * 2 + canvasPadding;
  const displayWidth = canvasSize;

  const linkRenderData = useMemo(() => {
    return root
      .links()
      .map((link) => {
        const fileCount = link.target.value ?? (link.target.data.type === 'file' ? 1 : 0);
        const normalizedCount = maxFiles > 0 ? fileCount / maxFiles : 0;
        const baseWidth = 0.6;
        const widthRange = 6.4;
        const strokeWidth = baseWidth + normalizedCount * widthRange;

        const maxFileSize = maxFileSizeMap.get(link.target.data.id) ?? 0;
        const denominator = sizePercentile90 > 0 ? sizePercentile90 : 1;
        const normalizedSize = Math.min(maxFileSize / denominator, 1);
        const interpolateChannel = (start: number, end: number) =>
          Math.round(start + (end - start) * normalizedSize);
        const strokeColor = `rgb(${interpolateChannel(startColor.r, endColor.r)}, ${interpolateChannel(
          startColor.g,
          endColor.g
        )}, ${interpolateChannel(startColor.b, endColor.b)})`;

        return {
          link,
          strokeWidth,
          strokeColor,
          normalizedSize
        };
      })
      .sort((a, b) => a.normalizedSize - b.normalizedSize);
  }, [root, maxFiles, maxFileSizeMap, sizePercentile90, startColor, endColor]);

  const handleLinkHover = useCallback(
    (event: React.MouseEvent<SVGPathElement>, node: HierarchyPointNode<TreeNode>) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) {
        setTooltip({ node: node.data, x: event.clientX, y: event.clientY });
        return;
      }
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      setTooltip({ node: node.data, x, y });
    },
    []
  );

  const resetTooltip = useCallback(() => {
    setTooltip(null);
  }, []);

  return (
    <div className="radial-tree" ref={containerRef}>
      <svg
        width={canvasSize}
        height={canvasSize}
        viewBox={`0 0 ${canvasSize} ${canvasSize}`}
        role="img"
        aria-label="Radial file tree"
        style={{ width: `${displayWidth}px`, maxWidth: '100%', height: 'auto' }}
      >
        <g transform={`translate(${canvasSize / 2}, ${canvasSize / 2})`}>
          <g className="radial-tree__levels" fill="none">
            {depthLevels.map((levelRadius, index) => (
              <circle
                key={index}
                r={levelRadius}
                strokeDasharray="4 8"
              />
            ))}
          </g>
          <g className="radial-tree__links" fill="none">
            {linkRenderData.map(({ link, strokeWidth, strokeColor }) => (
              <path
                key={link.target.data.id}
                d={linkPath(link) ?? undefined}
                className="radial-tree__link"
                strokeWidth={strokeWidth}
                stroke={strokeColor}
                onMouseEnter={(event) => handleLinkHover(event, link.target)}
                onMouseMove={(event) => handleLinkHover(event, link.target)}
                onMouseLeave={resetTooltip}
              />
            ))}
          </g>
        </g>
      </svg>
      {tooltip && (
        <div
          className="radial-tree__tooltip"
          style={{ top: tooltip.y, left: tooltip.x }}
          role="status"
        >
          <h3 className="tooltip__title">{tooltip.node.name}</h3>
          <dl className="tooltip__list">
            <div className="tooltip__item">
              <dt>Path</dt>
              <dd>{tooltip.node.relativePath}</dd>
            </div>
            <div className="tooltip__item">
              <dt>Type</dt>
              <dd>{tooltip.node.type}</dd>
            </div>
            {tooltip.node.type === 'directory' ? (
              <div className="tooltip__item">
                <dt>Entries</dt>
                <dd>{tooltip.node.children?.length ?? 0}</dd>
              </div>
            ) : (
              <div className="tooltip__item">
                <dt>Size</dt>
                <dd>{formatBytes(tooltip.node.size)}</dd>
              </div>
            )}
          </dl>
        </div>
      )}
      <footer className="radial-tree__legend">
        <span className="legend-item">
          <span className="legend-line legend-line--branch" /> Branch
        </span>
        <span className="legend-item">
          <span className="legend-line legend-line--branch-active" /> High density
        </span>
        <span className="legend-item">{formatBytes(data.size)} total</span>
      </footer>
    </div>
  );
};

RadialTree.displayName = 'RadialTree';
