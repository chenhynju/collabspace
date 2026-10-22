import { Module } from '@nestjs/common';
import { FilesController } from './files.controller';
import { AuditModule } from '../audit/audit.module';
import {OfficeController} from './office.controller';
import {OfficeService} from './office.service';

@Module({
  imports: [AuditModule],
  controllers: [FilesController,OfficeController],
  providers:[OfficeService],
})
export class FilesModule {}
