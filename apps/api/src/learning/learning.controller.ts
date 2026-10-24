import { BadRequestException, Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { ApiRequest, Public, Roles, SchemaBody, actor } from '../common/http';
import { Attempt, attemptInput, LearningService } from './learning.service';
const synchronization = z
  .object({
    pack: z.object({ payload: z.unknown(), signature: z.string().min(40).max(100) }).strict(),
    events: z.array(attemptInput).min(1).max(50),
  })
  .strict();
@ApiTags('Learning and offline progress')
@ApiBearerAuth()
@Controller('v1')
export class LearningController {
  constructor(private readonly learning: LearningService) {}
  @Public() @Get('offline/packs/:lesson') pack(@Param('lesson') id: string) {
    return this.learning.pack(
      z
        .string()
        .regex(/^[a-z0-9-]{1,100}$/)
        .parse(id),
    );
  }
  @Roles('learner', 'teacher', 'admin')
  @Post('learning/attempts')
  @SchemaBody(attemptInput)
  attempt(@Req() req: ApiRequest, @Body() input: Attempt) {
    return this.learning.attempt(actor(req), input);
  }
  @Roles('learner', 'teacher', 'admin')
  @Post(['offline/sync', 'sync/events'])
  @SchemaBody(synchronization)
  sync(@Req() req: ApiRequest, @Body() input: z.infer<typeof synchronization>) {
    return this.learning.sync(actor(req), input);
  }
  @Roles('learner', 'teacher', 'admin')
  @Post('lessons/:lesson/attempts')
  @SchemaBody(attemptInput)
  lessonAttempt(@Req() req: ApiRequest, @Param('lesson') lesson: string, @Body() input: Attempt) {
    if (input.lesson_id !== lesson)
      throw new BadRequestException('Lesson path and evidence must agree');
    return this.learning.attempt(actor(req), input);
  }
  @Roles('learner', 'teacher', 'admin') @Get('me/progress') progress(@Req() req: ApiRequest) {
    return this.learning.progress(actor(req));
  }
}
