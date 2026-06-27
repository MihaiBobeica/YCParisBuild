BLOCKING = {"CHARGING", "RESERVED", "OUTOFORDER", "INOPERATIVE"}


def aggregate_pin_color(statuses: list[str], confidence: int, has_partial_price: bool) -> str:
    if not statuses or all(s == "UNKNOWN" or not s for s in statuses):
        return "gray"
    if any(s == "AVAILABLE" for s in statuses):
        if confidence < 50 or has_partial_price:
            return "orange"
        return "green"
    if all(s in BLOCKING for s in statuses if s):
        return "red"
    if any(s in BLOCKING for s in statuses if s):
        return "red"
    return "orange"


def availability_summary(statuses: list[str]) -> str:
    available = sum(1 for s in statuses if s == "AVAILABLE")
    total = len(statuses) or 1
    if available > 0:
        return f"Available ({available}/{total})"
    if all(s in BLOCKING for s in statuses if s):
        return "Unavailable"
    if all(s == "UNKNOWN" or not s for s in statuses):
        return "Unknown"
    return "Limited"
