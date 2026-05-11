from datetime import date, timedelta


def iter_calendar_days(start: date, end: date):
    current = start
    while current <= end:
        yield current
        current += timedelta(days=1)


def is_weekday(value: date) -> bool:
    return value.weekday() < 5
