from __future__ import annotations

import os
from datetime import datetime, timezone

from fastapi import APIRouter
from pydantic import BaseModel

from tradingagents.api.schemas import ApiResponse
from tradingagents.llm_clients.model_catalog import MODEL_OPTIONS, get_known_models
from tradingagents.llm_clients.validators import validate_model
from tradingagents.research.db import get_connection, init_db

router = APIRouter(prefix="/api/config", tags=["config"])

PROVIDER_ENV_KEYS = {
    "openai": "OPENAI_API_KEY",
    "anthropic": "ANTHROPIC_API_KEY",
    "google": "GOOGLE_API_KEY",
    "deepseek": "DEEPSEEK_API_KEY",
    "qwen": "DASHSCOPE_API_KEY",
    "glm": "GLM_API_KEY",
    "xai": "XAI_API_KEY",
    "openrouter": "OPENROUTER_API_KEY",
    "azure": "AZURE_OPENAI_API_KEY",
    "ollama": None,
}


class LLMProviderConfigRequest(BaseModel):
    provider: str
    display_name: str | None = None
    default_quick_model: str | None = None
    default_deep_model: str | None = None
    base_url: str | None = None
    api_key: str | None = None
    enabled: bool = True


class LLMValidationRequest(BaseModel):
    provider: str
    model: str


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _mask_secret(value: str | None) -> str | None:
    if not value:
        return None
    if len(value) <= 8:
        return "***"
    return f"{value[:3]}***{value[-4:]}"


def _config_rows() -> list[dict]:
    init_db()
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT provider, display_name, default_quick_model, default_deep_model,
                   base_url, api_key_mask, enabled, created_at, updated_at
            FROM llm_provider_config
            ORDER BY updated_at DESC, provider
            """
        ).fetchall()
    return [{**dict(row), "enabled": bool(row["enabled"])} for row in rows]


def _env_readiness() -> dict:
    readiness = {}
    for provider, env_key in PROVIDER_ENV_KEYS.items():
        readiness[provider] = {
            "env": env_key,
            "configured": bool(os.getenv(env_key)) if env_key else True,
            "api_key_mask": _mask_secret(os.getenv(env_key)) if env_key else None,
        }
    return readiness


@router.get("/llm", response_model=ApiResponse)
async def get_llm_config():
    known_models = get_known_models()
    provider_catalog = {
        provider: {
            "quick": options.get("quick", []),
            "deep": options.get("deep", []),
            "known_models": known_models.get(provider, []),
        }
        for provider, options in MODEL_OPTIONS.items()
    }
    return ApiResponse(
        success=True,
        data={
            "provider_catalog": provider_catalog,
            "provider_configs": _config_rows(),
            "env_readiness": _env_readiness(),
        },
    )


@router.post("/llm/providers", response_model=ApiResponse)
async def upsert_llm_provider_config(request: LLMProviderConfigRequest):
    init_db()
    provider = request.provider.strip().lower()
    timestamp = _now()
    api_key_mask = _mask_secret(request.api_key)
    with get_connection() as conn:
        existing = conn.execute(
            "SELECT api_key_mask, created_at FROM llm_provider_config WHERE provider = ?",
            (provider,),
        ).fetchone()
        conn.execute(
            """
            INSERT INTO llm_provider_config (
                provider, display_name, default_quick_model, default_deep_model,
                base_url, api_key_mask, enabled, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(provider) DO UPDATE SET
                display_name = excluded.display_name,
                default_quick_model = excluded.default_quick_model,
                default_deep_model = excluded.default_deep_model,
                base_url = excluded.base_url,
                api_key_mask = COALESCE(excluded.api_key_mask, llm_provider_config.api_key_mask),
                enabled = excluded.enabled,
                updated_at = excluded.updated_at
            """,
            (
                provider,
                request.display_name or provider,
                request.default_quick_model,
                request.default_deep_model,
                request.base_url,
                api_key_mask,
                int(request.enabled),
                existing["created_at"] if existing else timestamp,
                timestamp,
            ),
        )
        conn.commit()
    row = next(item for item in _config_rows() if item["provider"] == provider)
    return ApiResponse(success=True, data=row)


@router.post("/llm/validate", response_model=ApiResponse)
async def validate_llm_model(request: LLMValidationRequest):
    provider = request.provider.strip().lower()
    model = request.model.strip()
    return ApiResponse(
        success=True,
        data={
            "provider": provider,
            "model": model,
            "model_known": validate_model(provider, model),
            "env_configured": _env_readiness().get(provider, {}).get("configured", False),
        },
    )
