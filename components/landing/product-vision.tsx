import type { ReactNode } from "react";
import { Reveal } from "@/components/landing/reveal";
import { MediaSlot } from "@/components/landing/media-slot";

/**
 * ProductVision — asymmetric bento that maps the post-MVP roadmap.
 *
 * Layout intent (the opposite of "six identical icon cards"):
 *   - 12-column grid, three rows: 7+5, 4+8, 5+7
 *   - Mixed surfaces (white / surface-2) so neighbors never look the same
 *   - Index numbers appear on some cards, audience tags on others
 *   - Two cards host real media slots; three host bespoke in-card visuals;
 *     one is text-only and split internally — every card has its own logic
 *
 * Side-neutral copy throughout.
 */

export function ProductVision() {
  return (
    <section
      id="vision"
      className="border-b border-[color:var(--color-border)] bg-[color:var(--color-bg)]"
    >
      <div className="mx-auto max-w-[1280px] px-6 py-24 md:py-32">
        {/* ---------- Section head ---------- */}
        <div className="grid grid-cols-1 gap-10 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-16">
          <div>
            <Reveal>
              <p className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-[color:var(--color-text-faint)]">
                Where this is going
              </p>
            </Reveal>
            <Reveal delay={80}>
              <h2
                className="mt-5 max-w-[15ch] text-balance font-semibold tracking-[-0.014em] text-[color:var(--color-text-strong)]"
                style={{ fontSize: "var(--type-h2)", lineHeight: 1.05 }}
              >
                The match is the start, not the product.
              </h2>
            </Reveal>
          </div>
          <Reveal delay={140}>
            <p className="max-w-[54ch] text-[15px] leading-[1.65] text-[color:var(--color-text-muted)] md:pt-2">
              Once founders and investors find each other, the work begins.
              VentraMatch is shipping the layer that traditional databases
              skip: readiness, deal memos, outreach, and the room itself.
            </p>
          </Reveal>
        </div>

        {/* ---------- Asymmetric bento ---------- */}
        <div className="mt-16 grid grid-cols-1 gap-4 md:mt-20 md:grid-cols-12">
          {/* Card 1 · Readiness score · 7-wide · media slot E */}
          <Reveal as="div" className="md:col-span-7">
            <article className="group relative flex h-full flex-col overflow-hidden rounded-[18px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 md:p-8">
              <CardIndex n="01" />
              <h3 className="mt-2 max-w-[22ch] text-[22px] font-semibold leading-[1.15] tracking-[-0.012em] text-[color:var(--color-text-strong)] md:text-[24px]">
                Fundraising readiness score
              </h3>
              <p className="mt-3 max-w-[44ch] text-[14px] leading-[1.6] text-[color:var(--color-text-muted)]">
                A pre-flight check before you waste an investor&apos;s time.
                Deck quality, traction signal, market timing, founder–market
                fit — surfaced before you click send.
              </p>
              <div className="mt-7 flex-1">
                <MediaSlot slot="visionReadiness" className="rounded-[12px]" />
              </div>
            </article>
          </Reveal>

          {/* Card 2 · AI deal memo · 5-wide · in-card mock */}
          <Reveal delay={60} as="div" className="md:col-span-5">
            <article className="group/memo relative flex h-full flex-col rounded-[18px] border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] p-6 md:p-8">
              <CardIndex n="02" />
              <h3 className="mt-2 max-w-[18ch] text-[22px] font-semibold leading-[1.15] tracking-[-0.012em] text-[color:var(--color-text-strong)]">
                AI deal memo
              </h3>
              <p className="mt-3 text-[14px] leading-[1.6] text-[color:var(--color-text-muted)]">
                Every startup profile becomes a one-page memo: problem,
                solution, market, traction, risks, why now.
              </p>
              <div className="mt-7 flex-1">
                <DealMemoMock />
              </div>
            </article>
          </Reveal>

          {/* Card 3 · Investor pipeline · 4-wide · screenshot */}
          <Reveal delay={120} as="div" className="md:col-span-4">
            <article className="relative grid h-full place-items-center overflow-hidden rounded-[18px] border border-[color:var(--color-brand)] bg-[color:var(--color-brand-tint)]">
              <img
                src="/media/pipeline-mock.png"
                alt="Investor pipeline — status tracking for every conversation"
                className="w-[110%] max-w-none object-contain"
                style={{ marginLeft: "-30%" }}
              />
            </article>
          </Reveal>

          {/* Card 4 · Outreach · 8-wide · split layout w/ media slot F */}
          <Reveal delay={180} as="div" className="md:col-span-8">
            <article className="relative h-full overflow-hidden rounded-[18px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 md:p-8">
              <CardIndex n="04" />
              <div className="mt-2 grid gap-7 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:items-center md:gap-10">
                <div>
                  <h3 className="max-w-[22ch] text-[22px] font-semibold leading-[1.15] tracking-[-0.012em] text-[color:var(--color-text-strong)]">
                    Outreach grounded in their thesis.
                  </h3>
                  <p className="mt-3 text-[14px] leading-[1.6] text-[color:var(--color-text-muted)]">
                    Personalized intros built from each investor&apos;s stated
                    focus and recent checks. Specific — not &ldquo;Dear Sir or
                    Madam.&rdquo;
                  </p>
                </div>
                <MediaSlot slot="visionOutreach" className="rounded-[12px]" />
              </div>
            </article>
          </Reveal>

          {/* Card 5 · Data rooms · 5-wide · in-card mock */}
          <Reveal delay={240} as="div" className="md:col-span-5">
            <article className="relative flex h-full flex-col rounded-[18px] border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] p-6 md:p-8">
              <AudienceTag>both sides</AudienceTag>
              <h3 className="mt-3 max-w-[20ch] text-[20px] font-semibold leading-[1.18] tracking-[-0.012em] text-[color:var(--color-text-strong)]">
                Data rooms with a verifiable audit trail.
              </h3>
              <p className="mt-3 text-[14px] leading-[1.6] text-[color:var(--color-text-muted)]">
                Scoped uploads, time-bound access, and a log of every viewer.
              </p>
              <div className="mt-6 flex-1">
                <FilesMock />
              </div>
            </article>
          </Reveal>

          {/* Card 6 · Demo days + investor updates · 7-wide · text-only split */}
          <Reveal delay={300} as="div" className="md:col-span-7">
            <article className="relative flex h-full flex-col rounded-[18px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 md:p-8">
              <CardIndex n="06" />
              <div className="mt-2 grid gap-6 md:grid-cols-2 md:gap-8">
                <div>
                  <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-[color:var(--color-text-faint)]">
                    Demo days
                  </p>
                  <h3 className="mt-2 text-[18px] font-semibold leading-[1.22] tracking-[-0.01em] text-[color:var(--color-text-strong)]">
                    Curated cohorts to scan in one session.
                  </h3>
                </div>
                <div className="md:border-l md:border-[color:var(--color-border)] md:pl-8">
                  <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-[color:var(--color-text-faint)]">
                    Investor updates
                  </p>
                  <h3 className="mt-2 text-[18px] font-semibold leading-[1.22] tracking-[-0.01em] text-[color:var(--color-text-strong)]">
                    Ship monthly progress to the people watching.
                  </h3>
                </div>
              </div>
              <p className="mt-7 max-w-[60ch] text-[14px] leading-[1.6] text-[color:var(--color-text-muted)]">
                Many investors track founders for two or three quarters before
                they commit. We make that loop one click for both sides.
              </p>
            </article>
          </Reveal>
        </div>

        {/* ---------- Footnote ---------- */}
        <Reveal delay={120}>
          <p className="mt-12 max-w-[64ch] text-[13px] leading-[1.65] text-[color:var(--color-text-faint)]">
            Roadmap, not promises. Order and scope shift with what founders
            and investors actually use.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

/* ---------------- Internal primitives ---------------- */

function CardIndex({ n }: { n: string }) {
  return (
    <span className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-[color:var(--color-text-faint)]">
      {n}
    </span>
  );
}

function AudienceTag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 self-start rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-bg)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-[color:var(--color-text-muted)]">
      <span className="h-1 w-1 rounded-full bg-[color:var(--color-brand)]" />
      {children}
    </span>
  );
}

