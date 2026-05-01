/**
 * Mock recommendation profiles used during onboarding step 3.
 *
 * 12 startups + 12 investors, each fully populated. Every profile is
 * distinct on sector, stage, geography, and tone so the placeholder
 * ranking has signal to work with.
 *
 * Logos are NOT image URLs — the UI renders an Avatar with deterministic
 * initials + colour from `lib/profile/avatar.ts`. This keeps the demo
 * stable (no broken images, no CDN dependency).
 *
 * This file is mock-only. It must not leak into production matching,
 * feed, or analytics paths.
 */

import type {
  InvestorRecommendation,
  StartupRecommendation,
} from "./types";

// ─────────────────────────────────────────────────────────────────────────────
//  Startups (12) — what investors see during onboarding
// ─────────────────────────────────────────────────────────────────────────────

export const MOCK_STARTUPS: StartupRecommendation[] = [
  {
    kind: "startup",
    id: "mock-startup-01",
    name: "Lattice Forge",
    tagline: "Code-aware CI that explains every red build in plain English.",
    description:
      "Lattice Forge sits between GitHub Actions and your team's chat tool. When a build fails it traces the error to the changed lines, summarises the diff in plain English, and posts a fix-or-revert recommendation back to the PR within seconds.",
    sector: "Developer tools",
    stage: "seed",
    location: "San Francisco, CA",
    foundingYear: 2024,
    founderSummary:
      "Two ex-GitHub engineers. CTO led the Actions runtime team for four years; CEO ran developer experience at Vercel and shipped the v0 onboarding.",
    product:
      "GitHub App + CLI. Hooks into existing workflows with a one-line YAML change. Free for open source.",
    traction:
      "1,400 weekly active repos, $32K MRR, three Series-B customers in pilot (Notion, Linear, ClickUp).",
    fundingAsk: "$2.5M seed",
    useOfFunds:
      "Hire two senior engineers, pay for OpenAI inference at scale, and run a six-month enterprise pilot programme.",
    idealInvestor:
      "Devtools-native investor who has shipped CI or developer-experience products before. Bonus if they know enterprise sales motions.",
    websitePlaceholder: "latticeforge.example",
    tags: ["devtools", "ci-cd", "ai", "developer-experience", "github"],
    customerType: "developer",
  },
  {
    kind: "startup",
    id: "mock-startup-02",
    name: "Marrow Health",
    tagline: "Bone-marrow donor matching for the 70% of patients who never find one.",
    description:
      "Marrow Health builds a federated registry that lets transplant centres share donor matches across hospital networks without moving identifiable PHI. We focus on improving match rates for African American, Latino, and multiracial patients who are systematically under-represented in existing registries.",
    sector: "Healthcare",
    stage: "seed",
    location: "Boston, MA",
    foundingYear: 2023,
    founderSummary:
      "CEO is a hematologist-oncologist from Dana-Farber. CTO built infrastructure at Flatiron Health. Clinical advisory board includes the head of bone-marrow transplant at MD Anderson.",
    product:
      "HIPAA-compliant federated query layer plus a clinician-facing match dashboard. Live in two transplant centres.",
    traction:
      "Increased multiracial-patient match rates by 41% in pilot. LOIs from four transplant networks representing 11 hospitals.",
    fundingAsk: "$4M seed",
    useOfFunds:
      "Clinical validation study, two more transplant-centre integrations, and a regulatory affairs hire to push toward broader registry adoption.",
    idealInvestor:
      "Healthcare-focused investor with a track record in clinical software, FDA strategy, or hospital go-to-market.",
    websitePlaceholder: "marrowhealth.example",
    tags: ["healthcare", "biotech", "clinical-software", "health-equity", "regulated"],
    customerType: "enterprise",
  },
  {
    kind: "startup",
    id: "mock-startup-03",
    name: "Quill & Ledger",
    tagline: "AI bookkeeping for venture-backed startups under 50 employees.",
    description:
      "Quill & Ledger replaces the manual transaction-tagging work that bookkeepers do for every venture-backed startup. The AI ingests bank feeds, AWS invoices, and Stripe payouts, classifies each transaction against the company's chart of accounts, and produces investor-ready monthly close packets in 48 hours.",
    sector: "Fintech",
    stage: "pre_seed",
    location: "New York, NY",
    foundingYear: 2024,
    founderSummary:
      "Founders met at Brex — one ran the controller-tools team, the other ran AI at Pilot. Two technical hires from Plaid.",
    product:
      "Closed-beta web app, integrations with QuickBooks Online and Xero, Slack-based monthly review.",
    traction:
      "27 paying companies, $19K MRR, 84% of pilots converted to paid after the first close cycle.",
    fundingAsk: "$1.2M pre-seed",
    useOfFunds:
      "Build out the audit-trail product, hire one ML engineer, and add Rippling and Mercury integrations.",
    idealInvestor:
      "Fintech-savvy investor who understands the controller persona, comfortable with B2B SaaS economics, and willing to write a $250-500K check.",
    websitePlaceholder: "quillandledger.example",
    tags: ["fintech", "ai", "saas", "accounting", "bookkeeping", "b2b"],
    customerType: "smb",
  },
  {
    kind: "startup",
    id: "mock-startup-04",
    name: "Polestar Climate",
    tagline: "Industrial heat pumps that retire factory steam boilers.",
    description:
      "Polestar Climate designs high-temperature industrial heat pumps that replace gas-fired steam boilers in food-and-beverage and chemical plants. We deliver 180°C process heat at 4x the efficiency of gas, paying back the capex in under three years at current US energy prices.",
    sector: "Climate",
    stage: "series_a",
    location: "Berkeley, CA",
    foundingYear: 2022,
    founderSummary:
      "CEO came from Tesla's heat-pump programme. Two PhDs from Stanford ME on the founding team. Hardware leadership from a previous defence-tech exit.",
    product:
      "200kW industrial heat-pump module. Two units in field trial at a craft brewery and a dairy processor.",
    traction:
      "$1.1M in signed pilots, $14M of LOIs from prospective customers, IRA-aligned tax credits secured.",
    fundingAsk: "$18M Series A",
    useOfFunds:
      "Build a contract-manufacturing line in Reno, deploy 12 commercial units in 2026, hire an industrial-sales team.",
    idealInvestor:
      "Climate-tech-native lead investor who has scaled hardware before and is comfortable with manufacturing capex and IRA dynamics.",
    websitePlaceholder: "polestarclimate.example",
    tags: ["climate", "hardware", "industrial", "decarbonisation", "ira", "deeptech"],
    customerType: "enterprise",
  },
  {
    kind: "startup",
    id: "mock-startup-05",
    name: "Glyph",
    tagline: "On-device AI for clinical-grade hearing aids at $400 instead of $4,000.",
    description:
      "Glyph is a sub-$500 hearing aid that runs noise-suppression and speech-isolation models on a custom DSP chip. It targets the 28 million Americans with mild-to-moderate hearing loss who can't justify the cost of premium devices today.",
    sector: "Hardware",
    stage: "seed",
    location: "Austin, TX",
    foundingYear: 2023,
    founderSummary:
      "CEO previously led firmware at Bose Hearphones. CTO is the audio-DSP lead from a major Pixel Buds programme. Clinical advisor is past president of the AAA.",
    product:
      "First-generation hearing aid with companion iOS/Android app. FDA OTC clearance in progress.",
    traction:
      "12,000 person waiting list, $1.4M in pre-orders, two retail-distribution LOIs.",
    fundingAsk: "$3M seed",
    useOfFunds:
      "Finish FDA paperwork, build initial 5,000-unit production run with a Taiwan ODM partner, hire two acoustic engineers.",
    idealInvestor:
      "Hardware-friendly seed investor who has shipped consumer electronics or medical devices before.",
    websitePlaceholder: "glyph.example",
    tags: ["hardware", "consumer-health", "audio", "ai", "fda"],
    customerType: "consumer",
  },
  {
    kind: "startup",
    id: "mock-startup-06",
    name: "Steeple Markets",
    tagline: "Liquidity for the $32B private-credit secondaries market.",
    description:
      "Steeple Markets runs a regulated marketplace where institutional holders of private-credit funds can sell their positions to qualified buyers. We turn what is today a relationship-driven, six-week process into a multi-day RFQ with transparent pricing.",
    sector: "Fintech",
    stage: "seed",
    location: "New York, NY",
    foundingYear: 2024,
    founderSummary:
      "CEO ran private-credit secondaries at Goldman. CTO came from an exit in capital-markets infrastructure. Compliance lead from the SEC.",
    product:
      "FINRA-licensed RFQ platform with audit logs, stress-test reporting, and full KYC/AML.",
    traction:
      "Eight institutional buyers onboarded. First three trades closed at a combined $42M notional.",
    fundingAsk: "$5M seed",
    useOfFunds:
      "Hire two FIX-protocol engineers, expand compliance team, and pursue ATS approval.",
    idealInvestor:
      "Fintech investor with capital-markets experience who can help with broker-dealer relationships.",
    websitePlaceholder: "steeplemarkets.example",
    tags: ["fintech", "capital-markets", "secondaries", "regulated", "b2b"],
    customerType: "enterprise",
  },
  {
    kind: "startup",
    id: "mock-startup-07",
    name: "Atrium Learning",
    tagline: "Teacher-in-the-loop AI tutoring that 3x's reading scores.",
    description:
      "Atrium Learning builds a reading-comprehension tutor that pairs an AI assistant with a human reading specialist. Students get one-to-one practice; teachers get auto-generated progress reports and lesson plans aligned to the science of reading.",
    sector: "Edtech",
    stage: "seed",
    location: "Brooklyn, NY",
    foundingYear: 2023,
    founderSummary:
      "Co-founders are both former Teach For America corps members. Engineering lead came from Khan Academy. Curriculum lead has a PhD from UPenn GSE.",
    product:
      "Web app deployed in K-3 classrooms, with a teacher dashboard, a parent app, and a privacy-reviewed AI assistant.",
    traction:
      "Used in 47 schools across 6 districts; reading-progress scores up an average of 1.8 grade levels in a school year.",
    fundingAsk: "$3.5M seed",
    useOfFunds:
      "Hire a head of school sales, build a Spanish-language version, and run a randomized-controlled study with three districts.",
    idealInvestor:
      "Edtech-focused investor who understands school-district sales cycles and has portfolio support for K-12 GTM.",
    websitePlaceholder: "atriumlearning.example",
    tags: ["edtech", "ai", "k12", "reading", "social-impact"],
    customerType: "government",
  },
  {
    kind: "startup",
    id: "mock-startup-08",
    name: "Silt & Spark",
    tagline: "A neighbourhood fishmonger with same-day catch from local boats.",
    description:
      "Silt & Spark is a direct-to-consumer seafood marketplace that connects independent boats to home cooks. Customers see the boat name, the catch date, and the fishery's sustainability status; everything ships overnight in compostable packaging.",
    sector: "Consumer",
    stage: "pre_seed",
    location: "Portland, ME",
    foundingYear: 2024,
    founderSummary:
      "CEO is a former Whole Foods seafood buyer. CTO previously built marketplace infrastructure at Goldbelly. Operations lead has a master's from URI in fisheries policy.",
    product:
      "Web marketplace, weekly subscription product, compostable shipping system. Live in the Northeast.",
    traction:
      "$240K in trailing-90-day revenue; 38% repeat-purchase rate; 12 partner boats across Maine and New Hampshire.",
    fundingAsk: "$1M pre-seed",
    useOfFunds:
      "Open a second cold-pack facility, build a paid-marketing engine, and onboard 20 more boats by end of next season.",
    idealInvestor:
      "Consumer-marketplace investor comfortable with cold-chain economics. Bonus if they know food-and-beverage CPG channels.",
    websitePlaceholder: "siltandspark.example",
    tags: ["consumer", "marketplace", "food", "sustainability", "dtc"],
    customerType: "consumer",
  },
  {
    kind: "startup",
    id: "mock-startup-09",
    name: "Beacon Trace",
    tagline: "Software supply-chain attestations for regulated industries.",
    description:
      "Beacon Trace generates and verifies cryptographic attestations of every software artefact that ships into a regulated environment. We help defence, finance, and healthcare buyers comply with the new SBOM and Executive Order 14028 requirements without slowing down their vendors.",
    sector: "B2B SaaS",
    stage: "seed",
    location: "Washington, DC",
    foundingYear: 2023,
    founderSummary:
      "Founder team is former NSA Tailored Access plus a security-tools veteran from Snyk. Advisors include the former CISO of a top-3 US bank.",
    product:
      "SaaS attestation service plus open-source Sigstore-compatible client. Used by two defence primes.",
    traction:
      "$420K ARR, three Fortune 500 customers, FedRAMP Moderate authorization in progress.",
    fundingAsk: "$6M seed",
    useOfFunds:
      "Hire two security engineers, finish FedRAMP, expand into the European DORA-compliance market.",
    idealInvestor:
      "B2B SaaS lead with a security or regulated-software portfolio. Comfortable with long enterprise sales cycles.",
    websitePlaceholder: "beacontrace.example",
    tags: ["b2b-saas", "security", "compliance", "supply-chain", "fedramp", "regulated"],
    customerType: "enterprise",
  },
  {
    kind: "startup",
    id: "mock-startup-10",
    name: "Northbeam Robotics",
    tagline: "Autonomous mobile robots for mid-market warehouses.",
    description:
      "Northbeam Robotics ships a turnkey autonomous-mobile-robot fleet for warehouses too small for a Symbotic deployment. Our robots install in a weekend, integrate with existing WMS systems, and pay back capex inside 14 months at typical labour costs.",
    sector: "Hardware",
    stage: "series_a",
    location: "Pittsburgh, PA",
    foundingYear: 2022,
    founderSummary:
      "Founding team came out of CMU's RI plus operations leadership from a previous warehouse-automation exit.",
    product:
      "AMR fleet plus orchestration software. Installed in seven facilities across the Midwest.",
    traction:
      "$3.4M in trailing-12-month revenue, four signed enterprise contracts, one expansion to a second site.",
    fundingAsk: "$22M Series A",
    useOfFunds:
      "Scale manufacturing, build out a 50-person field-engineering team, expand into ambient-temperature 3PL.",
    idealInvestor:
      "Series A lead who has scaled robotics or warehouse-automation businesses before. Comfortable with hardware capex.",
    websitePlaceholder: "northbeamrobotics.example",
    tags: ["hardware", "robotics", "warehouses", "logistics", "automation", "deeptech"],
    customerType: "enterprise",
  },
  {
    kind: "startup",
    id: "mock-startup-11",
    name: "Tessera Bio",
    tagline: "Bench-to-clinic protein-design platform powered by retrieval-augmented LLMs.",
    description:
      "Tessera Bio uses retrieval-augmented protein-language models to design therapeutic candidates 10x faster than conventional discovery. Today we partner with two pharma companies on rare-disease enzyme replacement therapies and target programmes.",
    sector: "Biotech",
    stage: "series_a",
    location: "Cambridge, MA",
    foundingYear: 2022,
    founderSummary:
      "CEO came from Genentech computational biology. Co-founder is a Broad Institute principal investigator. Six PhDs on staff.",
    product:
      "Internal protein-design platform powering partnered programmes. Two candidates in IND-enabling studies.",
    traction:
      "$11M in signed partnership revenue across two pharma deals. One programme cleared lead-optimization milestones a quarter early.",
    fundingAsk: "$35M Series A",
    useOfFunds:
      "Stand up internal pipeline programmes, expand wet-lab capacity in Cambridge, hire two senior medicinal chemists.",
    idealInvestor:
      "Biotech-native lead with experience in platform-plus-pipeline economics and regulatory strategy.",
    websitePlaceholder: "tesserabio.example",
    tags: ["biotech", "ai", "deeptech", "therapeutics", "platform", "regulated"],
    customerType: "enterprise",
  },
  {
    kind: "startup",
    id: "mock-startup-12",
    name: "Drift Markets",
    tagline: "Onchain liquidity for the long tail of regional currencies.",
    description:
      "Drift Markets builds onchain market-making infrastructure for the 80+ regional currencies that today have nearly zero electronic FX liquidity. Our partners use Drift to settle cross-border B2B payments in seconds at fees 10x cheaper than correspondent-bank rails.",
    sector: "Web3",
    stage: "seed",
    location: "Singapore",
    foundingYear: 2023,
    founderSummary:
      "CEO ran FX strategy at a top-tier crypto market maker. CTO previously built oracle infrastructure at a major DeFi protocol. Both holders of CFA and Series 7.",
    product:
      "Permissioned market-making engine plus a settlement API. Live across 11 currency pairs.",
    traction:
      "$80M in trailing-30-day notional volume, $230K in trailing-90-day revenue, two regulated PSP partners.",
    fundingAsk: "$5M seed",
    useOfFunds:
      "Add 20 currency pairs, hire compliance and licensing leads, build into the Asia-Pacific PSP ecosystem.",
    idealInvestor:
      "Web3-fluent investor who understands FX and cross-border payments and is comfortable with regulated rails.",
    websitePlaceholder: "driftmarkets.example",
    tags: ["web3", "fintech", "fx", "payments", "defi", "regulated"],
    customerType: "enterprise",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
//  Investors (12) — what founders see during onboarding
// ─────────────────────────────────────────────────────────────────────────────

export const MOCK_INVESTORS: InvestorRecommendation[] = [
  {
    kind: "investor",
    id: "mock-investor-01",
    name: "Northstone Ventures",
    tagline: "Series A devtools and enterprise infrastructure.",
    investorType: "firm",
    checkRange: "$3M – $8M",
    stages: ["series_a"],
    sectors: ["Developer tools", "B2B SaaS", "Infrastructure"],
    geography: "US + Canada",
    equityPreference: "Lead-only, 15-22% target ownership",
    thesis:
      "We back technical founders who are rebuilding the developer-experience and enterprise-infrastructure layers from first principles, with a clear path to a $100M ARR business.",
    portfolio: [
      "Switchboard (devtools, Series B)",
      "Liminal Cloud (infra, acquired by Snowflake)",
      "Argus Logs (observability, Series A)",
      "Ribbon (devtools, seed)",
      "Casing (security, Series A)",
    ],
    helpsWith: [
      "Series B narrative and metrics work",
      "Enterprise GTM hires (VP Sales, head of CS)",
      "Pricing and packaging for technical buyers",
      "Board governance on engineering-led teams",
    ],
    founderQualities: [
      "Has shipped to engineers at scale before",
      "Comfortable being the first sales rep",
      "Strong opinions on developer experience",
    ],
    websitePlaceholder: "northstoneventures.example",
    tags: ["devtools", "b2b-saas", "infrastructure", "series-a", "lead"],
  },
  {
    kind: "investor",
    id: "mock-investor-02",
    name: "Halverson Capital",
    tagline: "Healthcare and life-sciences investing with a 25-year operator network.",
    investorType: "firm",
    checkRange: "$5M – $20M",
    stages: ["series_a", "series_b_plus"],
    sectors: ["Healthcare", "Biotech", "Health IT"],
    geography: "US + UK",
    equityPreference: "Lead, board seat, 18-25% target ownership",
    thesis:
      "We invest in companies that change cost-of-care or clinical outcomes for at least one diagnosis category. We bring deep payer, provider, and regulatory networks.",
    portfolio: [
      "Marrow Health (registry, seed-led)",
      "Helix Pediatrics (clinical SaaS, Series B)",
      "Caracal Therapeutics (biotech, IPO)",
      "Lumen Health (HRT, Series A)",
      "Brae Diagnostics (lab software, acquired)",
    ],
    helpsWith: [
      "FDA strategy and regulatory affairs hires",
      "Hospital-network introductions",
      "Payer-contract negotiations",
      "Clinical advisory board recruiting",
    ],
    founderQualities: [
      "Clinical or scientific co-founder on the team",
      "Patient-impact thesis they can articulate in plain English",
      "Realistic about regulatory timelines",
    ],
    websitePlaceholder: "halversoncapital.example",
    tags: ["healthcare", "biotech", "regulated", "series-a", "series-b", "lead"],
  },
  {
    kind: "investor",
    id: "mock-investor-03",
    name: "Lila Patel",
    tagline: "Solo angel and former Stripe operator. Fintech and B2B SaaS.",
    investorType: "angel",
    checkRange: "$50K – $250K",
    stages: ["pre_seed", "seed"],
    sectors: ["Fintech", "B2B SaaS"],
    geography: "Global, English-speaking",
    equityPreference: "Follow-on or co-invest only",
    thesis:
      "I write small first checks for fintech and B2B SaaS founders who are building for a specific buyer persona I've worked with before — controllers, AP teams, and platform-risk leads.",
    portfolio: [
      "Quill & Ledger (fintech, pre-seed)",
      "Padlock Risk (security, seed)",
      "Tabletop Payments (fintech, seed)",
      "Beam Reporting (B2B SaaS, pre-seed)",
      "Hatchpoint (HR tech, seed)",
    ],
    helpsWith: [
      "Operator intros at Stripe, Brex, and Mercury",
      "Pricing pages and self-serve onboarding teardowns",
      "Recruiting first 5-10 engineering and design hires",
    ],
    founderQualities: [
      "Has owned at least one B2B SaaS roadmap end-to-end before",
      "Writes well — clear thinking on the product page",
      "Customer-obsessed in conversation",
    ],
    websitePlaceholder: "lila.example",
    tags: ["fintech", "b2b-saas", "angel", "pre-seed", "seed", "operator"],
  },
  {
    kind: "investor",
    id: "mock-investor-04",
    name: "Pylon Climate Capital",
    tagline: "Series A climate-hardware and industrial decarbonisation.",
    investorType: "firm",
    checkRange: "$10M – $25M",
    stages: ["series_a"],
    sectors: ["Climate", "Hardware", "Industrial"],
    geography: "North America + Europe",
    equityPreference: "Lead, 18-22% target ownership",
    thesis:
      "We lead climate-hardware Series A rounds when a company has at least one paying industrial customer and a credible IRA-aligned path to gigawatt-scale capacity.",
    portfolio: [
      "Polestar Climate (heat pumps, Series A)",
      "Foundry Hydrogen (electrolysers, Series A)",
      "Mantle Energy (storage, Series B)",
      "Cadence Recycling (chemical recycling, Series A)",
      "Auger Cement (cement, seed-extension)",
    ],
    helpsWith: [
      "IRA tax-credit and DOE-loan navigation",
      "Industrial customer introductions",
      "Manufacturing-engineering hires",
      "Long-form Series-B narrative work",
    ],
    founderQualities: [
      "Hardware shipping experience at scale",
      "Comfort with industrial-customer sales cycles",
      "Realistic about capex and unit economics",
    ],
    websitePlaceholder: "pylonclimate.example",
    tags: ["climate", "hardware", "industrial", "deeptech", "series-a", "lead", "ira"],
  },
  {
    kind: "investor",
    id: "mock-investor-05",
    name: "Ravi Shah",
    tagline: "Devtools angel. First-cheque writer for technical founders.",
    investorType: "angel",
    checkRange: "$25K – $150K",
    stages: ["pre_seed", "seed"],
    sectors: ["Developer tools", "Infrastructure", "AI"],
    geography: "Global",
    equityPreference: "Follow",
    thesis:
      "I write small first checks for technical founders building developer-experience and infrastructure tools. I prefer founders shipping in public.",
    portfolio: [
      "Lattice Forge (devtools, seed)",
      "Stamp Sigchain (security, seed)",
      "Modular Bench (AI infra, seed)",
      "Codepath Labs (devtools, pre-seed)",
      "Glimmer Logs (observability, pre-seed)",
    ],
    helpsWith: [
      "Recruiting senior engineers from FAANG",
      "Open-source distribution strategy",
      "Founders-as-DevRel playbook",
    ],
    founderQualities: [
      "Ships in public — public PRs, blog posts, conference talks",
      "Prior devtools or platform experience",
      "Clear writer with strong opinions",
    ],
    websitePlaceholder: "ravi.example",
    tags: ["devtools", "ai", "infrastructure", "angel", "pre-seed", "operator"],
  },
  {
    kind: "investor",
    id: "mock-investor-06",
    name: "Beacon Public Ventures",
    tagline: "Govtech, edtech, and impact-oriented B2B SaaS.",
    investorType: "firm",
    checkRange: "$1M – $5M",
    stages: ["seed", "series_a"],
    sectors: ["Edtech", "Govtech", "Civic Tech"],
    geography: "US",
    equityPreference: "Lead or co-lead, 12-18% target ownership",
    thesis:
      "We back companies whose customer is a school district, a city government, or a nonprofit health system. We help with procurement and grant-funded GTM.",
    portfolio: [
      "Atrium Learning (edtech, seed)",
      "Civic Stack (govtech, Series A)",
      "Resolve Care (community-health SaaS, seed)",
      "Foundation Books (school libraries, seed)",
      "Open Permits (govtech, Series A)",
    ],
    helpsWith: [
      "RFP and procurement strategy",
      "ESSER and Title-I funding navigation",
      "School-district and city-government intros",
      "Outcome-measurement frameworks",
    ],
    founderQualities: [
      "Mission-driven without being preachy",
      "Realistic about long sales cycles",
      "Has worked inside a district, city, or nonprofit before",
    ],
    websitePlaceholder: "beaconpublic.example",
    tags: ["edtech", "govtech", "social-impact", "k12", "seed", "series-a", "lead"],
  },
  {
    kind: "investor",
    id: "mock-investor-07",
    name: "Tessellate Partners",
    tagline: "Seed-stage AI applications and tooling.",
    investorType: "firm",
    checkRange: "$1M – $4M",
    stages: ["seed"],
    sectors: ["AI", "Developer tools", "B2B SaaS"],
    geography: "Global, English-speaking",
    equityPreference: "Lead or co-lead, 12-18% target ownership",
    thesis:
      "We back applied-AI companies where the moat is product, distribution, or proprietary data — not the model. We help with go-to-market and pricing.",
    portfolio: [
      "Quill & Ledger (fintech, pre-seed)",
      "Echo Voice (AI consumer, seed)",
      "Beacon Trace (security, seed)",
      "Lattice Forge (devtools, seed)",
      "Rangefinder Insights (B2B SaaS, seed)",
    ],
    helpsWith: [
      "Pricing and packaging for AI products",
      "OpenAI and Anthropic enterprise relationships",
      "Recruiting applied-ML and product-design hires",
      "Series A narrative work",
    ],
    founderQualities: [
      "Strong product taste",
      "Has shipped to a customer before, not just a model demo",
      "Clear point of view on the moat",
    ],
    websitePlaceholder: "tessellate.example",
    tags: ["ai", "b2b-saas", "devtools", "seed", "lead", "applied-ai"],
  },
  {
    kind: "investor",
    id: "mock-investor-08",
    name: "Marcus Chen",
    tagline: "Angel for consumer marketplaces and food-and-beverage CPG.",
    investorType: "angel",
    checkRange: "$50K – $200K",
    stages: ["pre_seed", "seed"],
    sectors: ["Consumer", "Marketplace", "Food & Beverage"],
    geography: "North America",
    equityPreference: "Follow",
    thesis:
      "I back consumer-marketplace and CPG founders with strong unit economics and an obsession with the product experience. I prefer brands with a real perspective.",
    portfolio: [
      "Silt & Spark (consumer marketplace, pre-seed)",
      "Larder & Loft (CPG, seed)",
      "Tonn Tackle (DTC, pre-seed)",
      "Flora Bath (CPG, seed)",
      "Quay Foods (marketplace, seed)",
    ],
    helpsWith: [
      "Cold-chain and 3PL operator intros",
      "Whole Foods and specialty-retail buyer relationships",
      "Founder-led-marketing playbooks",
    ],
    founderQualities: [
      "Strong taste and design instincts",
      "Has a real opinion on the customer experience",
      "Numerate on unit economics",
    ],
    websitePlaceholder: "marcus.example",
    tags: ["consumer", "marketplace", "food", "cpg", "angel", "pre-seed", "operator"],
  },
  {
    kind: "investor",
    id: "mock-investor-09",
    name: "Foreland Security Partners",
    tagline: "Series A cyber, compliance, and regulated SaaS.",
    investorType: "firm",
    checkRange: "$5M – $15M",
    stages: ["series_a"],
    sectors: ["Security", "Compliance", "B2B SaaS"],
    geography: "US + Israel",
    equityPreference: "Lead, 15-20% target ownership",
    thesis:
      "We lead cyber Series A rounds where the company has at least three Fortune 500 customers and a clear path to FedRAMP or equivalent.",
    portfolio: [
      "Beacon Trace (security, seed)",
      "Sentinel CSPM (cloud-security, Series A)",
      "Manifold IAM (identity, Series A)",
      "Anvil Compliance (GRC, Series A)",
      "Marlow Backup (resilience, Series B)",
    ],
    helpsWith: [
      "FedRAMP and StateRAMP navigation",
      "CISO advisory-board recruiting",
      "Enterprise pricing and packaging",
      "Series B-narrative work",
    ],
    founderQualities: [
      "Security-domain expertise (founding team or first hires)",
      "Comfort with multi-quarter enterprise sales",
      "Clear plan for distribution beyond CISO friend-and-family",
    ],
    websitePlaceholder: "forelandsecurity.example",
    tags: ["b2b-saas", "security", "compliance", "regulated", "series-a", "lead", "fedramp"],
  },
  {
    kind: "investor",
    id: "mock-investor-10",
    name: "Aishwarya Rao",
    tagline: "Angel for biotech and healthcare-software founders.",
    investorType: "angel",
    checkRange: "$50K – $250K",
    stages: ["seed"],
    sectors: ["Biotech", "Healthcare", "Health IT"],
    geography: "US",
    equityPreference: "Follow or co-invest",
    thesis:
      "I write small checks for biotech and healthcare-software founders working on under-served patient populations. I prefer founders with at least one author-listed clinical publication.",
    portfolio: [
      "Marrow Health (registry, seed)",
      "Tessera Bio (biotech, Series A)",
      "Hyacinth Oncology (biotech, seed)",
      "Vista Mental (clinical software, seed)",
      "Lonsdale Diagnostics (lab software, seed)",
    ],
    helpsWith: [
      "Clinical-advisory-board recruiting",
      "Patient-advocacy-organization intros",
      "FDA and CMS strategic context",
    ],
    founderQualities: [
      "Clinical or scientific co-founder",
      "Realistic about regulatory and reimbursement timelines",
      "Mission-aligned with under-served patients",
    ],
    websitePlaceholder: "aishwarya.example",
    tags: ["biotech", "healthcare", "regulated", "angel", "seed", "operator"],
  },
  {
    kind: "investor",
    id: "mock-investor-11",
    name: "Argonaut Crypto Ventures",
    tagline: "Seed and Series A web3 infrastructure with regulated-rails focus.",
    investorType: "firm",
    checkRange: "$2M – $7M",
    stages: ["seed", "series_a"],
    sectors: ["Web3", "Fintech", "Infrastructure"],
    geography: "Global",
    equityPreference: "Lead or co-lead, 12-18% target ownership",
    thesis:
      "We back web3 infrastructure companies that operate inside a regulatory perimeter. We avoid pure consumer crypto and pure DeFi protocols.",
    portfolio: [
      "Drift Markets (FX, seed)",
      "Onchain Reserves (treasury, Series A)",
      "Chord Custody (institutional custody, Series A)",
      "Rampway (payments, seed)",
      "Indigo Stables (stablecoin, Series A)",
    ],
    helpsWith: [
      "Regulator and broker-dealer intros",
      "Treasury management and OTC desks",
      "Compliance and licensing work-streams",
    ],
    founderQualities: [
      "Capital-markets or regulator experience on the team",
      "Comfortable saying no to crypto-trading-style narratives",
      "Strong compliance hygiene from day one",
    ],
    websitePlaceholder: "argonautcrypto.example",
    tags: ["web3", "fintech", "infrastructure", "regulated", "seed", "series-a", "lead"],
  },
  {
    kind: "investor",
    id: "mock-investor-12",
    name: "Greenshield Frontier Fund",
    tagline: "Seed deeptech across robotics, hardware, and applied physics.",
    investorType: "firm",
    checkRange: "$2M – $6M",
    stages: ["seed"],
    sectors: ["Hardware", "Robotics", "Deeptech"],
    geography: "North America + Europe",
    equityPreference: "Lead or co-lead, 15-20% target ownership",
    thesis:
      "We lead deeptech seed rounds where a credible team is taking lab-validated technology toward a first commercial deployment in 24 months.",
    portfolio: [
      "Northbeam Robotics (warehouses, Series A)",
      "Glyph (hearing aids, seed)",
      "Beacon Bonsai (agtech, seed)",
      "Forge Vehicles (hardware, seed)",
      "Sable Optics (deeptech, Series A)",
    ],
    helpsWith: [
      "Manufacturing-engineering and ops hires",
      "Defence, energy, and industrial customer intros",
      "Capex strategy for hardware companies",
      "Deeptech-style Series A narrative",
    ],
    founderQualities: [
      "Has shipped a hardware product before, even at lab-prototype scale",
      "Comfort with capex and supply-chain reality",
      "Clear plan for first paying customer",
    ],
    websitePlaceholder: "greenshield.example",
    tags: ["hardware", "robotics", "deeptech", "industrial", "seed", "lead"],
  },
];

/**
 * Convenience: return the candidate pool for a given user role. Founders
 * see investors; investors see startups; anything else returns an empty
 * array (the UI handles the empty case with a fallback message).
 */
export function candidatesForRole(
  role: "founder" | "investor" | null | undefined,
): readonly (StartupRecommendation | InvestorRecommendation)[] {
  if (role === "founder") return MOCK_INVESTORS;
  if (role === "investor") return MOCK_STARTUPS;
  return [];
}
