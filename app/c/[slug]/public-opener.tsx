"use client";

import { useState, useEffect } from "react";
import type { CSSProperties } from "react";

type OpenerButton = {
  label?: string;
  action?: "open_card" | "call" | "sms" | "email" | "url";
  url?: string;
};

type TypographySettings = {
  font_family?: string;
  font_size?: number;
  color?: string;
  alignment?: "left" | "center" | "right" | "justify";
  font_weight?: number;
  italic?: boolean;
  letter_spacing?: number;
  line_height?: number;
};

export type OpenerContent = {
  digital_product?: string;
  splash_mode?: "standard" | "animation" | "video";
  title?: string;
  subtitle?: string;
  typography?: TypographySettings;
  background_color?: string;
  accent_color?: string;
  text_color?: string;
  background_image_url?: string;
  background_video_url?: string;
  duration_seconds?: number;
  open_animation?: string;
  close_animation?: string;
  transition_effect?: string;
  video_muted?: boolean;
  video_loop?: boolean;
  video_fit?: "cover" | "contain";
  buttons?: OpenerButton[];
};

export type PublicCard = {
  id: string;
  primary_phone?: string | null;
  sms_phone?: string | null;
  primary_email?: string | null;
  display_name?: string | null;
  card_name?: string | null;
  background_color?: string | null;
  text_color?: string | null;
  accent_color?: string | null;
};

function safeHref(url?: string | null) {
  if (!url) return "#";
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^\//.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function buttonHref(button: OpenerButton, card: PublicCard) {
  if (button.action === "call") return `tel:${button.url || card.primary_phone || ""}`;
  if (button.action === "sms") return `sms:${button.url || card.sms_phone || card.primary_phone || ""}`;
  if (button.action === "email") return `mailto:${button.url || card.primary_email || ""}`;
  if (button.action === "url") return safeHref(button.url);
  return null; // open_card — handled via onClick
}

// CSS keyframes for each named animation
const OPEN_KEYFRAMES: Record<string, string> = {
  fade_up:    "from{opacity:0;transform:translateY(18px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)}",
  fade_in:    "from{opacity:0}to{opacity:1}",
  zoom_in:    "from{opacity:0;transform:scale(.85)}to{opacity:1;transform:scale(1)}",
  slide_up:   "from{opacity:0;transform:translateY(60px)}to{opacity:1;transform:translateY(0)}",
  slide_down: "from{opacity:0;transform:translateY(-60px)}to{opacity:1;transform:translateY(0)}",
  slide_left: "from{opacity:0;transform:translateX(60px)}to{opacity:1;transform:translateX(0)}",
  slide_right:"from{opacity:0;transform:translateX(-60px)}to{opacity:1;transform:translateX(0)}",
  flip_in:    "from{opacity:0;transform:perspective(600px) rotateY(-90deg)}to{opacity:1;transform:perspective(600px) rotateY(0)}",
  bounce_in:  "0%{opacity:0;transform:scale(.5)}70%{transform:scale(1.08)}100%{opacity:1;transform:scale(1)}",
};

const CLOSE_KEYFRAMES: Record<string, string> = {
  fade_out:   "from{opacity:1}to{opacity:0;visibility:hidden;pointer-events:none}",
  zoom_out:   "from{opacity:1;transform:scale(1)}to{opacity:0;transform:scale(.85);visibility:hidden;pointer-events:none}",
  slide_up:   "from{opacity:1;transform:translateY(0)}to{opacity:0;transform:translateY(-60px);visibility:hidden;pointer-events:none}",
  slide_down: "from{opacity:1;transform:translateY(0)}to{opacity:0;transform:translateY(60px);visibility:hidden;pointer-events:none}",
  slide_left: "from{opacity:1;transform:translateX(0)}to{opacity:0;transform:translateX(-60px);visibility:hidden;pointer-events:none}",
  slide_right:"from{opacity:1;transform:translateX(0)}to{opacity:0;transform:translateX(60px);visibility:hidden;pointer-events:none}",
  flip_out:   "from{opacity:1;transform:perspective(600px) rotateY(0)}to{opacity:0;transform:perspective(600px) rotateY(90deg);visibility:hidden;pointer-events:none}",
  dissolve:   "from{opacity:1;filter:blur(0)}to{opacity:0;filter:blur(12px);visibility:hidden;pointer-events:none}",
};

function animCss(openAnim: string, closeAnim: string, durationSec: number): string {
  const openKf   = OPEN_KEYFRAMES[openAnim]   || OPEN_KEYFRAMES.fade_up!;
  const closeKf  = CLOSE_KEYFRAMES[closeAnim] || CLOSE_KEYFRAMES.fade_out!;
  return `
    @keyframes _opener_open  { ${openKf}  }
    @keyframes _opener_close { ${closeKf} }
    @keyframes _overlay_close { from{opacity:1;pointer-events:auto}to{opacity:0;visibility:hidden;pointer-events:none} }
    ._opener_content { animation: _opener_open  650ms ease both; }
    ._opener_overlay { animation: _overlay_close 450ms ease ${durationSec}s forwards; }
    ._opener_overlay.dismissed { animation: _overlay_close 350ms ease forwards !important; }
    ._opener_overlay.dismissed ._opener_content { animation: _opener_close 350ms ease both !important; }
  `;
}

