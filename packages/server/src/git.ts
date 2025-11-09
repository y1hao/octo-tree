import { spawn } from 'child_process';
import type { GitStats } from './types';

export const runGitCommand = (repoPath: string, args: string[]): Promise<string> => {
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
        reject(new Error(stderr.trim() || `git ${args.join(' ')} exited with code ${code}`));
      }
    });
  });
};

export const collectGitStats = async (repoPath: string, ref: string): Promise<GitStats> => {
  try {
    const [countOutput, timeOutput] = await Promise.all([
      runGitCommand(repoPath, ['rev-list', '--count', ref]).catch(() => ''),
      runGitCommand(repoPath, ['show', '-s', '--format=%ct', ref]).catch(() => '')
    ]);

    const totalCommits = countOutput ? Number.parseInt(countOutput, 10) : null;
    const latestCommitTimestamp = timeOutput ? Number.parseInt(timeOutput, 10) * 1000 : null;

    return {
      totalCommits: totalCommits != null && Number.isFinite(totalCommits) ? totalCommits : null,
      latestCommitTimestamp:
        latestCommitTimestamp != null && Number.isFinite(latestCommitTimestamp)
          ? latestCommitTimestamp
          : null
    };
  } catch (error) {
    console.warn('Failed to collect git statistics:', error);
    return { totalCommits: null, latestCommitTimestamp: null };
  }
};

