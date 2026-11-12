import {PrismaService} from '../../../prisma/prisma.service';
import {credentialMatches} from '../credential-version';
import {requireJwtSecret} from '../jwt-secret';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

export interface JwtPayload {
  pwd?:string;
  sub: string;
  email: string;
  name: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly config: ConfigService,private readonly prisma:PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (req: any) => req?.cookies?.['access_token'],
      ]),
      ignoreExpiration: false,
      secretOrKey: requireJwtSecret(config),
    });
  }

  async validate(payload: JwtPayload) {
    if(typeof payload.sub!=='string'||!payload.sub)throw new UnauthorizedException('Invalid identity');
    const user=await this.prisma.user.findUnique({where:{id:payload.sub},select:{id:true,email:true,name:true,status:true,passwordHash:true}});
    if(!user||user.status!=='NORMAL'||!credentialMatches(payload.pwd,user.passwordHash,requireJwtSecret(this.config)))throw new UnauthorizedException({code:'SESSION_EXPIRED',message:'登录已失效，请重新登录'});
    return {id:user.id,email:user.email,name:user.name};
  }
}
