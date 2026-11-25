import { z } from "zod";

export const scanFormSchema = z.object({
  businessName: z
    .string({ error: "Add the business name." })
    .trim()
    .min(2, "Add the business name.")
    .max(80, "Keep the business name under 80 characters."),
  category: z
    .string({ error: "Add the kind of business." })
    .trim()
    .min(2, "Add the kind of business.")
    .max(40, "Keep the category under 40 characters."),
  city: z
    .string({ error: "Add the city." })
    .trim()
    .min(2, "Add the city.")
    .max(60, "Keep the city name under 60 characters."),
  state: z.string({ error: "Pick a state." }).trim().length(2, "Pick a state.").toUpperCase(),
  websiteUrl: z.string().trim().max(300, "Keep the website address under 300 characters.").optional(),
});

export const checkoutFormSchema = z.object({
  scanId: z.string({ error: "Open a check before you pay." }).uuid("Open a check before you pay."),
  plan: z.enum(["report", "monitor"], { error: "Pick a plan." }),
  email: z
    .string({ error: "Add an email so we know where to send updates." })
    .trim()
    .email("Add an email so we know where to send updates."),
});
