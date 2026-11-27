import Image from "next/image";

import { BrandMark } from "@/components/brand-mark";
import { FooterYear } from "@/components/footer-year";
import { GatewayContactForm } from "@/components/gateway-contact-form";
import { GatewayNav } from "@/components/gateway-nav";
import { HomeCheckForm } from "@/components/home-check-form";
import { sitePath } from "@/lib/pages";
import type { SiteContent } from "@/lib/site";

const samples = [
  {
    style: "coffee",
    domain: "emberandoak.coffee",
    photo: "/images/work-coffee.jpg",
    overlayName: "Ember & Oak",
    headline: "Slow coffee, fast mornings.",
    button: "Order ahead",
    tag: "Sample site · Coffee shop",
    title: "Ember & Oak Coffee",
    caption: "Menu up front, hours at the top, and one tap to order ahead.",
  },
  {
    style: "barber",
    domain: "franklinstbarber.com",
    photo: "/images/work-barber.jpg",
    overlayName: "Franklin St. Barber Co.",
    headline: "Walk in sharp. Walk out sharper.",
    button: "Book a chair",
    tag: "Sample site · Barbershop",
    title: "Franklin St. Barber Co.",
    caption: "Online booking, prices on one screen, and every barber's open times.",
  },
  {
    style: "build",
    domain: "cumberlandporch.com",
    photo: "/images/work-contractor.jpg",
    overlayName: "Cumberland Porch & Build",
    headline: "Porches, decks and repairs done right.",
    button: "Free estimate",
    tag: "Sample site · Contractor",
    title: "Cumberland Porch & Build",
    caption: "A big estimate button, before-and-after photos, and a service-area map.",
  },
];