/* ---------------- In-card visual mocks (no fake product UI) ---------------- */

/**
 * AI deal memo mock — two states inside one box.
 *   • Idle: four memo cards stacked vertically with even spacing. Each card
 *     shows a real company logo, the company name, and a one-line memo.
 *   • Hover: the static stack fades out and a slow vertical carousel of 15
 *     memos fades in, scrolling upward with masked top + bottom edges so it
 *     reads as an endless feed.
 *
 * The hover trigger lives on the parent article (`group/memo`); any pointer
 * over the AI-deal-memo card swaps states. `:focus-within` mirrors hover for
 * keyboard users.
 */

type Brand = {
  name: string;
  color: string;
  bg: string;
  memo: string;
  svg?: { viewBox: string; path: string; size: number };
  letter?: string;
};

const BRANDS: Brand[] = [
  {
    name: "Linear",
    color: "#5E6AD2",
    bg: "#F4F4FB",
    memo: "Issue tracking ICs actually open. Quiet enterprise creep underneath.",
    svg: {
      viewBox: "0 0 24 24",
      size: 18,
      path: "M.403 13.795l9.802 9.802c4.067-1.18 7.267-4.38 8.447-8.447L.403 13.795zM.144 11.566L12.434 23.856c.327.027.658.04.992.04C19.852 23.896 24 19.748 24 13.575c0-.334-.013-.665-.04-.992L.144 11.566zm.351-2.198l14.337 14.337c2.71-.674 5.084-2.16 6.918-4.262L.495 9.368zm.998-2.428l11.738 11.738c-1.85-.65-3.6-1.53-5.18-2.61L1.493 6.94zm1.605-1.756L8.586 10.66c-1.073-1.5-1.93-3.225-2.534-5.083L3.098 5.184z",
    },
  },
  {
    name: "Vercel",
    color: "#000000",
    bg: "#FAFAFA",
    memo: "Frontend cloud built for Next.js. Cloudflare can't catch the DX.",
    svg: {
      viewBox: "0 0 24 24",
      size: 14,
      path: "M24 22.525H0l12-21.05 12 21.05z",
    },
  },
  {
    name: "Anthropic",
    color: "#181818",
    bg: "#F5F1EA",
    memo: "The model enterprise legal will sign off on. Pricing power is real.",
    svg: {
      viewBox: "0 0 24 24",
      size: 16,
      path: "M17.3041 3.541h-3.6718l6.696 16.918H24Zm-10.6082 0L0 20.459h3.7442l1.3693-3.5527h7.0052l1.3693 3.5527h3.7442L10.5363 3.541Zm-.3712 10.2232 2.2914-5.9456 2.2914 5.9456Z",
    },
  },
  {
    name: "Notion",
    color: "#000000",
    bg: "#F7F6F3",
    memo: "Workspace OS plus AI sidebar. New $400M of net-new ARR last year.",
    svg: {
      viewBox: "0 0 24 24",
      size: 16,
      path: "M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM1.936.279c.793-.046 1.66-.092 2.5-.092L17.252.466c.466 0 1.119.187 1.866.747l3.83 2.71C23.33 4.39 23.86 4.85 23.86 5.224v15.93c0 .747-.327 1.214-1.214 1.26L7.215 23.346c-.7.046-1.215-.046-1.775-.42l-3.456-2.522C1.469 19.987 1 19.475 1 18.866V2.296C1 1.69 1.28 1.13 1.936.28z",
    },
  },
  {
    name: "Stripe",
    color: "#635BFF",
    bg: "#EFEFFF",
    memo: "Default API for internet revenue. $1T processed in 2025.",
    svg: {
      viewBox: "0 0 24 24",
      size: 16,
      path: "M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.594-7.305h.003z",
    },
  },
  {
    name: "OpenAI",
    color: "#000000",
    bg: "#FAFAFA",
    memo: "ChatGPT is a behavior shift, not a chatbot. Distribution moat first.",
    svg: {
      viewBox: "0 0 24 24",
      size: 16,
      path: "M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.4069-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z",
    },
  },
  {
    name: "Figma",
    color: "#F24E1E",
    bg: "#FFF1ED",
    memo: "Multiplayer is the moat. Adobe couldn't replicate it in 18 months.",
    svg: {
      viewBox: "0 0 24 24",
      size: 16,
      path: "M15.852 8.981h-4.588V0h4.588c2.476 0 4.49 2.014 4.49 4.49s-2.014 4.491-4.49 4.491zM12.735 7.51h3.117c1.665 0 3.019-1.355 3.019-3.019s-1.354-3.02-3.019-3.02h-3.117V7.51zm0 1.471H8.148c-2.476 0-4.49-2.014-4.49-4.49S5.672 0 8.148 0h4.587v8.981zm-4.587-7.51c-1.665 0-3.019 1.355-3.019 3.02s1.354 3.019 3.019 3.019h3.117V1.471H8.148zm4.587 15.019H8.148c-2.476 0-4.49-2.014-4.49-4.49s2.014-4.49 4.49-4.49h4.587v8.98zM8.148 8.981c-1.665 0-3.019 1.355-3.019 3.019s1.354 3.02 3.019 3.02h3.117V8.981H8.148zM8.172 24c-2.489 0-4.515-2.014-4.515-4.49s2.014-4.49 4.49-4.49h4.588v4.441c0 2.503-2.047 4.539-4.563 4.539zm-.024-7.51a3.023 3.023 0 0 0-3.019 3.02c0 1.665 1.365 3.019 3.044 3.019 1.705 0 3.093-1.376 3.093-3.068v-2.971H8.148zm7.704 0h-.098c-2.476 0-4.49-2.014-4.49-4.49s2.014-4.49 4.49-4.49h.098c2.476 0 4.49 2.014 4.49 4.49s-2.014 4.49-4.49 4.49zm-.097-7.509c-1.665 0-3.019 1.355-3.019 3.019s1.354 3.02 3.019 3.02h.098c1.665 0 3.019-1.355 3.019-3.02s-1.355-3.019-3.019-3.019h-.098z",
    },
  },
  {
    name: "Supabase",
    color: "#3FCF8E",
    bg: "#ECFBF5",
    memo: "Open-source Firebase shipping AI primitives weekly. Devs vote with the CLI.",
    svg: {
      viewBox: "0 0 24 24",
      size: 16,
      path: "M21.362 9.354H12V.396a.396.396 0 0 0-.716-.233L2.203 12.424l-.401.562a1.04 1.04 0 0 0 .836 1.659H12v8.959a.396.396 0 0 0 .716.233l9.081-12.261.401-.562a1.04 1.04 0 0 0-.836-1.66z",
    },
  },
  {
    name: "Replit",
    color: "#F26207",
    bg: "#FFEFE2",
    memo: "Agents that write and ship apps. 30M devs already on the free tier.",
    svg: {
      viewBox: "0 0 24 24",
      size: 16,
      path: "M5.882 0a3.531 3.531 0 0 0-3.53 3.531v4.703h7.06V0Zm3.53 8.235v7.061H16.47V8.236Zm0 7.061H2.353v5.171A3.531 3.531 0 0 0 5.883 24h3.53Z",
    },
  },
  {
    name: "Cursor",
    color: "#0F0F0F",
    bg: "#FAFAFA",
    memo: "Zero to $100M ARR in 18 months. Devs are not going back to VS Code.",
    svg: {
      viewBox: "0 0 24 24",
      size: 16,
      path: "M11.925.025L.978 6.357v11.31l10.947 6.308 10.947-6.308V6.357L11.925.025zm0 1.732l8.81 5.087-8.81 5.087-8.81-5.087 8.81-5.087zm-9.21 6.165l8.815 5.087v10.176L2.715 18.099V7.922zm9.609 5.087l8.815-5.087v10.176l-8.815 5.087V13.009z",
    },
  },
  {
    name: "Perplexity",
    color: "#1B7F8A",
    bg: "#E6F4F5",
    memo: "Answer engine eating Google query share. Pro + ads pay the bill.",
    svg: {
      viewBox: "0 0 24 24",
      size: 14,
      path: "M22.3977 7.0896h-2.3106V.0676l-7.5094 6.3542V.1577h-1.1554v6.1966L4.4904.1577v6.932H1.6023v10.0951h2.8881V24l7.0834-6.4288v6.2711h1.1554v-6.1242l6.9244 6.3041v-6.6759h2.8442V7.0896zm-3.4661-4.4422v4.4422h-5.2454l5.2454-4.4422zm-13.7838.1659l5.0438 4.2763H5.1478V2.8133zM2.7576 16.1223V8.2451h7.4754l-7.4754 7.8772zm7.5114 5.1141v-4.4524l-4.9036 4.4524h4.9036zm1.1554-13.0203h7.978v8.5673l-7.978-8.5673zM18.687 21.247l-4.6675-4.2497h4.6675v4.2497zm2.5538-5.4051h-7.5734V7.7559l7.5734 7.886z",
    },
  },
  {
    name: "Airtable",
    color: "#FCB400",
    bg: "#FFF5DC",
    memo: "Spreadsheet-to-app pipeline. Enterprise ARR up 90% YoY.",
    svg: {
      viewBox: "0 0 24 24",
      size: 16,
      path: "M11.992 0c-.376 0-.752.087-1.097.262L1.31 5.117c-.652.327-.652 1.262 0 1.589l9.585 4.855a2.422 2.422 0 0 0 2.194 0l9.585-4.855c.652-.327.652-1.262 0-1.589L13.089.262A2.443 2.443 0 0 0 11.992 0zM23.227 8.293a.524.524 0 0 0-.255.057L13.41 12.96a2.34 2.34 0 0 0-1.328 2.114v9.34c0 .344.346.586.665.466l10.13-3.806c.317-.119.522-.42.522-.756V8.81a.521.521 0 0 0-.172-.408.521.521 0 0 0-.255-.108h.255zM.741 8.293a.521.521 0 0 0-.255.108.521.521 0 0 0-.172.408v11.508c0 .335.205.637.522.756l10.13 3.806c.319.12.665-.122.665-.466v-9.34a2.34 2.34 0 0 0-1.328-2.114L.997 8.35a.524.524 0 0 0-.255-.057H.74z",
    },
  },
  {
    name: "GitHub",
    color: "#181717",
    bg: "#F5F5F5",
    memo: "Where 100M devs live. Copilot is the upsell, not the product.",
    svg: {
      viewBox: "0 0 24 24",
      size: 16,
      path: "M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12",
    },
  },
  {
    name: "Slack",
    color: "#611F69",
    bg: "#F6EFF5",
    memo: "Channels won the workplace. Enterprise Grid is the new tier.",
    svg: {
      viewBox: "0 0 24 24",
      size: 14,
      path: "M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z",
    },
  },
  {
    name: "Modal",
    color: "#15803D",
    bg: "#ECFDF5",
    memo: "Serverless GPUs with sub-second cold starts. Picks-and-shovels for AI.",
    letter: "M",
  },
];

