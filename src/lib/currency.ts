export const CURRENCIES = ["USD", "EUR", "GBP", "INR", "AED", "SGD", "AUD", "JPY", "CNY"] as const;

const SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  INR: "₹",
  AED: "AED ",
  SGD: "S$",
  AUD: "A$",
  JPY: "¥",
  CNY: "¥",
};

export function formatMoney(amount: number | string, currency: string) {
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  const symbol = SYMBOLS[currency] ?? currency + " ";
  return `${symbol}${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
