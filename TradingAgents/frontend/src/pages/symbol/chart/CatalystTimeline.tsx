// V2 Catalyst Timeline — 横向时间线，左过去 / 右未来
// 严格按 design brief §7.2.2
import type { Catalyst } from "../../../types/symbol-workspace";

interface Props {
  past: Catalyst[];
  future: Catalyst[];
  futureWindowDays?: number;
  pastWindowDays?: number;
}

const TYPE_LABEL: Record<string, string> = {
  earnings: "财报",
  research: "研报",
  policy: "政策",
  lhb: "龙虎",
  disclosure: "公告",
  unlock: "解禁",
  industry: "行业",
  dividend: "分红",
  meeting: "会议",
};

export function CatalystTimeline({
  past,
  future,
  futureWindowDays = 30,
  pastWindowDays = 60,
}: Props) {
  // 把 offset_days 映射到 0..100 (50% = 今天)
  const positionOf = (offsetDays: number): number => {
    if (offsetDays > 0) {
      return 50 + (offsetDays / futureWindowDays) * 50;
    }
    return 50 + (offsetDays / pastWindowDays) * 50;
  };
  const isEmpty = past.length === 0 && future.length === 0;
  return (
    <div className="sw-catalyst" role="img" aria-label="催化剂时间线">
      <div className="sw-catalyst__axis" />
      <div className="sw-catalyst__today" style={{ left: "50%" }} />
      {past.map((c, idx) => {
        const left = `${Math.max(2, Math.min(48, positionOf(c.offset_days)))}%`;
        const isTop = idx % 2 === 0;
        return (
          <CatalystMarker
            key={`p-${c.date}-${c.title}`}
            catalyst={c}
            left={left}
            topLabel={isTop}
          />
        );
      })}
      {future.map((c, idx) => {
        const left = `${Math.max(52, Math.min(98, positionOf(c.offset_days)))}%`;
        const isTop = idx % 2 === 0;
        return (
          <CatalystMarker
            key={`f-${c.date}-${c.title}`}
            catalyst={c}
            left={left}
            topLabel={isTop}
            future
          />
        );
      })}
      {isEmpty && (
        <div className="sw-catalyst__empty">
          近 60 日无重要事件，未来事件日历即将上线
        </div>
      )}
    </div>
  );
}

function CatalystMarker({
  catalyst,
  left,
  topLabel,
  future = false,
}: {
  catalyst: Catalyst;
  left: string;
  topLabel: boolean;
  future?: boolean;
}) {
  const tip = `${catalyst.date} · ${catalyst.title}${catalyst.note ? " — " + catalyst.note : ""}`;
  return (
    <>
      <div
        className={`sw-catalyst__event ${
          future ? "sw-catalyst__event--future" : "sw-catalyst__event--past"
        } sw-tone-${catalyst.tone}`}
        style={{ left }}
        title={tip}
        aria-label={tip}
      />
      <div
        className={`sw-catalyst__label ${
          topLabel ? "sw-catalyst__label--top" : "sw-catalyst__label--bot"
        }`}
        style={{ left }}
      >
        {TYPE_LABEL[catalyst.type] ?? catalyst.type}
      </div>
    </>
  );
}
