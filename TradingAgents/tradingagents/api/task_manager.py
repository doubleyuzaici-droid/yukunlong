from __future__ import annotations

import logging
import os
import threading
import traceback
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from tradingagents.default_config import DEFAULT_CONFIG

# TradingAgentsGraph is lazy-imported in _run_analysis to avoid blocking API startup
from .schemas import (
    AgentStatus,
    AnalyzeRequest,
    StageInfo,
    TaskProgress,
    TaskStatus,
    TokenStats,
)

logger = logging.getLogger(__name__)

DEPTH_MAP = {"shallow": 1, "medium": 3, "deep": 5}

STAGE_DEFINITIONS = [
    {
        "key": "analysts",
        "label": "分析师团队",
        "agents": [
            {"key": "market", "label": "市场技术面分析师"},
            {"key": "social", "label": "社交媒体分析师"},
            {"key": "news", "label": "新闻分析师"},
            {"key": "fundamentals", "label": "基本面分析师"},
        ],
    },
    {
        "key": "research",
        "label": "研究辩论",
        "agents": [
            {"key": "bull", "label": "多头研究员"},
            {"key": "bear", "label": "空头研究员"},
            {"key": "research_manager", "label": "研究经理"},
        ],
    },
    {
        "key": "trading",
        "label": "交易计划",
        "agents": [
            {"key": "trader", "label": "交易员"},
        ],
    },
    {
        "key": "risk",
        "label": "风险管理",
        "agents": [
            {"key": "aggressive", "label": "激进风险分析师"},
            {"key": "conservative", "label": "保守风险分析师"},
            {"key": "neutral", "label": "中性风险分析师"},
        ],
    },
    {
        "key": "portfolio",
        "label": "投资决策",
        "agents": [
            {"key": "portfolio_manager", "label": "投资组合经理"},
        ],
    },
]

REPORT_SECTION_KEYS = {
    "market_report": "市场技术面分析",
    "sentiment_report": "社交媒体情绪",
    "news_report": "新闻分析",
    "fundamentals_report": "基本面分析",
    "investment_plan": "研究团队决策",
    "trader_investment_plan": "交易团队计划",
    "investment_debate_summary": "多空研究辩论",
    "risk_debate_summary": "风险团队辩论",
    "final_trade_decision": "最终投资决策",
}


