import type { SessionFeedback } from '@/engine/models';
import { getDb, type FeedbackRow } from '../schema';

export async function insertFeedback(
  feedback: SessionFeedback,
  session_id: number | null = null,
): Promise<number> {
  const id = await getDb().feedbacks.add({
    session_id,
    seance_date: feedback.seance_date,
    cycle_index: feedback.cycle_index,
    week_in_cycle: feedback.week_in_cycle,
    feedback,
    created_at: new Date().toISOString(),
  });
  return Number(id);
}

export async function listAllFeedbacks(): Promise<FeedbackRow[]> {
  return getDb().feedbacks.orderBy('seance_date').toArray();
}

export async function listFeedbacksByCycle(cycle_index: number): Promise<FeedbackRow[]> {
  return getDb().feedbacks.where('cycle_index').equals(cycle_index).sortBy('seance_date');
}

export async function getFeedbackForSession(session_id: number): Promise<FeedbackRow | undefined> {
  return getDb().feedbacks.where('session_id').equals(session_id).first();
}
