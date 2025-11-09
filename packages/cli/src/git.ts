import { spawn } from 'child_process';
import { GitRepositoryError } from '@octotree/core';

export const runGit = async (repoPath: string, args: string[]): Promise<string> => {
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
        resolve(stdout.trim());
      } else {
        reject(new GitRepositoryError(stderr.trim() || `git ${args.join(' ')} exited with code ${code}`));
      }
    });
  });
};

export const listCommitsForBranch = async (repoPath: string): Promise<string[]> => {
  const output = await runGit(repoPath, ['rev-list', '--reverse', 'HEAD']);
  return output
    .split('\n')
    .map((commit) => commit.trim())
    .filter((commit) => commit.length > 0);
};

export const sampleCommits = (commits: string[], maxFrames: number): string[] => {
  if (commits.length <= maxFrames) {
    return commits;
  }

  const frameCount = Math.max(1, maxFrames);
  const lastIndex = commits.length - 1;
  const indices = new Set<number>();

  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    const index = Math.floor((frameIndex * lastIndex) / Math.max(frameCount - 1, 1));
    indices.add(Math.min(index, lastIndex));
  }
  indices.add(lastIndex);

  return Array.from(indices)
    .sort((a, b) => a - b)
    .map((index) => commits[index]);
};

