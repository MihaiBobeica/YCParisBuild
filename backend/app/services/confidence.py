from datetime import datetime, timezone

FRESHNESS_MINUTES = 15


def compute_confidence(
    statuses: list[str],
    has_energy_price: bool,
    last_updated: datetime | None,
    tariff_matched: bool,
) -> tuple[int, str]:
    score = 0
    known_status = any(s and s != "UNKNOWN" for s in statuses)
    if known_status:
        score += 25
    if has_energy_price:
        score += 25
    if last_updated:
        now = datetime.now(timezone.utc)
        lu = last_updated if last_updated.tzinfo else last_updated.replace(tzinfo=timezone.utc)
        age_min = (now - lu).total_seconds() / 60
        if age_min < FRESHNESS_MINUTES:
            score += 25
    if tariff_matched:
        score += 25

    if score >= 75:
        label = "High"
    elif score >= 50:
        label = "Medium"
    else:
        label = "Low"
    return score, label
