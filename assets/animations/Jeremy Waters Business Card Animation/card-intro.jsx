/* card-intro.jsx — Jeremy Waters digital business card intro.
   Vertical 1080x1920 cinematic timeline. Reads engine globals from window
   (animations.jsx loads first via the x-import `from` order). */

const { Stage, Sprite, useTime, useSprite, Easing, interpolate, animate, clamp } = window;

const DISPLAY = "'Space Grotesk', system-ui, sans-serif";
const TEXT = "'Manrope', system-ui, sans-serif";

// ── Theme ───────────────────────────────────────────────────────────────────
function getTheme(mode) {
  if (mode === 'light') {
    return {
      mode: 'light',
      bg: '#EAF0E1',
      bg2: '#DCE6CF',
      glowA: 'rgba(124,179,40,0.20)',
      glowB: 'rgba(12,40,26,0.05)',
      panel: '#FFFFFF',
      panelSoft: 'rgba(255,255,255,0.72)',
      panelBorder: 'rgba(12,40,26,0.10)',
      ink: '#0C2818',
      sub: '#3C5A47',
      muted: '#6E8676',
      lime: '#79B81E',
      limeSoft: 'rgba(124,179,40,0.16)',
      accentInk: '#0C2818',
      line: 'rgba(12,40,26,0.12)',
      btnBg: '#0C2818',
      btnInk: '#EAF6D2',
      btnLime: '#C6F24E',
      btnLimeInk: '#0C2818',
    };
  }
  return {
    mode: 'dark',
    bg: '#06140D',
    bg2: '#0B2417',
    glowA: 'rgba(198,242,78,0.16)',
    glowB: 'rgba(13,74,46,0.45)',
    panel: '#0E2A1C',
    panelSoft: 'rgba(18,48,33,0.55)',
    panelBorder: 'rgba(198,242,78,0.18)',
    ink: '#EAF3EC',
    sub: '#A7C4B2',
    muted: '#6E8C7A',
    lime: '#C6F24E',
    limeSoft: 'rgba(198,242,78,0.12)',
    accentInk: '#C6F24E',
    line: 'rgba(198,242,78,0.16)',
    btnBg: '#13301F',
    btnInk: '#EAF3EC',
    btnLime: '#C6F24E',
    btnLimeInk: '#06140D',
  };
}

// ── animation helpers ───────────────────────────────────────────────────────
const ease = Easing;
// fade-in then fade-out window
function lifecycle(lt, dur, inDur = 0.55, outDur = 0.45) {
  const outStart = dur - outDur;
  if (lt < inDur) return ease.easeOutCubic(clamp(lt / inDur, 0, 1));
  if (lt > outStart) return 1 - ease.easeInCubic(clamp((lt - outStart) / outDur, 0, 1));
  return 1;
}
function appear(lt, t0, dur = 0.6, e = ease.easeOutCubic) {
  return e(clamp((lt - t0) / dur, 0, 1));
}

