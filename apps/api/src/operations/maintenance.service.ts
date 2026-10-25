import { Inject, Injectable } from '@nestjs/common';
import { Database } from '../database/database';
import { StorageService } from '../artifacts/storage.service';
import { CONFIG, Config } from '../config';
@Injectable()
export class MaintenanceService {
  private cursor?: string;
  constructor(
    private readonly db: Database,
    private readonly storage: StorageService,
    @Inject(CONFIG) private readonly config: Config,
  ) {}
  async cleanup() {
    await this.db.query(
      "UPDATE experiment_runs SET result=NULL,diagnostics=diagnostics||'{\"retention_expired\":true}'::jsonb WHERE id IN (SELECT id FROM experiment_runs WHERE result IS NOT NULL AND finished_at<now()-$1*interval '1 day' LIMIT 100)",
      [this.config.RETENTION_DAYS],
    );
    const expiredStructures = await this.db.query<{ source_id: string; object_key: string }>(
      "SELECT source_id,object_key FROM structure_assets WHERE retrieved_at<now()-$1*interval '1 day' LIMIT 20",
      [this.config.RETENTION_DAYS],
    );
    for (const asset of expiredStructures) {
      await this.storage.remove(asset.object_key);
      await this.db.query('DELETE FROM structure_assets WHERE source_id=$1', [asset.source_id]);
    }
    await this.db.query(
      "DELETE FROM source_records WHERE id IN (SELECT id FROM source_records s WHERE retrieved_at<now()-$1*interval '1 day' AND NOT EXISTS(SELECT 1 FROM investigation_citations c WHERE c.source_id=s.id) AND NOT EXISTS(SELECT 1 FROM structure_assets a WHERE a.source_id=s.id) LIMIT 100)",
      [this.config.RETENTION_DAYS],
    );
    await this.db.query(
      "UPDATE companion_responses SET status='failed',error_code='execution_interrupted',finished_at=now() WHERE status IN ('queued','running') AND created_at<now()-interval '2 minutes'",
    );
    await this.db.query(
      "DELETE FROM companion_responses WHERE status IN ('completed','failed') AND created_at<now()-$1*interval '1 day'",
      [this.config.RETENTION_DAYS],
    );
    // Delete objects before their metadata. A failed deletion remains retryable next pass.
    const artifacts = await this.db.query<{ id: string; object_key: string }>(
      "SELECT a.id,a.object_key FROM run_artifacts a JOIN experiment_runs r ON r.id=a.run_id JOIN users u ON u.id=r.owner_id WHERE (u.deleted_at IS NOT NULL AND r.status NOT IN ('queued','running')) OR a.created_at<now()-$1*interval '1 day' ORDER BY a.created_at LIMIT 100",
      [this.config.RETENTION_DAYS],
    );
    for (const artifact of artifacts) {
      await this.storage.remove(artifact.object_key);
      await this.db.query('DELETE FROM run_artifacts WHERE id=$1', [artifact.id]);
    }
    const objects = await this.storage.objects(this.cursor);
    this.cursor = objects.NextContinuationToken;
    for (const object of objects.Contents ?? []) {
      if (
        !object.Key ||
        !object.LastModified ||
        object.LastModified.getTime() > Date.now() - 3600000
      )
        continue;
      if (
        !(await this.db.query('SELECT id FROM run_artifacts WHERE object_key=$1', [object.Key]))
          .length
      )
        await this.storage.remove(object.Key);
    }
    await this.db.transaction(async (tx) => {
      await tx.query('DELETE FROM idempotency_keys WHERE expires_at<now()');
      await tx.query("DELETE FROM sessions WHERE refresh_expires_at<now()-interval '7 days'");
      await tx.query("DELETE FROM durable_events WHERE created_at<now()-$1*interval '1 day'", [
        this.config.RETENTION_DAYS,
      ]);
      await tx.query(
        "DELETE FROM outbox o WHERE processed_at<now()-interval '7 days' AND NOT EXISTS(SELECT 1 FROM experiment_runs r WHERE r.id=o.job_id AND r.status IN ('queued','running')) AND NOT EXISTS(SELECT 1 FROM investigations i WHERE i.id=o.job_id AND i.status IN ('queued','running'))",
      );
      const users = await tx.query<{ id: string }>(
        "SELECT id FROM users WHERE deleted_at IS NOT NULL AND NOT EXISTS(SELECT 1 FROM experiment_runs r WHERE r.owner_id=users.id AND r.status IN ('queued','running')) AND NOT EXISTS(SELECT 1 FROM investigations i WHERE i.owner_id=users.id AND i.status IN ('queued','running')) AND NOT EXISTS(SELECT 1 FROM run_artifacts a JOIN experiment_runs r ON r.id=a.run_id WHERE r.owner_id=users.id) LIMIT 100",
      );
      for (const { id } of users.rows) {
        for (const table of [
          'lesson_attempts',
          'learning_rewards',
          'concept_mastery',
          'user_achievements',
          'challenge_attempts',
          'offline_events',
          'pathway_documents',
          'idempotency_keys',
          'share_links',
          'companion_responses',
          'dynamic_challenge_feedback',
          'dynamic_challenges',
          'personalized_missions',
          'ai_intents',
          'molecular_screens',
          'molecular_collections',
        ])
          await tx.query(`DELETE FROM ${table} WHERE owner_id=$1`, [id]);
        await tx.query('DELETE FROM durable_events WHERE owner_id=$1', [id]);
        await tx.query('DELETE FROM sessions WHERE user_id=$1', [id]);
        await tx.query(
          "UPDATE experiment_runs SET parameters='{}',input='{}',result=NULL,diagnostics='{}' WHERE owner_id=$1",
          [id],
        );
        await tx.query(
          "UPDATE investigations SET question='Deleted',request='{}',result=NULL WHERE owner_id=$1",
          [id],
        );
        await tx.query(
          'UPDATE agent_tasks SET output=NULL WHERE investigation_id IN (SELECT id FROM investigations WHERE owner_id=$1)',
          [id],
        );
        await tx.query("UPDATE collaboration_rooms SET parameters='{}' WHERE owner_id=$1", [id]);
        await tx.query("UPDATE classrooms SET name='Deleted classroom' WHERE owner_id=$1", [id]);
        await tx.query("UPDATE audit_log SET metadata='{}' WHERE actor_id=$1", [id]);
      }
    });
    return { deleted_artifacts: artifacts.length };
  }
}
