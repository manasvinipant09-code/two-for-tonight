"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PreferenceForm from "@/components/PreferenceForm";
import { getOrCreatePartnerId, storeRoleForSession } from "@/lib/client";
import type { PreferenceProfile } from "@/lib/types";

export default function Home() {
  const router = useRouter();
  const [started, setStarted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(preferences: PreferenceProfile) {
    setSubmitting(true);
    const partnerId = getOrCreatePartnerId();
    const res = await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ preferences, partnerId }),
    });
    const data = await res.json();
    if (data.session?.id) {
      storeRoleForSession(data.session.id, "A");
      router.push(`/session/${data.session.id}`);
    } else {
      setSubmitting(false);
    }
  }

  if (started) {
    return <PreferenceForm who="You" onSubmit={handleSubmit} submitting={submitting} />;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <p className="uppercase tracking-[0.3em] text-xs text-marquee mb-4">Two for Tonight</p>
      <h1 className="font-display text-4xl sm:text-5xl leading-[1.1] mb-4 max-w-md">
        Stop scrolling.
        <br />
        Stop negotiating.
      </h1>
      <p className="text-paper/70 max-w-xs mb-10 text-sm leading-relaxed">
        Set your mood, send one QR code, and swipe until you both land on something worth
        watching — right now, on whatever you're already paying for.
      </p>
      <button
        onClick={() => setStarted(true)}
        className="bg-marquee text-ink font-semibold rounded-xl px-8 py-4"
      >
        Start tonight's pick
      </button>
    </div>
  );
}
