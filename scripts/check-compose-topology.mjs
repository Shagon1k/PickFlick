// Checks the deployed Compose topology for one APP_ENV: Redis stays on a private network, only
// the backend and deadline worker reach it, nothing publishes host ports, and the email worker
// receives only the variables it reads. Run by scripts/check-compose.sh.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const config = JSON.parse(
    execFileSync(
        'docker',
        [
            'compose',
            '--env-file',
            '.env.example',
            '-f',
            'compose.deploy.yaml',
            'config',
            '--format',
            'json',
        ],
        { encoding: 'utf8' },
    ),
);
const environment = process.env.APP_ENV;
const privateNetwork = 'notification-signals';
assert.equal(config.name, `pickflick-${environment}`);
assert.deepEqual(Object.keys(config.services).sort(), [
    'backend',
    'email-worker',
    'frontend',
    'redis',
    'release',
    'worker',
]);
assert.deepEqual(Object.keys(config.networks).sort(), ['application', privateNetwork]);
assert.equal(config.networks[privateNetwork].internal, true);
assert.ok(!config.networks[privateNetwork].external);
assert.equal(config.networks[privateNetwork].name, `${config.name}_${privateNetwork}`);
assert.equal(config.networks.application.external, true);
assert.equal(config.networks.application.name, 'dokploy-network');
const redis = config.services.redis;
assert.deepEqual(Object.keys(redis.networks), [privateNetwork]);
assert.deepEqual(redis.networks[privateNetwork].aliases, [`pickflick-${environment}-redis`]);
assert.deepEqual(redis.command, ['redis-server', '--save', '', '--appendonly', 'no']);
assert.ok(!redis.volumes?.length);
for (const [name, service] of Object.entries(config.services)) {
    assert.ok(!service.ports?.length, `${name} must not publish host ports`);
    if (name === 'redis') continue;
    const consumer = name === 'backend' || name === 'worker';
    assert.deepEqual(
        Object.keys(service.networks).sort(),
        consumer ? ['application', privateNetwork] : ['application'],
    );
    assert.deepEqual(service.networks.application.aliases, [`pickflick-${environment}-${name}`]);
    if (consumer) {
        assert.equal(service.environment.REDIS_URL, `redis://pickflick-${environment}-redis:6379`);
        assert.ok(!service.depends_on.redis);
        assert.equal(service.depends_on.release.condition, 'service_completed_successfully');
    }
}
// The email worker gets only what it reads: no OAuth, storage, Redis or webhook secrets.
assert.deepEqual(Object.keys(config.services['email-worker'].environment).sort(), [
    'APP_ENV',
    'AUTH_BASE_URL',
    'CONTACT_DELIVERY_TO',
    'DATABASE_URL',
    'RESEND_API_KEY',
    'RESEND_DELIVERY_MODE',
    'RESEND_FROM',
]);
console.log(
    `${environment}: private Redis topology, application connections and email-worker secrets verified.`,
);
