import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import { RadialTree, type RadialTreeHandle } from './components/RadialTree';
import type { TreeNode, TreeResponse } from './types';

const formatTimestamp = (timestamp: number | null): string => {
  if (!timestamp) {
    return 'Never';
  }
  const date = new Date(timestamp);
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
};

const formatModifiedTime = (timestamp: number): string => {
  if (!timestamp) {
    return '—';
  }
  return new Date(timestamp).toLocaleString();
};

const formatBytes = (bytes: number): string => {
  if (!bytes) {
    return '0 B';
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const magnitude = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, magnitude);
  return `${value.toFixed(value >= 10 || magnitude === 0 ? 0 : 1)} ${units[magnitude]}`;
};

const formatNodeSummary = (node: TreeNode | null): string => {
  if (!node) {
    return 'Hover a node to inspect details.';
  }
  const typeLabel = node.type === 'directory' ? 'Directory' : 'File';
  const childCount = node.children?.length ?? 0;
  if (node.type === 'directory') {
    return `${typeLabel} · ${childCount} item(s)`;
  }
  return `${typeLabel} · ${formatBytes(node.size)}`;
};

const fetchTree = async (endpoint: string, init?: RequestInit): Promise<TreeResponse> => {
  const response = await fetch(endpoint, {
    headers: { 'Content-Type': 'application/json' },
    ...init
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Failed to load tree');
  }
  return (await response.json()) as TreeResponse;
};

export const App: React.FC = () => {
  const [tree, setTree] = useState<TreeNode | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [hoveredNode, setHoveredNode] = useState<TreeNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const radialTreeRef = useRef<RadialTreeHandle>(null);

  const loadTree = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { tree: fetchedTree, lastUpdated: updated } = await fetchTree('/api/tree');
      setTree(fetchedTree);
      setLastUpdated(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error fetching tree.');
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshTreeData = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const { tree: refreshedTree, lastUpdated: updated } = await fetchTree('/api/tree/refresh', {
        method: 'POST'
      });
      setTree(refreshedTree);
      setLastUpdated(updated);
      radialTreeRef.current?.resetZoom();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error refreshing tree.');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadTree().catch((err) => {
      console.error(err);
    });
  }, [loadTree]);

  const aggregateStats = useMemo(() => {
    if (!tree) {
      return null;
    }
    let files = 0;
    let directories = 0;
    let nodes = 0;
    let maxDepth = 0;

    const walk = (node: TreeNode) => {
      nodes += 1;
      if (node.type === 'directory') {
        directories += 1;
      } else {
        files += 1;
      }
      maxDepth = Math.max(maxDepth, node.depth);
      node.children?.forEach(walk);
    };

    walk(tree);
    return { files, directories, nodes, maxDepth };
  }, [tree]);

  const handleResetView = () => {
    radialTreeRef.current?.resetZoom();
  };

  return (
    <div className="app">
      <header className="app__header">
        <div>
          <h1 className="app__title">Octo Tree</h1>
          <div className="app__status">
            <span className="status__item">
              <span className="status__badge" />
              {tree ? 'API online' : 'Waiting for data'}
            </span>
            <span className="status__item">Last updated: {formatTimestamp(lastUpdated)}</span>
          </div>
        </div>
        <div className="app__controls">
          <button
            type="button"
            className="button"
            onClick={refreshTreeData}
            disabled={loading || refreshing}
          >
            {refreshing ? 'Refreshing…' : 'Refresh Tree'}
          </button>
          <button
            type="button"
            className="button"
            onClick={handleResetView}
            disabled={!tree}
          >
            Reset View
          </button>
        </div>
      </header>

      <main className="app__content">
        <section className="app__visualization">
          {loading && <p>Loading repository tree…</p>}
          {error && !loading && <p role="alert">{error}</p>}
          {!loading && !error && tree && (
            <RadialTree ref={radialTreeRef} data={tree} onHover={setHoveredNode} />
          )}
        </section>

        <aside className="app__sidebar" aria-live="polite">
          <div className="sidebar__section">
            <h2 className="sidebar__title">Repository</h2>
            <p className="sidebar__body">{tree?.name ?? '—'}</p>
          </div>
          <div className="sidebar__section">
            <h2 className="sidebar__title">Node Details</h2>
            <p className="sidebar__body">{hoveredNode?.relativePath ?? 'Hover a node to inspect details.'}</p>
            {hoveredNode && (
              <>
                <p className="sidebar__body">{formatNodeSummary(hoveredNode)}</p>
                <p className="sidebar__body">
                  Modified: {formatModifiedTime(hoveredNode.mtimeMs)}
                </p>
              </>
            )}
          </div>
          <div className="sidebar__section">
            <h2 className="sidebar__title">Statistics</h2>
            <p className="sidebar__body">
              Max depth: {aggregateStats ? aggregateStats.maxDepth : '—'}
            </p>
            <p className="sidebar__body">
              Nodes: {aggregateStats ? aggregateStats.nodes : '—'} total
            </p>
            <p className="sidebar__body">
              Directories: {aggregateStats ? aggregateStats.directories : '—'} · Files:{' '}
              {aggregateStats ? aggregateStats.files : '—'}
            </p>
          </div>
        </aside>
      </main>
    </div>
  );
};
