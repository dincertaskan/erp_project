"""İş yerinin saatine (İstanbul) göre gün, hafta ve ay sınırları."""

import calendar
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

BUSINESS_TZ = ZoneInfo("Europe/Istanbul")


def now() -> datetime:
    return datetime.now(BUSINESS_TZ)


def as_business_time(moment: datetime) -> datetime:
    """Saat dilimi belirtilmemiş zaman İstanbul saati kabul edilir (UTC değil)."""
    return moment.replace(tzinfo=BUSINESS_TZ) if moment.tzinfo is None else moment


def start_of_day(moment: datetime) -> datetime:
    return moment.astimezone(BUSINESS_TZ).replace(hour=0, minute=0, second=0, microsecond=0)


def start_of_week(moment: datetime) -> datetime:
    day = start_of_day(moment)
    return day - timedelta(days=day.weekday())


def start_of_month(moment: datetime) -> datetime:
    return start_of_day(moment).replace(day=1)


def add_months(moment: datetime, months: int) -> datetime:
    """Ayın günü korunur; hedef ayda o gün yoksa ayın son günü kullanılır (31 Mart - 1 ay = 28/29 Şubat)."""
    index = moment.month - 1 + months
    year, month = moment.year + index // 12, index % 12 + 1
    return moment.replace(year=year, month=month, day=min(moment.day, calendar.monthrange(year, month)[1]))
