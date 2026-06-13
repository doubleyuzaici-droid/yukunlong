// Tab 1 多头叙事 vs 证伪条件 双栏
import { Dot, Pill } from "../_shared/atoms";
import type { SymbolNarrative } from "../../../types/symbol-workspace";

interface Props {
  narrative: SymbolNarrative;
}

export function NarrativeCards({ narrative }: Props) {
  const occurredCount = narrative.falsify.filter((f) => f.occurred).length;
  return (
    <div className="sw-narrative">
      <div className="sw-narrative__card sw-narrative__card--bull">
        <div className="sw-narrative__title">
          <h3 className="sw-tone-success">多头叙事</h3>
          <Pill tone="success">{narrative.bull.length} 项成立</Pill>
        </div>
        <div className="sw-narrative__list">
          {narrative.bull.length === 0 && (
            <span className="sw-faint">暂无多头驱动</span>
          )}
          {narrative.bull.map((b) => (
            <div className="sw-narrative__row" key={b}>
              <span className="sw-narrative__icon ok">✓</span>
              <span>{b}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="sw-narrative__card sw-narrative__card--falsify">
        <div className="sw-narrative__title">
          <h3 className="sw-tone-danger">若以下任一发生即证伪</h3>
          {occurredCount > 0 ? (
            <Pill tone="warning">{occurredCount} 项已发生</Pill>
          ) : (
            <Pill tone="neutral">未触发</Pill>
          )}
        </div>
        <div className="sw-narrative__list">
          {narrative.falsify.length === 0 && (
            <span className="sw-faint">暂无证伪条件</span>
          )}
          {narrative.falsify.map((f) => (
            <div
              className={`sw-narrative__row${f.occurred ? " is-occurred" : ""}`}
              key={f.text}
            >
              {f.occurred ? (
                <Dot tone="warning" pulse />
              ) : (
                <span className="sw-narrative__icon no">✗</span>
              )}
              <span>{f.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