function telHref(phone: string) {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

export function GatewayHome({ site }: { site: SiteContent }) {
  return (
    <div className="home">
      <GatewayNav businessName={site.business_name} logo={site.photos.logo} />

      <section className="wrap hero">
        <div>
          <span className="badge">
            <BrandMark size={26} />
            <span className="eyebrow">{site.hero.eyebrow}</span>
          </span>
          <h1>
            Your work is good. Your website should <em>show it.</em>
          </h1>
          <p className="lede">{site.hero.intro}</p>
          <div className="ctas">
            <a className="btn btn-primary" href="#contact">
              {site.hero.button_main}
            </a>
            <a className="btn btn-ghost" href="#ai-check">
              {site.hero.button_secondary}
            </a>
          </div>
          <div className="trust">
            {site.hero.trust_points.map((point) => (
              <span key={point}>
                <i aria-hidden="true" />
                {point}
              </span>
            ))}
          </div>
        </div>
        <div className="art">
          <div className="arch">
            <Image
              src="/images/hero-owner.jpg"
              alt="Local shop owner standing in a shop doorway"
              fill
              sizes="(max-width: 600px) 290px, 430px"
              style={{ objectFit: "cover", objectPosition: "40% 30%" }}
              priority
            />
          </div>
          <div className="phone" aria-hidden="true">
            <div className="screen">
              <div className="ph" />
              <div className="c">
                <div className="t">Ember &amp; Oak Coffee</div>
                <div className="s">Wood-fired roasts on Franklin St. Open 6am–3pm.</div>
                <div className="b">Order ahead</div>
                <div className="row">
                  <span>Menu</span>
                  <span>Hours</span>
                  <span>Map</span>
                </div>
              </div>
            </div>
          </div>
          <div className="sticker">
            <b>$500</b>
            <span>
              First 10
              <br />
              clients
            </span>
          </div>
        </div>
      </section>

      <section className="offer" id="pricing">
        <div className="wrap">
          <div className="eyebrow">{site.pricing.eyebrow}</div>
          <h2>{site.pricing.heading}</h2>
          <p className="intro">{site.pricing.intro}</p>
          <div className="offer-grid">
            <div className="price">
              <div className="was">
                Normally <s>$1,000</s> · First 10 clients
              </div>
              <div className="big">
                <sup>$</sup>500
              </div>
              <p>One flat price for a custom site, up to 5 pages.</p>
              <ul>
                <li>Designed for your business, not a recycled template</li>
                <li>Looks right on phones, with tap-to-call</li>
                <li>Your hours, map and a contact form</li>
                <li>Two rounds of changes included</li>
              </ul>
              <p className="fine-offer">Only for our first 10 local clients</p>
            </div>
            <div className="costs">
              <div className="eyebrow" style={{ color: "var(--mist)" }}>
                What it costs after launch
              </div>
              {site.pricing.items.slice(1).map((item, index) => (
                <div className={index === 2 ? "cost dashed" : "cost"} key={item.title}>
                  <h3>{item.title}</h3>
                  <div className="amt">{item.price}</div>
                  <p>{item.text}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="steps">
            {site.how.steps.map((step, index) => (
              <div className="step" key={step.title}>
                <div className="n">{String(index + 1).padStart(2, "0")} · {step.meta ?? ""}</div>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="work" id="work">
        <div className="wrap">
          <div className="head">
            <div>
              <div className="eyebrow">{site.concepts.eyebrow}</div>
              <h2>{site.concepts.heading}</h2>
            </div>
            <p className="note">{site.concepts.note}</p>
          </div>
          <div className="cards">
            {samples.map((sample) => (
              <article className="work-card" key={sample.title}>
                <div className="browser">
                  <div className="bar">
                    <i />
                    <i />
                    <i />
                    <span>{sample.domain}</span>
                  </div>
                  <div
                    className={`site-shot ${sample.style}`}
                    style={{ backgroundImage: `url(${sample.photo})` }}
                  >
                    <div className="ov">
                      <div className="nm">{sample.overlayName}</div>
                      <h4>{sample.headline}</h4>
                      <span className="pill">{sample.button}</span>
                    </div>
                  </div>
                </div>
                <div className="info">
                  <div className="tag">{sample.tag}</div>
                  <h3>{sample.title}</h3>
                  <p>{sample.caption}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="ai" id="ai-check">
        <div className="wrap ai-grid">
          <div>
            <div className="eyebrow">Free AI Visibility Check</div>
            <h2>When people ask AI who to call, do they hear your name?</h2>
            <p className="body">
              More customers now ask AI things like “best barber in Clarksville.” Our free check
              asks Perplexity those same questions about your kind of business and shows you what
              comes back.
            </p>
            <div className="checks">
              <div className="chk">
                <b>01</b>
                <div>
                  <strong>Your score</strong>
                  <span>A number from 0 to 100 for how often AI names you.</span>
                </div>
              </div>
              <div className="chk">
                <b>02</b>
                <div>
                  <strong>Who gets named instead</strong>
                  <span>The other businesses showing up in the answers.</span>
                </div>
              </div>
              <div className="chk">
                <b>03</b>
                <div>
                  <strong>What to fix first</strong>
                  <span>Your Google listing, your reviews, or your website.</span>
                </div>
              </div>
            </div>
          </div>
          <div className="tool">
            <div className="q">
              <em>Asked</em>
              “Who&apos;s the best barber in Clarksville, TN?”
            </div>
            <div className="score">
              <div className="ring">
                <div>
                  <b>34</b>
                  <span>out of 100</span>
                </div>
              </div>
              <p>
                <strong>Named in 3 of 9 answers</strong>
                Two other shops came up more often. Your Google hours are missing.
              </p>
            </div>
            <HomeCheckForm />
            <p className="fine">
              Sample result. The check is free. A full write-up is $49 if you want one. Or open the{" "}
              <a href={sitePath("/check")} style={{ textDecoration: "underline" }}>
                full check form
              </a>
              .
            </p>
          </div>
        </div>
      </section>

      <section className="cta" id="contact">
        <div className="wrap cta-grid">
          <div>
            <div className="eyebrow">{site.contact_section.eyebrow}</div>
            <h2>{site.contact_section.heading}</h2>
            <p className="sub">{site.contact_section.intro}</p>
            <div className="contact-list">
              <div>
                <b>{site.owner_name}</b> · Owner
              </div>
              <div>
                <b>
                  <a href={telHref(site.phone)}>{site.phone}</a>
                </b>{" "}
                · call or text
              </div>
              <div>
                <b>
                  <a href={`mailto:${site.email}`}>{site.email}</a>
                </b>
              </div>
            </div>
          </div>
          <GatewayContactForm
            button={site.contact_section.form_button}
            errorMessage={site.contact_section.form_error}
          />
        </div>
        <footer className="site-footer">
          <div className="wrap">
            <a className="brand" href="#top" aria-label={`${site.business_name} home`}>
              <BrandMark variant="dark" size={38} />
              <span>
                <b>Two Forks Studio</b>
                <small>Clarksville, Tenn.</small>
              </span>
            </a>
            <span>
              Where the Cumberland meets the Red. · © <FooterYear /> {site.business_name}
            </span>
          </div>
        </footer>
      </section>
    </div>
  );
}