function MemoLogo({ brand, size }: { brand: Brand; size: number }) {
  const radius = Math.round(size / 4.5);
  return (
    <span
      className="grid shrink-0 place-items-center ring-1 ring-[color:var(--color-border)]"
      style={{
        height: size,
        width: size,
        borderRadius: radius,
        backgroundColor: brand.bg,
      }}
      aria-hidden
    >
      {brand.svg ? (
        <svg
          viewBox={brand.svg.viewBox}
          fill={brand.color}
          style={{ height: brand.svg.size, width: brand.svg.size }}
        >
          <path d={brand.svg.path} />
        </svg>
      ) : (
        <span
          className="font-semibold leading-none"
          style={{
            color: brand.color,
            fontSize: Math.round(size * 0.46),
            letterSpacing: "-0.03em",
          }}
        >
          {brand.letter}
        </span>
      )}
    </span>
  );
}

function MemoRow({ brand }: { brand: Brand }) {
  return (
    <div className="flex min-h-[60px] items-center gap-3 rounded-[12px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <MemoLogo brand={brand} size={40} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-semibold leading-[1.25] text-[color:var(--color-text-strong)]">
          {brand.name}
        </p>
        <p className="mt-0.5 truncate text-[12px] leading-[1.45] text-[color:var(--color-text-muted)]">
          {brand.memo}
        </p>
      </div>
    </div>
  );
}