export function PublicOpener({
  content: rawContent,
  card,
  publicUrl,
}: {
  content: OpenerContent;
  card: PublicCard;
  publicUrl: string;
}) {
  const content: OpenerContent = rawContent;
  const [dismissed, setDismissed] = useState(false);

  const duration    = Math.max(1, Math.min(60, Number(content.duration_seconds || 7)));
  const openAnim    = content.open_animation  || "fade_up";
  const closeAnim   = content.close_animation || "fade_out";
  const splashMode  = content.splash_mode || "standard";
  const isVideoMode = splashMode === "video";
  const hasVideo    = !!content.background_video_url;

  const bgImage = content.background_image_url
    ? `linear-gradient(rgba(0,0,0,.38),rgba(0,0,0,.38)),url(${content.background_image_url})`
    : undefined;

  const typo = content.typography || {};
  const fontSize   = Number(typo.font_size   || 44);
  const fontWeight = Number(typo.font_weight || 700);
  const textAlign  = (typo.alignment || "center") as CSSProperties["textAlign"];
  const lineHeight = typo.line_height ? String(typo.line_height) : "1.15";
  const letterSpacing = typo.letter_spacing ? `${typo.letter_spacing}em` : undefined;
  const textColor  = content.text_color || card.text_color || "#f7fff2";
  const accentColor = content.accent_color || card.accent_color || "#a3e635";

  const overlayStyle: CSSProperties = {
    background: isVideoMode ? "#000" : (content.background_color || card.background_color || "#07130b"),
    color: textColor,
    backgroundImage: isVideoMode ? undefined : bgImage,
    backgroundSize: "cover",
    backgroundPosition: "center",
  };

  function dismiss() {
    setDismissed(true);
    // scroll to card after animation completes
    setTimeout(() => {
      document.getElementById("card")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 380);
  }

  // Auto-dismiss after duration
  useEffect(() => {
    const t = setTimeout(dismiss, duration * 1000);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration]);

  if (dismissed) return null;

  return (
    <>
      <style>{animCss(openAnim, closeAnim, duration)}</style>
      <div
        className={`_opener_overlay fixed inset-0 z-50 grid place-items-center overflow-hidden px-5${dismissed ? " dismissed" : ""}`}
        style={overlayStyle}
        onClick={isVideoMode ? dismiss : undefined}
      >
        {/* Background video */}
        {hasVideo && (
          <video
            className="absolute inset-0 h-full w-full"
            style={{ objectFit: content.video_fit || "cover", opacity: isVideoMode ? 1 : 0.45 }}
            src={content.background_video_url!}
            autoPlay
            muted={content.video_muted !== false}
            playsInline
            loop={content.video_loop !== false}
          />
        )}

        {/* Content overlay */}
        <div
          className="_opener_content relative z-10 mx-auto w-full max-w-lg"
          style={{ textAlign, fontFamily: typo.font_family || undefined, letterSpacing }}
        >
          {/* Standard + Animation mode: show title/subtitle */}
          {!isVideoMode && (
            <>
              <div className="text-xs uppercase tracking-[0.35em] opacity-70">Digital card</div>
              <h1
                className="mt-5 tracking-tight"
                style={{ fontSize, fontWeight, lineHeight, color: textColor }}
              >
                {content.title || card.display_name || card.card_name}
              </h1>
              <p
                className="mx-auto mt-4 max-w-md opacity-80"
                style={{ fontSize: Math.max(14, fontSize * 0.38), lineHeight }}
              >
                {content.subtitle || `Connect with ${card.display_name || card.card_name}`}
              </p>
            </>
          )}

          {/* Video mode: minimal label */}
          {isVideoMode && (
            <div className="mb-6 text-center text-sm font-semibold uppercase tracking-[0.3em] opacity-80" style={{ color: textColor }}>
              {content.title || card.display_name || "Tap to view card"}
            </div>
          )}

          {/* Buttons */}
          <div className={`grid gap-3 sm:grid-cols-2 ${isVideoMode ? "mt-0" : "mt-8"}`}>
            {(content.buttons || []).slice(0, 2).map((button, index) => {
              const href = buttonHref(button, card);
              const label = button.label || (index === 0 ? "View card" : "Contact");
              const cls = "block rounded-2xl border border-white/20 bg-white/10 px-5 py-3 text-center text-sm font-semibold backdrop-blur transition-opacity hover:opacity-80 active:opacity-60 cursor-pointer select-none";
              if (!href || button.action === "open_card") {
                return (
                  <button key={index} type="button" className={cls} style={{ color: accentColor }} onClick={dismiss}>
                    {label}
                  </button>
                );
              }
              return (
                <a key={index} href={href} className={cls} style={{ color: accentColor }} onClick={dismiss}>
                  {label}
                </a>
              );
            })}
          </div>

          {!isVideoMode && (
            <div className="mt-5 text-xs opacity-50" style={{ textAlign }}>{publicUrl}</div>
          )}

          {isVideoMode && (
            <div className="mt-4 text-center text-[11px] opacity-40" style={{ color: textColor }}>Tap anywhere to continue</div>
          )}
        </div>
      </div>
    </>
  );
}
