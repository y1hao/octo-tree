export interface ServeOptions {
  repo?: string;
  port?: string;
  ref?: string;
  level?: string;
}

export interface ScreenshotOptions {
  repo?: string;
  port?: string;
  output?: string;
  width?: string;
  aspect?: string;
  ref?: string;
  level?: string;
}

export interface VideoOptions {
  repo?: string;
  port?: string;
  output?: string;
  width?: string;
  aspect?: string;
  fps?: string;
  maxSeconds?: string;
  from?: string;
  to?: string;
  level?: string;
}

export interface ClientUrlOptions {
  ref?: string;
  level?: number;
}

export interface CaptureOptions {
  repoPath: string;
  ref?: string;
  width: number;
  height: number;
  requestedPort: number;
  outputPath: string;
  silent?: boolean;
  level?: number;
}

