import {
  Controller,
  Get,
  Param,
  OnModuleDestroy,
  OnModuleInit,
  HttpException,
} from "@nestjs/common";
import { Store } from "@collabspace/store";
import { Public } from "../../common/decorators/public.decorator";

@Controller("shares")
export class SharesController implements OnModuleDestroy, OnModuleInit {
  private store = new Store();
  onModuleInit() {
    return this.store.assertRuntime();
  }
  onModuleDestroy() {
    return this.store.close();
  }
  @Public()
  @Get(":token")
  async get(@Param("token") token: string) {
    try {
      return await this.store.publicShare(token);
    } catch (e: any) {
      if (e.status) throw new HttpException({ code: e.code, message: e.code }, e.status);
      throw e;
    }
  }
}