// ── Line icons (24x24 stroke) ───────────────────────────────────────────────
function Icon({ name, size = 28, color = '#fff', stroke = 1.7 }) {
  const P = {
    pen: <><path d="M11 5 16 3l5 5-2 5" /><path d="M16 8 5 19l-2 2 1-4L13 6" /><path d="m5 19 0 0" /></>,
    layers: <><path d="M12 3 3 8l9 5 9-5-9-5Z" /><path d="m3 13 9 5 9-5" /><path d="m3 18 9 5 9-5" /></>,
    type: <><path d="M5 6V4h14v2" /><path d="M12 4v16" /><path d="M8 20h8" /></>,
    image: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9.5" r="1.6" /><path d="m4 18 5-5 4 4 3-3 4 4" /></>,
    sign: <><path d="M12 3v4" /><path d="M5 7h11l3 2.5L16 12H5Z" /><path d="M5 16h13" /><path d="M12 12v9" /><path d="M9 21h6" /></>,
    monitor: <><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8" /><path d="M12 16v4" /></>,
    gear: <><circle cx="12" cy="12" r="3.2" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" /></>,
    printer: <><path d="M7 9V3h10v6" /><rect x="4" y="9" width="16" height="8" rx="2" /><path d="M7 14h10v6H7z" /><circle cx="17" cy="12" r="0.6" /></>,
    spark: <><path d="M12 3v6M12 15v6M3 12h6M15 12h6" /><path d="m6 6 3 3M15 15l3 3M18 6l-3 3M9 15l-3 3" /></>,
    cpu: <><rect x="6" y="6" width="12" height="12" rx="2" /><rect x="9.5" y="9.5" width="5" height="5" rx="1" /><path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3" /></>,
    diamond: <><path d="M12 2 4 9l8 13 8-13-8-7Z" /><path d="M4 9h16" /><path d="m9 9 3 13M15 9l-3 13" /></>,
    bolt: <><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" /></>,
    grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    bulb: <><path d="M9 18h6" /><path d="M10 21h4" /><path d="M12 3a6 6 0 0 0-4 10.5c.7.8 1 1.5 1 2.5h6c0-1 .3-1.7 1-2.5A6 6 0 0 0 12 3Z" /></>,
    save: <><path d="M5 3h11l3 3v15H5Z" /><path d="M8 3v6h7V3" /><rect x="8" y="13" width="8" height="6" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 9h18M8 3v4M16 3v4" /><circle cx="8" cy="14" r="0.8" /><circle cx="12" cy="14" r="0.8" /><circle cx="16" cy="14" r="0.8" /></>,
    grid2: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 17.5h7M17.5 14v7" /></>,
    link: <><path d="M9 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1 1" /><path d="M15 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1-1" /></>,
    arrow: <><path d="M4 12h15" /><path d="m13 6 6 6-6 6" /></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      {P[name]}
    </svg>
  );
}

// ── Brand wordmark (logo stand-in) ──────────────────────────────────────────
function BrandMark({ t, size = 1, mono = false }) {
  const lime = t.lime, ink = mono ? t.ink : t.ink;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 11 * size }}>
      <div style={{ position: 'relative', width: 30 * size, height: 30 * size }}>
        <svg width={30 * size} height={30 * size} viewBox="0 0 24 24" fill="none"
          stroke={lime} strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="9" opacity="0.45" />
          <circle cx="12" cy="12" r="4" />
          <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
        </svg>
      </div>
      <div style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 19 * size, letterSpacing: '-0.01em', color: t.ink }}>
        control<span style={{ color: lime }}>p</span>
        <span style={{ color: t.muted, fontWeight: 500 }}>.io</span>
      </div>
    </div>
  );
}

