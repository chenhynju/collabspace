import { ServiceUnavailableException } from '@nestjs/common';

export interface AvatarRenderInput {
 organizationId:string;actorId:string;audioAssetId:string;audioRevision:string;personaRevision:string;
}
export interface AvatarRenderReceipt {provider:string;requestId:string;state:'PENDING'|'READY'|'UNKNOWN';privateAssetId?:string;}
/** A video adapter must consume the authorized audio revision, never re-synthesize different text. */
export interface AvatarProvider {
 readonly configured:boolean;
 create(input:AvatarRenderInput,signal:AbortSignal):Promise<AvatarRenderReceipt>;
 inspect(receipt:AvatarRenderReceipt,signal:AbortSignal):Promise<AvatarRenderReceipt>;
}
export class UnconfiguredAvatarProvider implements AvatarProvider {
 readonly configured=false;
 async create(_input:AvatarRenderInput,_signal:AbortSignal):Promise<AvatarRenderReceipt>{throw new ServiceUnavailableException('真人数字人供应商尚未选定并配置，不能生成视频');}
 async inspect(_receipt:AvatarRenderReceipt,_signal:AbortSignal):Promise<AvatarRenderReceipt>{throw new ServiceUnavailableException('不存在可核查的真人视频供应商');}
}
