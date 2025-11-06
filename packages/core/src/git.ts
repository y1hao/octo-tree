import { spawn } from 'child_process';
import { GitRepositoryError } from './types';

export const runGitCommand = async (repoPath: string, args: string[]): Promise<string> => {
  return new Promise((resolve, reject) => {
    const child = spawn('git', args, { cwd: repoPath });
    let stdout = '';
    let stderr = '';

    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });

    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        const error = new GitRepositoryError(
          `Git command failed (git ${args.join(' ')}): ${stderr.trim()}`
        );
        reject(error);
      }
    });
  });
};

export const resolveRepoRoot = async (repoPath: string): Promise<string> => {
  try {
    const stdout = await runGitCommand(repoPath, ['rev-parse', '--show-toplevel']);
    return stdout.trim();
  } catch (error) {
    throw new GitRepositoryError(`Failed to locate git repository at ${repoPath}`);
  }
};

export const listGitManagedFiles = async (repoPath: string): Promise<string[]> => {
  return new Promise((resolve, reject) => {
    const child = spawn('git', ['ls-files', '--cached', '--exclude-standard'], {
      cwd: repoPath
    });

    const files: string[] = [];
    let buffer = '';
    let stderr = '';

    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.length > 0) {
          files.push(trimmed);
        }
      }
    });

    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
      if (buffer.length > 0) {
        const trimmed = buffer.trim();
        if (trimmed.length > 0) {
          files.push(trimmed);
        }
      }

      if (code === 0) {
        resolve(files);
      } else {
        reject(
          new GitRepositoryError(
            `Git command failed (git ls-files --cached --exclude-standard): ${stderr.trim()}`
          )
        );
      }
    });
  });
};

interface GitTreeEntry {
  path: string;
  size: number;
}

export interface ResolvedRef {
  treeHash: string;
  commitHash: string | null;
}

export const resolveGitRef = async (repoPath: string, ref: string): Promise<ResolvedRef> => {
  const resolvedRef = (await runGitCommand(repoPath, ['rev-parse', '--verify', ref])).trim();
  let objectType: string;
  try {
    objectType = (await runGitCommand(repoPath, ['cat-file', '-t', resolvedRef])).trim();
  } catch (error) {
    if (error instanceof GitRepositoryError) {
      throw new GitRepositoryError(`Failed to resolve git ref: ${ref}`);
    }
    throw error;
  }

  if (objectType === 'commit') {
    const treeHash = (
      await runGitCommand(repoPath, ['rev-parse', '--verify', `${resolvedRef}^{tree}`])
    ).trim();
    return { treeHash, commitHash: resolvedRef };
  }

  if (objectType === 'tag') {
    // Parallelize: get commit and tree hash simultaneously from tag
    const [commitHash, treeHash] = await Promise.all([
      runGitCommand(repoPath, ['rev-parse', '--verify', `${resolvedRef}^{commit}`]),
      runGitCommand(repoPath, ['rev-parse', '--verify', `${resolvedRef}^{tree}`])
    ]);
    return { treeHash: treeHash.trim(), commitHash: commitHash.trim() };
  }

  if (objectType === 'tree') {
    return { treeHash: resolvedRef, commitHash: null };
  }

  throw new GitRepositoryError(`Unsupported git object type for ref ${ref}: ${objectType}`);
};

export const listFilesAtTree = async (repoPath: string, treeHash: string): Promise<GitTreeEntry[]> => {
  const output = await runGitCommand(repoPath, [
    'ls-tree',
    '--full-tree',
    '--long',
    '-r',
    treeHash
  ]);

  const lines = output
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const entries: GitTreeEntry[] = [];

  for (const line of lines) {
    const [meta, filePath] = line.split('\t');
    if (!meta || !filePath) {
      continue;
    }
    const parts = meta.split(/\s+/);
    if (parts.length < 4) {
      continue;
    }
    const type = parts[1];
    if (type !== 'blob') {
      continue;
    }
    const sizeValue = parts[3];
    const size = sizeValue === '-' ? 0 : Number.parseInt(sizeValue, 10);
    entries.push({ path: filePath, size: Number.isNaN(size) ? 0 : size });
  }

  return entries;
};

export const getCommitTimestampMs = async (repoPath: string, commitHash: string): Promise<number | null> => {
  try {
    const output = await runGitCommand(repoPath, ['show', '-s', '--format=%ct', commitHash]);
    const numeric = Number.parseInt(output.trim(), 10);
    if (Number.isNaN(numeric)) {
      return null;
    }
    return numeric * 1000;
  } catch (error) {
    if (error instanceof GitRepositoryError) {
      throw error;
    }
    return null;
  }
};

