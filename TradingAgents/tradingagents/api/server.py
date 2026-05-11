from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routes import router
from .signal_routes import router as signal_router

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
