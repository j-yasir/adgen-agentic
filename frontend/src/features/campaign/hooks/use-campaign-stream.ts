"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getAccessToken } from "@/shared/lib/api-client";
import type { CampaignEvent, PipelineStage } from "../types";

const BACKOFF_BASE_MS = 1_000;
const BACKOFF_CAP_MS  = 30_000;

function backoff(attempt: number) {
  return Math.min(BACKOFF_CAP_MS, BACKOFF_BASE_MS * 2 ** attempt);
}

export function useCampaignStream(campaignId: string, initialStatus?: string) {
  const [events, setEvents]               = useState<CampaignEvent[]>([]);
  const [currentAgent, setCurrentAgent]   = useState<string | null>(null);
  const [hitlData, setHitlData]           = useState<Record<string, unknown> | null>(null);
  const [pipelineStage, setPipelineStage] = useState<PipelineStage>(
    (initialStatus as PipelineStage) ?? "pending"
  );

  const lastSeqRef   = useRef(0);
  const sourceRef    = useRef<EventSource | null>(null);
  const retriesRef   = useRef(0);
  const stoppedRef   = useRef(false);
  const timerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track whether we ever opened a connection so initialStatus can't
  // re-trigger a full reset on every status change (e.g. awaiting_review → running).
  const connectedRef = useRef(false);

  const handleEvent = useCallback((evt: CampaignEvent) => {
    if (evt.seq) lastSeqRef.current = evt.seq;

    setEvents((prev) => {
      if (evt.seq && prev.some((e) => e.seq === evt.seq)) return prev;
      return [...prev, evt];
    });

    switch (evt.event_type) {
      case "agent_started":
        setCurrentAgent(evt.agent);
        if (evt.agent && evt.agent !== "orchestrator") {
          setPipelineStage(evt.agent as PipelineStage);
        }
        setHitlData(null);
        break;
      case "agent_completed":
        setCurrentAgent(null);
        break;
      case "hitl_required":
        setHitlData(evt.payload);
        setPipelineStage("awaiting_review");
        break;
      case "campaign_done":
        setPipelineStage("completed");
        setCurrentAgent(null);
        setHitlData(null);
        stoppedRef.current = true;
        sourceRef.current?.close();
        break;
      case "campaign_failed":
        // NOT terminal — campaign may be retried and produce more events.
        setPipelineStage("failed");
        setCurrentAgent(null);
        break;
    }
  }, []);

  const connect = useCallback(() => {
    if (stoppedRef.current) return;

    sourceRef.current?.close();

    // Connect directly to the FastAPI backend to bypass the Next.js dev-server
    // proxy, which buffers streaming responses and prevents SSE events from
    // arriving until the buffer fills (Turbopack issue).
    const base  = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";
    const token = getAccessToken();
    const url   = `${base}/stream/campaigns/${campaignId}?after_seq=${lastSeqRef.current}${token ? `&token=${token}` : ""}`;
    const source = new EventSource(url);
    sourceRef.current = source;

    source.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === "heartbeat") return;
        retriesRef.current = 0;
        handleEvent(data as CampaignEvent);
      } catch {
        // ignore parse errors
      }
    };

    source.onerror = () => {
      source.close();
      if (stoppedRef.current) return;
      const delay = backoff(retriesRef.current);
      retriesRef.current += 1;
      timerRef.current = setTimeout(() => {
        if (!stoppedRef.current) connect();
      }, delay);
    };
  }, [campaignId, handleEvent]);

  // Only re-initialize for campaignId changes (real navigation) or
  // for the very first mount. initialStatus changes between running
  // states (e.g. awaiting_review → running) must NOT cause a full
  // reconnect that would reset lastSeqRef to 0.
  useEffect(() => {
    // If already connected for this campaign, only stop if status
    // becomes "done" — otherwise keep the existing connection.
    if (connectedRef.current) {
      if (initialStatus === "done") {
        stoppedRef.current = true;
        if (timerRef.current) clearTimeout(timerRef.current);
        sourceRef.current?.close();
        setPipelineStage("completed");
      }
      return;
    }

    // First mount for this campaignId.
    stoppedRef.current   = false;
    retriesRef.current   = 0;
    connectedRef.current = false;

    if (!campaignId || initialStatus === "done") {
      if (initialStatus === "done") setPipelineStage("completed");
      return;
    }

    connectedRef.current = true;
    connect();

    return () => {
      stoppedRef.current   = true;
      connectedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      sourceRef.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]); // campaignId only — not initialStatus, not connect

  // Force reconnect on explicit retry (retryEpoch changes externally via
  // the forceConnect helper below).
  const forceConnect = useCallback(() => {
    if (stoppedRef.current) return;
    // Don't reset lastSeqRef — we want to replay from current position.
    connect();
  }, [connect]);

  const clearHitl = useCallback(() => setHitlData(null), []);

  return { events, currentAgent, hitlData, pipelineStage, clearHitl, forceConnect };
}
