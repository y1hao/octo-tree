import type { RequestHandler } from 'express';

export const createLevelRedirectMiddleware = (level: number): RequestHandler => {
  return (req, res, next) => {
    if (req.method !== 'GET' || req.path !== '/' || req.query.level != null) {
      next();
      return;
    }

    try {
      const url = new URL(req.originalUrl ?? '/', 'http://localhost');
      url.searchParams.set('level', level.toString());
      res.redirect(url.pathname + url.search);
    } catch (error) {
      console.warn('Failed to apply level redirect:', error);
      res.redirect(`/?level=${level}`);
    }
  };
};

