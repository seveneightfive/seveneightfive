import Link from "next/link";

export const metadata = {
  title: "seveneightfive tickets — Ticketing that keeps it local | seveneightfive",
  description:
    "Sell tickets for 70¢ each. Keep your money local. Online + at-the-door, Stripe payouts in 2 days, QR scanning and analytics built in.",
};

const HOT = "#c80650";
const ACID = "#FFCE03";
const INK = "#0c111d";
const PAPER = "#ffffff";
const PAPER_WARM = "#ffffff";

export default function TicketsLandingPage() {
  return (
    <main className="bg-white text-[#0c111d] font-serif overflow-x-hidden">
      {/* ============== HERO ============== */}
      <section className="relative px-4 pt-8 pb-12 sm:px-6 sm:pt-14 sm:pb-20 lg:pt-20 lg:pb-28">
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none opacity-40"
          style={{
            backgroundImage: "radial-gradient(rgba(12,17,29,0.18) 1px, transparent 1px)",
            backgroundSize: "4px 4px",
          }}
        />
        <div className="relative mx-auto max-w-7xl">
          <div className="flex items-center gap-3 mb-5 sm:mb-8">
            <span className="h-px flex-1 max-w-[60px] bg-[#0c111d]" />
            <span className="font-mono text-[10px] sm:text-xs tracking-[0.2em] uppercase">
              From the team at seveneightfive
            </span>
            <span className="h-px flex-1 bg-[#0c111d]" />
          </div>

          <h1 className="font-display leading-[0.85] tracking-tight text-[15vw] sm:text-[12vw] lg:text-[160px]">
            <span className="block">SELL TICKETS.</span>
            <span className="block">KEEP MONEY</span>
            <span className="block italic font-serif font-normal text-[12vw] sm:text-[8vw] lg:text-[96px] text-[#c80650]">
              local.
            </span>
          </h1>

          <div className="mt-8 sm:mt-10 grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:gap-12 lg:items-end">
            <p className="text-lg sm:text-xl lg:text-2xl leading-relaxed max-w-2xl">
              seveneightfive tickets charges{" "}
              <span className="bg-[#FFCE03] px-1.5 font-semibold">70¢ a ticket plus ACH fee.</span>{" "}
              That's it. No percentage tax on every sale, no padding the price for your fans.
              Built by{" "}
              <span className="italic underline decoration-[#c80650] decoration-2 underline-offset-4">
                seveneightfive
              </span>{" "}
              for Topeka venues, promoters and nonprofits.
            </p>

            <div className="flex flex-col sm:flex-row lg:flex-col gap-3">
              <Link
                href="#start"
                className="font-display text-lg sm:text-xl text-center bg-[#0c111d] text-white px-6 py-4 border-2 border-[#0c111d] hover:bg-[#c80650] hover:border-[#c80650] transition-all tracking-wider hover:-translate-y-0.5"
              >
                START SELLING TICKETS →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ============== THE MATH ============== */}
      <section id="compare" className="bg-black text-white px-4 py-14 sm:px-6 sm:py-20 lg:py-28">
        <div className="mx-auto max-w-7xl">
          <p className="font-mono text-xs tracking-[0.25em] uppercase text-[#FFCE03] mb-4">
            The Math
          </p>
          <h2 className="font-display text-5xl sm:text-7xl lg:text-8xl leading-[0.9] mb-10 sm:mb-14">
            DO THE MATH ON
            <br />
            <span className="italic font-serif font-normal text-[#c80650]">your last event.</span>
          </h2>

          <div className="grid gap-6 md:grid-cols-2 max-w-5xl">
            <FeeCard
              label="Eventbrite"
              feeMain="3.7% + $1.79"
              feeSub="+ 2.9% processing"
              pill="$10 ticket = $2.46 in fees"
              note={
                <>You keep just <strong>$7.54</strong> of every $10 ticket.</>
              }
            />
            <FeeCard
              label="seveneightfive tickets"
              feeMain="$0.70 flat"
              feeSub="+ 2.9% processing"
              pill="$10 ticket = $0.99 in fees"
              note={
                <>You keep <strong>$9.01</strong> of every $10 ticket.</>
              }
              featured
            />
          </div>

          <p className="mt-10 sm:mt-14 max-w-3xl text-lg sm:text-xl leading-relaxed text-white/85">
            For a 50-person event at $10 per ticket, that's{" "}
            <span className="text-[#FFCE03] font-semibold">$123 in fees vs. $49.50</span>. That
            money stays with you, the artists and the venue. Talk about win, win, win.
          </p>
        </div>
      </section>

      {/* ============== FEATURES ============== */}
      <section className="px-4 py-14 sm:px-6 sm:py-20 lg:py-28">
        <div className="mx-auto max-w-7xl">
          <p className="font-mono text-xs tracking-[0.25em] uppercase text-[#c80650] mb-4">
            Everything You Need
          </p>
          <h2 className="font-display text-5xl sm:text-7xl lg:text-8xl leading-[0.9] mb-10 sm:mb-14">
            ALL THE GEAR.
            <br />
            <span className="italic font-serif font-normal">no fluff</span>
          </h2>

          <div className="grid gap-4 sm:gap-5 md:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              title="Sell online + at the door"
              body={
                <>Sell tickets from your event page on <em>seveneightfive</em> or your own website. Walk-ups? Take cash or card on-site through the same dashboard, that way your inventory is in sync.</>
              }
            />
            <FeatureCard
              title="Instant Payout"
              body="Connect your bank account to Stripe and receive funds within two days. You own the customer data and the cash flow."
              accent
            />
            <FeatureCard
              title="Ticket Levels, Your Way"
              body="Early bird, GA, VIP, students, members. Set caps, sale windows, and per-tier perks. As many tiers as your event needs."
            />
            <FeatureCard
              title="QR scanning built in"
              body="No extra app to download. Your dashboard becomes the scanner. Real-time check-ins, no double-scans. Simple, shareable URL for event staff and volunteers."
            />
            <FeatureCard
              title="Ask attendees anything"
              body="Customize questions for each ticket type: dietary needs, t-shirt size, age, accessibility, how they heard about the event, or more. The data is yours to use as you choose."
              accent
            />
            <FeatureCard
              title="Analytics that actually help"
              body="Live sales by tier, traffic sources. Know what's working before the doors open."
            />
            <FeatureCard
              title="Email attendees, pre + post"
              body="Communicate with your event attendees, pre and post show. Send reminders, updates, emails, or push notifications. Your complete attendee list is yours to download and communicate with… it's your event, after all."
              accent
            />
            <FeatureCard
              title="Not Just seveneightfive"
              body={
                <>Every event automatically lives on the <em>seveneightfive</em>.com calendar, which is seen by thousands of Topekans looking for entertainment. But it also lives on partner calendars, such as ArtsTopeka.org.</>
              }
            />
            <FeatureCard
              title="Keep Traffic On Your Site"
              body="Even better, we provide you with an embed code so you can sell tickets on your own website. Keep your fans on your website, no more directing them someplace else."
              accent
            />
          </div>
        </div>
      </section>

      {/* ============== STORY ============== */}
      <section className="relative px-4 py-14 sm:px-6 sm:py-20 lg:py-28 border-y-2 border-[#0c111d] bg-black text-white">
        <div className="mx-auto max-w-4xl">
          <p className="font-mono text-xs tracking-[0.25em] uppercase mb-6">Why Bother?</p>
          <h2 className="font-display text-4xl sm:text-6xl lg:text-7xl leading-[0.95] mb-8">
            EVERY TICKET SOLD WITH US, MATTERS{" "}
            <span className="bg-[#c80650] text-white px-2 -rotate-1 inline-block">
              KEEP MONEY LOCAL.
            </span>
          </h2>
          <div className="space-y-5 text-lg sm:text-xl leading-relaxed max-w-2xl">
            <p>
              seveneightfive is all about local. We know when we spend money with locally owned businesses those dollars stay in our community and circulate. seveneightfive tickets is the next step: a ticketing tool where the fees stay reasonable, the money stays in Topeka and a real person behind the "help" button.
            </p>
            <p className="font-display text-2xl sm:text-3xl not-italic">
              You're not a user. You're our neighbor.
            </p>
          </div>
        </div>
      </section>

      {/* ============== FAQ ============== */}
      <section className="px-4 py-14 sm:px-6 sm:py-20 lg:py-28">
        <div className="mx-auto max-w-4xl">
          <p className="font-mono text-xs tracking-[0.25em] uppercase text-[#c80650] mb-4">
            Quick Answers
          </p>
          <h2 className="font-display text-5xl sm:text-7xl leading-[0.9] mb-10 sm:mb-14">
            QUESTIONS?
          </h2>

          <div className="space-y-0 border-t-2 border-[#0c111d]">
            <Faq
              q="What does the 70¢ actually cover?"
              a="Our platform fee. Stripe's standard card processing (2.7% + 30¢) is separate and goes straight to Stripe, the same as any other tool. If you want to pass the fee onto the buyer, increase the ticket price for this platform."
            />
            <Faq
              q="How fast do I get paid?"
              a="Stripe Connect pays out to your bank in about 2 business days on a standard rolling schedule. Your money, your account, your timeline."
            />
            <Faq
              q="Can I sell tickets on my own website too?"
              a={
                <>Yes. Use the <em>seveneightfive</em>.com event page, embed a checkout widget on your own site, or both. Same inventory, same dashboard.</>
              }
            />
            <Faq
              q="What about at-the-door sales?"
              a="Open the dashboard on any phone or tablet. Sell tickets, take payment, check people in with QR all in one place."
            />
            <Faq
              q="What if my event is free?"
              a={
                <>If your event is free, so is seveneightfive tickets. No charge to list it, no charge per RSVP. We gladly accept small donations from organizers who want to chip in toward keeping the platform running, but it's never required. And if you'd like an extra push, online advertising on <em>seveneightfive</em>.com starts at just $10 a week to put your event in front of thousands of locals.</>
              }
            />
          </div>
        </div>
      </section>

      {/* ============== CTA ============== */}
      <section
        id="start"
        className="relative bg-black text-white px-4 py-16 sm:px-6 sm:py-24 lg:py-32 overflow-hidden"
      >
        <div
          aria-hidden
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(rgba(255,255,255,0.5) 1px, transparent 1px)",
            backgroundSize: "6px 6px",
          }}
        />
        <div className="relative mx-auto max-w-5xl text-center">
          <p className="font-mono text-xs tracking-[0.25em] uppercase text-[#FFCE03] mb-6">
            Ready When You Are
          </p>
          <h2 className="font-display text-6xl sm:text-8xl lg:text-9xl leading-[0.85] mb-6 sm:mb-8">
            LET'S SELL <br />
            <span className="italic font-serif font-normal text-[#c80650]">some tickets.</span>
          </h2>
          <p className="text-lg sm:text-xl text-white/80 max-w-2xl mx-auto mb-8 sm:mb-12">
            Set up an event in about 10 minutes. No contracts, no monthly fees.
            Pay 70¢ when you sell a ticket. That's the deal.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
            <Link
              href="/signup"
              className="font-display text-xl sm:text-2xl bg-[#c80650] text-white px-8 py-5 border-2 border-[#c80650] hover:bg-white hover:text-[#0c111d] hover:border-white transition-all tracking-wider"
            >
              CREATE AN EVENT →
            </Link>
            <a
              href="sms:+17852493126"
              className="font-display text-xl sm:text-2xl bg-transparent text-white px-8 py-5 border-2 border-white hover:bg-white hover:text-[#0c111d] transition-all tracking-wider"
            >
              TEXT A HUMAN
            </a>
          </div>
        </div>
      </section>

      {/* ============== FOOTER ============== */}
      <footer className="bg-black text-white/60 border-t border-white/10 px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-2 font-mono text-xs">
          <span>© seveneightfive magazine — Topeka, KS</span>
          <span className="tracking-[0.2em] uppercase">
            seveneightfive <span className="text-[#c80650]">tickets</span> · keep it local
          </span>
        </div>
      </footer>

      {/* ============== STYLES ============== */}
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.4); opacity: 0.5; }
        }
        .font-display { font-family: 'Bebas Neue', 'Arial Narrow', sans-serif; letter-spacing: 0.01em; }
        .font-serif { font-family: 'Fraunces', Georgia, serif; }
        .font-mono { font-family: 'JetBrains Mono', ui-monospace, monospace; }
        ::selection { background: #c80650; color: #ffffff; }
      `}</style>
    </main>
  );
}

/* ───────── subcomponents ───────── */

function FeeCard({
  label,
  feeMain,
  feeSub,
  pill,
  note,
  featured = false,
}: {
  label: string;
  feeMain: string;
  feeSub: string;
  pill: string;
  note: React.ReactNode;
  featured?: boolean;
}) {
  return (
    <div
      className={`relative border-2 p-5 sm:p-6 transition-transform ${
        featured
          ? "border-[#c80650] bg-white text-[#0c111d] -rotate-1 hover:rotate-0"
          : "border-white/20 bg-transparent"
      }`}
    >
      <p className="font-mono text-xs tracking-[0.2em] uppercase opacity-70">{label}</p>
      <p className="font-display text-5xl sm:text-6xl mt-3 leading-none">
        {feeMain}
        <br />
        <span className="text-3xl opacity-70">{feeSub}</span>
      </p>
      <div
        className={`mt-4 inline-block px-2 py-1 font-mono text-xs text-white ${
          featured ? "bg-[#c80650]" : "bg-[#7a7368]"
        }`}
      >
        {pill}
      </div>
      <p className="mt-4 text-sm sm:text-base leading-relaxed opacity-90">{note}</p>
    </div>
  );
}

function FeatureCard({
  title,
  body,
  accent = false,
}: {
  title: string;
  body: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className={`group relative border-2 border-[#0c111d] p-5 sm:p-6 ${
        accent ? "bg-[#0c111d] text-white" : "bg-white"
      } hover:-translate-y-1 hover:shadow-[6px_6px_0_0_#c80650] transition-all`}
    >
      <div className="flex items-baseline justify-end mb-3">
        <span className="font-mono text-xs opacity-40 group-hover:text-[#c80650] group-hover:opacity-100 transition-colors">
          ✱
        </span>
      </div>
      <h3 className="font-display text-2xl sm:text-3xl leading-tight mb-3">{title}</h3>
      <p className="text-sm sm:text-base leading-relaxed opacity-90">{body}</p>
    </div>
  );
}

function Faq({ q, a }: { q: string; a: React.ReactNode }) {
  return (
    <details className="group border-b-2 border-[#0c111d] py-5 sm:py-6">
      <summary className="flex items-start justify-between gap-4 cursor-pointer list-none">
        <span className="font-display text-2xl sm:text-3xl leading-tight">{q}</span>
        <span className="font-display text-3xl sm:text-4xl text-[#c80650] transition-transform group-open:rotate-45 shrink-0">
          +
        </span>
      </summary>
      <p className="mt-4 text-base sm:text-lg leading-relaxed max-w-2xl">{a}</p>
    </details>
  );
}

/* ─────────────────────────────────────────────────────────────
   FONT SETUP — add to your app/layout.tsx:

   import { Bebas_Neue, Fraunces, JetBrains_Mono } from "next/font/google";

   const bebas = Bebas_Neue({ weight: "400", subsets: ["latin"], variable: "--font-bebas", display: "swap" });
   const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap" });
   const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", display: "swap" });

   Then: <body className={`${bebas.variable} ${fraunces.variable} ${jetbrains.variable}`}>

   ───────────────────────────────────────────────────────────── */
