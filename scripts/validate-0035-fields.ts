/**
 * Validation script for 0035 investor-grade profile fields.
 * Run with: npx tsx scripts/validate-0035-fields.ts
 * 
 * Tests:
 * 1. Schema validation - all new Zod schemas parse correctly
 * 2. Type consistency - database types match validation schemas
 * 3. Completion logic - new fields contribute to completion %
 * 4. Depth projection - narrative fields appear in visibility projections
 */

import { z } from "zod";

// Import validation schemas
import {
  submitFounderSchema,
  draftFounderSchema,
} from "../lib/validation/applications";
import {
  startupRoundDetailsSchema,
  startupNarrativeSchema,
  type StartupNarrativeInput,
} from "../lib/validation/depth";

// Import completion logic
import {
  founderCompletion,
  type StartupDepthCounts,
} from "../lib/profile/completion";

// Import types
import type {
  ProductStatus,
  CustomerType,
  AverageContractValueBand,
  GrossMarginBand,
  SalesCycleBand,
} from "../types/database";

// Import visibility
import {
  projectStartupDepth,
  type StartupDepthInput,
  type ViewingTier,
} from "../lib/profile/visibility";

// ─────────────────────────────────────────────────────────────────────────────
// Test utilities
// ─────────────────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ✗ ${name}`);
    console.log(`    Error: ${e instanceof Error ? e.message : e}`);
    failed++;
  }
}

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Schema validation tests
// ─────────────────────────────────────────────────────────────────────────────

console.log("\n1. SCHEMA VALIDATION TESTS\n");

test("submitFounderSchema accepts new basics fields", () => {
  const input = {
    companyName: "TestCo",
    oneLiner: "A test company description that is long enough",
    industry: "fintech",
    stage: "seed" as const,
    foundedYear: 2024,
    productStatus: "beta" as const,
    customerType: "smb" as const,
  };
  const result = submitFounderSchema.safeParse(input);
  assert(result.success, `Parse failed: ${JSON.stringify(result.error?.issues)}`);
});

test("submitFounderSchema rejects invalid foundedYear", () => {
  const input = {
    companyName: "TestCo",
    oneLiner: "A test company description that is long enough",
    industry: "fintech",
    stage: "seed" as const,
    foundedYear: 1800, // Too old
  };
  const result = submitFounderSchema.safeParse(input);
  assert(!result.success, "Should reject foundedYear < 1900");
});

test("submitFounderSchema rejects invalid productStatus", () => {
  const input = {
    companyName: "TestCo",
    oneLiner: "A test company description that is long enough",
    industry: "fintech",
    stage: "seed" as const,
    productStatus: "invalid_status" as ProductStatus,
  };
  const result = submitFounderSchema.safeParse(input);
  assert(!result.success, "Should reject invalid productStatus");
});

test("draftFounderSchema allows partial data", () => {
  const input = {
    companyName: "TestCo",
    foundedYear: 2023,
  };
  const result = draftFounderSchema.safeParse(input);
  assert(result.success, `Parse failed: ${JSON.stringify(result.error?.issues)}`);
});

test("startupRoundDetailsSchema accepts runway and milestones", () => {
  const input = {
    instrument: "safe_post_money" as const,
    runway_months_after_raise: 18,
    milestones_summary: "Hire 3 engineers, launch v2, reach $100k ARR",
  };
  const result = startupRoundDetailsSchema.safeParse(input);
  assert(result.success, `Parse failed: ${JSON.stringify(result.error?.issues)}`);
});

test("startupRoundDetailsSchema rejects runway > 120 months", () => {
  const input = {
    runway_months_after_raise: 150,
  };
  const result = startupRoundDetailsSchema.safeParse(input);
  assert(!result.success, "Should reject runway > 120 months");
});

