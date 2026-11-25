export const CHECKOUT_EMAIL_STORAGE_KEY = "gateway-checkout-email";

export function storeCheckoutEmail(email: string) {
  try {
    sessionStorage.setItem(CHECKOUT_EMAIL_STORAGE_KEY, email.trim());
  } catch {
    // sessionStorage can throw in locked-down browsers; checkout still works if the user re-enters the email.
  }
}

export function loadCheckoutEmail(): string {
  try {
    return sessionStorage.getItem(CHECKOUT_EMAIL_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}
