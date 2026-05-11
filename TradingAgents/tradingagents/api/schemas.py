from __future__ import annotations

from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


class MarketProfile(str, Enum):
    US = "us"
    CHINA = "china"
    HONGKONG = "hongkong"


class ResearchDepth(str, Enum):
    SHALLOW = "shallow"
    MEDIUM = "medium"
    DEEP = "deep"


class LLMProvider(str, Enum):
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    GOOGLE = "google"
    DEEPSEEK = "deepseek"
    QWEN = "qwen"
    GLM = "glm"
    OLLAMA = "ollama"
    XAI = "xai"
    OPENROUTER = "openrouter"
    AZURE = "azure"


class AnalystType(str, Enum):
    MARKET = "market"
    FUNDAMENTALS = "fundamentals"
    NEWS = "news"
    SOCIAL = "social"
    SEC_FILINGS = "sec_filings"


class AnalyzeRequest(BaseModel):
    ticker: str = Field(..., description="股票代码，如 NVDA, 600519.SH, 00700.HK", examples=["NVDA", "600519.SH"])
    trade_date: str = Field(..., description="交易日期 YYYY-MM-DD", examples=["2026-04-30"])
    market_profile: MarketProfile = Field(default=MarketProfile.US, description="市场类型")
    research_depth: ResearchDepth = Field(default=ResearchDepth.MEDIUM, description="研究深度")
    selected_analysts: list[AnalystType] = Field(
        default=[AnalystType.MARKET, AnalystType.FUNDAMENTALS, AnalystType.NEWS, AnalystType.SOCIAL],
        description="选择的分析师类型"
    )
    llm_provider: LLMProvider = Field(default=LLMProvider.OPENAI, description="LLM 供应商")
    deep_think_llm: str = Field(default="gpt-5.4", description="深度推理模型")
    quick_think_llm: str = Field(default="gpt-5.4-mini", description="快速推理模型")
    api_key: Optional[str] = Field(default=None, description="LLM API Key（可选，留空则使用环境变量）")
    backend_url: Optional[str] = Field(default=None, description="LLM 代理地址（Base URL）")
    output_language: str = Field(default="English", description="报告输出语言")
    max_debate_rounds: int = Field(default=1, ge=1, le=5, description="最大辩论轮数")
    max_risk_discuss_rounds: int = Field(default=1, ge=1, le=5, description="最大风险讨论轮数")
    # Provider-specific thinking configuration
    openai_reasoning_effort: Optional[str] = Field(default=None, description="OpenAI reasoning effort: low/medium/high")
    anthropic_effort: Optional[str] = Field(default=None, description="Anthropic effort: low/medium/high")
    google_thinking_level: Optional[str] = Field(default=None, description="Google thinking level: high/minimal")
    deepseek_thinking: Optional[str] = Field(default=None, description="DeepSeek thinking mode: enabled/disabled")


class TaskStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class AgentStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    ERROR = "error"


class StageInfo(BaseModel):
    key: str = ""
    label: str = ""
    status: AgentStatus = AgentStatus.PENDING
    agents: list[dict[str, Any]] = Field(default_factory=list)


class TokenStats(BaseModel):
    input_tokens: int = 0
    output_tokens: int = 0
    llm_calls: int = 0
    tool_calls: int = 0


class TaskProgress(BaseModel):
    task_id: str
    status: TaskStatus
    ticker: str
    trade_date: str
    research_depth: str = "medium"
    messages: list[dict[str, Any]] = Field(default_factory=list)
    current_step: str = ""
    stages: list[StageInfo] = Field(default_factory=list)
    current_stage_key: str = ""
    token_stats: Optional[TokenStats] = None
    current_report_html: str = ""
    started_at: Optional[str] = None
    finished_at: Optional[str] = None
    error: Optional[str] = None


class TaskReport(BaseModel):
    task_id: str
    ticker: str
    trade_date: str
    research_depth: str = "medium"
    market_report: Optional[str] = None
    sentiment_report: Optional[str] = None
    news_report: Optional[str] = None
    fundamentals_report: Optional[str] = None
    investment_plan: Optional[str] = None
    final_trade_decision: Optional[str] = None
    saved_path: Optional[str] = None


class HistoryItem(BaseModel):
    ticker: str
    trade_date: str
    file_path: str
    created_at: Optional[str] = None


class ApiResponse(BaseModel):
    success: bool
    data: Optional[Any] = None
    error: Optional[str] = None
