import { Controller, Get } from "@nestjs/common";
import { SERVICE_NAMES, type ServiceStatus } from "@pickflick/contracts";

import { Public } from "./identity/authorization.decorators.js";

@Public()
@Controller()
export class AppController {
  @Get()
  status(): ServiceStatus {
    return {
      service: SERVICE_NAMES.api,
      status: "scaffold",
    };
  }
}
