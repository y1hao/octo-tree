import path from 'path';
import { existsSync } from 'fs';

export const resolveStaticAssets = (): { root: string; indexPath: string } => {
  const distPath = path.resolve(__dirname, '..', '..', 'web', 'dist');
  const indexPath = path.join(distPath, 'index.html');

  if (!existsSync(distPath) || !existsSync(indexPath)) {
    console.warn(
      'Front-end build not found. Run `npm run build:web` to generate assets before launching the server.'
    );
  }

  return { root: distPath, indexPath };
};

