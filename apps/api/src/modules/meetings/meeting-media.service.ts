import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';
import { mediaIdentity, mediaRoom } from './meeting-domain';

@Injectable()
export class MeetingMediaService {
  private readonly logger=new Logger(MeetingMediaService.name);
  private configuration(){
    const {LIVEKIT_URL:url,LIVEKIT_API_KEY:key,LIVEKIT_API_SECRET:secret,LIVEKIT_DEPLOYMENT:deployment}=process.env;
    if(!url||!key||!secret||!['cloud','self-hosted'].includes(deployment||''))return null;
    try {
      const u=new URL(url);
      if(u.username||u.password||u.search||u.hash||u.pathname!=='/')return null;
      const local=['localhost','127.0.0.1','[::1]'].includes(u.hostname);
      if(u.protocol!=='wss:'&&!(process.env.NODE_ENV!=='production'&&local&&u.protocol==='ws:'))return null;
      if(deployment==='cloud'&&!u.hostname.endsWith('.livekit.cloud'))return null;
      return {url,key,secret,deployment};
    }catch{return null;}
  }
  status(){return {enabled:process.env.MEETINGS_ENABLED==='true',configured:this.configuration()?.deployment==='cloud',deployment:this.configuration()?.deployment||null,recording:false};}
  private requireConfig(){const config=this.configuration();if(!config)throw new ServiceUnavailableException('会议媒体服务尚未配置；请按第三方配置指南准备LiveKit');return config;}
  async ticket(org:string,id:string,user:string){
    const config=this.requireConfig();
    if(config.deployment!=='cloud')throw new ServiceUnavailableException('自托管尚无严格令牌撤销网关，暂不签发入会凭证');
    // Cloud refreshes connected clients every five minutes. Keep initial admission
    // valid across that interval; Cloud revocation still rejects ended sessions.
    const access=new AccessToken(config.key,config.secret,{identity:mediaIdentity(org,user),ttl:600});
    access.addGrant({room:mediaRoom(org,id),roomJoin:true,canPublish:true,canSubscribe:true,canPublishData:false,canUpdateOwnMetadata:false});
    return {url:config.url,token:await access.toJwt(),expiresIn:600};
  }
  async end(org:string,id:string,issuedUsers:string[]=[]){
    const config=this.requireConfig();
    const server=new RoomServiceClient(config.url.replace(/^ws/,'http'),config.key,config.secret,{requestTimeout:10,failover:false});
    let deleting=false,stage='configuration';
    try{
      if(config.deployment!=='cloud')throw new ServiceUnavailableException('媒体撤权尚未确认');
      const room=mediaRoom(org,id),identities=new Set(issuedUsers.map(user=>mediaIdentity(org,user)));
      stage='list-participants';
      try{for(const participant of await server.listParticipants(room))identities.add(participant.identity);}catch(e:any){if(e?.code!=='not_found'&&e?.status!==404)throw e;}
      if(!identities.size)throw new ServiceUnavailableException('历史会议凭证记录不完整，需核查媒体撤权');
      if(identities.size>100)throw new ServiceUnavailableException('会议参与者撤权数量异常，需核查');
      // Explicit future cutoff covers same-second tokens and Cloud's default clock buffer.
      // Any rejection leaves the application ENDING; never delete before revocation succeeds.
      const cutoff=BigInt(Math.floor(Date.now()/1000)+30);
      stage='revoke-participants';
      for(const identity of identities)await server.removeParticipant(room,identity,{revokeTokenTs:cutoff});
      deleting=true;stage='delete-room';await server.deleteRoom(room);
    }
    catch(error:any){
      // Retrying an already deleted room is safe. All other failures stay ENDING.
      if(!deleting||(error?.code!=='not_found'&&error?.status!==404)){
        // Never log SDK messages, URLs, room/participant identities or credentials.
        const code=typeof error?.code==='string'&&/^[a-z_]{1,40}$/.test(error.code)?error.code:'unknown';
        const status=Number.isInteger(error?.status)?error.status:'unknown';
        this.logger.warn(`Media end unconfirmed: stage=${stage} code=${code} status=${status}`);
        throw new ServiceUnavailableException('媒体房间结束结果尚未确认，请重试结束');
      }
    }
  }
  async revoke(org:string,id:string,user:string){
    const config=this.requireConfig();
    if(config.deployment!=='cloud')throw new ServiceUnavailableException('媒体撤权尚未确认');
    const server=new RoomServiceClient(config.url.replace(/^ws/,'http'),config.key,config.secret,{requestTimeout:10,failover:false});
    try{await server.removeParticipant(mediaRoom(org,id),mediaIdentity(org,user),{revokeTokenTs:BigInt(Math.floor(Date.now()/1000)+30)});}
    catch{throw new ServiceUnavailableException('成员媒体撤权结果尚未确认');}
  }
}
