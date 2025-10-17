import { build, context } from 'esbuild';
import { mkdir, copyFile, rm } from 'fs/promises';
import { watch } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const distDir = path.resolve(projectRoot, 'dist');
const uiHtmlSrc = path.resolve(projectRoot, 'ui.html');
const isWatch = process.argv.includes('--watch');

const ensureDist = async () => {
  await rm(distDir, { recursive: true, force: true });
  await mkdir(distDir, { recursive: true });
};

const buildCodeOptions = {
  entryPoints: [path.resolve(projectRoot, 'src/code.ts')],
  bundle: true,
  outfile: path.resolve(distDir, 'code.js'),
  platform: 'node',
  target: 'es2018',
  format: 'cjs',
  sourcemap: true,
};

const buildUiOptions = {
  entryPoints: [path.resolve(projectRoot, 'src/ui.ts')],
  bundle: true,
  outfile: path.resolve(distDir, 'ui.js'),
  platform: 'browser',
  target: ['chrome90', 'safari13'],
  format: 'esm',
  sourcemap: true,
};

const copyHtml = async () => {
  await copyFile(uiHtmlSrc, path.resolve(distDir, 'ui.html'));
};

const runBuild = async () => {
  await ensureDist();

  if (isWatch) {
    const [codeCtx, uiCtx] = await Promise.all([context(buildCodeOptions), context(buildUiOptions)]);
    await Promise.all([codeCtx.watch(), uiCtx.watch()]);
    await copyHtml();

    watch(uiHtmlSrc, { persistent: true }, async (eventType) => {
      if (eventType === 'change') {
        await copyHtml();
      }
    });

    console.log('Watching for changes…');
  } else {
    await Promise.all([build(buildCodeOptions), build(buildUiOptions)]);
    await copyHtml();
    console.log('Build complete');
  }
};

runBuild().catch((error) => {
  console.error(error);
  process.exit(1);
});
