#!/usr/bin/env node
// Deploys Zyven's SQL migrations to Supabase via the Management API.
//
// Requires:
//   SUPABASE_ACCESS_TOKEN  — create at supabase.com → Account → Access Tokens
//   SUPABASE_PROJECT_REF   — or SUPABASE_URL / VITE_SUPABASE_URL (ref is parsed from it)
//
// Usage:
//   SUPABASE_ACCESS_TOKEN=sbp_... bun run db:deploy
//
// Idempotent: every file uses CREATE OR REPLACE / IF NOT EXISTS, so it is safe to re-run.

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) {
  console.error('✗ SUPABASE_ACCESS_TOKEN is not set.');
  console.error('  Create one at https://supabase.com/dashboard/account/tokens');
  console.error('  Then run: SUPABASE_ACCESS_TOKEN=sbp_... bun run db:deploy');
  process.exit(1);
}

const ref =
  process.env.SUPABASE_PROJECT_REF ||
  [process.env.SUPABASE_URL, process.env.VITE_SUPABASE_URL]
    .find(Boolean)
    ?.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];

if (!ref) {
  console.error('✗ Could not determine the project ref. Set SUPABASE_PROJECT_REF (or SUPABASE_URL / VITE_SUPABASE_URL).');
  process.exit(1);
}

console.log(`→ Deploying SQL to project ${ref}…\n`);

const files = ['supabase/rpc_process_sale.sql', 'supabase/rpc_record_payment.sql'];

for (const file of files) {
  const sql = readFileSync(join(root, file), 'utf8');
  process.stdout.write(`  ${file} … `);
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });

  if (res.ok) {
    console.log('✓ applied');
  } else {
    const body = await res.text();
    console.log('✗ failed');
    console.error(`\nHTTP ${res.status}: ${body.slice(0, 800)}`);
    console.error(`\n✗ ${file} failed — fix the error above and re-run (safe to re-run, everything is idempotent).`);
    process.exit(1);
  }
}

console.log('\n✓ All migrations applied. POS sales and customer payments now use atomic RPCs.');
console.log('  Verify: open Zyven → POS → complete a sale (should succeed instantly).');
