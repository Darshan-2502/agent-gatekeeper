# Agent Gatekeeper: Comprehensive Code Walkthrough & Viva Guide
**Student Enrolment No:** `2023UCS1101`  
**System:** Air India Autonomous Agent Gatekeeper Prototype  

---

## 1. End-to-End Request Flow: Form to Audit Log

When an AI agent or operator submits an action through the gateway, the data travels through a deterministic, synchronous pipeline:

1. **Input Capture & Normalisation:** The user fills out the **Incoming Request** form (`customer`, `agent`, `action`, and conditional `amount`). On submission, the event listener intercepts the event via `e.preventDefault()`, reads the fields, converts financial inputs to numeric types, and captures a fixed snapshot of current epoch time (`nowMs = Date.now()`).
2. **Deterministic Evaluation (`decide`):** The engine takes the request payload, the current state snapshot (registered agents and audit history), and `nowMs`. It evaluates the 8 authoritative rules strictly in descending order (R1 &rarr; R8) and halts at the first match. No state mutation, DOM access, or clock queries occur inside this function.
3. **Primary Audit Recording (`addAuditEntry`):** Immediately following decision generation, a persistent audit object is constructed containing a strictly monotonic sequence number, ISO-8601 UTC timestamp, customer, agent, action, amount, decision outcome (`ALLOW`, `ASK CUSTOMER`, `BLOCK`), triggering rule index, and an explanatory human-readable reason string.
4. **Human-in-the-Loop Interception (if `ASK CUSTOMER`):** If the decision is `ASK CUSTOMER`, execution is paused. A unique alphanumeric token (e.g. `CONF-7K2QX9`) with a 10-minute expiry timestamp is appended to `appState.pendingConfirmations`.
5. **State Persistence & Re-Rendering:** The modified state is serialized into `localStorage` (falling back gracefully to memory if storage is sandboxed). The UI re-renders the result card, updates the live audit table, refreshes the datalist, and displays the pending confirmation queue.
6. **Secondary Confirmation Resolution:** If a pending token is subsequently Approved or Declined by the customer, a secondary audit row is logged (`APPROVED` or `DECLINED`), recording the human operator's explicit mandate and closing the loop.

---

## 2. Function-by-Function Reference

### Core Decision Engine
The engine code is intentionally isolated between `/* ===== ENGINE START ===== */` and `/* ===== ENGINE END ===== */` comment delimiters, allowing automated headless testing via `test_engine.mjs` without browser dependencies.

#### `_fmtDT(isoStr)`
Converts an ISO-8601 timestamp string into a standardized, zero-padded `DD/MM/YYYY HH:MM:SS` human-readable string using the client's local timezone. It is built using explicit two-digit padding helpers rather than browser-specific locale formatters to guarantee consistent, cross-platform date rendering across diverse operating systems and Node.js environments.

#### `decide(request, state, nowMs)`
The central, pure decision function of the gateway that maps an incoming agent request against registered mandates and rolling audit logs to return `{ decision, rule, ruleTitle, reason }`. It is built completely without side effects, global state lookups, or internal calls to `Date.now()`, ensuring mathematical determinism and making it trivially testable in both browser and CI/headless Node environments.

---

### State Management & Persistence

#### `loadState()`
Attempts to read and deserialize the gateway's state from browser `localStorage` under the key `agentGatekeeperState`. It is wrapped in a strict `try/catch` block so that when the prototype is launched directly from the local filesystem (`file://`), where browser security policies frequently restrict local storage, the application does not crash and seamlessly falls back to the in-memory seed state.

#### `saveState()`
Serializes the current in-memory state (`agents`, `audit`, and `pendingConfirmations`) back into `localStorage`. Like `loadState()`, it wraps the operation in a `try/catch` block to silently tolerate storage quotas or filesystem sandbox blocks without disrupting active user interactions.

#### `createSeedState()`
Generates the authoritative baseline demo state required by the university specification, containing the five predefined agents (`TripMind`, `FareScout`, `OldBot`, `StaleBot`, `BulkBot`) with calculated future and past expiry timestamps, an empty live audit log, and an empty confirmation queue. It is built as a factory function so both initial page load and the "Reset Demo Data" action instantiate fresh, unpolluted data objects.

#### `resetState()`
Prompts the user for confirmation and replaces the active `appState` with a pristine seed state from `createSeedState()`, clears UI test results, flushes storage, and triggers a full DOM re-render. It is built to allow quick demonstration resets during university viva presentations without requiring a hard browser refresh or cookie clearing.

#### `nextSeq()`
Calculates the next sequential integer for audit log entries by finding the maximum existing `seq` number in the log and incrementing it by 1 (or returning 1 if the log is empty). This guarantees strictly increasing, gapless sequence numbers even if entries are sorted or filtered in the user interface.

#### `addAuditEntry(partial)`
Accepts an audit entry payload, automatically assigns it a unique sequence number via `nextSeq()`, and pushes it to the authoritative `appState.audit` array. It encapsulates audit appending in one location so that schema consistency is maintained across automated decisions, manual registrations, revocations, and customer confirmations.

---

### Formatting & Utility Functions

#### `fmtCurrency(n)`
Formats numerical monetary values into the official Indian currency representation (`Rs. X,XX,XXX`) using Indian numbering formatting (`en-IN`), or returns an em-dash (`—`) for non-monetary actions. It provides consistent, professional monetary presentation across the dashboard and keeps financial figures clean for viva evaluators.

