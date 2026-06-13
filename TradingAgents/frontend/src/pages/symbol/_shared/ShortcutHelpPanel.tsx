// 键盘快捷键帮助面板 — 按 ? 弹出
import { SHORTCUT_HELP } from "./useKeyboardShortcuts";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ShortcutHelpPanel({ open, onClose }: Props) {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="sw-shortcut-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.5)",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--sw-bg-surface)",
          border: "1px solid var(--sw-border-strong)",
          borderRadius: "var(--sw-r-lg)",
          padding: "var(--sw-sp-5)",
          minWidth: 420,
          maxWidth: 520,
        }}
      >
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: "var(--sw-sp-4)",
          }}
        >
          <h2 id="sw-shortcut-title" style={{ fontSize: 16, fontWeight: 600 }}>
            键盘快捷键
          </h2>
          <button
            type="button"
            className="sw-btn sw-btn--mini"
            onClick={onClose}
            aria-label="关闭"
          >
            关闭
          </button>
        </header>
        <ul style={{ display: "flex", flexDirection: "column", gap: 6, listStyle: "none" }}>
          {SHORTCUT_HELP.map((s) => (
            <li
              key={s.keys}
              style={{
                display: "grid",
                gridTemplateColumns: "140px 1fr",
                gap: "var(--sw-sp-3)",
                fontSize: 13,
                padding: "4px 0",
              }}
            >
              <kbd
                style={{
                  fontFamily: "var(--sw-font-mono)",
                  fontSize: 12,
                  background: "var(--sw-bg-hover)",
                  padding: "2px 8px",
                  borderRadius: 4,
                  border: "1px solid var(--sw-border-subtle)",
                  color: "var(--sw-text-primary)",
                  width: "fit-content",
                }}
              >
                {s.keys}
              </kbd>
              <span style={{ color: "var(--sw-text-secondary)" }}>{s.description}</span>
            </li>
          ))}
        </ul>
        <p style={{ marginTop: "var(--sw-sp-4)", fontSize: 11, color: "var(--sw-text-tertiary)" }}>
          在输入框内时除 ⌘K 外不拦截快捷键
        </p>
      </div>
    </div>
  );
}
