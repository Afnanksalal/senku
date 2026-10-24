import {
  ArgumentsHost,
  CanActivate,
  Catch,
  ExceptionFilter,
  ExecutionContext,
  ForbiddenException,
  HttpException,
  Inject,
  Injectable,
  SetMetadata,
  ServiceUnavailableException,
  UnauthorizedException,
  applyDecorators,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { Actor, AuthService } from '../auth/auth.service';
import { Connections } from './events';
import { CONFIG, Config } from '../config';

export interface ApiRequest {
  headers: Record<string, string | string[] | undefined>;
  body: unknown;
  method: string;
  ip?: string;
  user?: Actor;
  bearer?: string;
  requestId: string;
  route?: { path: string };
}
export interface ApiResponse {
  status(code: number): ApiResponse;
  json(data: unknown): void;
  setHeader(name: string, value: string): void;
}
export const PUBLIC = 'senku:public';
export const ROLES = 'senku:roles';
export const BODY = 'senku:body';
export const Public = () => SetMetadata(PUBLIC, true);
export const Roles = (...roles: Actor['role'][]) => SetMetadata(ROLES, roles);
export function SchemaBody(schema: z.ZodType) {
  return applyDecorators(
    SetMetadata(BODY, schema),
    ApiBody({ schema: z.toJSONSchema(schema, { io: 'input', target: 'openapi-3.0' }) as never }),
  );
}
export const Protected = () => ApiBearerAuth();
export const actor = (req: ApiRequest): Actor => {
  if (!req.user) throw new UnauthorizedException();
  return req.user;
};
export function bearerHeader(req: ApiRequest): string | undefined {
  const value = req.headers.authorization;
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !/^Bearer [A-Za-z0-9._-]{20,8192}$/.test(value))
    throw new UnauthorizedException('Malformed authorization header');
  return value.slice(7);
}
@Injectable()
export class ApiGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
    private readonly connections: Connections,
    @Inject(CONFIG) private readonly config: Config,
  ) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<ApiRequest>();
    if (context.getClass().name === 'HealthController') return true;
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    const sensitive = context.getClass().name === 'AuthController';
    const key = this.connections.key(
      `rate:${sensitive ? 'auth' : 'api'}:${req.ip ?? 'unknown'}:${Math.floor(Date.now() / 60000)}`,
    );
    try {
      const count = (await this.connections.redis.eval(
        "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],65) end; return n",
        1,
        key,
      )) as number;
      if (
        count >
        (sensitive ? this.config.AUTH_RATE_LIMIT_PER_MINUTE : this.config.RATE_LIMIT_PER_MINUTE)
      )
        throw new HttpException('Rate limit exceeded', 429);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException('Admission control is unavailable');
    }
    if (!isPublic) {
      const bearer = bearerHeader(req);
      if (!bearer) throw new UnauthorizedException('Bearer token required');
      req.user = await this.auth.authenticate(bearer);
      req.bearer = bearer;
      const roles = this.reflector.getAllAndOverride<Actor['role'][]>(ROLES, [
        context.getHandler(),
        context.getClass(),
      ]);
      if (roles && !roles.includes(req.user.role))
        throw new ForbiddenException('Role does not permit this operation');
    }
    const schema = this.reflector.get<z.ZodType>(BODY, context.getHandler());
    if (schema) req.body = schema.parse(req.body);
    return true;
  }
}
@Catch()
export class SafeErrors implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const req = http.getRequest<ApiRequest>();
    const res = http.getResponse<ApiResponse>();
    let status = 500,
      code = 'internal_error',
      message = 'The request could not be completed';
    let details: unknown;
    if (error instanceof z.ZodError) {
      status = 400;
      code = 'validation_error';
      message = 'Invalid request';
      details = error.issues.map((i) => ({ path: i.path.join('.'), code: i.code }));
    } else if (error instanceof HttpException) {
      status = error.getStatus();
      code =
        (
          {
            400: 'bad_request',
            401: 'unauthorized',
            403: 'forbidden',
            404: 'not_found',
            409: 'conflict',
            410: 'gone',
            413: 'payload_too_large',
            429: 'rate_limited',
            503: 'unavailable',
          } as Record<number, string>
        )[status] ?? 'request_failed';
      // Nest can wrap parser errors as BadRequestException, including fragments of
      // the submitted body in its message. Never reflect those fragments.
      message = status === 400 ? 'Invalid request' : error.message;
    } else if ((error as { type?: string })?.type === 'entity.parse.failed') {
      status = 400;
      code = 'invalid_json';
      message = 'Invalid JSON body';
    } else if ((error as { type?: string })?.type === 'entity.too.large') {
      status = 413;
      code = 'payload_too_large';
      message = 'Request body is too large';
    } else if ((error as { code?: string })?.code === '23505') {
      status = 409;
      code = 'conflict';
      message = 'The resource already exists';
    } else if ((error as { code?: string })?.code === '23503') {
      status = 400;
      code = 'invalid_reference';
      message = 'A referenced resource is unavailable';
    }
    if (status >= 500)
      console.error(
        JSON.stringify({
          level: 'error',
          event: 'request.failed',
          request_id: req.requestId,
          status,
          error_type: error instanceof Error ? error.name : 'unknown',
        }),
      );
    if (status === 429) res.setHeader('Retry-After', '60');
    res.status(status).json({
      error: {
        code,
        message,
        request_id: req.requestId ?? randomUUID(),
        ...(details ? { details } : {}),
      },
    });
  }
}
export const uuid = (input: string) => z.string().uuid().parse(input);
export const pagination = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  after: z.string().max(200).default(''),
});
export const text = (min: number, max: number) =>
  z
    .string()
    .trim()
    .min(min)
    .max(max)
    .refine((v) => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v));
