const { Trino, BasicAuth } = require('trino-client');

const trinoHost = process.env.TRINO_HOST || 'trino';
const trinoPort = process.env.TRINO_PORT || 8080;
const trinoUser = process.env.TRINO_USER || 'admin';

const trinoClient = Trino.create({
  server: `http://${trinoHost}:${trinoPort}`,
  catalog: process.env.TRINO_CATALOG || 'hive',
  schema: process.env.TRINO_SCHEMA || 'default',
  auth: new BasicAuth(trinoUser),
});

async function checkTrinoHealth() {
  const queryIterator = await trinoClient.query('SELECT 1 AS ok');
  
  // Consume the iterator to verify connection
  for await (const queryResult of queryIterator) {
    // Connection successful if we get here
  }
}

module.exports = { checkTrinoHealth, trinoClient };
