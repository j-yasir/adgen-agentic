"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getAccessToken } from "@/shared/lib/api-client";
import type { AgentActivityEvent } from "@/shared/types";

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 3000;

export type OnboardingStreamStatus = "connecting" | "running" | "ready" | "failed";

/**
 * Same mechanics as useCampaignStream (features/campaign/hooks) — EventSource
 * against the SSE endpoint, ?token= auth, reconnect-with-backoff on error —
 * just pointed at /stream/businesses/{id} and with the two terminal events
 * this pipeline actually has (business_ready / business_failed) instead of
 * campaign_done / campaign_failed.
 */
export function useBusinessOnboardingStream(businessId: string | null) {
  const [events, setEvents] = useState<AgentActivityEvent[]>([]);
  const [status, setStatus] = useState<OnboardingStreamStatus>("connecting");
  const [error, setError] = useState<string | null>(null);
  const lastSeqRef = useRef(0);
  const sourceRef = useRef<EventSource | null>(null);
  const retriesRef = useRef(0);
  const stoppedRef = useRef(false);

  const connect = useCallback(() => {
    if (stoppedRef.current || !businessId) return null;

    if (sourceRef.current) {
      sourceRef.current.close();
    }

    const token = getAccessToken();
    const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";
    const url = `${base}/stream/businesses/${businessId}?after_seq=${lastSeqRef.current}${token ? `&token=${token}` : ""}`;

    const source = new EventSource(url);
    sourceRef.current = source;

    source.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data);

        if (event.type === "heartbeat") return;

        retriesRef.current = 0;

        if (event.seq) {
          lastSeqRef.current = event.seq;
        }

        setEvents((prev) => [...prev, event as AgentActivityEvent]);
        setStatus("running");

        if (event.event_type === "business_ready") {
          setStatus("ready");
          stoppedRef.current = true;
          source.close();
        } else if (event.event_type === "business_failed") {
          const payloadError = event.payload?.error;
          setError(typeof payloadError === "string" ? payloadError : "Onboarding failed");
          setStatus("failed");
          stoppedRef.current = true;
          source.close();
        }
      } catch {
        // ignore parse errors
      }
    };

    source.onerror = () => {
      source.close();
      retriesRef.current += 1;

      if (retriesRef.current > MAX_RETRIES || stoppedRef.current) {
        if (!stoppedRef.current) {
          setStatus("failed");
          setError("Lost connection to the server");
        }
        return;
      }

      setTimeout(() => {
        connect();
      }, RETRY_DELAY_MS);
    };

    return source;
  }, [businessId]);

  useEffect(() => {
    stoppedRef.current = false;
    retriesRef.current = 0;
    lastSeqRef.current = 0;
    setEvents([]);
    setError(null);
    setStatus("connecting");

    if (!businessId) return;

    const source = connect();
    return () => {
      stoppedRef.current = true;
      source?.close();
    };
  }, [businessId, connect]);

  return { events, status, error };
}
