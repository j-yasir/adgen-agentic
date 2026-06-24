"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getAccessToken } from "@/shared/lib/api-client";
import type { CampaignEvent, PipelineStage } from "../types";

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 3000;

export function useCampaignStream(campaignId: string, initialStatus?: string) {
  const [events, setEvents] = useState<CampaignEvent[]>([]);
  const [currentAgent, setCurrentAgent] = useState<string | null>(null);
  const [hitlData, setHitlData] = useState<Record<string, unknown> | null>(null);
  const [pipelineStage, setPipelineStage] = useState<PipelineStage>(
    (initialStatus as PipelineStage) ?? "pending"
  );
  const lastSeqRef = useRef(0);
  const sourceRef = useRef<EventSource | null>(null);
  const retriesRef = useRef(0);
  const stoppedRef = useRef(false);

  const connect = useCallback(() => {
    if (stoppedRef.current) return null;

    if (sourceRef.current) {
      sourceRef.current.close();
    }

    const token = getAccessToken();
    const url = `/api/v1/stream/campaigns/${campaignId}?after_seq=${lastSeqRef.current}${token ? `&token=${token}` : ""}`;

    const source = new EventSource(url);
    sourceRef.current = source;

    source.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data);

        if (event.type === "heartbeat") return;

        retriesRef.current = 0;

        const evt = event as CampaignEvent;
        if (evt.seq) {
          lastSeqRef.current = evt.seq;
        }

        setEvents((prev) => [...prev, evt]);

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
            source.close();
            break;
          case "campaign_failed":
            setPipelineStage("failed");
            setCurrentAgent(null);
            stoppedRef.current = true;
            source.close();
            break;
        }
      } catch {
        // ignore parse errors
      }
    };

    source.onerror = () => {
      source.close();
      retriesRef.current += 1;

      if (retriesRef.current > MAX_RETRIES || stoppedRef.current) {
        return;
      }

      setTimeout(() => {
        connect();
      }, RETRY_DELAY_MS);
    };

    return source;
  }, [campaignId]);

  useEffect(() => {
    stoppedRef.current = false;
    retriesRef.current = 0;

    if (
      !campaignId ||
      initialStatus === "done" ||
      initialStatus === "failed"
    ) {
      if (initialStatus === "done") setPipelineStage("completed");
      if (initialStatus === "failed") setPipelineStage("failed");
      return;
    }

    const source = connect();
    return () => {
      stoppedRef.current = true;
      source?.close();
    };
  }, [campaignId, initialStatus, connect]);

  const clearHitl = useCallback(() => setHitlData(null), []);

  return {
    events,
    currentAgent,
    hitlData,
    pipelineStage,
    clearHitl,
  };
}
