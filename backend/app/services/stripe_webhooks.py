from datetime import datetime, timezone

import stripe
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import StripeEvent, Subscription

stripe.api_key = settings.stripe_secret_key


async def _get_or_create_subscription(
    session: AsyncSession,
    customer_id: str,
    email: str | None = None,
) -> Subscription:
    sub = await session.scalar(
        select(Subscription).where(Subscription.stripe_customer_id == customer_id)
    )
    if not sub:
        sub = Subscription(stripe_customer_id=customer_id, email=email)
        session.add(sub)
    elif email and not sub.email:
        sub.email = email
    return sub


async def handle_webhook_event(session: AsyncSession, event: stripe.Event) -> None:
    existing = await session.get(StripeEvent, event.id)
    if existing:
        return

    session.add(StripeEvent(id=event.id))

    if event.type == "checkout.session.completed":
        data = event.data.object
        customer_id = data.get("customer")
        subscription_id = data.get("subscription")
        email = data.get("customer_details", {}).get("email") or data.get("customer_email")
        plan = data.get("metadata", {}).get("plan", "monthly")
        if customer_id:
            sub = await _get_or_create_subscription(session, customer_id, email)
            sub.stripe_subscription_id = subscription_id
            sub.plan = plan
            sub.status = "active"

    elif event.type == "customer.subscription.updated":
        data = event.data.object
        customer_id = data.get("customer")
        if customer_id:
            sub = await _get_or_create_subscription(session, customer_id)
            sub.stripe_subscription_id = data.get("id")
            sub.status = data.get("status", "none")
            sub.plan = data.get("metadata", {}).get("plan", sub.plan)
            period_end = data.get("current_period_end")
            if period_end:
                sub.current_period_end = datetime.fromtimestamp(period_end, tz=timezone.utc)

    elif event.type == "customer.subscription.deleted":
        data = event.data.object
        customer_id = data.get("customer")
        if customer_id:
            sub = await session.scalar(
                select(Subscription).where(Subscription.stripe_customer_id == customer_id)
            )
            if sub:
                sub.status = "canceled"

    elif event.type == "invoice.payment_failed":
        data = event.data.object
        customer_id = data.get("customer")
        if customer_id:
            sub = await session.scalar(
                select(Subscription).where(Subscription.stripe_customer_id == customer_id)
            )
            if sub:
                sub.status = "past_due"
