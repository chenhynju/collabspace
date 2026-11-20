import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { AgentController } from "./agent.controller";
import { AgentService } from "./agent.service";

@Module({
  imports: [AuditModule],
  controllers: [AgentController],
  providers: [AgentService],
})
export class AgentModule {}
