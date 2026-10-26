import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { VoiceController } from './voice.controller';
import { VoiceService } from './voice.service';
import { SpeechProvider } from './speech-provider';
import {PersonaController} from './persona.controller';
import {PersonaService} from './persona.service';
@Module({imports:[AuditModule],controllers:[VoiceController,PersonaController],providers:[VoiceService,SpeechProvider,PersonaService]})
export class VoiceModule {}
