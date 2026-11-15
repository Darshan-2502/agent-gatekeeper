# PROMPTS.md

**Assignment:** Agent Gatekeeper (Air India) — proof of own work
**Student:** Aman Darshan Keshri · Enrolment No. PGD202564124
**Coding agent used:** Google Antigravity (agentic IDE, Gemini 3 in the agent panel) + a terminal for the headless test run

This file records the main instructions I gave the coding agent, in the order I gave them, and one
thing I checked and changed myself. Everything below is the actual sequence I worked through.

---

## A. The prompts I gave the agent

### 1. Set the scene and the rules

> I'm building a prototype called the Agent Gatekeeper for an airline (Air India). It receives a
> request from a customer's personal AI agent and must return ALLOW, ASK CUSTOMER or BLOCK with the
> rule number that caused the decision. Airline actions are: view fares, book, change, refund.
> Before writing any code, restate the eight rules I've written (R1 unknown agent, R2 revoked agent,
> R3 read-only allowed, R4 money up to Rs 10,000 allowed, R5 above the limit needs the customer,
> R6 refunds always need the customer, R7 invalid or expired mandate, R8 more than three money
> actions in 24 hours) and tell me if any two of them can contradict each other.

### 2. Build the decision engine on its own

> Write the policy as one pure function `decide(request, state, now)` that returns
> `{decision, rule, ruleTitle, reason}`. No DOM, no storage, no side effects — I want to be able to
> run it in Node without a browser. Check the rules in this order: unknown agent, then revoked, then
> invalid mandate, then read-only, then refund, then velocity, then the spending limit. Every
> decision must name the rule that produced it and explain it in one plain sentence a customer
> could read.

### 3. Build the page around it

> Now a single self-contained index.html — no build step, no CDN, no framework, because I have to
> open it by double-clicking during a screen recording. It needs: a request form (customer, agent,
> action, amount), a result card that shows the decision in large type with the rule number, an
> agent register with a Revoke button, a pending-confirmations panel, and an audit log table with
> date and time. Show my enrolment number PGD202564124 in the header.

### 4. The Wells Fargo problem

> Revoking an agent must write a revocation record with the date and time and keep it permanently —
> this is the evidence Wells Fargo now makes customers keep, except here the company keeps it
> instead of the customer. Once revoked, every later request from that agent must be blocked, even
> a harmless read-only one, and the audit log entry must quote the revocation timestamp.

### 5. Make ASK CUSTOMER a real step, not a label

> When the decision is ASK CUSTOMER, don't just print the word. Create a one-time confirmation
> token with a 10-minute expiry, show it in a waiting panel with approve/decline buttons, and log a
> second audit entry when the customer answers, so the log shows the request, the pause and the
> outcome.

### 6. Make it testable in one click

> Add a self-test button that runs the eight cases against a sandbox copy of the register (so it
> never touches my live data) and prints expected vs actual vs rule vs PASS/FAIL. Seed the sandbox
> with an agent that already has three money actions in the last 24 hours, otherwise rule R8 can't
> be reached.

### 7. Verify it without trusting the UI

> Write test_engine.mjs: pull the `<script>` block out of index.html, stub out `document` and
> `localStorage`, and call `decide()` directly for all eight cases. I don't want a green table in
> the browser to be the only evidence — I want the same function checked from the terminal, and a
> CSV of the results.

### 8. The report

> Write the two-page report as a Python/reportlab script so I can regenerate it: the company and the
> problem in my own words with the three given cases plus the source I found myself (eMarketer on
> United and JetBlue, 12 November 2026), the eight rules, the test table, and one paragraph on what
> Air India gains and loses by blocking agents completely.

---

## B. One thing I checked and changed myself

**What I changed:** the spending limit in `index.html`, from `MONEY_LIMIT: 10000` to `MONEY_LIMIT: 8000`,
to see whether the test suite actually reads the constant or whether the number was hard-coded
somewhere else.

**How I checked it:** I edited the constant, saved, reopened the page and ran the self-test again.

**What happened:** T3 (Rs. 18,400) still returned ASK CUSTOMER under R5, but T4 (Rs. 7,500) flipped
from ALLOW R4 to ASK CUSTOMER R5 — which is correct, because Rs. 7,500 is now above the Rs. 8,000
limit. Seven of eight passed and T4 failed *against its old expectation*, which is exactly what a
real limit change should do. I then put the constant back to `10000` and the suite returned to 8/8.

**What it told me:** the limit is a genuine single point of control — one number, read by the engine,
with no copy of it hiding in the UI — and it also showed me that my test expectations are tied to the
limit, so anyone changing the limit has to change T4's expected result too. I noted that in the README.

---

## C. Tools and honest notes

- The eight test cases, the rules and the Rs. 10,000 justification are mine; the agent wrote the
  code to them.
- The three named cases (Wells Fargo, JPMorgan, Delta) come from the assignment brief and the two
  sources listed in the report. The eMarketer piece on United and JetBlue, and Air India's own
  AI.g / eZ Booking announcements, I found and added myself.
- The prototype is a policy engine, not a production system: it stores state in the browser, not in
  a database, and the "customer" in the confirmation step is simulated by the person clicking
  Approve. That is enough to demonstrate the decision, the audit trail and the revocation record.
