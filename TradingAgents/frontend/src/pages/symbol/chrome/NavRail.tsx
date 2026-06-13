// V2 Nav Rail — 自选 / 机会 / 风险 / 最近 四组
import { Dot } from "../_shared/atoms";
import type { NavData, NavItem } from "../../../types/symbol-workspace";
import { classOfChange, fmtPct } from "../formatters";

interface Props {
  navigation: NavData;
  currentSymbol: string;
  onOpenSymbol: (symbol: string) => void;
}

interface Group {
  title: string;
  items: NavItem[];
  empty: string;
}

function NavGroup({
  group,
  onOpen,
}: {
  group: Group;
  onOpen: (s: string) => void;
}) {
  return (
    <div className="sw-nav-group">
      <div className="sw-nav-group__head">
        <span className="sw-nav-group__title">{group.title}</span>
        <span className="sw-nav-group__count">{group.items.length}</span>
      </div>
      {group.items.length === 0 ? (
        <p className="sw-nav-empty">{group.empty}</p>
      ) : (
        group.items.map((item) => (
          <button
            key={`${group.title}-${item.symbol}-${item.name}`}
            type="button"
            className={`sw-nav-item${item.active ? " is-active" : ""}`}
            onClick={() => onOpen(item.symbol)}
          >
            <Dot tone={item.tone} />
            <span className="sw-nav-item__name">
              <strong>{item.name}</strong>
              <span>{item.symbol}</span>
            </span>
            <span
              className={`sw-nav-item__trailing ${
                item.trailing.kind === "change_pct"
                  ? classOfChange(item.trailing.value)
                  : "sw-tone-neutral"
              }`}
            >
              {item.trailing.kind === "change_pct" &&
                fmtPct(item.trailing.value, 2)}
              {item.trailing.kind === "score" &&
                (item.trailing.value != null
                  ? Math.round(item.trailing.value * 100)
                  : "-")}
              {item.trailing.kind === "flag" && item.trailing.text}
              {item.trailing.kind === "viewed_at" && item.trailing.text}
            </span>
          </button>
        ))
      )}
    </div>
  );
}

export function NavRail({ navigation, onOpenSymbol }: Props) {
  return (
    <aside className="sw-nav-rail" aria-label="标的导航">
      <NavGroup
        group={{ title: "自选", items: navigation.favorites, empty: "自选股池暂无标的" }}
        onOpen={onOpenSymbol}
      />
      <NavGroup
        group={{
          title: "今日机会",
          items: navigation.opportunities,
          empty: "暂无机会信号",
        }}
        onOpen={onOpenSymbol}
      />
      <NavGroup
        group={{ title: "风险升高", items: navigation.risks, empty: "暂无风险标的" }}
        onOpen={onOpenSymbol}
      />
      <NavGroup
        group={{ title: "最近", items: navigation.recent, empty: "暂无最近查看" }}
        onOpen={onOpenSymbol}
      />
    </aside>
  );
}
