/** City and state for headers, without repeating "TN" when the city already ends with it. */
export function formatCityState(city: string, state: string): string {
  const cityName = city.trim().replace(/\s+/g, " ");
  const st = state.trim().toUpperCase();
  if (!cityName) return st;
  if (!st) return cityName;
  const escaped = st.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const stripped = cityName.replace(new RegExp(`(?:,\\s*${escaped})+$`, "i"), "").trim();
  return stripped ? `${stripped}, ${st}` : st;
}
