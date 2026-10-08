import { execFileSync } from 'node:child_process';
import { appendFile, readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const unpublishedReadmes = new Set([
  'README.md', 'app/README.md', 'scripts/transform/python/README.md',
  'seiten/README.md', 'seiten/components/README.md',
]);

export function needsSiteBuild(files) {
  return files.some((file) => file.startsWith('docs/import/briefe/367/') ||
    (!file.startsWith('docs/') && !unpublishedReadmes.has(file)));
}

export function changedFiles(eventName, event, git = execFileSync) {
  let revisions;
  if (eventName === 'push' && event.before && !/^0+$/.test(event.before) && event.after) {
    revisions = [event.before, event.after];
  } else if (eventName === 'pull_request' && event.pull_request?.base?.sha && event.pull_request?.head?.sha) {
    revisions = [`${event.pull_request.base.sha}...${event.pull_request.head.sha}`];
  } else {
    return null; // Manual runs, initial pushes and unknown events always build.
  }
  // Disabling rename detection includes both paths when a published file moves into docs/.
  try {
    return git('git', ['diff', '--name-only', '--no-renames', '-z', ...revisions, '--'], { encoding: 'utf8' })
      .split('\0').filter(Boolean);
  } catch {
    // A force push can make the previous commit unavailable. Build rather than skip.
    return null;
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, 'utf8'));
  const files = changedFiles(process.env.GITHUB_EVENT_NAME, event);
  const build = files === null || needsSiteBuild(files);
  await appendFile(process.env.GITHUB_OUTPUT, `site=${build}\n`);
  console.info(build ? 'Published inputs changed; build the site.' : 'Only unpublished documentation changed; skip build and deployment.');
}
