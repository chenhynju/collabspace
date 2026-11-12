import {RealtimeModule} from '../realtime/realtime.module';
import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { MeetingsController } from './meetings.controller';
import { MeetingsService } from './meetings.service';
import { MeetingMediaService } from './meeting-media.service';
@Module({imports:[AuditModule,RealtimeModule],controllers:[MeetingsController],providers:[MeetingsService,MeetingMediaService]})
export class MeetingsModule {}