// ── Persistent backdrop ─────────────────────────────────────────────────────
function Backdrop({ t }) {
  const time = useTime();
  const driftY = Math.sin(time * 0.18) * 40;
  const driftX = Math.cos(time * 0.13) * 50;
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: t.bg }}>
      <div style={{
        position: 'absolute', inset: -200,
        background: `radial-gradient(60% 42% at ${50 + driftX / 14}% ${26 + driftY / 30}%, ${t.glowA}, transparent 70%),
                     radial-gradient(70% 50% at ${48 - driftX / 16}% ${88 + driftY / 40}%, ${t.glowB}, transparent 72%)`,
      }} />
      {/* faint vertical grid */}
      <div style={{
        position: 'absolute', inset: 0, opacity: t.mode === 'dark' ? 0.5 : 0.4,
        backgroundImage: `repeating-linear-gradient(90deg, ${t.line} 0 1px, transparent 1px 108px)`,
        maskImage: 'radial-gradient(circle at 50% 42%, #000 30%, transparent 86%)',
        WebkitMaskImage: 'radial-gradient(circle at 50% 42%, #000 30%, transparent 86%)',
        transform: `translateY(${driftY * 0.3}px)`,
      }} />
      {/* drifting horizon line */}
      <div style={{
        position: 'absolute', left: 0, right: 0, top: 960 + driftY * 0.5, height: 1,
        background: `linear-gradient(90deg, transparent, ${t.line}, transparent)`, opacity: 0.7,
      }} />
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(140% 90% at 50% 50%, transparent 58%, ${t.mode === 'dark' ? 'rgba(0,0,0,0.5)' : 'rgba(12,40,26,0.06)'})` }} />
    </div>
  );
}

// small kicker label
function Kicker({ t, text, lt, x = 540, y, delay = 0 }) {
  const a = appear(lt, delay, 0.5);
  return (
    <div style={{
      position: 'absolute', left: x, top: y, transform: `translate(-50%, ${(1 - a) * 12}px)`, opacity: a,
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <span style={{ width: 26, height: 1.5, background: t.lime, display: 'block' }} />
      <span style={{ fontFamily: TEXT, fontWeight: 700, fontSize: 19, letterSpacing: '0.32em', textTransform: 'uppercase', color: t.lime }}>{text}</span>
      <span style={{ width: 26, height: 1.5, background: t.lime, display: 'block' }} />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// SCENE 1 — Identity
function SceneIdentity({ t }) {
  const { localTime: lt, duration } = useSprite();
  const op = lifecycle(lt, duration, 0.5, 0.5);
  const brandA = appear(lt, 0.15, 0.6);
  const nameA = appear(lt, 0.55, 0.8, ease.easeOutExpo);
  const lineA = appear(lt, 1.15, 0.9, ease.easeInOutCubic);
  const subA = appear(lt, 1.5, 0.7);
  const words = ['Designer.', 'Builder.', 'Entrepreneur.'];
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: op }}>
      <div style={{ position: 'absolute', left: 540, top: 150, transform: `translate(-50%,${(1 - brandA) * 10}px)`, opacity: brandA }}>
        <BrandMark t={t} size={1.15} />
      </div>

      <div style={{ position: 'absolute', left: 0, right: 0, top: 720, textAlign: 'center' }}>
        <div style={{ fontFamily: TEXT, fontWeight: 700, fontSize: 22, letterSpacing: '0.34em', textTransform: 'uppercase', color: t.lime, opacity: appear(lt, 0.4, 0.6), transform: `translateY(${(1 - appear(lt, 0.4, 0.6)) * 10}px)` }}>
          Digital Business Card
        </div>
        <div style={{
          fontFamily: DISPLAY, fontWeight: 600, fontSize: 132, lineHeight: 1.0, letterSpacing: '-0.03em',
          color: t.ink, marginTop: 30,
          opacity: nameA, transform: `translateY(${(1 - nameA) * 40}px)`,
        }}>
          Jeremy<br />Waters
        </div>
        <div style={{ width: 320, height: 4, margin: '40px auto 0', background: t.lime, transform: `scaleX(${lineA})`, transformOrigin: 'center', borderRadius: 2 }} />
        <div style={{ display: 'flex', justifyContent: 'center', gap: 26, marginTop: 40, opacity: subA }}>
          {words.map((w, i) => {
            const wa = appear(lt, 1.55 + i * 0.16, 0.5);
            return (
              <span key={w} style={{ fontFamily: TEXT, fontWeight: 600, fontSize: 34, color: t.sub, opacity: wa, transform: `translateY(${(1 - wa) * 14}px)` }}>{w}</span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// SCENE 2 — Creative Foundation
function SceneFoundation({ t }) {
  const { localTime: lt, duration } = useSprite();
  const op = lifecycle(lt, duration, 0.5, 0.45);
  const count = Math.round(interpolate([0, 1.4], [0, 30], ease.easeOutExpo)(lt));
  const numA = appear(lt, 0.1, 0.5);
  const tools = [
    { n: 'pen', l: 'Design' }, { n: 'layers', l: 'Branding' }, { n: 'type', l: 'Typography' },
    { n: 'image', l: 'Print' }, { n: 'sign', l: 'Signage' }, { n: 'monitor', l: 'Digital' },
  ];
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: op }}>
      <Kicker t={t} text="Creative Foundation" y={470} lt={lt} delay={0.1} />

      <div style={{ position: 'absolute', left: 540, top: 540, transform: 'translateX(-50%)', textAlign: 'center', opacity: numA }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center' }}>
          <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 230, lineHeight: 0.9, letterSpacing: '-0.04em', color: t.lime }}>{count}</span>
          <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 120, color: t.lime }}>+</span>
        </div>
        <div style={{ fontFamily: TEXT, fontWeight: 700, fontSize: 30, letterSpacing: '0.06em', color: t.ink, marginTop: 6 }}>YEARS OF CRAFT</div>
      </div>

      {/* tool grid */}
      <div style={{ position: 'absolute', left: 90, right: 90, top: 1010, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 26 }}>
        {tools.map((tool, i) => {
          const a = appear(lt, 1.0 + i * 0.13, 0.6, ease.easeOutBack);
          return (
            <div key={tool.l} style={{
              opacity: clamp(a, 0, 1), transform: `translateY(${(1 - a) * 26}px) scale(${0.9 + 0.1 * clamp(a, 0, 1)})`,
              background: t.panelSoft, border: `1.5px solid ${t.panelBorder}`, borderRadius: 22,
              padding: '34px 18px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
              backdropFilter: 'blur(6px)',
            }}>
              <div style={{ width: 66, height: 66, borderRadius: 16, background: t.limeSoft, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={tool.n} size={34} color={t.lime} stroke={1.7} />
              </div>
              <span style={{ fontFamily: TEXT, fontWeight: 600, fontSize: 24, color: t.ink }}>{tool.l}</span>
            </div>
          );
        })}
      </div>

      <div style={{ position: 'absolute', left: 110, right: 110, top: 1500, textAlign: 'center', opacity: appear(lt, 1.9, 0.7), transform: `translateY(${(1 - appear(lt, 1.9, 0.7)) * 16}px)` }}>
        <span style={{ fontFamily: TEXT, fontWeight: 500, fontSize: 38, lineHeight: 1.42, color: t.sub }}>
          Three decades of creative <span style={{ color: t.ink, fontWeight: 700 }}>design, print, branding</span> &amp; digital experience.
        </span>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// SCENE 3 — Business Builder (network)
function SceneNetwork({ t }) {
  const { localTime: lt, duration } = useSprite();
  const op = lifecycle(lt, duration, 0.5, 0.45);
  const cx = 540, cy = 760, R = 320;
  const nodes = [
    { l: 'Qallus', n: 'cpu' }, { l: 'ControlP.io', n: 'printer' }, { l: 'Automation', n: 'gear' },
    { l: 'Web Apps', n: 'monitor' }, { l: 'Signage', n: 'sign' }, { l: 'AI Tools', n: 'spark' },
  ];
  const pos = nodes.map((_, i) => {
    const ang = (-90 + i * 60) * Math.PI / 180;
    return { x: cx + R * Math.cos(ang), y: cy + R * Math.sin(ang) };
  });
  const coreA = appear(lt, 0.2, 0.7, ease.easeOutBack);
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: op }}>
      <Kicker t={t} text="Business Builder" y={300} lt={lt} delay={0.1} />

      <svg width="1080" height="1180" viewBox="0 0 1080 1180" style={{ position: 'absolute', left: 0, top: 180 }}>
        {pos.map((p, i) => {
          const a = appear(lt, 0.5 + i * 0.14, 0.55);
          return (
            <line key={i} x1={cx} y1={cy} x2={cx + (p.x - cx) * a} y2={cy + (p.y - cy) * a}
              stroke={t.lime} strokeWidth="2.5" opacity={(0.55 + 0.35 * a) * (t.mode === 'dark' ? 1 : 0.9)} strokeLinecap="round"
              strokeDasharray="3 9" />
          );
        })}
      </svg>

      {/* core */}
      <div style={{ position: 'absolute', left: cx, top: cy + 180, transform: `translate(-50%,-50%) scale(${coreA})`, opacity: clamp(coreA, 0, 1) }}>
        <div style={{ position: 'relative', width: 168, height: 168, borderRadius: '50%', background: t.lime, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 60px ${t.glowA}` }}>
          <div style={{ position: 'absolute', inset: -14, borderRadius: '50%', border: `2px solid ${t.lime}`, opacity: 0.4 + 0.3 * Math.sin(lt * 3) }} />
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke={t.mode === 'dark' ? '#06140D' : '#0C2818'} strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="4" /><path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
          </svg>
        </div>
      </div>

      {/* satellite nodes */}
      {pos.map((p, i) => {
        const a = appear(lt, 0.7 + i * 0.14, 0.5, ease.easeOutBack);
        return (
          <div key={i} style={{
            position: 'absolute', left: p.x, top: p.y + 180, transform: `translate(-50%,-50%) scale(${clamp(a, 0, 1)})`, opacity: clamp(a, 0, 1),
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
          }}>
            <div style={{ width: 110, height: 110, borderRadius: 28, background: t.panel, border: `1.5px solid ${t.panelBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: t.mode === 'dark' ? 'none' : '0 10px 24px rgba(12,40,26,0.10)' }}>
              <Icon name={nodes[i].n} size={46} color={t.lime} stroke={1.8} />
            </div>
            <span style={{ fontFamily: TEXT, fontWeight: 700, fontSize: 22, color: t.ink, whiteSpace: 'nowrap' }}>{nodes[i].l}</span>
          </div>
        );
      })}

      <div style={{ position: 'absolute', left: 110, right: 110, top: 1430, textAlign: 'center', opacity: appear(lt, 1.8, 0.7), transform: `translateY(${(1 - appear(lt, 1.8, 0.7)) * 16}px)` }}>
        <span style={{ fontFamily: TEXT, fontWeight: 500, fontSize: 38, lineHeight: 1.42, color: t.sub }}>
          Helping businesses connect <span style={{ color: t.ink, fontWeight: 700 }}>ideas, systems</span> &amp; real-world execution.
        </span>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// SCENE 4 — What Jeremy Does (service cards)
function SceneServices({ t }) {
  const { localTime: lt, duration } = useSprite();
  const op = lifecycle(lt, duration, 0.5, 0.45);
  const svc = [
    { n: 'diamond', l: 'Branding', d: 'Identity, logos & visual systems' },
    { n: 'monitor', l: 'Web Design', d: 'Sites & web applications' },
    { n: 'printer', l: 'Print & Signage', d: 'From business cards to billboards' },
    { n: 'gear', l: 'Automation', d: 'Workflows that run themselves' },
    { n: 'cpu', l: 'AI Agents', d: 'Smart tools that do the work' },
    { n: 'grid', l: 'Business Tools', d: 'Systems built for real execution' },
  ];
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: op }}>
      <Kicker t={t} text="What I Do" y={250} lt={lt} delay={0.1} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 300, textAlign: 'center', opacity: appear(lt, 0.25, 0.6), transform: `translateY(${(1 - appear(lt, 0.25, 0.6)) * 14}px)` }}>
        <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 66, letterSpacing: '-0.02em', color: t.ink }}>Services</span>
      </div>

      <div style={{ position: 'absolute', left: 80, right: 80, top: 470, display: 'flex', flexDirection: 'column', gap: 22 }}>
        {svc.map((s, i) => {
          const a = appear(lt, 0.5 + i * 0.16, 0.55, ease.easeOutCubic);
          return (
            <div key={s.l} style={{
              opacity: clamp(a, 0, 1), transform: `translateX(${(1 - a) * 120}px)`,
              display: 'flex', alignItems: 'center', gap: 28,
              background: t.panel, border: `1.5px solid ${t.panelBorder}`, borderRadius: 26,
              padding: '30px 34px', boxShadow: t.mode === 'dark' ? 'none' : '0 12px 30px rgba(12,40,26,0.07)',
            }}>
              <div style={{ flexShrink: 0, width: 84, height: 84, borderRadius: 20, background: t.limeSoft, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={s.n} size={42} color={t.lime} stroke={1.7} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 42, letterSpacing: '-0.01em', color: t.ink }}>{s.l}</div>
                <div style={{ fontFamily: TEXT, fontWeight: 500, fontSize: 25, color: t.muted, marginTop: 4 }}>{s.d}</div>
              </div>
              <div style={{ opacity: 0.5 }}><Icon name="arrow" size={30} color={t.lime} stroke={1.7} /></div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// SCENE 5 — Personal Mission (light turns on)
function SceneMission({ t }) {
  const { localTime: lt, duration } = useSprite();
  const op = lifecycle(lt, duration, 0.5, 0.0); // final scene — hold, no fade-out (cuts to live card)
  const on = appear(lt, 0.7, 0.9, ease.easeOutExpo); // bulb illumination
  const glowPulse = 0.6 + 0.4 * Math.sin(lt * 2.4);
  const rays = 8;
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: op, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', top: 560, left: 540, transform: 'translateX(-50%)' }}>
        {/* glow halo */}
        <div style={{
          position: 'absolute', left: '50%', top: '50%', width: 460, height: 460, transform: 'translate(-50%,-50%)',
          borderRadius: '50%', background: `radial-gradient(circle, ${t.glowA} 0%, transparent 68%)`,
          opacity: on * glowPulse,
        }} />
        {/* rays */}
        <svg width="420" height="420" viewBox="0 0 420 420" style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)' }}>
          {Array.from({ length: rays }).map((_, i) => {
            const ang = (i * 360 / rays) * Math.PI / 180;
            const r1 = 150, r2 = 150 + 46 * on;
            return (
              <line key={i} x1={210 + r1 * Math.cos(ang)} y1={210 + r1 * Math.sin(ang)}
                x2={210 + r2 * Math.cos(ang)} y2={210 + r2 * Math.sin(ang)}
                stroke={t.lime} strokeWidth="4" strokeLinecap="round" opacity={on * 0.8} />
            );
          })}
        </svg>
        {/* bulb */}
        <div style={{ position: 'relative', width: 240, height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', inset: 30, borderRadius: '50% 50% 46% 46%', background: t.lime, opacity: on * 0.9, filter: 'blur(2px)' }} />
          <svg width="170" height="170" viewBox="0 0 24 24" fill="none" stroke={on > 0.4 ? (t.mode === 'dark' ? '#06140D' : '#0C2818') : t.muted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'relative' }}>
            <path d="M9 18h6" /><path d="M10 21h4" />
            <path d="M12 3a6 6 0 0 0-4 10.5c.7.8 1 1.5 1 2.5h6c0-1 .3-1.7 1-2.5A6 6 0 0 0 12 3Z" />
            <path d="M12 9v4" opacity={on} />
          </svg>
        </div>
      </div>

      <div style={{ position: 'absolute', left: 100, right: 100, top: 1080, textAlign: 'center' }}>
        <div style={{ fontFamily: TEXT, fontWeight: 700, fontSize: 22, letterSpacing: '0.32em', textTransform: 'uppercase', color: t.lime, opacity: appear(lt, 1.4, 0.6), marginBottom: 34 }}>The Mission</div>
        <span style={{ fontFamily: DISPLAY, fontWeight: 500, fontSize: 58, lineHeight: 1.28, letterSpacing: '-0.02em', color: t.ink, opacity: appear(lt, 1.6, 0.9), display: 'inline-block', transform: `translateY(${(1 - appear(lt, 1.6, 0.9)) * 22}px)` }}>
          Turning ideas into <span style={{ color: t.lime }}>tools, brands</span> &amp; experiences that move businesses forward.
        </span>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// SCENE 6 — Digital Business Card CTA
function SceneCard({ t }) {
  const { localTime: lt, duration } = useSprite();
  const op = lifecycle(lt, duration, 0.55, 0.3);
  const cardA = appear(lt, 0.15, 0.8, ease.easeOutExpo);
  const photoA = appear(lt, 0.45, 0.7, ease.easeOutBack);
  const btns = [
    { n: 'save', l: 'Save Contact', primary: true },
    { n: 'calendar', l: 'Book a Meeting' },
    { n: 'grid2', l: 'View Services' },
    { n: 'link', l: 'Connect With Me' },
  ];
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: op }}>
      {/* card */}
      <div style={{
        position: 'absolute', left: 70, right: 70, top: 176, bottom: 300,
        background: t.panel, border: `1.5px solid ${t.panelBorder}`, borderRadius: 48,
        opacity: clamp(cardA, 0, 1), transform: `translateY(${(1 - cardA) * 60}px) scale(${0.94 + 0.06 * clamp(cardA, 0, 1)})`,
        boxShadow: t.mode === 'dark' ? '0 30px 90px rgba(0,0,0,0.5)' : '0 30px 80px rgba(12,40,26,0.16)',
        overflow: 'hidden', padding: '60px 56px',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
      }}>
        {/* top accent */}
        <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 10, background: t.lime }} />
        <div style={{ position: 'absolute', right: -90, top: -90, width: 280, height: 280, borderRadius: '50%', background: `radial-gradient(circle, ${t.glowA}, transparent 70%)` }} />

        <div style={{ opacity: appear(lt, 0.3, 0.5) }}><BrandMark t={t} size={1.05} /></div>

        {/* photo */}
        <div style={{
          width: 300, height: 300, borderRadius: '50%', marginTop: 44, overflow: 'hidden',
          border: `4px solid ${t.lime}`, boxShadow: `0 0 50px ${t.glowA}`,
          transform: `scale(${clamp(photoA, 0, 1)})`, opacity: clamp(photoA, 0, 1),
        }}>
          <img src="assets/jeremy.jpeg" alt="Jeremy Waters" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 22%' }} />
        </div>

        <div style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 78, letterSpacing: '-0.02em', color: t.ink, marginTop: 34, opacity: appear(lt, 0.6, 0.6), transform: `translateY(${(1 - appear(lt, 0.6, 0.6)) * 16}px)` }}>Jeremy Waters</div>
        <div style={{ fontFamily: TEXT, fontWeight: 600, fontSize: 28, letterSpacing: '0.04em', color: t.muted, marginTop: 6, opacity: appear(lt, 0.72, 0.6) }}>
          Designer · Builder · Entrepreneur
        </div>

        {/* buttons */}
        <div style={{ width: '100%', marginTop: 50, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {btns.map((b, i) => {
            const a = appear(lt, 1.0 + i * 0.22, 0.5, ease.easeOutBack);
            const isP = b.primary;
            return (
              <div key={b.l} style={{
                opacity: clamp(a, 0, 1), transform: `translateY(${(1 - a) * 26}px) scale(${0.96 + 0.04 * clamp(a, 0, 1)})`,
                display: 'flex', alignItems: 'center', gap: 18, justifyContent: 'center',
                background: isP ? t.btnLime : t.btnBg,
                border: isP ? 'none' : `1.5px solid ${t.panelBorder}`,
                borderRadius: 22, padding: '28px 24px',
                boxShadow: isP ? `0 14px 34px ${t.glowA}` : 'none',
              }}>
                <Icon name={b.n} size={32} color={isP ? t.btnLimeInk : t.lime} stroke={1.8} />
                <span style={{ fontFamily: TEXT, fontWeight: 700, fontSize: 34, color: isP ? t.btnLimeInk : t.btnInk }}>{b.l}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* tagline footer */}
      <div style={{ position: 'absolute', left: 90, right: 90, bottom: 56, textAlign: 'center', opacity: appear(lt, 2.0, 0.7), transform: `translateY(${(1 - appear(lt, 2.0, 0.7)) * 14}px)` }}>
        <span style={{ fontFamily: TEXT, fontWeight: 600, fontSize: 30, lineHeight: 1.4, color: t.sub }}>
          Let's build something that <span style={{ color: t.lime, fontWeight: 700 }}>moves your business forward.</span>
        </span>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
function CardIntro({ mode = 'dark' }) {
  const t = getTheme(mode === 'light' ? 'light' : 'dark');
  const DUR = 22.5;
  // scene windows (with small crossfade overlaps)
  return (
    <Stage width={1080} height={1920} duration={DUR} background={t.bg} persistKey={'jw-intro-' + t.mode} loop={false}>
      <Backdrop t={t} />
      <Sprite start={0} end={5.0}><SceneIdentity t={t} /></Sprite>
      <Sprite start={4.8} end={9.8}><SceneFoundation t={t} /></Sprite>
      <Sprite start={9.6} end={14.6}><SceneNetwork t={t} /></Sprite>
      <Sprite start={14.4} end={19.0}><SceneServices t={t} /></Sprite>
      <Sprite start={18.8} end={22.5}><SceneMission t={t} /></Sprite>
    </Stage>
  );
}

window.CardIntro = CardIntro;
