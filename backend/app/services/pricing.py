def is_valid_energy_price(price: float | None) -> bool:
    return price is not None and price > 0
