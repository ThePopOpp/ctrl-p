
const PILLARS = [
  {
    icon: "🏆",
    title: "Quality is non-negotiable",
    desc: "We use the same materials, equipment, and standards on a $30 order as we do on a $3,000 one. Every job gets a pre-press check before it goes to press. If something doesn't meet our standard, we fix it before you ever see it.",
  },
  {
    icon: "⚡",
    title: "Speed matters",
    desc: "Local businesses often need things yesterday. We've built our entire workflow around fast turnarounds — most orders ship in 3–5 business days. Rush options are available when you truly need it.",
  },
  {
    icon: "💰",
    title: "Fair, transparent pricing",
    desc: "No hidden fees. No $12 'setup fee' buried in checkout. The price you see when you configure your product is the price you pay. Volume discounts are automatic — no need to call and negotiate.",
  },
  {
    icon: "📞",
    title: "Humans answer the phone",
    desc: "Call (480) 999-9906 and a real person picks up. We reply to emails and texts within 4 business hours. We think this is the bare minimum, but it's apparently rare enough to mention.",
  },
  {
    icon: "🔍",
    title: "Every file gets reviewed",
    desc: "Before anything goes to press, a real person checks your artwork for resolution, bleed, color space, and font issues. Most online print shops don't do this — we think it's essential.",
  },
  {
    icon: "🤝",
    title: "Local first",
    desc: "We're rooted in Chandler, Arizona and built around serving local businesses. Same-day pickup. Local installation. Showing up in person when it matters.",
  },
];

export const metadata = {
  title: "Mission — controlp.io",
  description: "Our mission: professional-quality print for every local business.",
};

export default function MissionPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">

      {/* Hero */}
      <section className="border-b border-zinc-200 dark:border-zinc-800 px-4 py-20">
        <div className="mx-auto max-w-3xl">
          <div className="mb-6 inline-block rounded-full bg-lime-100 dark:bg-lime-900/30 px-4 py-1.5 text-sm font-semibold text-lime-700 dark:text-lime-400">
            Our mission
          </div>
          <h1 className="mb-6 text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 md:text-5xl leading-tight">
            Professional-quality print<br className="hidden sm:block" /> for every local business.
          </h1>
          <p className="text-xl text-zinc-500 dark:text-zinc-400 leading-relaxed">
            Not just those with big marketing budgets or agency relationships. If your brand deserves to look good, we'll make it happen — fast, fairly priced, and without the runaround.
          </p>
        </div>
      </section>

      {/* Pillars */}
      <section className="mx-auto max-w-4xl px-4 py-14">
        <h2 className="mb-8 text-2xl font-bold text-zinc-900 dark:text-zinc-100">What we stand for</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          {PILLARS.map((p) => (
            <div key={p.title} className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
              <div className="mb-3 text-2xl">{p.icon}</div>
              <h3 className="mb-2 font-semibold text-zinc-900 dark:text-zinc-100">{p.title}</h3>
              <p className="text-[15px] leading-relaxed text-zinc-500 dark:text-zinc-400">{p.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Story */}
      <section className="border-y border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 px-4 py-14">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-6 text-2xl font-bold text-zinc-900 dark:text-zinc-100">Why we started</h2>
          <div className="space-y-4 text-[16px] leading-relaxed text-zinc-600 dark:text-zinc-400">
            <p>
              In 2019, Jeremy Waters was running a small design agency and watching his clients get consistently overcharged for print work — sometimes 3–4× what the same job cost through wholesale vendors. Large national print shops competed on price but delivered inconsistent quality. Local shops charged more but often lacked the throughput for fast turnarounds.
            </p>
            <p>
              The gap was obvious: professional-grade print was accessible to agencies and large brands, but not to the small business owner who needed 500 business cards or a banner for their storefront.
            </p>
            <p>
              controlp.io was built to close that gap. We use the same wholesale vendors powering major agencies — 4Over, B2Sign, Max Pro Films — and wrap them in a proper quality control process, transparent pricing, and real customer service.
            </p>
            <p>
              We're not trying to be the biggest print shop. We're trying to be the most reliable one for local businesses in Arizona and across the U.S.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 py-14 text-center">
        <div className="mx-auto max-w-xl">
          <h2 className="mb-4 text-2xl font-bold text-zinc-900 dark:text-zinc-100">Ready to work together?</h2>
          <p className="mb-8 text-zinc-500 dark:text-zinc-400">
            Browse our products, request a quote, or just call us. We're here.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a href="/shop" className="inline-flex items-center justify-center rounded-lg bg-zinc-900 dark:bg-zinc-100 px-6 py-3 font-semibold text-white dark:text-zinc-900 hover:bg-zinc-800 transition-colors">
              Shop products
            </a>
            <a href="/contact" className="inline-flex items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-700 px-6 py-3 font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
              Get a quote
            </a>
          </div>
        </div>
      </section>

    </div>
  );
}
