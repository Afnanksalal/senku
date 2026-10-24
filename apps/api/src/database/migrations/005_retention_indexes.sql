CREATE INDEX citations_source_idx ON investigation_citations(source_id);
CREATE INDEX structure_assets_retrieved_idx ON structure_assets(retrieved_at);
CREATE INDEX runs_finished_result_idx ON experiment_runs(finished_at) WHERE result IS NOT NULL;
