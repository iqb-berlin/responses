const { spawn } = require('node:child_process');
const { createInterface } = require('node:readline');
const { join, resolve } = require('node:path');
const { PROTOCOL_VERSION } = require('./protocol');

const repositoryRoot = resolve(__dirname, '..', '..');
const project = join(
  repositoryRoot,
  'dotnet',
  'differential',
  'Iqb.Responses.Differential',
  'Iqb.Responses.Differential.csproj'
);

class WorkerClient {
  constructor(options = {}) {
    this.dotnet = options.dotnet || (process.platform === 'win32' ? 'dotnet.exe' : 'dotnet');
    this.command = options.command || this.dotnet;
    this.args = options.args || [
      'run', '--project', project, '--configuration', 'Release', '--no-build', '--', '--jsonl'
    ];
    this.timeoutMs = options.timeoutMs || 2000;
    this.pending = [];
    this.stderr = '';
    this.closed = false;
  }

  async start() {
    this.process = spawn(
      this.command,
      this.args,
      { cwd: repositoryRoot, stdio: ['pipe', 'pipe', 'pipe'] }
    );
    this.process.stderr.setEncoding('utf8');
    this.process.stderr.on('data', chunk => { this.stderr += chunk; });
    this.process.on('error', error => this.failAll(error));
    this.process.on('exit', (code, signal) => {
      this.closed = true;
      this.failAll(new Error(`.NET worker exited with code ${code} and signal ${signal}.`));
    });

    const lines = createInterface({ input: this.process.stdout, crlfDelay: Infinity });
    lines.on('line', line => this.handleLine(line));
    const ready = await this.nextLine(10000);
    if (ready.kind !== 'ready' || ready.protocolVersion !== PROTOCOL_VERSION) {
      throw new Error(`Unexpected worker handshake: ${JSON.stringify(ready)}`);
    }
    this.capabilities = ready.capabilities;
    return this;
  }

  execute(request) {
    if (this.closed) return Promise.reject(new Error('.NET worker is closed.'));
    const result = this.nextLine(this.timeoutMs);
    this.process.stdin.write(`${JSON.stringify(request)}\n`);
    return result;
  }

  executeRaw(line) {
    if (this.closed) return Promise.reject(new Error('.NET worker is closed.'));
    const result = this.nextLine(this.timeoutMs);
    this.process.stdin.write(`${line}\n`);
    return result;
  }

  nextLine(timeoutMs) {
    return new Promise((resolvePromise, rejectPromise) => {
      const pending = {
        resolve: value => {
          clearTimeout(timer);
          resolvePromise(value);
        },
        reject: error => {
          clearTimeout(timer);
          rejectPromise(error);
        }
      };
      const timer = setTimeout(() => {
        const index = this.pending.indexOf(pending);
        if (index >= 0) this.pending.splice(index, 1);
        rejectPromise(new Error(`.NET worker did not respond within ${timeoutMs} ms.`));
      }, timeoutMs);
      this.pending.push(pending);
    });
  }

  handleLine(line) {
    const pending = this.pending.shift();
    if (!pending) return;
    try {
      pending.resolve(JSON.parse(line));
    } catch (error) {
      pending.reject(new Error(`Invalid JSON from .NET worker: ${error.message}`));
    }
  }

  failAll(error) {
    for (const pending of this.pending.splice(0)) pending.reject(error);
  }

  async close() {
    if (!this.process || this.closed) return;
    this.process.stdin.end();
    await new Promise(resolvePromise => {
      const timer = setTimeout(() => {
        this.process.kill();
        resolvePromise();
      }, 2000);
      this.process.once('exit', () => {
        clearTimeout(timer);
        resolvePromise();
      });
    });
  }
}

module.exports = { WorkerClient };
