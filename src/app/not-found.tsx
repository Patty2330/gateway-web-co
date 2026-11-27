import Image from "next/image";
import Link from "next/link";

export default function NotFound() {
  return (
    <main
      style={{
        minHeight: "70vh",
        display: "grid",
        placeItems: "center",
        padding: "48px 20px",
        background: "#F6F0E4",
        color: "#1C2621",
        fontFamily: "var(--font-instrument), 'Instrument Sans', sans-serif",
        textAlign: "center",
      }}
    >
      <div>
        <Image
          src="/images/logo-riverbend-light.svg"
          alt="Two Forks Studio"
          width={64}
          height={64}
          unoptimized
          style={{ margin: "0 auto 20px" }}
        />
        <h1
          style={{
            fontFamily: "var(--font-fraunces), Fraunces, Georgia, serif",
            fontSize: "42px",
            letterSpacing: "-0.03em",
            margin: "0 0 12px",
          }}
        >
          That page isn&apos;t here.
        </h1>
        <p style={{ color: "#5C574D", margin: "0 0 24px" }}>
          Head back to Two Forks Studio, or run a free AI visibility check.
        </p>
        <p style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Link
            href="/"
            style={{
              background: "#9C3A22",
              color: "#FCF9F3",
              borderRadius: 999,
              padding: "14px 22px",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Back to the website
          </Link>
          <Link
            href="/check"
            style={{
              border: "2px solid #1C2621",
              color: "#1C2621",
              borderRadius: 999,
              padding: "12px 22px",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Free AI check
          </Link>
        </p>
      </div>
    </main>
  );
}
