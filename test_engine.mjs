import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read index.html
const htmlPath = path.join(__dirname, 'index.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf8');

// Extract the engine block
const startMarker = '/* ===== ENGINE START ===== */';
const endMarker = '/* ===== ENGINE END ===== */';

const startIndex = htmlContent.indexOf(startMarker);
const endIndex = htmlContent.indexOf(endMarker);

if (startIndex === -1 || endIndex === -1) {
  console.error('Error: ENGINE START or ENGINE END markers not found in index.html');
  process.exit(1);
}

const engineCode = htmlContent.substring(startIndex + startMarker.length, endIndex);

// Minimal stubs for browser globals
const context = {
  console,
  Date,
  Math,
  String,
  Number,
  document: {
    createElement: () => ({ innerHTML: '', textContent: '' })
  },
  localStorage: {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {}
  }
};

vm.createContext(context);
vm.runInContext(engineCode, context);

const { decide, CONFIG } = context;

if (typeof decide !== 'function') {
  console.error('Error: decide function not defined in engine block');
  process.exit(1);
}

const nowMs = Date.now();
const DAY = 86400000;
const HOUR = 3600000;

// Seed agents for sandbox test
const sbAgents = [
  {
    name: 'TripMind',
    customer: 'A. D. Keshri',
    cap: CONFIG.MONEY_LIMIT,
    validUntil: new Date(nowMs + 60 * DAY).toISOString(),
    revokedAt: null,
    registeredAt: new Date(nowMs - 30 * DAY).toISOString()
  },
  {
    name: 'FareScout',
    customer: 'A. D. Keshri',
    cap: CONFIG.MONEY_LIMIT,
    validUntil: new Date(nowMs + 78 * DAY).toISOString(),
    revokedAt: null,
    registeredAt: new Date(nowMs - 20 * DAY).toISOString()
  },
  {
    name: 'OldBot',
    customer: 'A. D. Keshri',
    cap: CONFIG.MONEY_LIMIT,
    validUntil: new Date(nowMs + 30 * DAY).toISOString(),
    revokedAt: new Date(nowMs - 2 * DAY).toISOString(),
    registeredAt: new Date(nowMs - 60 * DAY).toISOString()
  },
  {
    name: 'StaleBot',
    customer: 'A. D. Keshri',
    cap: CONFIG.MONEY_LIMIT,
    validUntil: new Date(nowMs - 5 * DAY).toISOString(),
    revokedAt: null,
    registeredAt: new Date(nowMs - 90 * DAY).toISOString()
  },
  {
    name: 'BulkBot',
    customer: 'A. D. Keshri',
    cap: CONFIG.MONEY_LIMIT,
    validUntil: new Date(nowMs + 87 * DAY).toISOString(),
    revokedAt: null,
    registeredAt: new Date(nowMs - 10 * DAY).toISOString()
  }
];

// Sandbox audit: three earlier ALLOW entries for BulkBot at 2, 6, and 11 hours ago
const sbAudit = [
  {
    seq: 1,
    timestamp: new Date(nowMs - 2 * HOUR).toISOString(),
    customer: 'A. D. Keshri',
    agent: 'BulkBot',
    action: 'book',
    amount: 5000,
    decision: 'ALLOW',
    rule: 4,
    reason: 'Sandbox seed entry'
  },
  {
    seq: 2,
    timestamp: new Date(nowMs - 6 * HOUR).toISOString(),
    customer: 'A. D. Keshri',
    agent: 'BulkBot',
    action: 'book',
    amount: 4000,
    decision: 'ALLOW',
    rule: 4,
    reason: 'Sandbox seed entry'
  },
  {
    seq: 3,
    timestamp: new Date(nowMs - 11 * HOUR).toISOString(),
    customer: 'A. D. Keshri',
    agent: 'BulkBot',
    action: 'book',
    amount: 3500,
    decision: 'ALLOW',
    rule: 4,
    reason: 'Sandbox seed entry'
  }
];

const state = { agents: sbAgents, audit: sbAudit };

