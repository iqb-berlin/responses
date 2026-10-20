// Only used by the isolated consumer CI against its disposable PostgreSQL service.
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const { join } = require('node:path');
assert.equal(process.env.RESPONSES_CONSUMER_TEST, 'true');
assert.equal(process.env.POSTGRES_HOST, '127.0.0.1');
assert.equal(process.env.POSTGRES_DB, 'responses_consumer');
const hostRequire = createRequire(join(process.cwd(), 'package.json'));
const { DataSource } = hostRequire('typeorm');
const initialize = DataSource.prototype.initialize;
DataSource.prototype.initialize = function initializeConsumerDatabase() {
  assert.equal(this.options.database, 'responses_consumer');
  this.setOptions({ synchronize: true });
  return initialize.call(this);
};

