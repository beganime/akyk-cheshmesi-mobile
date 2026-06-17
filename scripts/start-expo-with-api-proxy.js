const { spawn } = require('child_process');
const path = require('path');

const isWindows = process.platform === 'win32';
const nodePath = process.execPath;
const npxCommand = isWindows ? 'npx.cmd' : 'npx';
const extraExpoArgs = process.argv.slice(2);

const children = [];
let shuttingDown = false;

process.env.AKYL_USE_LOCAL_API_PROXY = process.env.AKYL_USE_LOCAL_API_PROXY || '1';

function startProcess(name, command, args) {
  const child = spawn(command, args, {
    stdio: 'inherit',
    shell: isWindows,
    env: process.env,
  });

  children.push(child);

  child.on('exit', code => {
    if (shuttingDown) return;

    if (name === 'expo') {
      shutdown(code || 0);
    }
  });

  child.on('error', error => {
    console.error(`[${name}] failed:`, error.message);
    if (name === 'expo') {
      shutdown(1);
    }
  });

  return child;
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  children.forEach(child => {
    if (!child.killed) {
      child.kill(isWindows ? undefined : 'SIGTERM');
    }
  });

  process.exit(code);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

startProcess('api-proxy', nodePath, [path.join(__dirname, 'dev-api-proxy.js')]);
startProcess('expo', npxCommand, ['expo', 'start', ...extraExpoArgs]);
