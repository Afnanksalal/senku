import { Body, Controller, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { AuthService } from './auth.service';
import { ApiRequest, Public, SchemaBody, actor, bearerHeader, text } from '../common/http';

const credentials = z
  .object({
    email: z
      .string()
      .email()
      .max(254)
      .transform((v) => v.toLowerCase()),
    password: z.string().min(12).max(128),
  })
  .strict();
const registration = credentials.extend({ display_name: text(1, 80) }).strict();
const refresh = z.object({ refresh_token: z.string().regex(/^sr_[A-Za-z0-9_-]{43}$/) }).strict();
const logout = z.object({ all_sessions: z.boolean().default(false) }).strict();
@ApiTags('Authentication')
@Controller('v1/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Public() @Post('guest') guest() {
    return this.auth.guest();
  }
  @Public() @SchemaBody(registration) @Post('register') register(
    @Body() body: z.infer<typeof registration>,
    @Req() req: ApiRequest,
  ) {
    return this.auth.register(body.email, body.password, body.display_name, bearerHeader(req));
  }
  @Public() @SchemaBody(credentials) @Post('login') login(
    @Body() body: z.infer<typeof credentials>,
  ) {
    return this.auth.login(body.email, body.password);
  }
  @Public() @SchemaBody(refresh) @Post('refresh') refresh(@Body() body: z.infer<typeof refresh>) {
    return this.auth.refresh(body.refresh_token);
  }
  @ApiBearerAuth() @SchemaBody(logout) @Post('logout') logout(
    @Body() body: z.infer<typeof logout>,
    @Req() req: ApiRequest,
  ) {
    return this.auth.logout(actor(req), req.bearer!, body.all_sessions);
  }
}
