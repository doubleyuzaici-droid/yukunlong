import type { MarketQuote, RealtimeQuote } from "../types/market";

export type TickerQuote = MarketQuote | RealtimeQuote;

export function isLiveRealtimeQuote(quote?: RealtimeQuote | null) {
  return Boolean(quote && (quote.status === "live" || quote.is_realtime === true) && typeof quote.price === "number");
}

export function isTickerRealtimeQuote(quote: TickerQuote): quote is RealtimeQuote {
  return "is_realtime" in quote && quote.is_realtime === true;
}

export function mergeRealtimeTickerQuotes(baseQuotes: MarketQuote[], realtimeQuotes: RealtimeQuote[]): TickerQuote[] {
  const realtimeBySymbol = new Map(
    realtimeQuotes
      .filter(isLiveRealtimeQuote)
      .map((quote) => [quote.symbol.toUpperCase(), quote]),
  );
  return baseQuotes.map((quote) => realtimeBySymbol.get(quote.symbol.toUpperCase()) || quote);
}
