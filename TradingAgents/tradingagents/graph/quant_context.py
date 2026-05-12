from __future__ import annotations

from tradingagents.research.signal_context import load_signal_context, render_signal_context


def create_quant_signal_loader(load_signal_context_fn=load_signal_context):
    def quant_signal_loader_node(state) -> dict:
        signals = load_signal_context_fn(
            state["company_of_interest"],
            state["trade_date"],
        )
        return {
            "quant_signals": signals,
            "quant_signal_context": render_signal_context(signals),
        }

    return quant_signal_loader_node
