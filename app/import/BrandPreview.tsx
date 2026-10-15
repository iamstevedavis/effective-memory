"use client";
import { useEffect, useState } from "react";
export default function BrandPreview(props: { primary: string; secondary: string; quoteSize: string; tone: string }) {
  const [src, setSrc] = useState(""), [error, setError] = useState("");
  const { primary, secondary, quoteSize, tone } = props;
  useEffect(() => {
    const controller = new AbortController();
    let url = "";
    const timer = setTimeout(async () => {
      try {
        const response = await fetch("/api/branding/preview", { method: "POST", signal: controller.signal,
          headers: { "Content-Type": "application/json" }, body: JSON.stringify({ brandTone: tone,
            brandColors: { primary, secondary, template: "quote-card-v1", quoteSize } }) });
        if (!response.ok) throw new Error("Preview unavailable. Check settings or sign in.");
        url = URL.createObjectURL(await response.blob()); setSrc(url); setError("");
      } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Preview failed"); }
    }, 400);
    return () => { clearTimeout(timer); controller.abort(); if (url) URL.revokeObjectURL(url); };
  }, [primary, secondary, quoteSize, tone]);
  return <div><p>Quote card v1 · foreground contrast is adjusted automatically. Changes apply on explicit generation only.</p>
    {error ? <p role="alert">{error}</p> : src ? <img src={src} width={300} height={300} alt="Synthetic quote preview of selected brand settings" /> : <p>Preparing sample…</p>}</div>;
}
