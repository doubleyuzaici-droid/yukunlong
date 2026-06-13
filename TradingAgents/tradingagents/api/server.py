from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .agent_review_routes import router as agent_review_router
from .backtest_routes import router as backtest_router
from .config_routes import router as config_router
from .market_routes import router as market_router
from .operability_routes import router as operability_router
from .professional_routes import router as professional_router
from .research_routes import router as research_router
from .routes import router
from .report_routes import router as report_router
from .signal_routes import router as signal_router
from .strategy_routes import router as strategy_router

logger = logging.getLogger(__name__)


def create_app() -> FastAPI:
    app = FastAPI(
        title="TradingAgents API",
        description="Multi-Agent LLM Financial Trading Framework - Web API",
        version="0.2.4",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(router)
    app.include_router(signal_router)
    app.include_router(report_router)
    app.include_router(backtest_router)
    app.include_router(agent_review_router)
    app.include_router(research_router)
    app.include_router(operability_router)
    app.include_router(market_router)
    app.include_router(config_router)
    app.include_router(professional_router)
    app.include_router(strategy_router)

    @app.get("/health")
    async def health():
        return {"status": "ok", "service": "TradingAgents API"}

    return app


app = create_app()


def main():
    import uvicorn

    uvicorn.run(
        "tradingagents.api.server:app",
        host="0.0.0.0",
        port=8100,
        reload=True,
        log_level="info",
    )


if __name__ == "__main__":
    main()
