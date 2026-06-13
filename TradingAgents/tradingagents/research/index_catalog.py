from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class IndexProfile:
    canonical_symbol: str
    name: str
    market: str
    akshare_symbol: str | None
    aliases: tuple[str, ...]


INDEX_PROFILES: dict[str, IndexProfile] = {
    "000016.SH": IndexProfile(
        canonical_symbol="000016.SH",
        name="上证50",
        market="CHINA",
        akshare_symbol="sh000016",
        aliases=("000016", "000016.SH", "上证50", "中证50", "SSE50", "SH50"),
    ),
    "000300.SH": IndexProfile(
        canonical_symbol="000300.SH",
        name="沪深300",
        market="CHINA",
        akshare_symbol="sh000300",
        aliases=("000300", "000300.SH", "399300", "399300.SZ"),
    ),
    "000905.SH": IndexProfile(
        canonical_symbol="000905.SH",
        name="中证500",
        market="CHINA",
        akshare_symbol="sh000905",
        aliases=("000905", "000905.SH", "399905", "399905.SZ"),
    ),
    "000852.SH": IndexProfile(
        canonical_symbol="000852.SH",
        name="中证1000",
        market="CHINA",
        akshare_symbol="sh000852",
        aliases=("000852", "000852.SH", "399852", "399852.SZ"),
    ),
    "HSI": IndexProfile(
        canonical_symbol="HSI",
        name="恒生指数",
        market="HONGKONG",
        akshare_symbol="HSI",
        aliases=("HSI", "^HSI", "恒生指数", "恒指"),
    ),
}

_ALIASES = {
    alias.upper(): profile.canonical_symbol
    for profile in INDEX_PROFILES.values()
    for alias in profile.aliases
}


def resolve_index_profile(symbol: str) -> IndexProfile | None:
    value = str(symbol).strip().upper()
    canonical = _ALIASES.get(value)
    if not canonical:
        return None
    return INDEX_PROFILES[canonical]


def normalize_index_symbol(symbol: str) -> str:
    profile = resolve_index_profile(symbol)
    if not profile:
        raise ValueError(f"Unsupported index symbol: {symbol}")
    return profile.canonical_symbol


def is_supported_index_symbol(symbol: str) -> bool:
    return resolve_index_profile(symbol) is not None


def index_display_name(symbol: str) -> str:
    profile = resolve_index_profile(symbol)
    return profile.name if profile else str(symbol).strip().upper()


def akshare_index_symbol(symbol: str) -> str:
    profile = resolve_index_profile(symbol)
    if not profile or not profile.akshare_symbol:
        raise ValueError(f"Index {symbol} does not have an AKShare mapping")
    return profile.akshare_symbol


DEFAULT_CHINA_INDEX_SYMBOLS = ("000016.SH", "000300.SH", "000905.SH", "000852.SH")