#### `generateToken()`
Generates a random 6-character alphanumeric verification token prefixed with `CONF-` (e.g. `CONF-7K2QX9`) from a base36 character set. It gives human confirmations a tangible, trackable reference code that simulates authentic dual-factor enterprise authorization tickets.

#### `escHtml(s)`
Sanitizes raw strings by escaping HTML entities using the browser's native DOM element text conversion before inserting dynamic content into `innerHTML` strings. It prevents potential Cross-Site Scripting (XSS) issues and injection bugs when displaying user-entered agent names or customer inputs.

#### `getAgentStatus(agent, nowMs)`
Determines the current operational badge for an agent by checking whether `revokedAt` is present (`REVOKED`), whether `validUntil` is earlier than the reference timestamp (`EXPIRED`), or whether the mandate is currently in force (`ACTIVE`). It centralizes status categorization so table renderers, datalists, and test runners evaluate agent lifecycle states identically.

---

### UI Rendering Functions

#### `renderAll()`
The master UI orchestration function that invokes all individual component renderers (`header`, `footer`, agent table, datalists, pending confirmations, policy rules, audit log, and notes). It ensures atomic, predictable screen updates whenever underlying state transitions occur.

#### `renderNotes()`
Injects contextual explanatory notes into the UI, specifically highlighting that agent revocation is permanent and that Air India retains the revocation log on the customer's behalf—mirroring Wells Fargo's banking guidelines for third-party AI agent liability.

#### `renderAgentTable()`
Iterates over the registered agents in `appState.agents`, generates table rows with status badges and validity dates, and dynamically attaches a "Revoke" button to active agents. It isolates DOM updates to the table body to avoid screen flicker.

#### `renderAgentDatalist()`
Populates the HTML `<datalist>` element linked to the request input form with names of currently `ACTIVE` agents. It enhances user experience by offering auto-completion while preventing operators from accidentally selecting revoked or expired bots for new requests.

#### `renderPending()`
Renders the "Waiting for Customer Confirmation" queue by generating actionable cards for all requests currently blocked at `ASK CUSTOMER`. Each card displays the transaction details, the triggering rule, a live minute-countdown to expiry, and "Approve" / "Decline" buttons.

#### `renderRules()`
Builds the reference table detailing rules R1 through R8, colour-coding each rule's resultant decision (`ALLOW` in green, `ASK CUSTOMER` in amber, `BLOCK` in red) and displaying the analytical justification for the Rs. 10,000 threshold.

#### `renderAuditLog()`
Renders the system audit trail table sorted in reverse chronological order (newest entry on top), displaying sequence numbers, local timestamps, customer and agent identifiers, actions, amounts, decisions, rules, and detailed reasons.

#### `renderResult(result, request)`
Displays the highlighted result card immediately below the request form after submission, presenting the large colour-coded decision badge, rule citation, transaction summary, and conversational explanation.

---

### User Actions & Interactive Handlers

#### `handleRevoke(agentName)`
Prompts for user confirmation, locates the active registration for the specified agent, stamps it with the current ISO-8601 timestamp in `revokedAt`, and appends an indelible `REVOKED` record to the audit log. It enforces the non-reversible revocation policy, ensuring any future attempt to act under that agent name immediately hits Rule R2.

#### `handleApprove(token)`
Removes the matched confirmation card from `appState.pendingConfirmations` and records an `APPROVED` entry in the audit log referencing the original token and transaction details. It enables the demonstration of positive human-in-the-loop closure.

#### `handleDecline(token)`
Removes the matched confirmation card from `appState.pendingConfirmations` and records a `DECLINED` entry in the audit log. It documents an explicit human veto against an agent's attempted financial transaction.

#### `checkExpiredTokens()`
A recurring background interval checker running every 5 seconds that compares pending tokens against the current wall-clock time and evicts tokens whose 10-minute lifespan has elapsed. It ensures that stale tokens do not linger indefinitely on the dashboard if unaddressed.

---

### Verification & Self-Test

#### `runSelfTest()`
Constructs an isolated sandbox replica of the register and audit trail (injecting three historical transactions for `BulkBot` to test velocity), evaluates all 8 benchmark test cases against `decide()`, verifies both the decision string and the rule integer, renders an immediate PASS/FAIL scorecard in the UI, and enables the test CSV export button. Crucially, it leaves the live operational audit log completely untouched.

---

### Data Export Handlers

#### `downloadFile(filename, content, mime)`
A universal browser download helper that creates an in-memory `Blob`, attaches it to a transient `<a>` anchor element, triggers a synthetic click, and unloads the object URL. It enables zero-dependency file downloads operating purely within client-side sandboxes.

#### `csvEscape(val)`
Escapes arbitrary text strings for standard RFC-4180 CSV compliance by checking for commas, double quotes, and newlines, and escaping internal quotes. It prevents corrupted CSV exports when reason strings contain punctuation.

#### `downloadAuditCSV()`
Generates a properly formatted CSV representation of the entire historical audit log and triggers an automated download named `audit_log.csv`.

#### `downloadAuditJSON()`
Serializes the entire audit trail into pretty-printed JSON (`audit_log.json`), enabling developers and examiners to inspect raw machine-readable data structures.

#### `downloadTestCSV()`
Exports the results of the latest execution of `runSelfTest()` into `self_test_results.csv`, confirming test coverage and evaluation accuracy for record-keeping.
