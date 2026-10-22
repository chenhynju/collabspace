import {Injectable,OnModuleInit,OnModuleDestroy,HttpException} from '@nestjs/common';
const {OfficeStore}=require('@collabspace/store/office.cjs');
@Injectable()
export class OfficeService extends OfficeStore implements OnModuleInit,OnModuleDestroy {
 storageReady=false;
 constructor(){super()}
 async onModuleInit(){const r=await this.pool.query("SELECT to_regclass('public.collab_office') AS name");this.storageReady=!!r.rows[0].name;if(this.storageReady||this.enabled())await this.assertOfficeRuntime();if(this.enabled())this.start()}
 onModuleDestroy(){return this.close()}
 async fileCurrent(ctx:any,id:string){try{return await super.fileCurrent(ctx,id)}catch(e:any){if(e.status)throw new HttpException({code:e.code,message:e.code},e.status);throw e}}
 async shareOffice(ctx:any,id:string){try{return await super.shareOffice(ctx,id)}catch(e:any){if(e.status)throw new HttpException({code:e.code,message:e.code},e.status);throw e}}
}
