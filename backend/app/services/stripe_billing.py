import stripe

from app.config import settings

stripe.api_key = settings.stripe_secret_key


def _price_for_plan(plan: str) -> str:
    if plan == "monthly":
        return settings.stripe_price_monthly
    if plan == "yearly":
        return settings.stripe_price_yearly
    raise ValueError("Invalid plan")


def create_checkout_session(plan: str, email: str | None = None) -> str:
    if not settings.stripe_secret_key:
        raise RuntimeError("Stripe is not configured")
    price_id = _price_for_plan(plan)
    if not price_id:
        raise RuntimeError(f"Stripe price not configured for plan: {plan}")

    params: dict = {
        "mode": "subscription",
        "line_items": [{"price": price_id, "quantity": 1}],
        "success_url": f"{settings.frontend_url}/billing/success?session_id={{CHECKOUT_SESSION_ID}}",
        "cancel_url": f"{settings.frontend_url}/support",
        "subscription_data": {
            "metadata": {"plan": plan},
        },
        "metadata": {"plan": plan},
    }
    if email:
        params["customer_email"] = email

    session = stripe.checkout.Session.create(**params)
    return session.url


def create_portal_session(customer_id: str) -> str:
    if not settings.stripe_secret_key:
        raise RuntimeError("Stripe is not configured")
    session = stripe.billing_portal.Session.create(
        customer=customer_id,
        return_url=f"{settings.frontend_url}/support",
    )
    return session.url
