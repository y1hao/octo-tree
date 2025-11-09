import type { Request, Response } from 'express';
import { GitRepositoryError } from '@octotree/core';
import type { CacheEntry } from './types';

export const extractRefParam = (req: Request): string | undefined => {
  const { ref } = req.query;
  if (typeof ref === 'string' && ref.trim().length > 0) {
    return ref.trim();
  }
  return undefined;
};

export const handleTreeRequest = async (
  req: Request,
  res: Response,
  handler: (ref?: string) => Promise<CacheEntry>,
  errorMessage: string
): Promise<void> => {
  const requestedRef = extractRefParam(req);
  try {
    const { tree, lastUpdated, gitStats } = await handler(requestedRef);
    res.json({ tree, lastUpdated, gitStats });
  } catch (error) {
    if (error instanceof GitRepositoryError) {
      res.status(400).json({ error: error.message });
      return;
    }
    console.error(error);
    res.status(500).json({ error: errorMessage });
  }
};

export const createTreeRoutes = (
  buildTreeForRef: (ref?: string) => Promise<CacheEntry>,
  refreshTreeForRef: (ref?: string) => Promise<CacheEntry>
) => {
  return {
    getTree: async (req: Request, res: Response) => {
      await handleTreeRequest(req, res, buildTreeForRef, 'Failed to build repository tree');
    },
    refreshTree: async (req: Request, res: Response) => {
      await handleTreeRequest(req, res, refreshTreeForRef, 'Failed to refresh repository tree');
    }
  };
};

