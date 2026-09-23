"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import PreferenceForm from "@/components/PreferenceForm";
import QRShare from "@/components/QRShare";
import SwipeDeck from "@/components/SwipeDeck";
import MatchCelebration from "@/components/MatchCelebration";
import { WaitingRoom, FinalCall } from "@/components/StatusScreens";
import { supabaseBrowser } from "@/lib/supabase";
import { getOrCreatePartnerId, getRoleForSession, storeRoleForSession } from "@/lib/client";
import type { PooledTitle, PreferenceProfile, Role, SessionRecord } from "@/lib/types";

type PartnerRow = { role: Role; submitted_at: string | null };

export default function SessionPage({ params }: { params: { id: string } }) {
  const sessionId = params.id;
  const [role, setRole] = useState<Role | null | "resolving">("resolving");
  const [session, setSession] = useState<SessionRecord | null>(null);
  const [partners, setPartners] = useState<PartnerRow[]>([]);
  const [pool, setPool] = useState<PooledTitle[]>([]);
  const [allPool, setAllPool] = useState<PooledTitle[]>([]);
  const [submittingPrefs, setSubmittingPrefs] = useState(false);
  const [finalCandidates, setFinalCandidates] = useState<(PooledTitle & { score: number })[] | null>(
    null
  );
  const swipedThisMount = useRef<Set<number>>(new Set());

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/session/${sessionId}`);
    if (!res.ok) return;
    const data = await res.json();
    setSession(data.session);
    setPartners(data.partners);
    setPool(data.pool);
    setAllPool(data.allPool);
  }, [sessionId]);

  // Resolve role: existing localStorage role, else attempt to join as B.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const existing = getRoleForSession(sessionId);
      if (existing) {
        if (!cancelled) setRole(existing);
        return;
      }
      const partnerId = getOrCreatePartnerId();
      const res = await fetch(`/api/session/${sessionId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partnerId }),
      });
      if (cancelled) return;
      if (res.ok) {
        storeRoleForSession(sessionId, "B");
        setRole("B");
      } else {
        setRole(null); // dead/invalid link
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  useEffect(() => {
    if (role === "resolving" || role === null) return;
    refresh();
  }, [role, refresh]);

  // Realtime: react instantly to status changes (partner joined, pool ready, match).
  useEffect(() => {
    if (role === "resolving" || role === null) return;
    const client = supabaseBrowser();
    const channel = client
      .channel(`session-${sessionId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sessions", filter: `id=eq.${sessionId}` },
        () => refresh()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "session_partners", filter: `session_id=eq.${sessionId}` },
        () => refresh()
      )
      .subscribe();
    return () => {
      client.removeChannel(channel);
    };
  }, [sessionId, role, refresh]);

  useEffect(() => {
    if (session?.status === "final_call" && !finalCandidates) {
      fetch(`/api/session/${sessionId}/final-candidates`)
        .then((r) => r.json())
        .then((d) => setFinalCandidates(d.candidates));
    }
  }, [session?.status, sessionId, finalCandidates]);

  if (role === "resolving" || !session) {
    return <WaitingRoom message="Loading your session…" />;
  }
  if (role === null) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 text-center">
        <p className="text-paper/70">
          This invite link looks invalid or expired. Ask your partner to send a fresh one.
        </p>
      </div>
    );
  }

  const me = partners.find((p) => p.role === role);
  const other = partners.find((p) => p.role !== role);
  const iHaveSubmitted = !!me?.submitted_at;

  async function submitPreferences(preferences: PreferenceProfile) {
    setSubmittingPrefs(true);
    await fetch(`/api/session/${sessionId}/preferences`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, preferences }),
    });
    setSubmittingPrefs(false);
    refresh();
  }

  // Partner A hasn't set prefs at all only happens if they landed here via a
  // stale tab before submitting on the home page — treat the same as B.
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  if (partners.length < 2 && role === "A") {
    return <QRShare joinUrl={`${origin}/session/${sessionId}`} />;
  }

  if (!iHaveSubmitted) {
    return (
      <PreferenceForm
        who={role === "A" ? "You" : "Your turn"}
        onSubmit={submitPreferences}
        submitting={submittingPrefs}
      />
    );
  }

  if (session.status === "waiting_for_b" || (partners.length < 2 && role === "A")) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 py-10">
        <p className="text-mist text-sm mb-6">Send this to your partner</p>
        <QRShare joinUrl={`${origin}/session/${sessionId}`} />
      </div>
    );
  }

  if (session.status === "waiting_for_prefs" && !other?.submitted_at) {
    return <WaitingRoom message="Waiting for your partner to finish their picks…" />;
  }

  if (session.status === "building_pool") {
    return (
      <WaitingRoom
        message={
          session.round === 1
            ? "Finding 30 titles you'll both actually like…"
            : "Refining the picks based on what you both leaned toward…"
        }
      />
    );
  }

  if (session.status === "swiping") {
    if (pool.length === 0) {
      return <WaitingRoom message="Putting the deck together…" />;
    }
    return (
      <div className="min-h-screen flex flex-col items-center justify-center py-10">
        <p className="text-mist text-sm mb-6">
          Round {session.round} · swipe right if you'd watch it tonight
        </p>
        <SwipeDeck
          titles={pool}
          onSwipe={(title, direction) => {
            if (swipedThisMount.current.has(title.tmdb_id)) return;
            swipedThisMount.current.add(title.tmdb_id);
            fetch(`/api/session/${sessionId}/swipe`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                role,
                tmdbId: title.tmdb_id,
                mediaType: title.media_type,
                direction,
                round: session.round,
              }),
            }).then((r) => r.json().then((d) => d.matched && refresh()));
          }}
          onDeckFinished={() => {
            // The server determines what happens next; poll once shortly
            // after in case realtime lags on the very last swipe.
            setTimeout(refresh, 1200);
          }}
        />
      </div>
    );
  }

  if (session.status === "final_call") {
    if (!finalCandidates) return <WaitingRoom message="Tallying up the votes…" />;
    return (
      <FinalCall
        candidates={finalCandidates}
        onPick={(title) => {
          fetch(`/api/session/${sessionId}/final-pick`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tmdbId: title.tmdb_id, mediaType: title.media_type }),
          }).then(refresh);
        }}
      />
    );
  }

  if (session.status === "matched" || session.status === "completed") {
    const matchedTitle = allPool.find((t) => t.tmdb_id === session.matched_tmdb_id);
    if (!matchedTitle) return <WaitingRoom message="Loading your match…" />;
    return (
      <MatchCelebration
        title={matchedTitle}
        sessionId={sessionId}
        onRate={(score) => {
          fetch(`/api/session/${sessionId}/rate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tmdbId: matchedTitle.tmdb_id,
              mediaType: matchedTitle.media_type,
              score,
            }),
          });
        }}
      />
    );
  }

  return <WaitingRoom message="One second…" />;
}