test("startupNarrativeSchema accepts all narrative fields", () => {
  const input: StartupNarrativeInput = {
    problem_statement: "Enterprises waste $10B annually on manual data entry",
    target_customer: "Mid-market CFOs at 500-5000 employee companies",
    current_alternatives: "Excel, legacy ERPs, offshore teams",
    why_alternatives_fail: "Too slow, error-prone, expensive",
    product_summary: "AI-powered data automation platform",
    key_features: "OCR, ML classification, API integrations",
    technical_moat: "Proprietary ML models trained on 10M+ documents",
    roadmap: "Q1: Enterprise SSO, Q2: Salesforce integration",
    target_market: "B2B SaaS for finance teams",
    market_trend: "Growing automation adoption post-COVID",
    beachhead_market: "Series B+ startups in fintech",
    why_now: "GPT-4 made document understanding viable",
    notable_customers: "Stripe, Plaid, Brex",
    customer_proof: "3 Fortune 500 pilots, 2 converted to paid",
    retention_engagement: "95% monthly retention, 4x weekly usage",
    revenue_model: "SaaS subscription with usage-based pricing",
    pricing: "$500/mo base + $0.10/document processed",
    average_contract_value_band: "10k_50k" as const,
    gross_margin_band: "70_85" as const,
    sales_cycle_band: "1_3mo" as const,
    acquisition_channels: "Content marketing, partnerships, outbound",
    current_gtm: "Founder-led sales + inbound from blog",
    planned_gtm: "Hire 2 AEs, launch partner program",
    why_channels_work: "CFOs actively search for automation solutions",
    why_we_win: "10x faster than alternatives, integrates in 1 day",
    defensibility: "Data moat from processing 1M+ docs/month",
    investor_misunderstanding: "Not just OCR - full workflow automation",
    founder_background: "Ex-Stripe, ex-Google, Stanford CS",
    founder_market_fit: "Built internal tools at Stripe, saw the pain",
    technical_strengths: "ML/AI, distributed systems, API design",
    business_strengths: "Enterprise sales, product management",
    advisors: "Former Plaid CTO, Brex CFO",
    key_hires_needed: "VP Sales, Senior ML Engineer",
    technical_risk: "Model accuracy on edge cases",
    market_risk: "Enterprise sales cycles",
    execution_risk: "Scaling support for enterprise customers",
    biggest_unknown: "Will mid-market adopt as fast as startups?",
    failure_scenario: "Incumbents add AI features faster than expected",
  };
  const result = startupNarrativeSchema.safeParse(input);
  assert(result.success, `Parse failed: ${JSON.stringify(result.error?.issues)}`);
});

test("startupNarrativeSchema rejects text exceeding limits", () => {
  const input = {
    problem_statement: "x".repeat(2000), // Limit is 1500
  };
  const result = startupNarrativeSchema.safeParse(input);
  assert(!result.success, "Should reject problem_statement > 1500 chars");
});

