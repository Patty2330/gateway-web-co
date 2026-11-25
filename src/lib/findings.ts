import type { AnswerRecord, CompetitorStat, Finding, SiteCheck } from "@/lib/types";

export function buildFindings(input: {
  businessName: string;
  category: string;
  city: string;
  websiteUrl: string | null;
  mentionCount: number;
  answerCount: number;
  answers: Pick<AnswerRecord, "mentioned" | "rank" | "error" | "question">[];
  competitors: CompetitorStat[];
  siteCheck: SiteCheck | null;
}): Finding[] {
  const findings: Finding[] = [];
  const rate = input.answerCount === 0 ? 0 : input.mentionCount / input.answerCount;
  const ranked = input.answers.filter((answer) => !answer.error && answer.rank != null);
  const firsts = ranked.filter((answer) => answer.rank === 1).length;
  const firstRate = ranked.length === 0 ? 0 : firsts / ranked.length;

  if (input.answerCount === 0) {
    findings.push({
      id: "no-answers",
      priority: 1,
      area: "content",
      title: "Perplexity didn't answer this run",
      why: "The check didn't get an answer back, so the score can't tell you much yet.",
      fix: "Check PERPLEXITY_API_KEY and run the check again. The free daily limit and the 24-hour cache are there so a retry stays cheap.",
    });
  }

  if (input.answerCount > 0 && rate < 0.34) {
    findings.push({
      id: "google-profile",
      priority: 1,
      area: "google",
      title: "Fill out your Google Business Profile",
      why: `${input.businessName} was named in ${input.mentionCount} of ${input.answerCount} answers. AI tools lean on the Google listing when someone asks for a local ${input.category}.`,
      fix: `Claim the profile for ${input.city}, pick the closest category, add hours, a phone number, and a short description that says ${input.category} and ${input.city} in plain words. Add recent photos of real jobs.`,
    });
  }

  if (!input.websiteUrl) {
    findings.push({
      id: "website-missing",
      priority: 2,
      area: "website",
      title: "Put a simple website on the record",
      why: "AI answers like to cite a page. With no site in this check, they have less to point at.",
      fix: "A one-page site with your services, city, hours, and phone is enough to start. Gateway Web Co builds that kind of site. The first 10 local clients are $500, and you pay only when you're 100% happy.",
    });
  }

  if (input.answerCount > 0 && (rate < 0.75 || firstRate < 0.4)) {
    findings.push({
      id: "reviews",
      priority: 2,
      area: "reviews",
      title: "Ask for a few fresh reviews",
      why:
        firstRate < 0.4 && input.mentionCount > 0
          ? "You get named, and you are rarely the first name. Review count and recent comments are a big part of who lands on top."
          : "Thin or quiet reviews make it easier for another business to take the recommendation.",
      fix: "Ask recent happy customers for a Google review this month. Reply to the ones you already have. A steady trickle beats a burst from years ago.",
    });
  }

  if (input.siteCheck?.ok && !input.siteCheck.hasLocalBusinessSchema) {
    findings.push({
      id: "schema",
      priority: 3,
      area: "schema",
      title: "Add LocalBusiness schema to the website",
      why: "The page doesn't include a LocalBusiness (or similar) block that machines can read.",
      fix: "Add a JSON-LD script with your name, address, phone, city, hours, and the right business type. Keep it identical to the Google listing.",
    });
  }

  if (input.siteCheck?.ok && (!input.siteCheck.hasBusinessName || !input.siteCheck.hasPhone || !input.siteCheck.hasAddress)) {
    const missing = [
      !input.siteCheck.hasBusinessName ? "business name" : null,
      !input.siteCheck.hasPhone ? "phone number" : null,
      !input.siteCheck.hasAddress ? "street address" : null,
    ].filter(Boolean);
    findings.push({
      id: "nap",
      priority: 4,
      area: "nap",
      title: "Put your name, address, and phone on the page",
      why: `The homepage is missing a clear ${missing.join(", ")}. AI tools and directories trust a business more when those three match everywhere.`,
      fix: "Show the same name, street address, and phone in the footer of every page, written the same way as the Google listing.",
    });
  }

  if (input.siteCheck && !input.siteCheck.ok) {
    findings.push({
      id: "site-unread",
      priority: 4,
      area: "website",
      title: "We couldn't read the website",
      why: input.siteCheck.error || "The address didn't return a page we could check.",
      fix: "Open the address in a browser and confirm it loads. Then run the check again.",
    });
  }

  const leader = input.competitors[0];
  if (leader && leader.mentions >= 2 && leader.mentions > input.mentionCount) {
    findings.push({
      id: "competitors",
      priority: 4,
      area: "content",
      title: `${leader.name} is getting the answers`,
      why: `${leader.name} was named ${leader.mentions} times. ${input.businessName} was named ${input.mentionCount} times.`,
      fix: `Publish a page that says you do ${input.category} work in ${input.city}, with the services people ask about (price range, reviews, emergency calls, or appointments). Match that wording on your Google listing.`,
    });
  }

  if (rate < 1) {
    findings.push({
      id: "directories",
      priority: 5,
      area: "nap",
      title: "Use the same details on every directory",
      why: "AI tools stitch together Google, Yelp, Apple Maps, Facebook, and the website. Small differences make the business look unverified.",
      fix: "Pick one spelling of the name, one phone number, and one address. Update Yelp, Facebook, Apple Maps, and the BBB so they match the Google listing.",
    });
  }

  if (input.websiteUrl && input.siteCheck?.ok && !input.siteCheck.hasFaq) {
    findings.push({
      id: "faq",
      priority: 5,
      area: "faq",
      title: "Answer the usual questions on the website",
      why: "People ask AI about price, reviews, and who to call this week. The site doesn't have a short FAQ those answers can quote.",
      fix: `Add four or five questions in the customer's words: best ${input.category} in ${input.city}, what it costs, how soon you can come, and the area you cover. Answer each one in a couple of sentences.`,
    });
  }

  if (input.siteCheck?.ok) {
    const title = input.siteCheck.title?.trim() || "";
    const description = input.siteCheck.metaDescription?.trim() || "";
    const titleWeak =
      title.length < 12 ||
      (!title.toLowerCase().includes(input.city.toLowerCase()) &&
        !title.toLowerCase().includes(input.businessName.toLowerCase().slice(0, 12)));
    if (titleWeak || description.length < 40) {
      findings.push({
        id: "title-meta",
        priority: 6,
        area: "website",
        title: "Say who you are in the page title",
        why: "The browser title and the short description are what other sites, and AI tools, quote first.",
        fix: `Use a title like "${input.businessName} | ${input.category} in ${input.city}" and a one-sentence description with the city and the phone number.`,
      });
    }
    if (!input.siteCheck.hasViewport) {
      findings.push({
        id: "mobile",
        priority: 7,
        area: "website",
        title: "Make the page comfortable on a phone",
        why: "The page is missing a viewport tag, so phones may show a tiny desktop layout. Most local searches happen on a phone.",
        fix: 'Add <meta name="viewport" content="width=device-width, initial-scale=1"> and check the page on a phone: text readable, phone number tappable, no sideways scrolling.',
      });
    }
  }

  const missed = input.answers.filter((answer) => !answer.error && !answer.mentioned);
  if (missed.length >= 2) {
    findings.push({
      id: "service-pages",
      priority: 6,
      area: "content",
      title: "Write a page for the questions you lose",
      why: `You were left out of ${missed.length} answers, including “${trimQuestion(missed[0].question)}”.`,
      fix: "Add a short section or page that answers that question directly, with your city in the heading and the same facts as your Google listing.",
    });
  }

  if (!findings.some((finding) => finding.id === "reviews")) {
    findings.push({
      id: "photos",
      priority: 8,
      area: "reviews",
      title: "Add recent photos to the Google listing",
      why: "Listings with fresh photos of real work look active. Quiet listings get skipped when an AI answer has to pick a name.",
      fix: "Upload a few photos this month: the storefront or truck, a finished job, and a picture of the crew. Keep doing it.",
    });
  }

  findings.sort((a, b) => a.priority - b.priority || a.title.localeCompare(b.title));
  return findings;
}

function trimQuestion(question: string): string {
  const compact = question.replace(/\s+/g, " ").trim();
  return compact.length > 90 ? `${compact.slice(0, 87)}…` : compact;
}
