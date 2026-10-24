import { Module } from '@nestjs/common';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';
import { AuditModule } from '../audit/audit.module';
import { MailModule } from '../mail/mail.module';
import { ProjectMailService } from './project-mail.service';
@Module({imports:[AuditModule,MailModule],controllers:[AssistantController],providers:[AssistantService,ProjectMailService]})
export class AssistantModule {}
