import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './App.css';
import { RadialTree } from './components/RadialTree';
import type { TreeNode, TreeResponse, GitStats } from './types';

const formatTimestamp = (timestamp: number | null): string => {
  if (!timestamp) {
    return 'Never';
  }
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatCount = (value: number | null | undefined, label: string): string => {
  if (value == null) {
    return '—';
  }
  return `${value.toLocaleString()} ${label}`;
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

const appendRefQuery = (endpoint: string): string => {
  if (typeof window === 'undefined') {
    return endpoint;
  }
  try {
    const url = new URL(window.location.href);
    const ref = url.searchParams.get('ref');
    if (!ref) {
      return endpoint;
    }
    const separator = endpoint.includes('?') ? '&' : '?';
    return `${endpoint}${separator}ref=${encodeURIComponent(ref)}`;
  } catch (error) {
    console.warn('Failed to append ref query parameter:', error);
    return endpoint;
  }
};

const fetchTree = async (endpoint: string, init?: RequestInit): Promise<TreeResponse> => {
  const url = appendRefQuery(endpoint);
  const response = await fetch(url, {
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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gitStats, setGitStats] = useState<GitStats | null>(null);

  const loadTree = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { tree: fetchedTree, lastUpdated: updated, gitStats: stats } = await fetchTree('/api/tree');
      setTree(fetchedTree);
      setLastUpdated(updated);
      setGitStats(stats ?? null);
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
      const {
        tree: refreshedTree,
        lastUpdated: updated,
        gitStats: stats
      } = await fetchTree('/api/tree/refresh', {
        method: 'POST'
      });
      setTree(refreshedTree);
      setLastUpdated(updated);
      setGitStats(stats ?? null);
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

  return (
    <div className="app">
      <main className="app__content">
        <aside className="app__sidebar" aria-live="polite">
          <div className="sidebar__section sidebar__section--stacked">
            <span className="sidebar__heading">{tree?.name ?? '—'}</span>
            <span className="sidebar__line">
              {formatTimestamp(gitStats?.latestCommitTimestamp ?? null)}
            </span>
            <span className="sidebar__line">
              {formatCount(gitStats?.totalCommits ?? null, 'commits')}
            </span>
            <span className="sidebar__line">
              {formatCount(aggregateStats?.files ?? null, 'files')}
            </span>
            <span className="sidebar__line">
              {formatCount(aggregateStats?.directories ?? null, 'directories')}
            </span>
          </div>
        </aside>

        <section className="app__visualization">
          {loading && <p>Loading repository tree…</p>}
          {error && !loading && <p role="alert">{error}</p>}
          {!loading && !error && tree && <RadialTree data={tree} />}
        </section>
      </main>
    </div>
  );
};
