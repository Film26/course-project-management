import { config } from './config.js';
import { createApp } from './app.js';

// Listen on all interfaces: Cloud Run and Docker route traffic to the container's PORT on 0.0.0.0.
createApp().listen(config.port, '0.0.0.0', () => {
  console.log(`API listening on port ${config.port} (commit ${config.appCommit})`);
});
