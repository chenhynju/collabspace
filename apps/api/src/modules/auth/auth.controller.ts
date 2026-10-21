import { Controller, Post, Body, Get, Query, Res, Req, Param } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/password-reset.dto';
import { Public } from '../../common/decorators/public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto, @Req() req: Request) {
    return this.auth.register(dto, { traceId: req.traceId, ip: req.ip || '' });
  }

  @Public()
  @Post('verify-email')
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.auth.verifyEmail(dto.token);
  }

  @Public()
  @Post('resend-verification')
  resendVerification(@Body() dto: ResendVerificationDto) {
    return this.auth.resendVerification(dto.email);
  }

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.auth.login(dto, { traceId: req.traceId, ip: req.ip || '' });
  }

  @Public()
  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.requestPasswordReset(dto.email);
  }

  @Public()
  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto.token, dto.password);
  }

  @Public()
  @Get('oauth/providers')
  oauthProviders() {
    return this.auth.getEnabledOAuthProviders();
  }

  @Public()
  @Get('oauth/:provider/url')
  async oauthUrl(@Param('provider') provider: 'google' | 'github',@Res({passthrough:true}) res:Response) {
    const result=await this.auth.getOAuthUrl(provider);
    res.cookie('collab_oauth_binding',result.binding,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/api/v1/auth/oauth',maxAge:600000});
    res.setHeader('Cache-Control','no-store');return {url:result.url};
  }

  @Public()
  @Get('oauth/:provider/callback')
  oauthCallback(
    @Param('provider') provider: 'google' | 'github',
    @Query('code') code: string,
    @Query('state') state: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.auth
      .handleOAuthCallback(provider, code, state, req.cookies?.collab_oauth_binding)
      .then(async (result) => {
        const webUrl = process.env.WEB_URL || 'http://localhost:3010';
        const handoff=await this.auth.oauthHandoff(result,req.cookies.collab_oauth_binding);
        res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');
        res.redirect(`${webUrl}/oauth/callback#code=${handoff}`);
      }).catch(()=>res.redirect(`${process.env.WEB_URL||'http://localhost:3010'}/login?oauth_error=failed`));
  }
  @Public()
  @Post('oauth/exchange')
  async exchange(@Body() body:{code:string},@Req() req:Request,@Res({passthrough:true}) res:Response){
    const result=await this.auth.oauthRedeem(body.code,req.cookies?.collab_oauth_binding);
    res.clearCookie('collab_oauth_binding',{path:'/api/v1/auth/oauth'});res.setHeader('Cache-Control','no-store');return result;
  }
}
