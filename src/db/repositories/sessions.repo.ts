import type { SessionPlan } from '@/engine/models';
import { getDb, type SessionRow, type SessionStatus } from '../schema';

export async function insertSession(
  plan: SessionPlan,
  status: SessionStatus = 'planned',
): Promise<number> {
  const id = await getDb().sessions.add({
    seance_date: plan.seance_date,
    week_in_cycle: plan.week_in_cycle,
    cycle_index: plan.cycle_index,
    plan,
    status,
    created_at: new Date().toISOString(),
  });
  return Number(id);
}

export async function setSessionStatus(id: number, status: SessionStatus): Promise<void> {
  await getDb().sessions.update(id, { status });
}

export async function getSession(id: number): Promise<SessionRow | undefined> {
  return getDb().sessions.get(id);
}

export async function listSessionsByCycle(cycle_index: number): Promise<SessionRow[]> {
  return getDb().sessions.where('cycle_index').equals(cycle_index).sortBy('seance_date');
}

export async function listAllSessions(): Promise<SessionRow[]> {
  return getDb().sessions.orderBy('seance_date').toArray();
}

export async function findLatestPlannedByDate(date: string): Promise<SessionRow | undefined> {
  const matches = await getDb().sessions.where('seance_date').equals(date).toArray();
  return matches.find((s) => s.status === 'planned');
}