function DealMemoMock() {
  const featured = BRANDS.slice(0, 4);

  // ── Y-axis positions for the four layered static cards ──
  // Tweak these values to control vertical overlap / spacing.
  // Cards are 60px tall; positions closer than 60px apart = overlapping.
  const yPositions = [0, 30, 75, 135];

  return (
    <div className="relative h-full min-h-[240px] w-full">
      {/* Idle — layered cards at explicit Y positions, last card on top. */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 bottom-0 transition-opacity duration-500 ease-out group-hover/memo:opacity-0 group-focus-within/memo:opacity-0"
      >
        {featured.map((brand, i) => (
          <div
            key={brand.name}
            className="absolute inset-x-0 flex min-h-[60px] items-center gap-3 rounded-[12px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2.5"
            style={{
              top: yPositions[i],
              zIndex: i + 1,
              boxShadow:
                i === featured.length - 1
                  ? "0 8px 22px rgba(15,23,42,0.08)"
                  : "0 2px 6px rgba(15,23,42,0.04)",
            }}
          >
            <MemoLogo brand={brand} size={40} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13.5px] font-semibold leading-[1.25] text-[color:var(--color-text-strong)]">
                {brand.name}
              </p>
              <p className="mt-0.5 truncate text-[12px] leading-[1.45] text-[color:var(--color-text-muted)]">
                {brand.memo}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* 3D "MEMO" text made of green dots, fills the empty space below cards */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-center overflow-hidden transition-opacity duration-500 ease-out group-hover/memo:opacity-0 group-focus-within/memo:opacity-0"
        style={{ height: 160, perspective: "600px" }}
      >
        <span
          className="vm-dot-drift select-none font-bold uppercase"
          style={{
            fontSize: 120,
            letterSpacing: "0.14em",
            lineHeight: 1,
            transform: "rotateX(42deg)",
            transformOrigin: "center bottom",
            animation: "vm-dot-drift 6s ease-in-out infinite",
            backgroundImage: [
              "radial-gradient(circle at 3px 3px, #16a34a 1.5px, transparent 1.5px)",
              "radial-gradient(circle at 9px 8px, #22c55e 1.5px, transparent 1.5px)",
              "radial-gradient(circle at 6px 11px, #15803d 1.5px, transparent 1.5px)",
              "radial-gradient(circle at 11px 2px, #4ade80 1.5px, transparent 1.5px)",
              "radial-gradient(circle at 1px 7px, #86efac 1.5px, transparent 1.5px)",
              "radial-gradient(circle at 8px 5px, #bbf7d0 1.5px, transparent 1.5px)",
            ].join(", "),
            backgroundSize: "13px 13px",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          MEMO
        </span>
      </div>

      {/* Hover — vertical carousel of all 15 memos, fills the entire stage. */}
      <div
        aria-hidden
        className="absolute inset-0 overflow-hidden opacity-0 transition-opacity duration-500 ease-out group-hover/memo:opacity-100 group-focus-within/memo:opacity-100"
        style={{
          WebkitMaskImage:
            "linear-gradient(to bottom, transparent 0%, #000 12%, #000 88%, transparent 100%)",
          maskImage:
            "linear-gradient(to bottom, transparent 0%, #000 12%, #000 88%, transparent 100%)",
        }}
      >
        <ul className="vm-memo-track flex flex-col gap-2.5">
          {[...BRANDS, ...BRANDS].map((brand, i) => (
            <li key={`${brand.name}-${i}`}>
              <MemoRow brand={brand} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}


function FilesMock() {
  const files = [
    { name: "deck-q1.pdf", size: "2.4 MB", views: 7 },
    { name: "financials.xlsx", size: "184 KB", views: 4 },
    { name: "cap-table.pdf", size: "94 KB", views: 2 },
  ];
  return (
    <ul className="space-y-1.5">
      {files.map((f) => (
        <li
          key={f.name}
          className="flex items-center justify-between rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-1.5"
        >
          <span className="flex min-w-0 items-center gap-2">
            <span
              aria-hidden
              className="h-3.5 w-3.5 shrink-0 rounded-[2px] border border-[color:var(--color-border-strong)] bg-[color:var(--color-bg)]"
            />
            <span className="truncate font-mono text-[11px] text-[color:var(--color-text-strong)]">
              {f.name}
            </span>
          </span>
          <span className="ml-3 shrink-0 font-mono text-[10px] text-[color:var(--color-text-faint)]">
            {f.size} · {f.views} views
          </span>
        </li>
      ))}
    </ul>
  );
}
