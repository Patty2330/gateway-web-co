import { FooterYear } from "@/components/footer-year";
import { GatewayContactForm } from "@/components/gateway-contact-form";
import { GatewayNav } from "@/components/gateway-nav";
import type { SiteContent } from "@/lib/site";

function rich(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={index}>{part.slice(2, -2)}</strong>
    ) : (
      <span key={index}>{part}</span>
    ),
  );
}

function blank(value: string | undefined) {
  const trimmed = (value || "").trim();
  return trimmed === "" || trimmed === "[email]" || trimmed === "[phone]" || trimmed === "[LinkedIn]";
}

function telHref(phone: string) {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

function Mock({ index, title, caption }: { index: number; title: string; caption: string }) {
  if (index === 0) {
    return (
      <div className="mock mock-a" aria-hidden="true">
        <div className="mk-nav"><b>Cumberland Lawn Co.</b><i /></div>
        <div className="mk-hero">
          <h4>Clean cuts. Every week.</h4>
          <p>Mowing, mulch &amp; cleanups across Clarksville</p>
          <span>Free estimate</span>
        </div>
        <div className="mk-tiles"><div>Mowing</div><div>Mulch</div><div>Leaf cleanup</div></div>
      </div>
    );
  }
  if (index === 1) {
    return (
      <div className="mock mock-b" aria-hidden="true">
        <div className="mk-nav"><b>Strawberry Alley Diner</b><i /></div>
        <div className="mk-hero">
          <h4>Breakfast all day</h4>
          <p>Open 6am to 2pm, downtown</p>
          <span>View menu</span>
        </div>
        <div className="mk-menu">
          <div><em>Biscuits &amp; gravy</em><em>$8</em></div>
          <div><em>Hot chicken plate</em><em>$12</em></div>
          <div><em>Pancake stack</em><em>$9</em></div>
        </div>
      </div>
    );
  }
  if (index === 2) {
    return (
      <div className="mock mock-c" aria-hidden="true">
        <div className="mk-nav"><b>Queen City Auto Care</b><i /></div>
        <div className="mk-hero">
          <h4>Honest repairs, done right</h4>
          <p>Brakes · Oil · Diagnostics</p>
          <span>Book service</span>
        </div>
        <div className="mk-stats">
          <div><b>Mon–Sat</b>7a–6p</div>
          <div><b>Call</b>tap to dial</div>
        </div>
      </div>
    );
  }
  return (
    <div className="mock mock-a" aria-hidden="true">
      <div className="mk-nav"><b>{title}</b><i /></div>
      <div className="mk-hero">
        <h4>{title}</h4>
        <p>{caption}</p>
      </div>
    </div>
  );
}

export function GatewayHome({ site }: { site: SiteContent }) {
  const logo = site.photos?.logo?.trim();
  const heroPhoto = site.photos?.hero?.trim();

  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <GatewayNav businessName={site.business_name} logo={logo || undefined} />
      <main id="main">
        <section className="hero">
          <div className="wrap hero-grid">
            <div className="hero-copy">
              <p className="eyebrow">{site.hero.eyebrow}</p>
              <h1>
                {site.hero.headline} <span className="hl">{site.hero.highlight}</span>
              </h1>
              <p className="lead">{site.hero.intro}</p>
              <div className="cta-row">
                <a className="btn" href="#contact">{site.hero.button_main}</a>
                <a className="btn btn-ghost" href="#pricing">{site.hero.button_secondary}</a>
              </div>
              <ul className="trust">
                {site.hero.trust_points.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="hero-art" aria-hidden="true">
              <div className="device laptop">
                <div className="bar">
                  <i /><i /><i />
                  <span>{site.hero.example_web_address}</span>
                </div>
                {heroPhoto ? (
                  <div className="screen screen-photo">
                    <img src={heroPhoto} alt="" />
                  </div>
                ) : (
                  <div className="screen">
                    <div className="m-hero">
                      <div className="m-line w60" />
                      <div className="m-line w40" />
                      <div className="m-btn" />
                    </div>
                    <div className="m-cards"><div /><div /><div /></div>
                    <div className="m-map"><span className="pin" /></div>
                  </div>
                )}
              </div>
              <div className="device phone">
                <div className="notch" />
                <div className="m-hero sm">
                  <div className="m-line w70" />
                  <div className="m-btn" />
                </div>
                <div className="m-row" />
                <div className="m-row" />
                <div className="m-row short" />
                <div className="m-call">{site.hero.phone_button_label}</div>
              </div>
              <div className="price-tag">
                <small>{site.price_label}</small>
                {site.price}
              </div>
            </div>
          </div>
        </section>

        <section id="visibility" className="section">
          <div className="wrap why-grid">
            <div>
              <p className="eyebrow">Free tool</p>
              <h2>Free AI visibility check</h2>
              <p>
                Customers ask ChatGPT, Perplexity, and Google&apos;s AI who to hire. This check
                asks those questions for your business and shows whether your name comes up.
              </p>
              <p>
                The check is free. A full write-up is $49, and $19 a month watches it for you.
                If the site itself is the problem, Gateway can build it.
              </p>
              <div className="cta-row">
                <a className="btn" href="/check">Run the free check</a>
                <a className="btn btn-ghost" href="#pricing">See website pricing</a>
              </div>
            </div>
            <ul className="why-list">
              <li><b>Your score.</b> A number from 0 to 100 for how often AI names you.</li>
              <li><b>Who gets named instead.</b> The other businesses that show up in the answers.</li>
              <li><b>What to fix first.</b> Google listing, reviews, and the pages on your site.</li>
            </ul>
          </div>
        </section>

        <section id="pricing" className="section alt">
          <div className="wrap">
            <p className="eyebrow">{site.pricing.eyebrow}</p>
            <h2>{site.pricing.heading}</h2>
            <p className="note">{site.pricing.intro}</p>
            <div className="grid-3 pricing-grid">
              {site.pricing.items.map((item) => (
                <article className="card price-card" key={item.title}>
                  <h3>{item.title}</h3>
                  <p className="amount">{item.price}</p>
                  <p>{item.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="included" className="section">
          <div className="wrap">
            <p className="eyebrow">{site.included.eyebrow}</p>
            <h2>{site.included.heading}</h2>
            <div className="grid-3 features">
              {site.included.items.map((item) => (
                <article className="card" key={item.title}>
                  <div className="ic">{item.icon}</div>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="how" className="section alt">
          <div className="wrap">
            <p className="eyebrow">{site.how.eyebrow}</p>
            <h2>{site.how.heading}</h2>
            <ol className="steps">
              {site.how.steps.map((step, index) => (
                <li key={step.title}>
                  <span className="num">{index + 1}</span>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="why" className="section">
          <div className="wrap why-grid">
            <div>
              <p className="eyebrow">{site.why.eyebrow}</p>
              <h2>{site.why.heading}</h2>
              {site.why.paragraphs.map((para) => (
                <p key={para}>{para}</p>
              ))}
            </div>
            <ul className="why-list">
              {site.why.points.map((point) => (
                <li key={point.lead}>
                  <b>{point.lead}</b> {point.text}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="work" className="section alt">
          <div className="wrap">
            <p className="eyebrow">{site.concepts.eyebrow}</p>
            <h2>{site.concepts.heading}</h2>
            <p className="note">{rich(site.concepts.note)}</p>
            <div className="grid-3 concepts">
              {site.concepts.items.map((item, index) => (
                <figure className="concept" key={item.title}>
                  {item.photo?.trim() ? (
                    <div className="concept-photo">
                      <img src={item.photo} alt={item.title} />
                    </div>
                  ) : (
                    <Mock index={index} title={item.title} caption={item.caption} />
                  )}
                  <figcaption>
                    <span className="tag">Concept</span>
                    <h3>{item.title}</h3>
                    <p>{item.caption}</p>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        <section id="faq" className="section">
          <div className="wrap narrow">
            <p className="eyebrow">{site.faq.eyebrow}</p>
            <h2>{site.faq.heading}</h2>
            {site.faq.items.map((item) => (
              <details key={item.question}>
                <summary>{item.question}</summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section id="contact" className="section contact">
          <div className="wrap contact-grid">
            <div>
              <p className="eyebrow light">{site.contact_section.eyebrow}</p>
              <h2>{site.contact_section.heading}</h2>
              <p>{site.contact_section.intro}</p>
              <ul className="contact-list">
                <li><span>Owner</span>{site.owner_name}</li>
                <li>
                  <span>Email</span>
                  {blank(site.email) ? <span className="ph">[email]</span> : <a href={`mailto:${site.email}`}>{site.email}</a>}
                </li>
                <li>
                  <span>Phone</span>
                  {blank(site.phone) ? <span className="ph">[phone]</span> : <a href={telHref(site.phone)}>{site.phone}</a>}
                </li>
                {!blank(site.linkedin) ? (
                  <li>
                    <span>LinkedIn</span>
                    <a href={site.linkedin.startsWith("http") ? site.linkedin : `https://${site.linkedin}`}>
                      {site.linkedin}
                    </a>
                  </li>
                ) : null}
                <li><span>Area</span>{site.service_area}</li>
                {site.hours?.trim() ? <li><span>Hours</span>{site.hours}</li> : null}
              </ul>
            </div>
            <GatewayContactForm
              button={site.contact_section.form_button}
              errorMessage={site.contact_section.form_error}
            />
          </div>
        </section>
      </main>
      <footer className="footer">
        <div className="wrap foot-inner">
          <p>© <FooterYear /> {site.business_name} · {site.footer_place}</p>
          <p><a href="#top">Back to top ↑</a></p>
        </div>
      </footer>
    </>
  );
}
