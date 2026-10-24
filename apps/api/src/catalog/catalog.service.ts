import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Experiment, Parameters, validateParameters } from '@senku/experiment-schema';
import { Database, rows } from '../database/database';
import { digest } from '../common/crypto';
import { experiments, engineCapabilities } from './definitions';

export type StoredExperiment = { manifest: Experiment; content_hash: string };
@Injectable()
export class CatalogService {
  constructor(private readonly db: Database) {}
  async seed() {
    await this.db.transaction(async (tx) => {
      await tx.query(
        'INSERT INTO subjects(id,name,description) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',
        ['biology', 'Biology', 'Explore life through reproducible educational experiments.'],
      );
      for (const manifest of experiments) {
        const model = manifest.model;
        const existing = await rows<{ content_hash: string }>(
          tx,
          'SELECT content_hash FROM scientific_models WHERE id=$1 AND version=$2',
          [model.id, model.version],
        );
        if (existing.length && existing[0].content_hash !== digest(model))
          throw new Error(`Immutable model changed: ${model.id}`);
        await tx.query(
          'INSERT INTO scientific_models(id,version,definition,content_hash) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',
          [model.id, model.version, JSON.stringify(model), digest(model)],
        );
        const current = await rows<{ content_hash: string }>(
          tx,
          'SELECT content_hash FROM experiment_definitions WHERE id=$1 AND version=$2',
          [manifest.id, manifest.version],
        );
        if (current.length && current[0].content_hash !== digest(manifest))
          throw new Error(`Immutable experiment changed: ${manifest.id}`);
        await tx.query(
          'INSERT INTO experiment_definitions(id,version,subject_id,model_id,model_version,manifest,content_hash,published) VALUES($1,$2,$3,$4,$5,$6,$7,true) ON CONFLICT DO NOTHING',
          [
            manifest.id,
            manifest.version,
            manifest.subject,
            model.id,
            model.version,
            JSON.stringify(manifest),
            digest(manifest),
          ],
        );
        const lesson = {
          id: `${manifest.id}-mission`,
          name: manifest.name,
          objective: manifest.learning.objective,
          concept: manifest.learning.concept,
          steps: ['predict', 'manipulate', 'observe', 'explain'],
          prediction: {
            question: 'What will happen when you change the limiting parameter?',
            choices: ['increase', 'decrease', 'unchanged'],
          },
          assessment: {
            question: 'Which approach supports a scientific conclusion?',
            choices: [
              'Inspect the outputs and model assumptions',
              'Trust the animation alone',
              'Ignore the parameter units',
            ],
            correct_index: 0,
          },
          xp: 20,
          experiment_id: manifest.id,
          experiment_version: manifest.version,
        };
        const priorLesson = (
          await rows<{ definition: unknown }>(tx, 'SELECT definition FROM lessons WHERE id=$1', [
            lesson.id,
          ])
        )[0];
        if (priorLesson && digest(priorLesson.definition) !== digest(lesson))
          throw new Error(`Immutable lesson changed: ${lesson.id}`);
        await tx.query(
          'INSERT INTO lessons(id,version,subject_id,experiment_id,experiment_version,definition) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING',
          [lesson.id, '1.0.0', 'biology', manifest.id, manifest.version, JSON.stringify(lesson)],
        );
      }
      await tx.query(
        'INSERT INTO challenges(id,lesson_id,definition) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',
        [
          'restore-cell',
          'cell-energy-mission',
          JSON.stringify({
            name: 'Restore the Cell',
            experiment_id: 'cell-energy',
            experiment_version: '1.0.0',
            metric: 'energy_index',
            minimum: 60,
            xp: 30,
          }),
        ],
      );
      await tx.query(
        "INSERT INTO achievements(id,name,required_lessons) VALUES('first-experiment','First Experiment',1),('five-concepts','Five Concepts',5) ON CONFLICT DO NOTHING",
      );
      for (const c of [
        { id: 'enzyme-saturation', name: 'Enzyme Sprint', experiment_id: 'enzyme-explorer', metric: 'initial_rate', minimum: 0.8 },
        { id: 'population-recovery', name: 'Population Recovery', experiment_id: 'population-dynamics', metric: 'final_population', minimum: 800 },
        { id: 'genetics-dominance', name: 'Inheritance Garden', experiment_id: 'genetics-lab', metric: 'AA', minimum: 70 },
      ]) {
        const { id, ...definition } = c;
        await tx.query('INSERT INTO challenges(id,lesson_id,definition) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',
          [id, `${c.experiment_id}-mission`, JSON.stringify({ ...definition, experiment_version: '1.0.0', xp: 30 })]);
      }
    });
  }
  subjects() {
    return this.db.query('SELECT id,name,description FROM subjects ORDER BY position,id');
  }
  async list(limit = 25, after = '') {
    const result = await this.db.query<{ manifest: Experiment; content_hash: string }>(
      "SELECT manifest,content_hash FROM (SELECT DISTINCT ON(id) id,manifest,content_hash FROM experiment_definitions WHERE published AND id>$1 ORDER BY id,string_to_array(version,'.')::int[] DESC) latest ORDER BY id LIMIT $2",
      [after, limit + 1],
    );
    return {
      items: result.slice(0, limit).map((r) => ({ ...r.manifest, content_hash: r.content_hash })),
      next_cursor: result.length > limit ? result[limit - 1].manifest.id : null,
    };
  }
  async experiment(id: string, version: string): Promise<StoredExperiment> {
    const result = await this.db.query<StoredExperiment>(
      'SELECT manifest,content_hash FROM experiment_definitions WHERE id=$1 AND version=$2 AND published',
      [id, version],
    );
    if (!result.length) throw new NotFoundException('Experiment version not found');
    return result[0];
  }
  parameters(manifest: Experiment, input: Record<string, unknown>): Parameters {
    try {
      return validateParameters(manifest, input);
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }
  }
  engines() {
    return engineCapabilities;
  }
  models() {
    return this.db.query(
      'SELECT id,version,definition,content_hash FROM scientific_models ORDER BY id,version',
    );
  }
  modelVersions(id: string) {
    return this.db.query(
      'SELECT id,version,definition,content_hash FROM scientific_models WHERE id=$1 ORDER BY version',
      [id],
    );
  }
  async lessons() {
    const lessons = await this.db.query<{ id: string; name: string }>(
      "SELECT id,definition->>'name' AS name FROM lessons ORDER BY id",
    );
    return Promise.all(
      lessons.map(async (lesson) => ({ ...(await this.lesson(lesson.id)), name: lesson.name })),
    );
  }
  async lesson(id: string) {
    const result = await this.db.query<{
      id: string;
      version: string;
      experiment_id: string;
      experiment_version: string;
      definition: Record<string, unknown>;
    }>('SELECT * FROM lessons WHERE id=$1', [id]);
    if (!result.length) throw new NotFoundException('Lesson not found');
    const { assessment, ...publicDefinition } = result[0].definition;
    const a = assessment as Record<string, unknown>;
    return {
      ...result[0],
      definition: { ...publicDefinition, assessment: { question: a.question, choices: a.choices } },
    };
  }
}
