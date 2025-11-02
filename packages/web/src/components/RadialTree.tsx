import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef
} from 'react';
import {
  hierarchy,
  tree,
  type HierarchyPointNode,
  type HierarchyPointLink
} from 'd3-hierarchy';
import { linkRadial } from 'd3-shape';
import { select } from 'd3-selection';
import { zoom, zoomIdentity, type ZoomBehavior } from 'd3-zoom';
import type { TreeNode } from '../types';

export interface RadialTreeHandle {
  resetZoom: () => void;
}

interface RadialTreeProps {
  data: TreeNode;
  activeNodeId?: string;
  width?: number;
  height?: number;
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

export const RadialTree = forwardRef<RadialTreeHandle, RadialTreeProps>(
  ({ data, activeNodeId, width = 960, height = 960, onHover }, ref) => {
    const svgRef = useRef<SVGSVGElement | null>(null);
    const gRef = useRef<SVGGElement | null>(null);
    const zoomBehaviorRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);

    const radius = Math.max(Math.min(width, height) / 2 - 80, 120);

    const root = useMemo(() => {
      const hierarchyRoot = hierarchy<TreeNode>(data, (node) => node.children);
      const layout = tree<TreeNode>()
        .size([2 * Math.PI, radius])
        .separation(separation);
      const positionedRoot = layout(hierarchyRoot);

      const maxDepth = Math.max(1, positionedRoot.height);
      positionedRoot.each((node) => {
        node.y = (node.depth / maxDepth) * radius;
      });
      return positionedRoot;
    }, [data, radius]);

    const nodes = useMemo(() => root.descendants(), [root]);
    const links = useMemo(() => root.links(), [root]);

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

    useEffect(() => {
      if (!svgRef.current || !gRef.current) {
        return undefined;
      }
      const svgSelection = select(svgRef.current);
      const gSelection = select(gRef.current);

      const zoomBehavior = zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.4, 5])
        .on('zoom', (event) => {
          gSelection.attr('transform', event.transform.toString());
        });

      zoomBehaviorRef.current = zoomBehavior;
      svgSelection.call(zoomBehavior);

      const initialTransform = zoomIdentity.translate(width / 2, height / 2);
      svgSelection.call(zoomBehavior.transform, initialTransform);

      return () => {
        svgSelection.on('.zoom', null);
      };
    }, [width, height, root]);

    useImperativeHandle(ref, () => ({
      resetZoom: () => {
        if (!svgRef.current || !zoomBehaviorRef.current) {
          return;
        }
        const svgSelection = select(svgRef.current);
        const initialTransform = zoomIdentity.translate(width / 2, height / 2);
        svgSelection.call(zoomBehaviorRef.current.transform, initialTransform);
      }
    }));

    const depthLevels = useMemo(() => {
      const maxDepth = Math.max(1, root.height);
      return Array.from({ length: maxDepth + 1 }, (_, index) => (index / maxDepth) * radius);
    }, [root.height, radius]);

    return (
      <div className="radial-tree">
        <svg
          ref={svgRef}
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label="Radial file tree"
        >
          <g ref={gRef} transform={`translate(${width / 2}, ${height / 2})`}>
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
                return (
                  <path
                    key={link.target.data.id}
                    d={linkPath(link) ?? undefined}
                    className={isActive ? 'radial-tree__link radial-tree__link--active' : 'radial-tree__link'}
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
                    <circle
                      r={radiusValue}
                      data-type={node.data.type}
                    />
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
  }
);

RadialTree.displayName = 'RadialTree';
