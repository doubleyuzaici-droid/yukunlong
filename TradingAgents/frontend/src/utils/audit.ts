export interface AuditEvent {
  id: string;
  action: string;
  target?: string;
  detail?: string;
  created_at: string;
}

const KEY = "tradingagents.auditEvents";

export function listAuditEvents(): AuditEvent[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function recordAuditEvent(action: string, target?: string, detail?: string) {
  const event: AuditEvent = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    action,
    target,
    detail,
    created_at: new Date().toISOString(),
  };
  const events = [event, ...listAuditEvents()].slice(0, 200);
  window.localStorage.setItem(KEY, JSON.stringify(events));
  return event;
}
