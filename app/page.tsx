import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
          <a href="/">
            <img src="/logos/logo-light-lime.svg" alt="ControlP.io" className="h-7 w-auto dark:hidden" />
            <img src="/logos/logo-darkgreen-lime.svg" alt="ControlP.io" className="hidden h-7 w-auto dark:block" />
          </a>
          <nav className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link href="/" className="font-medium text-foreground">Home</Link>
            <Link href="/shop" className="hover:text-foreground">Shop</Link>
            <Link href="/book" className="hover:text-foreground">Book</Link>
            <Link href="/login" className="hover:text-foreground">Sign in</Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 py-20 text-center">
        <div className="mx-auto max-w-3xl">
          <div className="mb-4 inline-flex items-center rounded-full border bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            Fast turnaround · Professional quality
          </div>
          <h1 className="mb-6 text-5xl font-bold tracking-tight md:text-6xl">
            Print that works as hard as you do
          </h1>
          <p className="mb-8 text-lg text-muted-foreground leading-relaxed">
            Banners, signs, apparel, and custom print products — ordered online, produced locally, delivered fast.
          </p>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <a
              href="/shop"
              className="inline-flex h-11 items-center justify-center rounded-lg bg-primary px-8 text-base font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              Shop print products
            </a>
            <a
              href="/book"
              className="inline-flex h-11 items-center justify-center rounded-lg border px-8 text-base font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              Book a consultation
            </a>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t bg-card/40">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <div className="mb-10 text-center">
            <h2 className="text-2xl font-bold tracking-tight">Everything you need to print</h2>
            <p className="mt-2 text-muted-foreground">From concept to delivery, we handle it all.</p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: "🖨️",
                title: "Custom Print Shop",
                body: "Banners, signs, posters, canvas, fabric, window clings, and more — all custom sized and produced to order.",
                href: "/shop",
                cta: "Browse products",
              },
              {
                icon: "📅",
                title: "Book a Consultation",
                body: "Not sure what you need? Book time with our team to spec out your project, review proofs, or plan a campaign.",
                href: "/book",
                cta: "View availability",
              },
              {
                icon: "⚡",
                title: "Fast Turnaround",
                body: "Same-day and next-day production available. Order before noon for same-day, before 4pm for next business day.",
                href: "/shop",
                cta: "Start an order",
              },
              {
                icon: "📦",
                title: "Pickup, Delivery & Ship",
                body: "Pick up locally, get delivered to your door, or have your order shipped anywhere in the US.",
                href: "/shop",
                cta: "Order now",
              },
              {
                icon: "🎨",
                title: "Design Support",
                body: "Submit your own files or work with our team. We accept JPEG and PDF artwork in CMYK at 150 dpi.",
                href: "/book",
                cta: "Talk to us",
              },
              {
                icon: "🏷️",
                title: "Bulk & Quantity Pricing",
                body: "The more you order, the more you save. Volume discounts apply automatically at checkout.",
                href: "/shop",
                cta: "See pricing",
              },
            ].map((card) => (
              <a
                key={card.title}
                href={card.href}
                className="group rounded-xl border bg-card p-6 transition-shadow hover:shadow-md"
              >
                <div className="mb-3 text-3xl">{card.icon}</div>
                <h3 className="mb-2 font-semibold">{card.title}</h3>
                <p className="mb-4 text-sm text-muted-foreground leading-relaxed">{card.body}</p>
                <span className="text-xs font-medium text-primary group-hover:underline underline-offset-2">{card.cta} →</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* CTA strip */}
      <section className="border-t">
        <div className="mx-auto max-w-6xl px-4 py-14 text-center">
          <h2 className="mb-4 text-2xl font-bold tracking-tight">Ready to get started?</h2>
          <p className="mb-6 text-muted-foreground">Place an order online in minutes or book a quick call with our team.</p>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <a
              href="/shop"
              className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-6 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              Go to shop
            </a>
            <a
              href="/dashboard/customer"
              className="inline-flex h-10 items-center justify-center rounded-lg border px-6 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              My account
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-card/40">
        <div className="mx-auto max-w-6xl px-4 py-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <a href="/">
              <img src="/logos/logo-light-lime.svg" alt="ControlP.io" className="h-6 w-auto dark:hidden" />
              <img src="/logos/logo-darkgreen-lime.svg" alt="ControlP.io" className="hidden h-6 w-auto dark:block" />
            </a>
            <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
              <Link href="/shop" className="hover:text-foreground">Shop</Link>
              <Link href="/book" className="hover:text-foreground">Book</Link>
              <Link href="/login" className="hover:text-foreground">Sign in</Link>
              <Link href="/dashboard/customer" className="hover:text-foreground">My account</Link>
            </nav>
            <p className="text-xs text-muted-foreground">&copy; {new Date().getFullYear()} ControlP.io</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
