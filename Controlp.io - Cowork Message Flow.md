**Controlp.io - Cowork Message Flow** 



**Message 1 — Kickoff (paste this first)**



I'm starting a new project called controlp.io — a Next.js ecommerce + 

operations platform for my print/signs/vehicle-wraps shop in Chandler, AZ.



The project folder contains everything you need. Before you write any code, 

read these files in this exact order:



1\. README.md (project root)

2\. BUILD\_PROMPT.md (project root)  

3\. reference/brand.md

4\. reference/pricing-strategy.md

5\. reference/vendors.md

6\. reference/env.example

7\. All 14 numbered mockups in mockups/ (01 through 14)

8\. All 5 files in mockups/auth/



Do NOT write any code yet. Do NOT set up the repo yet. Do NOT install 

dependencies yet.



After reading everything, respond with three things:



A. A 3-sentence summary of what you understand the project to be

B. Any questions or ambiguities you need clarified before starting

C. The Phase 1 self-check summary using the template in BUILD\_PROMPT.md



Then stop and wait for my approval before proceeding.



\---------------------------------------------------



**Message 2 — Approve Phase 1 (paste when ready)**



Self-check looks good. Proceed with Phase 1.



Remember:

\- Stop at GATE 1 before starting Phase 2

\- At Gate 1, show me: schema migration files, route tree (run `tree app/`), 

&#x20; SiteHeader running on localhost:3000, and lib/pricing/calculate.ts with 

&#x20; passing unit tests for all 8 test cases in pricing-strategy.md

\- No new dependencies beyond what's listed in BUILD\_PROMPT.md section 1. 

&#x20; If you think you need one, stop and ask.

\- Follow the mockups exactly for any UI work — don't invent styling





\---------------------------------------------------



**Message 3 — Handle common early-phase hiccups**

You'll probably need one of these at some point during Phase 1:



If Cowork tries to install something not on the list:

Stop. That library isn't in BUILD\_PROMPT.md section 1. 

Either use built-in Next.js/React primitives, or make the case for 

why this library is necessary and wait for my approval before installing.



\---------------------------------------------------



**If Cowork starts building Phase 2 stuff before Gate 1 is cleared:**



Stop. We haven't cleared Gate 1 yet. Per BUILD\_PROMPT.md, you need 

to show me the schema migrations, route tree, SiteHeader running, 

and pricing unit tests before touching anything in Phase 2.



\---------------------------------------------------



**If Cowork asks to skip a step:**



No skipping. The phases and gates in BUILD\_PROMPT.md are intentional. 

If there's a reason a step doesn't apply, explain the reason and I'll 

decide whether to skip it.



\---------------------------------------------------



**If the output drifts from the mockups:**

Compare what you built against mockups/\[filename].html. 

The spacing/typography/colors/layout should match. 

List the specific differences you see, then fix them.



\---------------------------------------------------



**General rules while working with Cowork**



Review at every gate. Don't let it chain multiple phases without you checking the work. The gates exist because they're the cheap places to catch drift.

Read the self-check before saying "go". If the self-check is vague or skips a section, send it back for a rewrite before approving.

Be explicit about stopping. AI agents have a bias toward forward momentum. "Stop and wait" is a real instruction you'll use often.

Keep the mockups open in browser tabs while reviewing. Open mockups/01-home.html directly in Chrome and eyeball it alongside Cowork's rendered output. That's the fastest way to spot drift.

Commit at every gate. Once a gate clears, git commit -m "Phase 1 complete" before giving the go for the next phase. If Phase 2 goes sideways, you can git reset back to a known good state.



\---------------------------------------------------



**Quick-reference: what each gate blocks on**

GateBlocks beforeYou verifyGate 1Phase 2Schema, routes, header running, pricing tests passGate 2Phase 3End-to-end customer flow works in stagingGate 3Phase 4Admin dashboard demo, sample order flow worksGate 4Production launchLive keys, backups, monitoring, policies live

Good luck. Message 1 is ready to paste.

