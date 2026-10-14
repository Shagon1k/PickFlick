import { loadDatabaseEnvironment } from '@pickflick/config/environment';

import { checkDatabaseReadiness } from '../client.js';

const READINESS_TIMEOUT_MS = 2_000;

const environment = loadDatabaseEnvironment();
await checkDatabaseReadiness(environment.databaseUrl, READINESS_TIMEOUT_MS);

// No shared reference records are required yet. Keep this ordered release step so
// future production-safe reference data is applied after migrations and before activation.
console.log('Required release seed step passed (no reference records registered).');
