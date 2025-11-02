import React, { useMemo } from 'react';
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
  activeNodeId?: string;
  onHover?: (node: TreeNode | null) => void;
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

export const RadialTree: React.FC<RadialTreeProps> = ({ data, activeNodeId, onHover }) => {
  const { root, radius, maxDepth } = useMemo(() => {
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

    return {
      root: positionedRoot,
      radius,
      maxDepth: computedMaxDepth
    };
  }, [data]);

  const nodes = useMemo(() => root.descendants(), [root]);
  const links = useMemo(() => root.links(), [root]);

  const maxFiles = useMemo(() => {
    let max = 0;
    for (const node of nodes) {
      const files = node.value ?? (node.data.type === 'file' ? 1 : 0);
      if (files > max) {
        max = files;
      }
    }
    return max;
  }, [nodes]);

  const activeNode = useMemo(() => {
    if (!activeNodeId) {
      return null;
    }
    return nodes.find((node) => node.data.id === activeNodeId) ?? null;
  }, [activeNodeId, nodes]);

  const activeBranchIds = useMemo(() => {
    if (!activeNode) {
      return new Set<string>();
    }
    return new Set(activeNode.ancestors().map((ancestor) => ancestor.data.id));
  }, [activeNode]);

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

  return (
    <div className="radial-tree">
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
                stroke="rgba(148, 163, 184, 0.25)"
                strokeDasharray="4 8"
              />
            ))}
          </g>
          <g className="radial-tree__links" fill="none">
            {links.map((link) => {
              const isActive = activeBranchIds.has(link.target.data.id);
              const fileCount = link.target.value ?? (link.target.data.type === 'file' ? 1 : 0);
              const normalized = maxFiles > 0 ? fileCount / maxFiles : 0;
              const baseWidth = 0.6;
              const widthRange = 6.4;
              let strokeWidth = baseWidth + normalized * widthRange;
              if (isActive) {
                strokeWidth += 0.6;
              }
              return (
                <path
                  key={link.target.data.id}
                  d={linkPath(link) ?? undefined}
                  className={isActive ? 'radial-tree__link radial-tree__link--active' : 'radial-tree__link'}
                  strokeWidth={strokeWidth}
                />
              );
            })}
          </g>
          <g className="radial-tree__nodes">
            {nodes.map((node) => {
              const isActive = activeBranchIds.has(node.data.id);
              const isHovered = activeNode?.data.id === node.data.id;
              const radiusValue = 10;

              return (
                <g
                  key={node.data.id}
                  transform={`rotate(${(node.x * 180) / Math.PI - 90}) translate(${node.y},0)`}
                  className={`radial-tree__node${isActive ? ' radial-tree__node--active' : ''}${
                    isHovered ? ' radial-tree__node--hovered' : ''
                  }`}
                  onMouseEnter={() => onHover?.(node.data)}
                  onMouseLeave={() => onHover?.(null)}
                >
                  <circle r={radiusValue} data-type={node.data.type} />
                </g>
              );
            })}
          </g>
        </g>
      </svg>
      <footer className="radial-tree__legend">
        <span className="legend-item">
          <span className="legend-line legend-line--branch" /> Branch
        </span>
        <span className="legend-item">
          <span className="legend-line legend-line--branch-active" /> Active branch
        </span>
        <span className="legend-item">{formatBytes(data.size)} total</span>
      </footer>
    </div>
  );
};

RadialTree.displayName = 'RadialTree';
