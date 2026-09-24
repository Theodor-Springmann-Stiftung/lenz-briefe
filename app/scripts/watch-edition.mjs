import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {runExport} from './export.mjs';

// Serialize exports, coalesce saves, and rerun if sources change during a build.
export function createExportQueue({run, success, failure, delay = 200}) {
  let timer;
  let running = false;
  let dirty = false;
  let stopped = false;
  async function flush() {
    timer = undefined;
    if (stopped || running || !dirty) return;
    dirty = false;
    running = true;
    try {
      await run();
      if (!stopped && !dirty) success();
    } catch (error) {
      if (!stopped && !dirty) failure(error);
    } finally {
      running = false;
      if (!stopped && dirty) {
        clearTimeout(timer);
        timer = setTimeout(flush, delay);
      }
    }
  }
  return {
    schedule() {
      if (stopped) return;
      dirty = true;
      clearTimeout(timer);
      timer = setTimeout(flush, delay);
    },
    stop() { stopped = true; clearTimeout(timer); },
  };
}

export default function watchEdition() {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const sources = ['data/xml', 'data/xsd', 'xslt'].map(dir => path.join(root, dir));
  const editionModule = path.join(root, 'app/src/lib/edition.ts');
  return {
    name: 'lenz:watch-edition',
    hooks: {
      'astro:server:setup': ({server, logger}) => {
        const abort = new AbortController();
        const queue = createExportQueue({
          run: () => {
            logger.info('Source changed; exporting the edition…');
            return runExport({signal: abort.signal});
          },
          success: () => {
            logger.info('Edition exported; reloading pages.');
            // Use Astro/Vite's normal invalidation path, including server module
            // runners and getStaticPaths caches, before its full browser reload.
            server.watcher.emit('change', editionModule);
          },
          failure: error => {
            logger.error(error.message);
            server.ws.send({type:'error', err:{message:error.message, stack:''}});
          },
        });
        const onSourceChange = (event, file) => {
          if (!['add', 'change', 'unlink'].includes(event)) return;
          const absolute = path.resolve(file);
          if (sources.some(dir => absolute.startsWith(dir + path.sep)) && /\.(xml|xsd|xsl|xslt)$/i.test(file)) queue.schedule();
        };
        server.watcher.add(sources);
        server.watcher.on('all', onSourceChange);
        server.httpServer?.once('close', () => {
          queue.stop();
          abort.abort();
          server.watcher.off('all', onSourceChange);
        });
      },
    },
  };
}
