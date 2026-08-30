/**
 * Minimal shape every SSE-streamed agent-progress event satisfies, regardless
 * of which entity it's about (campaign or business). Components that only
 * render progress (e.g. ActivityFeed) should accept this instead of a
 * feature-specific event type, so they work for any stream without a cast.
 */
export type AgentActivityEvent = {
  id: string;
  event_type: string;
  agent: string | null;
  payload: Record<string, unknown>;
  created_at: string;
};
