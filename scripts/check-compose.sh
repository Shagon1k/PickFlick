#!/usr/bin/env sh
# Renders every Compose file with example values; any missing variable or syntax error fails.
set -eu

docker compose --env-file .env.example -f compose.local.yaml config -q
for environment in uat production; do
    APP_ENV="$environment" docker compose --env-file .env.example -f compose.deploy.yaml config -q
    APP_ENV="$environment" node --input-type=module -e '
        import assert from "node:assert/strict";
        import { execFileSync } from "node:child_process";

        const config = JSON.parse(execFileSync("docker", [
            "compose", "--env-file", ".env.example", "-f", "compose.deploy.yaml", "config", "--format", "json",
        ], { encoding: "utf8" }));
        const environment = process.env.APP_ENV;
        const privateNetwork = "notification-signals";
        assert.equal(config.name, `pickflick-${environment}`);
        assert.deepEqual(Object.keys(config.services).sort(), ["backend", "email-worker", "frontend", "redis", "release", "worker"]);
        assert.deepEqual(Object.keys(config.networks).sort(), ["application", privateNetwork]);
        assert.equal(config.networks[privateNetwork].internal, true);
        assert.ok(!config.networks[privateNetwork].external);
        assert.equal(config.networks[privateNetwork].name, `${config.name}_${privateNetwork}`);
        assert.equal(config.networks.application.external, true);
        assert.equal(config.networks.application.name, "dokploy-network");
        const redis = config.services.redis;
        assert.deepEqual(Object.keys(redis.networks), [privateNetwork]);
        assert.deepEqual(redis.networks[privateNetwork].aliases, [`pickflick-${environment}-redis`]);
        assert.deepEqual(redis.command, ["redis-server", "--save", "", "--appendonly", "no"]);
        assert.ok(!redis.volumes?.length);
        for (const [name, service] of Object.entries(config.services)) {
            assert.ok(!service.ports?.length, `${name} must not publish host ports`);
            if (name === "redis") continue;
            const consumer = name === "backend" || name === "worker";
            assert.deepEqual(Object.keys(service.networks).sort(), consumer ? ["application", privateNetwork] : ["application"]);
            assert.deepEqual(service.networks.application.aliases, [`pickflick-${environment}-${name}`]);
            if (consumer) {
                assert.equal(service.environment.REDIS_URL, `redis://pickflick-${environment}-redis:6379`);
                assert.ok(!service.depends_on.redis);
                assert.equal(service.depends_on.release.condition, "service_completed_successfully");
            }
        }
        console.log(`${environment}: private Redis topology and existing application connections verified.`);
    '
done
SOURCE_REVISION=0000000000000000000000000000000000000000 PREVIEW_BACKEND_PORT=3001 PREVIEW_FRONTEND_PORT=3000 \
    docker compose --env-file .env.example -f compose.preview.yaml config -q

echo 'Compose files render.'
