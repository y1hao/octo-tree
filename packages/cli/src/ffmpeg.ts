import { spawn } from 'child_process';
import ffmpegStatic from 'ffmpeg-static';

export const getFfmpegExecutable = (): string => {
  if (typeof ffmpegStatic === 'string' && ffmpegStatic.length > 0) {
    return ffmpegStatic;
  }
  return 'ffmpeg';
};

export const runProcess = async (
  command: string,
  args: string[],
  options: { cwd?: string }
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: options.cwd, stdio: 'inherit' });
    child.on('error', (error) => {
      reject(error);
    });
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} exited with code ${code}`));
      }
    });
  });
};

