import "reflect-metadata";

import { NestFactory } from "@nestjs/core";
import { loadRuntimeEnvironment } from "@pickflick/config/environment";

import { AppModule } from "./app.module.js";

const environment = loadRuntimeEnvironment();
const app = await NestFactory.create(AppModule);
await app.listen(environment.apiPort, environment.apiHost);
console.log(`PickFlick API scaffold listening on ${environment.apiHost}:${environment.apiPort}`);