const testCases = [
  { id: 'T1', desc: 'Known agent, read-only', agent: 'TripMind', action: 'view_fares', amount: 0, expDec: 'ALLOW', expRule: 3 },
  { id: 'T2', desc: 'Unknown agent tries to book', agent: 'GhostBot', action: 'book', amount: 7500, expDec: 'BLOCK', expRule: 1 },
  { id: 'T3', desc: 'Payment above the limit', agent: 'TripMind', action: 'book', amount: 18400, expDec: 'ASK CUSTOMER', expRule: 5 },
  { id: 'T4', desc: 'Payment below the limit', agent: 'TripMind', action: 'book', amount: 7500, expDec: 'ALLOW', expRule: 4 },
  { id: 'T5', desc: 'Revoked agent, read-only', agent: 'OldBot', action: 'view_fares', amount: 0, expDec: 'BLOCK', expRule: 2 },
  { id: 'T6', desc: 'Refund below the limit', agent: 'FareScout', action: 'refund', amount: 6400, expDec: 'ASK CUSTOMER', expRule: 6 },
  { id: 'T7', desc: 'Expired mandate, change', agent: 'StaleBot', action: 'change', amount: 5000, expDec: 'BLOCK', expRule: 7 },
  { id: 'T8', desc: 'Fourth money action in 24 hours', agent: 'BulkBot', action: 'book', amount: 6000, expDec: 'BLOCK', expRule: 8 }
];

const csvRows = ['Case,Agent,Action,Amount,Expected,Actual,Rule,Status'];
let passedCount = 0;

console.log('='.repeat(92));
console.log(`Agent Gatekeeper — Air India | Engine Headless Test Suite`);
console.log(`Enrolment No: ${CONFIG.ENROLMENT_NO} | Company: ${CONFIG.COMPANY} | Money Limit: Rs. ${CONFIG.MONEY_LIMIT.toLocaleString('en-IN')}`);
console.log('='.repeat(92));
console.log(
  'Case'.padEnd(6) +
  'Agent'.padEnd(12) +
  'Action'.padEnd(13) +
  'Amount'.padEnd(10) +
  'Expected'.padEnd(15) +
  'Actual'.padEnd(15) +
  'Rule'.padEnd(8) +
  'Result'
);
console.log('-'.repeat(92));

for (const tc of testCases) {
  const req = {
    customer: 'A. D. Keshri',
    agent: tc.agent,
    action: tc.action,
    amount: tc.amount
  };

  const res = decide(req, state, nowMs);
  const matchDecision = res.decision === tc.expDec;
  const matchRule = res.rule === tc.expRule;
  const passed = matchDecision && matchRule;

  if (passed) passedCount++;

  const amtStr = tc.amount ? tc.amount.toLocaleString('en-IN') : '-';
  const ruleStr = `R${res.rule}` + (matchRule ? '' : ` (exp R${tc.expRule})`);
  const statusStr = passed ? 'PASS' : 'FAIL';

  console.log(
    tc.id.padEnd(6) +
    tc.agent.padEnd(12) +
    tc.action.padEnd(13) +
    amtStr.padEnd(10) +
    tc.expDec.padEnd(15) +
    res.decision.padEnd(15) +
    ruleStr.padEnd(8) +
    statusStr
  );

  csvRows.push(
    [
      tc.id,
      tc.agent,
      tc.action,
      tc.amount || '-',
      `"${tc.expDec}"`,
      `"${res.decision}"`,
      `R${res.rule}`,
      statusStr
    ].join(',')
  );
}

console.log('-'.repeat(92));
console.log(`Result: ${passedCount}/${testCases.length} passed`);
console.log('='.repeat(92));

// Write test_results.csv
const csvPath = path.join(__dirname, 'test_results.csv');
fs.writeFileSync(csvPath, csvRows.join('\n'), 'utf8');
console.log(`Wrote test results to ${csvPath}`);

if (passedCount !== testCases.length) {
  console.error(`Test failed: ${testCases.length - passedCount} test case(s) did not pass.`);
  process.exit(1);
} else {
  process.exit(0);
}
