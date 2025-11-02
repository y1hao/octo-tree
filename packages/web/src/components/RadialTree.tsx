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
  ({ data, width = 960, height = 960, onHover }, ref) => {
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
            <g className="radial-tree__links" fill="none" stroke="#CBD5F5" strokeOpacity={0.7}>
              {links.map((link) => (
                <path key={link.target.data.id} d={linkPath(link) ?? undefined} strokeWidth={1.2} />
              ))}
            </g>
            <g className="radial-tree__nodes" fontFamily="var(--font-sans, sans-serif)" fontSize={11}>
              {nodes.map((node) => {
                const isDirectory = node.data.type === 'directory';
                const labelAnchor = node.x < Math.PI ? 'start' : 'end';
                const labelRotation = node.x >= Math.PI ? 'rotate(180)' : undefined;
                const labelOffset = node.x < Math.PI ? 10 : -10;

                return (
                  <g
                    key={node.data.id}
                    transform={`rotate(${(node.x * 180) / Math.PI - 90}) translate(${node.y},0)`}
                    className="radial-tree__node"
                    onMouseEnter={() => onHover?.(node.data)}
                    onMouseLeave={() => onHover?.(null)}
                  >
                    <circle
                      r={isDirectory ? 5 : 3.5}
                      fill={isDirectory ? '#2563eb' : '#38bdf8'}
                      stroke="#0f172a"
                      strokeWidth={0.5}
                    />
                    <text
                      dy="0.31em"
                      x={labelOffset}
                      textAnchor={labelAnchor}
                      transform={labelRotation}
                      fill="#0f172a"
                    >
                      {node.data.name}
                    </text>
                  </g>
                );
              })}
            </g>
          </g>
        </svg>
        <footer className="radial-tree__legend">
          <span className="legend-item">
            <span className="legend-swatch legend-swatch--dir" /> Directory
          </span>
          <span className="legend-item">
            <span className="legend-swatch legend-swatch--file" /> File
          </span>
          <span className="legend-item">{formatBytes(data.size)} total</span>
        </footer>
      </div>
    );
  }
);

RadialTree.displayName = 'RadialTree';
