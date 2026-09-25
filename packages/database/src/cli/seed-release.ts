import { loadDatabaseEnvironment } from '@pickflick/config/environment';

import { checkDatabaseReadiness } from '../client.js';

const environment = loadDatabaseEnvironment();
await checkDatabaseReadiness(environment.databaseUrl, 2_000);

// No shared reference records are required yet. Keep this ordered release step so
// future production-safe reference data is applied after migrations and before activation.
console.log('Required release seed step passed (no reference records registered).');
