import { Body, Controller, Delete, Get, NotFoundException, Param, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { Database, rows } from '../database/database';
import { ApiRequest, Roles, SchemaBody, actor, text, uuid } from '../common/http';
import { audit } from '../common/events';
import { sha256, token } from '../common/crypto';
const create = z.object({ name: text(1, 100) }).strict();
const join = z.object({ code: z.string().regex(/^[A-Za-z0-9_-]{43}$/) }).strict();
const assignment = z
  .object({
    lesson_id: z.string().regex(/^[a-z0-9-]{1,100}$/),
    title: text(1, 120),
    due_at: z.string().datetime({ offset: true }).optional(),
  })
  .strict();
@ApiTags('Classroom foundations')
@ApiBearerAuth()
@Roles('learner', 'teacher', 'admin')
@Controller('v1/classrooms')
export class ClassroomController {
  constructor(private readonly db: Database) {}
  private async owner(r: ApiRequest, id: string) {
    const room = (
      await this.db.query(
        'SELECT id FROM classrooms WHERE id=$1 AND owner_id=$2 AND archived_at IS NULL',
        [id, actor(r).id],
      )
    )[0];
    if (!room) throw new NotFoundException('Classroom not found');
  }
  private async member(r: ApiRequest, id: string) {
    if (
      !(
        await this.db.query(
          'SELECT id FROM classrooms WHERE id=$1 AND archived_at IS NULL AND (owner_id=$2 OR EXISTS(SELECT 1 FROM classroom_members WHERE classroom_id=$1 AND user_id=$2))',
          [id, actor(r).id],
        )
      ).length
    )
      throw new NotFoundException('Classroom not found');
  }
  @Roles('teacher', 'admin') @Post() @SchemaBody(create) async create(
    @Req() r: ApiRequest,
    @Body() b: z.infer<typeof create>,
  ) {
    const code = token();
    return this.db.transaction(async (tx) => {
      const room = (
        await rows(
          tx,
          'INSERT INTO classrooms(owner_id,name,join_code_hash) VALUES($1,$2,$3) RETURNING id,name,created_at',
          [actor(r).id, b.name, sha256(code)],
        )
      )[0];
      await audit(tx, actor(r).id, 'classroom.created', String(room.id));
      return { ...room, join_code: code };
    });
  }
  @Get() list(@Req() r: ApiRequest) {
    return this.db.query(
      'SELECT c.id,c.name,c.created_at,c.owner_id=$1 AS is_teacher FROM classrooms c WHERE archived_at IS NULL AND (owner_id=$1 OR EXISTS(SELECT 1 FROM classroom_members m WHERE m.classroom_id=c.id AND m.user_id=$1)) ORDER BY c.created_at DESC LIMIT 100',
      [actor(r).id],
    );
  }
  @Post('join') @SchemaBody(join) async join(
    @Req() r: ApiRequest,
    @Body() b: z.infer<typeof join>,
  ) {
    return this.db.transaction(async (tx) => {
      const room = (
        await rows<{ id: string }>(
          tx,
          'SELECT id FROM classrooms WHERE join_code_hash=$1 AND archived_at IS NULL FOR UPDATE',
          [sha256(b.code)],
        )
      )[0];
      if (!room) throw new NotFoundException('Classroom invitation not found');
      await tx.query(
        'INSERT INTO classroom_members(classroom_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING',
        [room.id, actor(r).id],
      );
      return { classroom_id: room.id };
    });
  }
  @Roles('teacher', 'admin') @Post(':id/rotate-code') async rotate(
    @Req() r: ApiRequest,
    @Param('id') id: string,
  ) {
    id = uuid(id);
    await this.owner(r, id);
    const code = token();
    await this.db.query('UPDATE classrooms SET join_code_hash=$2 WHERE id=$1', [id, sha256(code)]);
    return { join_code: code };
  }
  @Roles('teacher', 'admin') @Delete(':id') async archive(
    @Req() r: ApiRequest,
    @Param('id') id: string,
  ) {
    id = uuid(id);
    await this.owner(r, id);
    await this.db.query('UPDATE classrooms SET archived_at=now() WHERE id=$1', [id]);
    return { archived: true };
  }
  @Roles('teacher', 'admin') @Post(':id/assignments') @SchemaBody(assignment) async assign(
    @Req() r: ApiRequest,
    @Param('id') id: string,
    @Body() b: z.infer<typeof assignment>,
  ) {
    id = uuid(id);
    await this.owner(r, id);
    if (!(await this.db.query('SELECT id FROM lessons WHERE id=$1', [b.lesson_id])).length)
      throw new NotFoundException('Lesson not found');
    return (
      await this.db.query(
        'INSERT INTO assignments(classroom_id,lesson_id,title,due_at) VALUES($1,$2,$3,$4) RETURNING *',
        [id, b.lesson_id, b.title, b.due_at ?? null],
      )
    )[0];
  }
  @Get(':id/assignments') async assignments(@Req() r: ApiRequest, @Param('id') id: string) {
    id = uuid(id);
    await this.member(r, id);
    return this.db.query(
      'SELECT id,lesson_id,title,due_at,created_at FROM assignments WHERE classroom_id=$1 ORDER BY created_at DESC LIMIT 100',
      [id],
    );
  }
  @Roles('teacher', 'admin') @Get(':id/progress') async progress(
    @Req() r: ApiRequest,
    @Param('id') id: string,
  ) {
    id = uuid(id);
    await this.owner(r, id);
    return this.db.query(
      'SELECT m.user_id,u.display_name,a.id AS assignment_id,a.lesson_id,max(t.score) AS best_score,count(t.id)::int AS attempts,max(t.created_at) AS last_attempt FROM classroom_members m JOIN users u ON u.id=m.user_id JOIN assignments a ON a.classroom_id=m.classroom_id LEFT JOIN lesson_attempts t ON t.owner_id=m.user_id AND t.lesson_id=a.lesson_id AND t.created_at>=greatest(m.joined_at,a.created_at) WHERE m.classroom_id=$1 AND u.deleted_at IS NULL GROUP BY m.user_id,u.display_name,a.id,a.lesson_id ORDER BY u.display_name,a.id LIMIT 1000',
      [id],
    );
  }
  @Delete(':id/members/:user') async remove(
    @Req() r: ApiRequest,
    @Param('id') id: string,
    @Param('user') user: string,
  ) {
    id = uuid(id);
    user = uuid(user);
    if (user !== actor(r).id) await this.owner(r, id);
    await this.db.query('DELETE FROM classroom_members WHERE classroom_id=$1 AND user_id=$2', [
      id,
      user,
    ]);
    return { removed: true };
  }
}