test("startupNarrativeSchema accepts empty/partial input", () => {
  const input = {
    problem_statement: "Just this one field",
  };
  const result = startupNarrativeSchema.safeParse(input);
  assert(result.success, `Parse failed: ${JSON.stringify(result.error?.issues)}`);
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Completion logic tests
// ─────────────────────────────────────────────────────────────────────────────

console.log("\n2. COMPLETION LOGIC TESTS\n");

test("founderCompletion includes foundedYear, productStatus, customerType items", () => {
  const result = founderCompletion(null);
  const ids = result.missing.map((m) => m.id);
  assert(ids.includes("foundedYear"), "Missing foundedYear item");
  assert(ids.includes("productStatus"), "Missing productStatus item");
  assert(ids.includes("customerType"), "Missing customerType item");
});

test("founderCompletion includes narrative item", () => {
  const result = founderCompletion(null);
  const ids = result.missing.map((m) => m.id);
  assert(ids.includes("narrative"), "Missing narrative item");
});

test("founderCompletion marks foundedYear done when filled", () => {
  const row = {
    id: "test",
    user_id: "user",
    name: "TestCo",
    one_liner: "A test company with enough description",
    industry: "fintech",
    stage: "seed" as const,
    raise_amount: 1000000,
    traction: "Growing",
    location: "SF",
    deck_url: "https://example.com/deck",
    website: "https://testco.com",
    founded_year: 2023,
    product_status: null,
    customer_type: null,
    deck_storage_key: null,
    deck_filename: null,
    deck_uploaded_at: null,
    startup_sectors: ["fintech"],
    application_status: "pending" as const,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const result = founderCompletion(row);
  const doneIds = result.done.map((d) => d.id);
  assert(doneIds.includes("foundedYear"), "foundedYear should be done");
});

test("founderCompletion marks narrative done when hasNarrative=true", () => {
  const row = {
    id: "test",
    user_id: "user",
    name: "TestCo",
    one_liner: "A test company with enough description",
    industry: "fintech",
    stage: "seed" as const,
    raise_amount: 1000000,
    traction: null,
    location: null,
    deck_url: null,
    website: null,
    founded_year: null,
    product_status: null,
    customer_type: null,
    deck_storage_key: null,
    deck_filename: null,
    deck_uploaded_at: null,
    startup_sectors: [],
    application_status: "pending" as const,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const depth: StartupDepthCounts = {
    teamMembers: 0,
    tractionSignals: 0,
    hasRoundDetails: false,
    hasNarrative: true,
    narrativeFieldsFilled: 5,
  };
  const result = founderCompletion(row, depth);
  const doneIds = result.done.map((d) => d.id);
  assert(doneIds.includes("narrative"), "narrative should be done");
});

test("new basics fields are bonus (base=false), don't block publish", () => {
  const row = {
    id: "test",
    user_id: "user",
    name: "TestCo",
    one_liner: "A test company with enough description here",
    industry: "fintech",
    stage: "seed" as const,
    raise_amount: 1000000,
    traction: "Growing fast",
    location: "San Francisco",
    deck_url: "https://example.com/deck.pdf",
    website: "https://testco.com",
    founded_year: null, // Not filled
    product_status: null, // Not filled
    customer_type: null, // Not filled
    deck_storage_key: null,
    deck_filename: null,
    deck_uploaded_at: null,
    startup_sectors: ["fintech"],
    application_status: "pending" as const,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const result = founderCompletion(row);
  // With all base fields filled, should be able to publish even without new bonus fields
  assert(result.canPublish, "Should be able to publish without bonus fields filled");
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Visibility projection tests
// ─────────────────────────────────────────────────────────────────────────────

console.log("\n3. VISIBILITY PROJECTION TESTS\n");

test("projectStartupDepth includes narrative in output", () => {
  const input: StartupDepthInput = {
    team: [],
    round: null,
    capTable: null,
    useOfFunds: [],
    traction: [],
    market: null,
    competitors: [],
    narrative: {
      id: "n1",
      startup_id: "s1",
      problem_statement: "Test problem",
      target_customer: "Test customer",
      current_alternatives: null,
      why_alternatives_fail: null,
      product_summary: "Test product",
      key_features: null,
      technical_moat: "Test moat",
      roadmap: null,
      target_market: null,
      market_trend: null,
      beachhead_market: null,
      why_now: null,
      notable_customers: null,
      customer_proof: null,
      retention_engagement: null,
      revenue_model: null,
      pricing: null,
      average_contract_value_band: null,
      gross_margin_band: null,
      sales_cycle_band: null,
      acquisition_channels: null,
      current_gtm: null,
      planned_gtm: null,
      why_channels_work: null,
      why_we_win: "Test why we win",
      defensibility: null,
      investor_misunderstanding: null,
      founder_background: "Test background",
      founder_market_fit: null,
      technical_strengths: null,
      business_strengths: null,
      advisors: null,
      key_hires_needed: null,
      technical_risk: null,
      market_risk: null,
      execution_risk: null,
      biggest_unknown: null,
      failure_scenario: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    parent: {
      id: "test-startup",
      deck_url: null,
      deck_storage_key: null,
      traction: null,
    },
  };
  
  const result = projectStartupDepth(input, "owner" as ViewingTier);
  assert(result.narrative !== null, "narrative should be projected");
  assert(result.narrative?.problem_statement === "Test problem", "problem_statement should match");
  assert(result.narrative?.why_we_win === "Test why we win", "why_we_win should match");
});

test("projectStartupDepth returns null narrative when input is null", () => {
  const input: StartupDepthInput = {
    team: [],
    round: null,
    capTable: null,
    useOfFunds: [],
    traction: [],
    market: null,
    competitors: [],
    narrative: null,
    parent: {
      id: "test-startup",
      deck_url: null,
      deck_storage_key: null,
      traction: null,
    },
  };
  
  const result = projectStartupDepth(input, "owner" as ViewingTier);
  assert(result.narrative === null, "narrative should be null");
});

test("round projection includes runway and milestones", () => {
  const input: StartupDepthInput = {
    team: [],
    round: {
      id: "r1",
      startup_id: "s1",
      instrument: "safe_post_money",
      valuation_band: "3_5m",
      target_raise_usd: 500000,
      min_check_usd: 25000,
      lead_status: "soliciting_lead",
      close_by_date: null,
      committed_amount_usd: 100000,
      use_of_funds_summary: "Engineering and GTM",
      instrument_terms_summary: null,
      runway_months_after_raise: 18,
      milestones_summary: "Hire 5 engineers, launch v2",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    capTable: null,
    useOfFunds: [],
    traction: [],
    market: null,
    competitors: [],
    narrative: null,
    parent: {
      id: "test-startup",
      deck_url: null,
      deck_storage_key: null,
      traction: null,
    },
  };
  
  const result = projectStartupDepth(input, "owner" as ViewingTier);
  assert(result.round !== null, "round should be projected");
  assert(result.round?.runway_months_after_raise === 18, "runway should be 18");
  assert(result.round?.milestones_summary === "Hire 5 engineers, launch v2", "milestones should match");
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Type consistency tests
// ─────────────────────────────────────────────────────────────────────────────

console.log("\n4. TYPE CONSISTENCY TESTS\n");

test("ProductStatus enum values match schema", () => {
  const validStatuses: ProductStatus[] = ["idea", "prototype", "beta", "launched", "revenue_generating"];
  for (const status of validStatuses) {
    const result = submitFounderSchema.safeParse({
      companyName: "Test",
      oneLiner: "Test description that is long enough",
      industry: "fintech",
      stage: "seed",
      productStatus: status,
    });
    assert(result.success, `productStatus '${status}' should be valid`);
  }
});

test("CustomerType enum values match schema", () => {
  const validTypes: CustomerType[] = ["consumer", "smb", "enterprise", "developer", "government", "marketplace", "other"];
  for (const type of validTypes) {
    const result = submitFounderSchema.safeParse({
      companyName: "Test",
      oneLiner: "Test description that is long enough",
      industry: "fintech",
      stage: "seed",
      customerType: type,
    });
    assert(result.success, `customerType '${type}' should be valid`);
  }
});

test("ACV band values match schema", () => {
  const validBands: AverageContractValueBand[] = ["under_1k", "1k_10k", "10k_50k", "50k_250k", "250k_1m", "over_1m"];
  for (const band of validBands) {
    const result = startupNarrativeSchema.safeParse({
      average_contract_value_band: band,
    });
    assert(result.success, `ACV band '${band}' should be valid`);
  }
});

test("Gross margin band values match schema", () => {
  const validBands: GrossMarginBand[] = ["under_30", "30_50", "50_70", "70_85", "over_85"];
  for (const band of validBands) {
    const result = startupNarrativeSchema.safeParse({
      gross_margin_band: band,
    });
    assert(result.success, `Gross margin band '${band}' should be valid`);
  }
});

test("Sales cycle band values match schema", () => {
  const validBands: SalesCycleBand[] = ["under_1wk", "1_4wk", "1_3mo", "3_6mo", "6_12mo", "over_12mo"];
  for (const band of validBands) {
    const result = startupNarrativeSchema.safeParse({
      sales_cycle_band: band,
    });
    assert(result.success, `Sales cycle band '${band}' should be valid`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────────────────

console.log("\n" + "─".repeat(60));
console.log(`\nRESULTS: ${passed} passed, ${failed} failed\n`);

if (failed > 0) {
  process.exit(1);
}
