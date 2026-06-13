from __future__ import annotations

import argparse
import json

from .data_sync import (
    DATA_SOURCES,
    sync_index_bars,
    sync_watchlist_bars,
    sync_watchlist_fund_flows,
)
from .db import init_db
from .factor_pipeline import compute_watchlist_factors
from .quality import list_quality_issues
from .pipeline import run_pipeline
from .repository import ensure_core_watchlist_symbols, list_watchlist, upsert_watchlist_symbols


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="python -m tradingagents.research.cli")
    subparsers = parser.add_subparsers(dest="command", required=True)

    subparsers.add_parser("init-db")

    add_watchlist = subparsers.add_parser("add-watchlist")
    add_watchlist.add_argument("symbols", nargs="+")

    bootstrap_watchlist = subparsers.add_parser("bootstrap-watchlist")
    bootstrap_watchlist.add_argument("symbols", nargs="*")

    list_watchlist_parser = subparsers.add_parser("list-watchlist")
    list_watchlist_parser.add_argument("--all", action="store_true")

    sync_bars = subparsers.add_parser("sync-bars")
    sync_bars.add_argument("--start", required=True)
    sync_bars.add_argument("--end", required=True)
    sync_bars.add_argument(
        "--source",
        choices=DATA_SOURCES,
        default=None,
        help="daily bar source; defaults to TRADINGAGENTS_DATA_SOURCE or akshare",
    )

    sync_indices = subparsers.add_parser("sync-indices")
    sync_indices.add_argument("--start", required=True)
    sync_indices.add_argument("--end", required=True)
    sync_indices.add_argument("--index", dest="indices", action="append")
    sync_indices.add_argument(
        "--source",
        choices=("akshare", "auto"),
        default=None,
        help="index data source; defaults to akshare",
    )

    sync_flow = subparsers.add_parser("sync-fund-flow")
    sync_flow.add_argument("--start", required=True)
    sync_flow.add_argument("--end", required=True)

    compute_factors = subparsers.add_parser("compute-factors")
    compute_factors.add_argument("--start", required=True)
    compute_factors.add_argument("--end", required=True)

    subparsers.add_parser("data-quality")
    run_pipeline_parser = subparsers.add_parser("run-pipeline")
    run_pipeline_parser.add_argument("--start", required=True)
    run_pipeline_parser.add_argument("--end", required=True)
    run_pipeline_parser.add_argument("--signal-date", default=None)
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    if args.command == "init-db":
        init_db()
        print("research db initialized")
        return 0

    if args.command == "add-watchlist":
        upsert_watchlist_symbols(args.symbols)
        print(f"added {len(args.symbols)} symbols")
        return 0

    if args.command == "bootstrap-watchlist":
        rows = ensure_core_watchlist_symbols(args.symbols or None)
        print(json.dumps(rows, ensure_ascii=False, indent=2))
        return 0

    if args.command == "list-watchlist":
        rows = list_watchlist(active_only=not args.all)
        print(json.dumps(rows, ensure_ascii=False, indent=2))
        return 0

    if args.command == "sync-bars":
        rows_synced = sync_watchlist_bars(args.start, args.end, source=args.source)
        print(f"synced {rows_synced} daily bars")
        return 0

    if args.command == "sync-indices":
        rows_synced = sync_index_bars(
            args.start,
            args.end,
            index_symbols=args.indices,
            source=args.source,
        )
        print(f"synced {rows_synced} index bars")
        return 0

    if args.command == "sync-fund-flow":
        rows_synced = sync_watchlist_fund_flows(args.start, args.end)
        print(f"synced {rows_synced} fund-flow rows")
        return 0

    if args.command == "compute-factors":
        rows_computed = compute_watchlist_factors(args.start, args.end)
        print(f"computed {rows_computed} factor rows")
        return 0

    if args.command == "data-quality":
        print(json.dumps(list_quality_issues(), ensure_ascii=False, indent=2))
        return 0

    if args.command == "run-pipeline":
        result = run_pipeline(args.start, args.end, signal_date=args.signal_date)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0

    parser.error(f"unsupported command: {args.command}")
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
