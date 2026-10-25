import { Module } from '@nestjs/common';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';
import { AuditModule } from '../audit/audit.module';
import { MailModule } from '../mail/mail.module';
import { ProjectMailService } from './project-mail.service';
import { AssistantRuntimeService } from './assistant-runtime.service';
import { AssistantRuntimeController } from './assistant-runtime.controller';
@Module({imports:[AuditModule,MailModule],controllers:[AssistantController,AssistantRuntimeController],providers:[AssistantService,ProjectMailService,AssistantRuntimeService]})
export class AssistantModule {}
