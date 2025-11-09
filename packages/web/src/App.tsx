import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './App.css';
import { RadialTree } from './components/RadialTree';
import type { TreeNode, RepositoryTree, GitStats } from '@octotree/core';

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

const fetchTree = async (endpoint: string, init?: RequestInit): Promise<RepositoryTree> => {
  const url = appendRefQuery(endpoint);
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...init
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Failed to load tree');
  }
  return (await response.json()) as RepositoryTree;
};

export const App: React.FC = () => {
  const [tree, setTree] = useState<TreeNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gitStats, setGitStats] = useState<GitStats | null>(null);

  const levelOverride = useMemo(() => {
    if (typeof window === 'undefined') {
      return null;
    }
    try {
      const params = new URLSearchParams(window.location.search);
      const rawLevel = params.get('level');
      if (!rawLevel) {
        return null;
      }
      const parsed = Number(rawLevel);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        return null;
      }
      return parsed;
    } catch (error) {
      console.warn('Failed to parse level query parameter:', error);
      return null;
    }
  }, []);

  const loadTree = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { tree: fetchedTree, gitStats: stats } = await fetchTree('/api/tree');
      setTree(fetchedTree);
      setGitStats(stats ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error fetching tree.');
    } finally {
      setLoading(false);
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
          {!loading && !error && tree && <RadialTree data={tree} level={levelOverride} />}
        </section>
      </main>
    </div>
  );
};
