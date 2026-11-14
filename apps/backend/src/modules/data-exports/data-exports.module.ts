import { Module } from '@nestjs/common';

import { DataExportWorkerService } from './data-export-worker.service.js';
import { DataExportsController } from './data-exports.controller.js';
import { DataExportsService } from './data-exports.service.js';

@Module({
    controllers: [DataExportsController],
    providers: [DataExportsService, DataExportWorkerService],
})
export class DataExportsModule {}
