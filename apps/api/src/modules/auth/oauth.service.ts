import { Injectable, BadRequestException, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { randomBytes, createHash } from 'crypto';
export interface OAuthProfile {id:string;email:string;name?:string;avatarUrl?:string;}
const digest=(s:string)=>createHash('sha256').update(s).digest('base64url');
const invalid=(code:string):never=>{throw new BadRequestException({code,message:code});};
@Injectable()
export class OAuthService implements OnModuleDestroy {
  private redis:Redis;
  constructor(private readonly config:ConfigService){this.redis=new Redis(this.config.get<string>('REDIS_URL')??'redis://localhost:6379');}
  onModuleDestroy(){this.redis.disconnect();}
  private creds(provider:'google'|'github'){
    if(!['google','github'].includes(provider))invalid('INVALID_PROVIDER');
    const p=provider.toUpperCase();return {clientId:this.config.get<string>(p+'_CLIENT_ID',''),clientSecret:this.config.get<string>(p+'_CLIENT_SECRET',''),callback:this.config.get<string>(p+'_CALLBACK_URL','')};
  }
  isEnabled(provider:'google'|'github'){const c=this.creds(provider);return !!(c.clientId&&c.clientSecret&&c.callback);}
  async getAuthorizeUrl(provider:'google'|'github'){
    const c=this.creds(provider);if(!this.isEnabled(provider))invalid('OAUTH_NOT_CONFIGURED');
    const state=randomBytes(32).toString('base64url'),binding=randomBytes(32).toString('base64url'),verifier=randomBytes(32).toString('base64url');
    await this.redis.set('oauth:state:'+state,JSON.stringify({provider,binding:digest(binding),verifier}),'EX',300);
    const params=new URLSearchParams({client_id:c.clientId,redirect_uri:c.callback,response_type:'code',scope:provider==='google'?'openid email profile':'read:user user:email',state,code_challenge:digest(verifier),code_challenge_method:'S256'});
    return {url:(provider==='google'?'https://accounts.google.com/o/oauth2/v2/auth?':'https://github.com/login/oauth/authorize?')+params,binding};
  }
  private async consume(key:string,binding:string,provider?:string){
    if(!/^[\w-]{43}$/.test(binding||''))invalid('INVALID_STATE');
    const raw=await this.redis.eval(`local s=redis.call('GET',KEYS[1]); if not s then return nil end; local v=cjson.decode(s); if v.binding~=ARGV[1] or (ARGV[2]~='' and v.provider~=ARGV[2]) then return nil end; redis.call('DEL',KEYS[1]); return s`,1,key,digest(binding),provider||'');
    if(typeof raw!=='string')invalid('INVALID_STATE');return JSON.parse(raw as string);
  }
  private async json(url:string,init:RequestInit){const r=await fetch(url,{...init,signal:AbortSignal.timeout(15000)});if(!r.ok)invalid('OAUTH_PROVIDER_FAILED');return r.json();}
  async exchangeCode(provider:'google'|'github',code:string,state:string,binding:string):Promise<OAuthProfile>{
    const c=this.creds(provider);if(!/^[\w-]{43}$/.test(state||'')||!code||code.length>2048)invalid('INVALID_STATE');
    const flow=await this.consume('oauth:state:'+state,binding,provider);
    const data=await this.json(provider==='google'?'https://oauth2.googleapis.com/token':'https://github.com/login/oauth/access_token',{
      method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',Accept:'application/json'},
      body:new URLSearchParams({code,client_id:c.clientId,client_secret:c.clientSecret,redirect_uri:c.callback,grant_type:'authorization_code',code_verifier:flow.verifier}),
    });
    if(typeof data.access_token!=='string')invalid('OAUTH_TOKEN_FAILED');
    const headers={Authorization:'Bearer '+data.access_token,Accept:'application/json'};
    const u=await this.json(provider==='google'?'https://www.googleapis.com/oauth2/v3/userinfo':'https://api.github.com/user',{headers});
    let email:string|undefined;
    if(provider==='google'){if(u.email_verified!==true||typeof u.sub!=='string')invalid('OAUTH_EMAIL_NOT_VERIFIED');email=u.email;}
    else{const emails=await this.json('https://api.github.com/user/emails',{headers});if(!Array.isArray(emails))invalid('OAUTH_EMAIL_NOT_VERIFIED');email=emails.find((e:any)=>e.primary&&e.verified)?.email;if(!Number.isSafeInteger(u.id)||u.id<=0)invalid('OAUTH_PROFILE_INVALID');}
    if(typeof email!=='string'||email.length>254||!/^\S+@\S+\.\S+$/.test(email))invalid('OAUTH_EMAIL_NOT_VERIFIED');
    return {id:provider==='google'?u.sub:String(u.id),email:email!.trim().toLowerCase(),name:u.name||u.login,avatarUrl:u.picture||u.avatar_url};
  }
  async handoff(result:unknown,binding:string){const code=randomBytes(32).toString('base64url');await this.redis.set('oauth:handoff:'+code,JSON.stringify({binding:digest(binding),result}),'EX',60);return code;}
  async redeem(code:string,binding:string){if(!/^[\w-]{43}$/.test(code||''))invalid('INVALID_STATE');return (await this.consume('oauth:handoff:'+code,binding)).result;}
}
