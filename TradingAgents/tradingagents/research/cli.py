from __future__ import annotations

import argparse
import json

from .data_sync import sync_watchlist_bars
from .db import init_db
from .factor_pipeline import compute_watchlist_factors
from .quality import list_quality_issues
from .repository import list_watchlist, upsert_watchlist_symbols


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="python -m tradingagents.research.cli")
    subparsers = parser.add_subparsers(dest="command", required=True)

    subparsers.add_parser("init-db")

    add_watchlist = subparsers.add_parser("add-watchlist")
    add_watchlist.add_argument("symbols", nargs="+")

    list_watchlist_parser = subparsers.add_parser("list-watchlist")
    list_watchlist_parser.add_argument("--all", action="store_true")

    sync_bars = subparsers.add_parser("sync-bars")
    sync_bars.add_argument("--start", required=True)
    sync_bars.add_argument("--end", required=True)

    compute_factors = subparsers.add_parser("compute-factors")
    compute_factors.add_argument("--start", required=True)
    compute_factors.add_argument("--end", required=True)

    subparsers.add_parser("data-quality")
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

    if args.command == "list-watchlist":
        rows = list_watchlist(active_only=not args.all)
        print(json.dumps(rows, ensure_ascii=False, indent=2))
        return 0

    if args.command == "sync-bars":
        rows_synced = sync_watchlist_bars(args.start, args.end)
        print(f"synced {rows_synced} daily bars")
        return 0

    if args.command == "compute-factors":
        rows_computed = compute_watchlist_factors(args.start, args.end)
        print(f"computed {rows_computed} factor rows")
        return 0

    if args.command == "data-quality":
        print(json.dumps(list_quality_issues(), ensure_ascii=False, indent=2))
        return 0

    parser.error(f"unsupported command: {args.command}")
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
