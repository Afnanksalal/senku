import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { CONFIG, loadConfig } from './config';
import { Database } from './database/database';
import { Connections } from './common/events';
import { Idempotency } from './common/idempotency';
import { ApiGuard } from './common/http';
import { AuthService } from './auth/auth.service';
import { AuthController } from './auth/auth.controller';
import { CatalogService } from './catalog/catalog.service';
import { CatalogController } from './catalog/catalog.controller';
import { HealthController } from './health.controller';
import { BudgetService } from './budgets/budget.service';
import { BudgetController } from './budgets/budget.controller';
import { StorageService } from './artifacts/storage.service';
import { ScienceClient } from './science/science.client';
import { RunService } from './runs/run.service';
import { RunController } from './runs/run.controller';
import { PathwayController } from './pathways/pathway.controller';
import { JobRuntime } from './runs/job.runtime';
import { LearningService } from './learning/learning.service';
import { LearningController } from './learning/learning.controller';
import { CollaborationService } from './collaboration/collaboration.service';
import { CollaborationController } from './collaboration/collaboration.controller';
import { CollaborationGateway } from './collaboration/collaboration.gateway';
import { SourcesService } from './sources/sources.service';
import { SourcesController } from './sources/sources.controller';
import { InvestigationService } from './investigations/investigation.service';
import { InvestigationController } from './investigations/investigation.controller';
import { ClassroomController } from './classrooms/classroom.controller';
import { AccountController } from './accounts/account.controller';
import { ChallengeController } from './learning/challenge.controller';
import { OperationsController } from './operations/operations.controller';
import { MaintenanceService } from './operations/maintenance.service';
import { CompanionController } from './companion/companion.controller';
import { DomainController } from './sources/domain.controller';
import { GeminiService } from './science/gemini.service';

@Module({
  controllers: [
    HealthController,
    AuthController,
    CatalogController,
    BudgetController,
    RunController,
    PathwayController,
    LearningController,
    CollaborationController,
    SourcesController,
    InvestigationController,
    ClassroomController,
    AccountController,
    ChallengeController,
    OperationsController,
    CompanionController,
    DomainController,
  ],
  providers: [
    { provide: CONFIG, useFactory: () => loadConfig() },
    Database,
    Connections,
    Idempotency,
    AuthService,
    CatalogService,
    BudgetService,
    StorageService,
    ScienceClient,
    GeminiService,
    RunService,
    JobRuntime,
    LearningService,
    CollaborationService,
    CollaborationGateway,
    SourcesService,
    InvestigationService,
    MaintenanceService,
    { provide: APP_GUARD, useClass: ApiGuard },
  ],
  exports: [Database, Connections, CatalogService, AuthService, Idempotency, CONFIG],
})
export class AppModule {}
