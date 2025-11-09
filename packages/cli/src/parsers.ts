import { DEFAULT_WIDTH, DEFAULT_ASPECT_X, DEFAULT_ASPECT_Y } from './constants';

export const parseWidth = (rawWidth: string | undefined): number | null => {
  if (!rawWidth) {
    return DEFAULT_WIDTH;
  }
  const width = Number(rawWidth);
  if (Number.isNaN(width) || width <= 0) {
    return null;
  }
  return Math.round(width);
};

export const parseAspect = (rawAspect: string | undefined): { x: number; y: number } | null => {
  if (!rawAspect) {
    return { x: DEFAULT_ASPECT_X, y: DEFAULT_ASPECT_Y };
  }
  const parts = rawAspect.split(':');
  if (parts.length !== 2) {
    return null;
  }
  const [xPart, yPart] = parts;
  const x = Number(xPart);
  const y = Number(yPart);
  if (Number.isNaN(x) || Number.isNaN(y) || x <= 0 || y <= 0) {
    return null;
  }
  return { x: Math.round(x), y: Math.round(y) };
};

export const parseCommitBound = (
  rawValue: string | undefined,
  flag: '--from' | '--to'
): { value?: number; error?: string } => {
  if (rawValue == null) {
    return { value: undefined };
  }
  const parsed = Number(rawValue);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return { error: `${flag} must be a positive integer` };
  }
  return { value: parsed };
};

export const parseLevel = (rawValue: string | undefined): { value?: number; error?: string } => {
  if (rawValue == null) {
    return {};
  }

  const parsed = Number(rawValue);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return { error: '--level must be a positive integer' };
  }

  return { value: parsed };
};

