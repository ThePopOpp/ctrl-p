
const STATS = [
  { value: "12,400+", label: "Projects completed" },
  { value: "4.9/5", label: "Average rating" },
  { value: "7 years", label: "Serving Arizona" },
  { value: "342", label: "Vehicles wrapped" },
];

const VALUES = [
  {
    title: "Quality is non-negotiable",
    desc: "We use the same materials, equipment, and standards on a $30 order as we do on a $3,000 one. Every job gets a pre-press check before it goes to press.",
  },
  {
    title: "Speed matters",
    desc: "Local businesses often need things yesterday. We've built our workflow around fast turnarounds without cutting corners — most orders ship in 3–5 business days.",
  },
  {
    title: "Fair, transparent pricing",
    desc: "No hidden fees, no surprise charges at checkout. The price you see is the price you pay. Volume discounts are automatic.",
  },
  {
    title: "Humans answer the phone",
    desc: "Call (480) 999-9906 and a real person picks up. No bots, no ticket queues for basic questions. We're here to help.",
  },
];

const TEAM = [
  {
    name: "Jeremy Waters",
    role: "Founder & CEO",
    bio: "Jeremy started controlp.io in 2019 after years of frustration watching local businesses get overcharged for mediocre print work. He built the platform, manages key vendor relationships with 4Over, B2Sign, and Max Pro Films, and still personally reviews every large job before it ships.",
    initials: "JW",
    color: "#a3e635",
  },
  {
    name: "Sofia Mendes",
    role: "Lead Designer",
    bio: "Sofia has 15 years of print design experience and has produced artwork for brands across retail, hospitality, and automotive. She leads our design services team and reviews every customer file for print quality before it goes to production.",
    initials: "SM",
    color: "#60a5fa",
  },
  {
    name: "Marcus Rivera",
    role: "Production Manager",
    bio: "Marcus oversees all production operations — from large-format printing to vehicle wrap installation. He trained at a leading Phoenix sign shop before joining controlp.io and has personally installed over 200 vehicle wraps.",
    initials: "MR",
    color: "#f472b6",
  },
];

export const metadata = {
  title: "About — controlp.io",
  description: "We help local businesses look professional. Born from a frustration with bad print.",
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">

      {/* Hero */}
      <section className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 px-4 py-20">
        <div className="mx-auto max-w-3xl">
          <h1 className="mb-4 text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 md:text-5xl">
            We help local businesses<br className="hidden sm:block" /> look professional.
          </h1>
          <p className="text-xl text-zinc-500 dark:text-zinc-400">
            Agency-grade print quality, without the agency markup.
          </p>
        </div>
      </section>

      {/* Story */}
      <section className="mx-auto max-w-3xl px-4 py-14">
        <h2 className="mb-4 text-2xl font-bold text-zinc-900 dark:text-zinc-100">Born from a frustration with bad print.</h2>
        <div className="space-y-4 text-[16px] leading-relaxed text-zinc-600 dark:text-zinc-400">
          <p>
            In 2019, founder Jeremy Waters was running a small design agency and grew increasingly frustrated watching clients overpay for mediocre banners, signs, and business cards — usually from large online print shops that shipped generic-looking work with no real quality control.
          </p>
          <p>
            He started controlp.io with a simple premise: use the same wholesale print vendors the agencies use, add a proper pre-press review process, and pass the savings directly to local businesses. No fluff, no upsells, no $12 "rush fee" that still takes four days.
          </p>
          <p>
            Today we partner with <strong className="text-zinc-900 dark:text-zinc-100">4Over</strong>, <strong className="text-zinc-900 dark:text-zinc-100">B2Sign</strong>, and <strong className="text-zinc-900 dark:text-zinc-100">Max Pro Films</strong> — the same vendors supplying major print agencies across Arizona. Every order is reviewed by a real human before it goes to press, and we offer agency-grade design services starting at $85 for businesses that need help with artwork.
          </p>
          <p>
            We're based in Chandler, AZ. Same-day local pickup is available. When you call (480) 999-9906, someone actually picks up.
          </p>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 px-4 py-12">
        <div className="mx-auto max-w-4xl">
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">{s.value}</div>
                <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="mx-auto max-w-4xl px-4 py-14">
        <h2 className="mb-8 text-2xl font-bold text-zinc-900 dark:text-zinc-100">What we believe</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          {VALUES.map((v) => (
            <div key={v.title} className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
              <h3 className="mb-2 font-semibold text-zinc-900 dark:text-zinc-100">{v.title}</h3>
              <p className="text-[15px] text-zinc-500 dark:text-zinc-400 leading-relaxed">{v.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Team */}
      <section id="team" className="border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 px-4 py-14">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-8 text-2xl font-bold text-zinc-900 dark:text-zinc-100">The team</h2>
          <div className="grid gap-6 sm:grid-cols-3">
            {TEAM.map((member) => (
              <div key={member.name} className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
                <div
                  className="mb-4 flex h-14 w-14 items-center justify-center rounded-full text-xl font-bold text-zinc-900"
                  style={{ backgroundColor: member.color }}
                >
                  {member.initials}
                </div>
                <div className="mb-0.5 font-semibold text-zinc-900 dark:text-zinc-100">{member.name}</div>
                <div className="mb-3 text-sm font-medium text-zinc-400">{member.role}</div>
                <p className="text-[14px] text-zinc-500 dark:text-zinc-400 leading-relaxed">{member.bio}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mission CTA */}
      <section id="mission" className="mx-auto max-w-3xl px-4 py-14 text-center">
        <h2 className="mb-4 text-2xl font-bold text-zinc-900 dark:text-zinc-100">Our mission</h2>
        <p className="mb-8 text-lg text-zinc-500 dark:text-zinc-400 leading-relaxed">
          To make professional-quality print accessible to every local business, not just those with big marketing budgets or agency relationships. If your brand deserves to look good, we'll make it happen — fast, fairly priced, and without the runaround.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a href="/shop" className="inline-flex items-center justify-center rounded-lg bg-zinc-900 dark:bg-zinc-100 px-6 py-3 font-semibold text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors">
            Browse products
          </a>
          <a href="/contact" className="inline-flex items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-700 px-6 py-3 font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
            Get a quote
          </a>
        </div>
      </section>

    </div>
  );
}
