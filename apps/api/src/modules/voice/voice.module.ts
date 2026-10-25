import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { VoiceController } from './voice.controller';
import { VoiceService } from './voice.service';
import { SpeechProvider } from './speech-provider';
@Module({imports:[AuditModule],controllers:[VoiceController],providers:[VoiceService,SpeechProvider]})
export class VoiceModule {}
