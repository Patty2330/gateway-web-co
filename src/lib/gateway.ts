/** Copy shared by the visibility check. Matches the live Two Forks Studio offer. */
export const gateway = {
  name: "Two Forks Studio",
  owner: "Jalen",
  email: "gatewaywebco@gmail.com",
  phone: "612-719-4312",
  place: "Clarksville, Tennessee",
  buildPitch:
    "Two Forks Studio builds the website. The first 10 local clients are $500, and you pay only when you're 100% happy.",
};

export function leadEmailSubject(name: string): string {
  return `New ${gateway.name} note from ${name}`;
}
