import { anyProviderConfigured } from "@/lib/providers";
import { stripeConfigured } from "@/lib/stripe";

export async function GET() {
  return Response.json({
    ok: true,
    mode: anyProviderConfigured() ? "live" : "demo",
    stripe: stripeConfigured(),
  });
}
