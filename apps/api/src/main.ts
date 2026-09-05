import "reflect-metadata";

import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module.js";

const port = 3001;
const app = await NestFactory.create(AppModule);
await app.listen(port, "127.0.0.1");
console.log(`PickFlick API scaffold listening on http://127.0.0.1:${port}`);
