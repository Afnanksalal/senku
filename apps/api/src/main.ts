import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { randomUUID } from 'node:crypto';
import { AppModule } from './app.module';
import { CONFIG, Config } from './config';
import { Database } from './database/database';
import { CatalogService } from './catalog/catalog.service';
import { ApiRequest, SafeErrors } from './common/http';
import { StorageService } from './artifacts/storage.service';
import { requestContext } from './common/request-context';

export async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn'],
  });
  const config = app.get<Config>(CONFIG);
  app.disable('x-powered-by');
  app.set('trust proxy', config.TRUST_PROXY ? 1 : false);
  app.useBodyParser('json', { limit: '128kb', strict: true });
  app.enableCors({
    origin: config.CORS_ORIGINS.split(',').map((v) => v.trim()),
    credentials: false,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Authorization',
      'Content-Type',
      'Idempotency-Key',
      'Last-Event-ID',
      'X-Request-ID',
    ],
    exposedHeaders: ['X-Request-ID'],
    maxAge: 600,
  });
  app.use(
    (
      req: ApiRequest,
      res: {
        setHeader: (name: string, value: string) => void;
        on: (name: string, fn: () => void) => void;
        statusCode: number;
      },
      next: () => void,
    ) => {
      const supplied = req.headers['x-request-id'];
      req.requestId =
        typeof supplied === 'string' &&
        /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(supplied)
          ? supplied
          : randomUUID();
      res.setHeader('X-Request-ID', req.requestId);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('Referrer-Policy', 'no-referrer');
      res.setHeader('Cache-Control', 'no-store');
      const start = performance.now();
      res.on('finish', () =>
        console.log(
          JSON.stringify({
            level: 'info',
            event: 'http.request',
            request_id: req.requestId,
            method: req.method,
            route: req.route?.path ?? 'unmatched',
            status: res.statusCode,
            duration_ms: Math.round(performance.now() - start),
          }),
        ),
      );
      requestContext.run({ requestId: req.requestId }, next);
    },
  );
  app.useGlobalFilters(new SafeErrors());
  app.enableShutdownHooks();
  if (config.AUTO_MIGRATE) {
    await app.get(Database).migrate();
    await app.get(CatalogService).seed();
  } else await app.get(Database).verifyMigrations();
  await app.get(StorageService).initialize();
  if (config.API_DOCS) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Senku Backend')
        .setDescription(
          'Versioned educational science, learning and collaboration API. Scientific model limitations are part of each experiment manifest.',
        )
        .setVersion('1.0.0')
        .addBearerAuth()
        .build(),
    );
    SwaggerModule.setup('docs', app, document, {
      jsonDocumentUrl: 'openapi.json',
      swaggerOptions: { persistAuthorization: false },
    });
  }
  await app.listen(config.PORT, '0.0.0.0');
  return app;
}
if (require.main === module)
  void bootstrap().catch(() => {
    console.error(JSON.stringify({ level: 'fatal', event: 'startup.failed' }));
    process.exitCode = 1;
  });
