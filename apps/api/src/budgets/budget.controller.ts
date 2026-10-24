import { Body, Controller, Delete, Get, Param, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { ApiRequest, Roles, SchemaBody, actor, text, uuid } from '../common/http';
import { BudgetService } from './budget.service';

const group = z
  .object({
    name: text(1, 80),
    daily_units: z.number().int().min(1).max(100000),
    member_daily_units: z.number().int().min(1).max(10000),
  })
  .strict();
const invite = z
  .object({
    group_id: z.string().uuid(),
    max_uses: z.number().int().min(1).max(10000).default(1),
    expires_in_hours: z.number().int().min(1).max(720).default(24),
  })
  .strict();
const redeem = z.object({ code: z.string().regex(/^[A-Za-z0-9_-]{43}$/) }).strict();
@ApiTags('Compute admission')
@ApiBearerAuth()
@Controller('v1')
export class BudgetController {
  constructor(private readonly budget: BudgetService) {}
  @Get('me/usage') usage(@Req() req: ApiRequest) {
    return this.budget.usage(actor(req));
  }
  @Roles('admin') @SchemaBody(group) @Post('admin/budget-groups') group(
    @Req() req: ApiRequest,
    @Body() body: z.infer<typeof group>,
  ) {
    return this.budget.createGroup(actor(req), body);
  }
  @Roles('admin') @SchemaBody(invite) @Post('admin/invitations') invite(
    @Req() req: ApiRequest,
    @Body() body: z.infer<typeof invite>,
  ) {
    return this.budget.invite(actor(req), body);
  }
  @Roles('admin') @Delete('admin/invitations/:id') revoke(
    @Req() req: ApiRequest,
    @Param('id') id: string,
  ) {
    return this.budget.revoke(actor(req), uuid(id));
  }
  @Roles('learner', 'teacher', 'admin') @SchemaBody(redeem) @Post('invitations/redeem') redeem(
    @Req() req: ApiRequest,
    @Body() body: z.infer<typeof redeem>,
  ) {
    return this.budget.redeem(actor(req), body.code);
  }
}
