"use client";

import { useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";

export default function QRShare({ joinUrl }: { joinUrl: string }) {
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  async function shareAsImage() {
    const canvas = canvasWrapRef.current?.querySelector("canvas");
    if (!canvas) return;

    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], "two-for-tonight-invite.png", { type: "image/png" });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: "Pick tonight's movie with me",
            text: `Join my session on Two for Tonight: ${joinUrl}`,
          });
          return;
        } catch {
          // user cancelled — fall through to link share
        }
      }
      if (navigator.share) {
        await navigator.share({ title: "Two for Tonight", url: joinUrl }).catch(() => {});
      } else {
        copyLink();
      }
    });
  }

  function copyLink() {
    navigator.clipboard.writeText(joinUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="flex flex-col items-center gap-5">
      <div
        ref={canvasWrapRef}
        className="bg-paper p-5 rounded-2xl shadow-card"
      >
        <QRCodeCanvas value={joinUrl} size={220} bgColor="#F4F1E9" fgColor="#131218" level="M" />
      </div>

      <div className="flex flex-col gap-2 w-full max-w-xs">
        <button
          onClick={shareAsImage}
          className="bg-marquee text-ink font-semibold rounded-xl py-3.5 w-full"
        >
          Send to their phone
        </button>
        <button
          onClick={copyLink}
          className="bg-transparent border border-paper/20 text-paper/90 font-medium rounded-xl py-3.5 w-full"
        >
          {copied ? "Link copied" : "Or copy the link"}
        </button>
      </div>
    </div>
  );
}
