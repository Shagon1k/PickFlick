import { type DynamicModule, Global, Module } from '@nestjs/common';
import type { TRuntimeEnvironment } from '@pickflick/config/environment';

export const RUNTIME_ENVIRONMENT = Symbol('RUNTIME_ENVIRONMENT');

/** Provides the environment that bootstrap already loaded and validated. */
@Global()
@Module({})
export class RuntimeModule {
    static register(environment: TRuntimeEnvironment): DynamicModule {
        return {
            module: RuntimeModule,
            providers: [{ provide: RUNTIME_ENVIRONMENT, useValue: environment }],
            exports: [RUNTIME_ENVIRONMENT],
        };
    }
}
