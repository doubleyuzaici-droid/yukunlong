// V2 Profile Strip — 8 列画像条
import type { SymbolProfile } from "../../../types/symbol-workspace";
import {
  fmtMarketCap,
  fmtPercentile,
  fmtTurnover,
  fmtValuation,
  fmtDividendYield,
} from "../formatters";

interface Props {
  profile: SymbolProfile;
}

interface Cell {
  label: string;
  value: string;
  sub?: string;
  isMono?: boolean;
}

export function ProfileStrip({ profile }: Props) {
  const peIndustryDesc =
    profile.pe_industry_pct != null
      ? `行业 ${fmtPercentile(profile.pe_industry_pct)}`
      : "无行业百分位";
  const floatRatioDesc =
    profile.market_cap_yi && profile.free_float_yi
      ? `${Math.round((profile.free_float_yi / profile.market_cap_yi) * 100)}% 流通比`
      : undefined;
  const cells: Cell[] = [
    {
      label: "行业",
      value: profile.industry,
      sub: profile.sub_industry,
      isMono: false,
    },
    {
      label: "总市值",
      value: fmtMarketCap((profile.market_cap_yi ?? 0) * 1e8) || "-",
      sub: profile.market_cap_yi == null ? "未公布" : "全部股本",
    },
    {
      label: "自由流通",
      value: fmtMarketCap((profile.free_float_yi ?? 0) * 1e8) || "-",
      sub: floatRatioDesc ?? "未公布",
    },
    {
      label: "换手率",
      value: fmtTurnover(profile.turnover_pct),
      sub: "近 20 个交易日均值",
    },
    {
      label: "PE TTM",
      value: fmtValuation(profile.pe_ttm),
      sub: peIndustryDesc,
    },
    {
      label: "PB",
      value: fmtValuation(profile.pb),
      sub: "市净率",
    },
    {
      label: "股息率",
      value: fmtDividendYield(profile.dividend_yield),
      sub: "过去 12 个月",
    },
    {
      label: "状态",
      value: profile.flags.length ? profile.flags[0] : "常规",
      sub: profile.flags.slice(1).join(" · ") || undefined,
      isMono: false,
    },
  ];

  return (
    <section className="sw-profile-strip" aria-label="标的画像条">
      {cells.map((c) => (
        <div className="sw-profile-cell" key={c.label}>
          <span className="sw-profile-cell__label">{c.label}</span>
          <span
            className="sw-profile-cell__value"
            style={c.isMono === false ? { fontFamily: "var(--sw-font-sans)" } : undefined}
          >
            {c.value}
          </span>
          {c.sub && <span className="sw-profile-cell__sub">{c.sub}</span>}
        </div>
      ))}
    </section>
  );
}
