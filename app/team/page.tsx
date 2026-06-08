import { SiteNav } from "@/components/site-nav";

const TEAM = [
  {
    name: "Jeremy Waters",
    role: "Founder & CEO",
    bio: "Jeremy started controlp.io in 2019 after years of frustration watching local businesses get overcharged for mediocre print work. He built the platform, manages key vendor relationships with 4Over, B2Sign, and Max Pro Films, and still personally reviews every large job before it ships.",
    details: [
      "7+ years in the print industry",
      "Manages vendor relationships",
      "Personal pre-press review on every large job",
      "Based in Chandler, AZ",
    ],
    initials: "JW",
    color: "#a3e635",
  },
  {
    name: "Sofia Mendes",
    role: "Lead Designer",
    bio: "Sofia has 15 years of print design experience and has produced artwork for brands across retail, hospitality, and automotive. She leads our design services team and reviews every customer file for print quality before it goes to production.",
    details: [
      "15 years of print design experience",
      "Specializes in large-format and vehicle graphics",
      "File prep review on every submitted design",
      "Available for design services starting at $85",
    ],
    initials: "SM",
    color: "#60a5fa",
  },
  {
    name: "Marcus Rivera",
    role: "Production Manager",
    bio: "Marcus oversees all production operations — from large-format printing to vehicle wrap installation. He trained at a leading Phoenix sign shop before joining controlp.io and has personally installed over 200 vehicle wraps.",
    details: [
      "Trained at Phoenix's top sign shop",
      "200+ vehicle wrap installations",
      "Specializes in Tesla wraps",
      "Oversees all quality control",
    ],
    initials: "MR",
    color: "#f472b6",
  },
];

export const metadata = {
  title: "Team — controlp.io",
  description: "Meet the team behind controlp.io — print professionals in Chandler, Arizona.",
};

export default function TeamPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      <SiteNav />

      {/* Hero */}
      <section className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 px-4 py-16 text-center">
        <div className="mx-auto max-w-2xl">
          <h1 className="mb-3 text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Meet the team</h1>
          <p className="text-lg text-zinc-500 dark:text-zinc-400">
            A small, focused team of print professionals based in Chandler, Arizona.
          </p>
        </div>
      </section>

      {/* Team grid */}
      <section className="mx-auto max-w-4xl px-4 py-14">
        <div className="space-y-8">
          {TEAM.map((member) => (
            <div key={member.name} className="flex flex-col sm:flex-row gap-8 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-8">
              <div className="shrink-0">
                <div
                  className="flex h-20 w-20 items-center justify-center rounded-2xl text-2xl font-bold text-zinc-900"
                  style={{ backgroundColor: member.color }}
                >
                  {member.initials}
                </div>
              </div>
              <div className="flex-1">
                <div className="mb-0.5 text-xl font-bold text-zinc-900 dark:text-zinc-100">{member.name}</div>
                <div className="mb-4 text-sm font-medium text-zinc-400">{member.role}</div>
                <p className="mb-5 text-[15px] leading-relaxed text-zinc-600 dark:text-zinc-400">{member.bio}</p>
                <ul className="space-y-1.5">
                  {member.details.map((d) => (
                    <li key={d} className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-lime-500 shrink-0" />
                      {d}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Join CTA */}
      <section className="border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 px-4 py-14 text-center">
        <div className="mx-auto max-w-xl">
          <h2 className="mb-3 text-2xl font-bold text-zinc-900 dark:text-zinc-100">Want to work with us?</h2>
          <p className="mb-6 text-zinc-500 dark:text-zinc-400">
            We're a small team and we hire slowly and carefully. If you're passionate about print quality and local business, reach out.
          </p>
          <a href="mailto:hello@controlp.io" className="inline-flex items-center justify-center rounded-lg bg-zinc-900 dark:bg-zinc-100 px-6 py-3 font-semibold text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors">
            hello@controlp.io
          </a>
        </div>
      </section>

      <footer className="border-t border-zinc-200 dark:border-zinc-800 py-8 text-center text-sm text-zinc-400">
        © 2026 controlp.io · Chandler, Arizona · (480) 999-9906
      </footer>
    </div>
  );
}
