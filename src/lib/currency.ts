import { prisma } from "./prisma";

export const FX_BASE_CURRENCY = "USD";

/** Ensures the USD anchor row always exists, pinned at rate 1. Safe to call
 * on every page load / API call - it's a no-op once USD exists. */
export async function ensureBaseCurrencySeeded() {
  await prisma.exchangeRate.upsert({
    where: { currency: FX_BASE_CURRENCY },
    update: {}, // never overwrite an existing USD row
    create: { currency: "USD", symbol: "$", name: "US Dollar", rateFromBase: 1, isBase: true },
  });
}

/**
 * Converts an amount from `fromCurrency` to `toCurrency`, pivoting through
 * USD (each rate on file means "1 USD = rateFromBase units of that
 * currency"). If either currency has no rate on file, fails safe by
 * returning the original amount/currency unchanged rather than showing a
 * wrong number.
 */
export async function convertAmount(
  amount: number,
  fromCurrency: string,
  toCurrency: string | undefined | null,
): Promise<{ amount: number; currency: string; rate: number | null }> {
  if (!toCurrency || toCurrency === fromCurrency) {
    return { amount, currency: fromCurrency, rate: null };
  }
  const [fromRate, toRate] = await Promise.all([
    fromCurrency === FX_BASE_CURRENCY
      ? Promise.resolve({ rateFromBase: 1 })
      : prisma.exchangeRate.findUnique({ where: { currency: fromCurrency } }),
    toCurrency === FX_BASE_CURRENCY
      ? Promise.resolve({ rateFromBase: 1 })
      : prisma.exchangeRate.findUnique({ where: { currency: toCurrency } }),
  ]);
  if (!fromRate || !toRate) {
    // No rate on file for one side - fail safe to the original currency.
    return { amount, currency: fromCurrency, rate: null };
  }
  const amountInUsd = amount / Number(fromRate.rateFromBase);
  const converted = amountInUsd * Number(toRate.rateFromBase);
  const effectiveRate = Number(toRate.rateFromBase) / Number(fromRate.rateFromBase);
  return { amount: converted, currency: toCurrency, rate: effectiveRate };
}

/** Back-compat convenience wrapper used by the PDF/Word/Invoice routes. */
export async function convertFromBase(
  amount: number,
  fromCurrency: string,
  toCurrency: string | undefined | null,
): Promise<{ amount: number; currency: string; rate: number | null }> {
  return convertAmount(amount, fromCurrency, toCurrency);
}