class TaskManager:
    _instance: Optional[TaskManager] = None

    def __init__(self):
        self._tasks: dict[str, TaskProgress] = {}
        self._reports: dict[str, dict] = {}
        self._task_requests: dict[str, AnalyzeRequest] = {}
        self._cancelled_tasks: set[str] = set()
        self._lock = threading.Lock()

    @classmethod
    def get_instance(cls) -> TaskManager:
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def create_task(self, request: AnalyzeRequest) -> str:
        task_id = uuid.uuid4().hex[:12]
        depth = (
            request.research_depth.value
            if hasattr(request.research_depth, "value")
            else "medium"
        )

        stages = self._build_stages(request.selected_analysts)

        progress = TaskProgress(
            task_id=task_id,
            status=TaskStatus.PENDING,
            ticker=request.ticker,
            trade_date=request.trade_date,
            research_depth=depth,
            messages=[],
            current_step="初始化中...",
            stages=stages,
            current_stage_key="analysts",
            token_stats=TokenStats(
                input_tokens=0, output_tokens=0, llm_calls=0, tool_calls=0
            ),
        )
        with self._lock:
            self._tasks[task_id] = progress
            self._task_requests[task_id] = request

        thread = threading.Thread(
            target=self._run_analysis,
            args=(task_id, request),
            daemon=True,
        )
        thread.start()
        return task_id

    def list_tasks(self, limit: int = 100) -> list[dict]:
        with self._lock:
            tasks = list(self._tasks.values())
        tasks.sort(key=lambda item: item.started_at or item.task_id, reverse=True)
        return [task.model_dump() for task in tasks[: max(1, min(limit, 500))]]

    def cancel_task(self, task_id: str) -> dict | None:
        with self._lock:
            task = self._tasks.get(task_id)
            if task is None:
                return None
            self._cancelled_tasks.add(task_id)
            if task.status in (TaskStatus.PENDING, TaskStatus.RUNNING, TaskStatus.FAILED):
                task.status = TaskStatus.CANCELLED
                task.current_step = "已取消"
                task.finished_at = datetime.now(timezone.utc).isoformat()
                task.messages.append(
                    {
                        "time": datetime.now(timezone.utc).isoformat(),
                        "type": "warning",
                        "content": "任务已标记取消",
                    }
                )
            return task.model_dump()

    def retry_task(self, task_id: str) -> str | None:
        with self._lock:
            request = self._task_requests.get(task_id)
        if request is None:
            return None
        return self.create_task(request)

    def _build_stages(self, selected_analysts: list) -> list[StageInfo]:
        selected_keys = set()
        if selected_analysts:
            for a in selected_analysts:
                key = a.value if hasattr(a, "value") else a
                selected_keys.add(key)

        stages = []
        for stage_def in STAGE_DEFINITIONS:
            if stage_def["key"] == "analysts":
                agents = [
                    {
                        "key": a["key"],
                        "label": a["label"],
                        "status": AgentStatus.PENDING.value,
                        "enabled": a["key"] in selected_keys,
                    }
                    for a in stage_def["agents"]
                ]
            else:
                agents = [
                    {
                        "key": a["key"],
                        "label": a["label"],
                        "status": AgentStatus.PENDING.value,
                        "enabled": True,
                    }
                    for a in stage_def["agents"]
                ]
            stages.append(
                StageInfo(
                    key=stage_def["key"],
                    label=stage_def["label"],
                    status=AgentStatus.PENDING,
                    agents=agents,
                )
            )
        return stages

    def get_progress(self, task_id: str) -> Optional[TaskProgress]:
        with self._lock:
            return self._tasks.get(task_id)

    def get_report(self, task_id: str) -> Optional[dict]:
        with self._lock:
            return self._reports.get(task_id)

    def _update(self, task_id: str, **kwargs):
        with self._lock:
            task = self._tasks.get(task_id)
            if task:
                for key, value in kwargs.items():
                    setattr(task, key, value)

    def _update_agent(
        self, task_id: str, stage_key: str, agent_key: str, status: AgentStatus
    ):
        with self._lock:
            task = self._tasks.get(task_id)
            if not task:
                return
            for stage in task.stages:
                if stage.key == stage_key:
                    stage.status = status
                    for agent in stage.agents:
                        if agent["key"] == agent_key:
                            agent["status"] = status.value
                            break
                    break

    def _set_stage_status(self, task_id: str, stage_key: str, status: AgentStatus):
        with self._lock:
            task = self._tasks.get(task_id)
            if not task:
                return
            task.current_stage_key = stage_key
            for stage in task.stages:
                if stage.key == stage_key:
                    stage.status = status
                    break

    def _add_tokens(
        self,
        task_id: str,
        input_tokens: int = 0,
        output_tokens: int = 0,
        llm_calls: int = 0,
        tool_calls: int = 0,
    ):
        with self._lock:
            task = self._tasks.get(task_id)
            if not task or not task.token_stats:
                return
            ts = task.token_stats
            ts.input_tokens += input_tokens
            ts.output_tokens += output_tokens
            ts.llm_calls += llm_calls
            ts.tool_calls += tool_calls

    def _set_report_section(self, task_id: str, section_key: str, content: str):
        with self._lock:
            task = self._tasks.get(task_id)
            if not task:
                return
            header = REPORT_SECTION_KEYS.get(section_key, section_key)
            snippet = content[:500] if content else ""
            task.current_report_html = f"### {header}\n\n{snippet}\n\n*(分析中...)*"

    def _append_message(self, task_id: str, msg_type: str, content: str):
        with self._lock:
            task = self._tasks.get(task_id)
            if task:
                task.messages.append(
                    {
                        "time": datetime.now(timezone.utc).isoformat(),
                        "type": msg_type,
                        "content": content,
                    }
                )

    def _debate_state_to_markdown(self, state: object, labels: dict[str, str]) -> str:
        if not isinstance(state, dict):
            return ""
        parts: list[str] = []
        for key, label in labels.items():
            value = state.get(key)
            if value:
                parts.append(f"### {label}\n\n{value}")
        return "\n\n".join(parts)

    def _sanitize_tool_value(self, value: Any) -> Any:
        if isinstance(value, dict):
            sanitized = {}
            for key, item in value.items():
                lowered = str(key).lower()
                if any(token in lowered for token in ("key", "token", "secret", "password")):
                    sanitized[key] = "***"
                else:
                    sanitized[key] = self._sanitize_tool_value(item)
            return sanitized
        if isinstance(value, list):
            return [self._sanitize_tool_value(item) for item in value[:20]]
        if isinstance(value, str):
            return value if len(value) <= 500 else f"{value[:497]}..."
        return value

    def _extract_tool_events(self, state: object) -> list[dict[str, Any]]:
        if not isinstance(state, dict):
            return []
        events: list[dict[str, Any]] = []
        for index, message in enumerate(state.get("messages") or []):
            tool_calls = getattr(message, "tool_calls", None) or []
            for call in tool_calls:
                name = call.get("name") if isinstance(call, dict) else getattr(call, "name", None)
                args = call.get("args", {}) if isinstance(call, dict) else getattr(call, "args", {})
                call_id = call.get("id") if isinstance(call, dict) else getattr(call, "id", None)
                events.append(
                    {
                        "event_type": "tool_call",
                        "message_index": index,
                        "tool_call_id": call_id,
                        "tool_name": name or "unknown_tool",
                        "args": self._sanitize_tool_value(args or {}),
                    }
                )
            tool_call_id = getattr(message, "tool_call_id", None)
            if tool_call_id:
                content = getattr(message, "content", "")
                events.append(
                    {
                        "event_type": "tool_result",
                        "message_index": index,
                        "tool_call_id": tool_call_id,
                        "tool_name": getattr(message, "name", None) or "tool",
                        "content_preview": self._sanitize_tool_value(str(content)),
                    }
                )
        return events[:200]

    def _run_analysis(self, task_id: str, request: AnalyzeRequest):
        try:
            if task_id in self._cancelled_tasks:
                self._update(
                    task_id,
                    status=TaskStatus.CANCELLED,
                    current_step="已取消",
                    finished_at=datetime.now(timezone.utc).isoformat(),
                )
                return
            now = datetime.now(timezone.utc).isoformat()
            self._update(task_id, status=TaskStatus.RUNNING, started_at=now)

            self._append_message(
                task_id, "info", f"开始分析 {request.ticker} ({request.trade_date})"
            )
            self._update(task_id, current_step="构建配置...")

            config = DEFAULT_CONFIG.copy()
            config["llm_provider"] = request.llm_provider.value
            config["deep_think_llm"] = request.deep_think_llm
            config["quick_think_llm"] = request.quick_think_llm
            config["output_language"] = request.output_language
            config["checkpoint_enabled"] = request.checkpoint_enabled

            depth = (
                request.research_depth.value
                if hasattr(request.research_depth, "value")
                else "medium"
            )
            rounds = DEPTH_MAP.get(depth, 3)
            config["max_debate_rounds"] = rounds
            config["max_risk_discuss_rounds"] = rounds

            if request.backend_url:
                config["backend_url"] = request.backend_url

            if request.api_key:
                os.environ[f"{request.llm_provider.value.upper()}_API_KEY"] = (
                    request.api_key
                )

            # Provider-specific thinking configuration
            if (
                request.llm_provider.value == "openai"
                and request.openai_reasoning_effort
            ):
                config["openai_reasoning_effort"] = request.openai_reasoning_effort
            if request.llm_provider.value == "anthropic" and request.anthropic_effort:
                config["anthropic_effort"] = request.anthropic_effort
            if request.llm_provider.value == "google" and request.google_thinking_level:
                config["google_thinking_level"] = request.google_thinking_level
            if request.llm_provider.value == "deepseek":
                if request.deepseek_thinking:
                    config["deepseek_thinking"] = request.deepseek_thinking
                if request.openai_reasoning_effort:
                    config["openai_reasoning_effort"] = request.openai_reasoning_effort

            if request.market_profile.value in ("china", "hongkong"):
                config["market_profile"] = request.market_profile.value
                market_key = (
                    "china_market"
                    if request.market_profile.value == "china"
                    else "hongkong_market"
                )
                config.setdefault(market_key, {})["simulation_only"] = True

            selected = [a.value for a in request.selected_analysts]
            if request.clear_checkpoint_before_run:
                from tradingagents.graph.checkpointer import clear_checkpoint

                clear_checkpoint(
                    DEFAULT_CONFIG["data_cache_dir"], request.ticker, request.trade_date
                )
                self._append_message(task_id, "info", "已清除旧 checkpoint")

            self._append_message(task_id, "info", f"研究深度: {depth} ({rounds}轮辩论)")
            self._append_message(
                task_id,
                "info",
                f"LLM: {config['llm_provider']} / {config['deep_think_llm']}",
            )
            self._append_message(task_id, "info", f"分析师: {', '.join(selected)}")
            if request.checkpoint_enabled:
                self._append_message(task_id, "info", "Checkpoint 恢复已启用")
            self._update(task_id, current_step="初始化 TradingAgentsGraph...")

            from tradingagents.graph.trading_graph import TradingAgentsGraph

            # Mark selected analysts as in_progress
            for a in request.selected_analysts:
                self._update_agent(
                    task_id, "analysts", a.value, AgentStatus.IN_PROGRESS
                )
            self._set_stage_status(task_id, "analysts", AgentStatus.IN_PROGRESS)

            ta = TradingAgentsGraph(
                selected_analysts=selected,
                debug=False,
                config=config,
            )

            self._append_message(task_id, "info", "TradingAgentsGraph 初始化完成")
            self._update(task_id, current_step="执行分析流程...")
            self._add_tokens(task_id, llm_calls=1)

            final_state, decision = ta.propagate(request.ticker, request.trade_date)
            tool_events = self._extract_tool_events(final_state)

            # Mark all agents completed
            self._mark_all_completed(task_id)

            report = {
                "task_id": task_id,
                "ticker": request.ticker,
                "trade_date": request.trade_date,
                "research_depth": depth,
                "market_report": final_state.get("market_report", ""),
                "sentiment_report": final_state.get("sentiment_report", ""),
                "news_report": final_state.get("news_report", ""),
                "fundamentals_report": final_state.get("fundamentals_report", ""),
                "investment_plan": final_state.get("investment_plan", ""),
                "trader_investment_plan": final_state.get("trader_investment_plan", ""),
                "investment_debate_summary": self._debate_state_to_markdown(
                    final_state.get("investment_debate_state"),
                    {
                        "bull_history": "多头研究员",
                        "bear_history": "空头研究员",
                        "judge_decision": "研究经理裁决",
                    },
                ),
                "risk_debate_summary": self._debate_state_to_markdown(
                    final_state.get("risk_debate_state"),
                    {
                        "aggressive_history": "激进风险分析师",
                        "neutral_history": "中性风险分析师",
                        "conservative_history": "保守风险分析师",
                        "judge_decision": "风险团队裁决",
                    },
                ),
                "quant_signal_context": final_state.get("quant_signal_context", ""),
                "past_context": final_state.get("past_context", ""),
                "final_trade_decision": final_state.get("final_trade_decision", ""),
                "saved_path": "",
            }

            # Save report to disk
            try:
                saved_path = self._save_report_to_disk(report)
                report["saved_path"] = saved_path
            except Exception:
                pass

            with self._lock:
                self._reports[task_id] = report
                task = self._tasks.get(task_id)
                if task:
                    task.tool_events = tool_events

            self._append_message(task_id, "success", f"分析完成！决策: {decision}")
            self._update(
                task_id,
                status=TaskStatus.COMPLETED,
                current_step="分析完成",
                current_report_html=final_state.get("final_trade_decision", ""),
                finished_at=datetime.now(timezone.utc).isoformat(),
            )

        except Exception as e:
            logger.exception("Task %s failed", task_id)
            self._append_message(task_id, "error", f"分析失败: {str(e)}")
            self._update(
                task_id,
                status=TaskStatus.FAILED,
                current_step="分析失败",
                error=str(e) + "\n" + traceback.format_exc(),
                finished_at=datetime.now(timezone.utc).isoformat(),
            )

    def _mark_all_completed(self, task_id: str):
        with self._lock:
            task = self._tasks.get(task_id)
            if not task:
                return
            for stage in task.stages:
                stage.status = AgentStatus.COMPLETED
                for agent in stage.agents:
                    agent["status"] = AgentStatus.COMPLETED.value

    def _save_report_to_disk(self, report: dict) -> str:
        results_dir = Path(DEFAULT_CONFIG["results_dir"])
        ticker = report["ticker"].replace(".", "_")
        date_str = report["trade_date"]
        folder = results_dir / ticker / "TradingAgentsStrategy_logs"
        folder.mkdir(parents=True, exist_ok=True)

        parts = [
            f"# TradingAgents 分析报告\n\n"
            f"**股票**: {report['ticker']}\n\n"
            f"**日期**: {report['trade_date']}\n\n"
            f"**研究深度**: {report.get('research_depth', 'medium')}\n\n"
            f"---\n\n",
            f"## 市场技术面分析\n\n{report.get('market_report', '')}\n\n---\n\n",
            f"## 社交媒体情绪\n\n{report.get('sentiment_report', '')}\n\n---\n\n",
            f"## 新闻分析\n\n{report.get('news_report', '')}\n\n---\n\n",
            f"## 基本面分析\n\n{report.get('fundamentals_report', '')}\n\n---\n\n",
            f"## 多空研究辩论\n\n{report.get('investment_debate_summary', '')}\n\n---\n\n",
            f"## 投资计划\n\n{report.get('investment_plan', '')}\n\n---\n\n",
            f"## 交易计划\n\n{report.get('trader_investment_plan', '')}\n\n---\n\n",
            f"## 风险团队辩论\n\n{report.get('risk_debate_summary', '')}\n\n---\n\n",
            f"## 量化信号上下文\n\n{report.get('quant_signal_context', '')}\n\n---\n\n",
            f"## 最终决策\n\n{report.get('final_trade_decision', '')}\n\n",
        ]
        report_path = folder / f"report_{date_str}.md"
        report_path.write_text("".join(parts), encoding="utf-8")
        return str(report_path)
