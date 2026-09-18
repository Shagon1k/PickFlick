import { SetMetadata } from "@nestjs/common";

import type { AppRole } from "./authorization.types.js";

export const AUTHORIZATION_PUBLIC = "pickflick:authorization:public";
export const AUTHORIZATION_ROLES = "pickflick:authorization:roles";

export const Public = () => SetMetadata(AUTHORIZATION_PUBLIC, true);
export const RequireAppRole = (...roles: readonly AppRole[]) => SetMetadata(AUTHORIZATION_ROLES, roles);
