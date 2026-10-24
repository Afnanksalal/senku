import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { ApiRequest, Public, Roles, SchemaBody, actor, uuid } from '../common/http';
import { CollaborationService } from './collaboration.service';
const parameters = z.record(z.string(), z.union([z.number().finite(), z.string().max(256)]));
const create = z
  .object({
    experiment_id: z.string().regex(/^[a-z0-9-]{1,64}$/),
    experiment_version: z
      .string()
      .regex(/^\d+\.\d+\.\d+$/)
      .default('1.0.0'),
    parameters: parameters.default({}),
  })
  .strict();
export const roomEdit = z
  .object({ expected_version: z.number().int().min(0).max(2147483646), parameters })
  .strict();
const share = z
  .object({
    resource_type: z.enum(['run', 'room', 'investigation']),
    resource_id: z.string().uuid(),
    role: z.enum(['viewer', 'editor']).default('viewer'),
    expires_in_hours: z.number().int().min(1).max(720).default(24),
  })
  .strict();
const token = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
@ApiTags('Collaboration and private sharing')
@ApiBearerAuth()
@Roles('learner', 'teacher', 'admin')
@Controller('v1')
export class CollaborationController {
  constructor(private readonly collaboration: CollaborationService) {}
  @Get('rooms') list(@Req() r: ApiRequest) { return this.collaboration.list(actor(r)); }
  @Get('shares') shares(@Req() r: ApiRequest) { return this.collaboration.shares(actor(r)); }
  @Post('rooms') @SchemaBody(create) create(
    @Req() r: ApiRequest,
    @Headers('idempotency-key') key: string | undefined,
    @Body() b: z.infer<typeof create>,
  ) {
    return this.collaboration.create(actor(r), key, b);
  }
  @Get('rooms/:id') room(@Req() r: ApiRequest, @Param('id') id: string) {
    return this.collaboration.room(actor(r), uuid(id));
  }
  @Patch('rooms/:id') @SchemaBody(roomEdit) edit(
    @Req() r: ApiRequest,
    @Param('id') id: string,
    @Body() b: z.infer<typeof roomEdit>,
  ) {
    return this.collaboration.edit(actor(r), uuid(id), b);
  }
  @Delete('rooms/:id') close(@Req() r: ApiRequest, @Param('id') id: string) {
    return this.collaboration.close(actor(r), uuid(id));
  }
  @Get('rooms/:id/events') events(
    @Req() r: ApiRequest,
    @Param('id') id: string,
    @Query('after') after = '0',
  ) {
    return this.collaboration.events(
      actor(r),
      uuid(id),
      z
        .string()
        .regex(/^\d{1,18}$/)
        .parse(after),
    );
  }
  @Get('rooms/:id/members') members(@Req() r: ApiRequest, @Param('id') id: string) {
    return this.collaboration.members(actor(r), uuid(id));
  }
  @Delete('rooms/:id/members/:user') remove(
    @Req() r: ApiRequest,
    @Param('id') id: string,
    @Param('user') user: string,
  ) {
    return this.collaboration.removeMember(actor(r), uuid(id), uuid(user));
  }
  @Post('shares') @SchemaBody(share) share(@Req() r: ApiRequest, @Body() b: z.infer<typeof share>) {
    return this.collaboration.share(actor(r), b);
  }
  @Delete('shares/:id') revoke(@Req() r: ApiRequest, @Param('id') id: string) {
    return this.collaboration.revoke(actor(r), uuid(id));
  }
  @Public() @Get('shared/:token') view(@Param('token') value: string) {
    return this.collaboration.view(token.parse(value));
  }
  @Post('shared/:token/join') join(@Req() r: ApiRequest, @Param('token') value: string) {
    return this.collaboration.join(actor(r), token.parse(value));
  }
}
