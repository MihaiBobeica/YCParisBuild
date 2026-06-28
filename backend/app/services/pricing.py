def is_valid_energy_price(price: float | None) -> bool:
    """True when price is a positive €/kWh that won't display as €0.00."""
    if price is None or price <= 0:
        return False
    return round(price, 2) > 0
