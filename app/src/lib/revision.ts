import { execFileSync } from 'node:child_process';

// Read once on the server; static exports retain the revision they were built from.
const [hash, shortHash] = execFileSync('git', ['show', '-s', '--format=%H%n%h', 'HEAD'], {
  cwd: process.cwd(),
  encoding: 'utf8',
}).trim().split('\n');

export const revision = {
  shortHash,
  url: `https://github.com/Theodor-Springmann-Stiftung/lenz-briefe/commit/${hash}`,
};
