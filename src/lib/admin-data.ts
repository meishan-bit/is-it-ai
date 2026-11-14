import { SCENARIOS } from './content';
import type { AttemptRow, ParticipantRow, ResponseRow, ScenarioMeta } from './analytics';
import { buildSampleData } from './sample-data';
import { fetchTable, supabaseConfigured } from './supabase';

export const SCENARIO_META: ScenarioMeta[] = SCENARIOS.map((s) => ({
  id: s.id,
  use: s.use,
  tactic: s.tactic,
  pair_id: s.pair_id,
  form: s.form,
}));

export interface AdminDataset {
  mode: 'live' | 'sample';
  participants: ParticipantRow[];
  attempts: AttemptRow[];
  responses: ResponseRow[];
}

/** Live data when Supabase is connected, otherwise clearly-labelled sample data so the dashboard can be previewed. */
export async function loadAdminDataset(): Promise<AdminDataset> {
  if (supabaseConfigured()) {
    const [participants, attempts, responses] = await Promise.all([
      fetchTable<ParticipantRow>('participants'),
      fetchTable<AttemptRow>('attempts'),
      fetchTable<ResponseRow>('responses'),
    ]);
    return { mode: 'live', participants, attempts, responses };
  }
  return { mode: 'sample', ...buildSampleData(SCENARIO_META) };
}
