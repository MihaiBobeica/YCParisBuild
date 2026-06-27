from unittest.mock import AsyncMock, MagicMock

import pytest

from app.services.stripe_webhooks import handle_webhook_event


@pytest.mark.asyncio
async def test_webhook_checkout_completed():
    session = MagicMock()
    session.get = AsyncMock(return_value=None)
    session.scalar = AsyncMock(return_value=None)
    session.add = MagicMock()

    event = MagicMock()
    event.id = "evt_test_1"
    event.type = "checkout.session.completed"
    event.data.object = {
        "customer": "cus_test",
        "subscription": "sub_test",
        "customer_email": "test@example.com",
        "metadata": {"plan": "monthly"},
    }

    await handle_webhook_event(session, event)
    assert session.add.called


@pytest.mark.asyncio
async def test_webhook_idempotent():
    session = MagicMock()
    session.get = AsyncMock(return_value=MagicMock())  # event already processed

    event = MagicMock()
    event.id = "evt_test_2"
    event.type = "checkout.session.completed"
    event.data.object = {}

    await handle_webhook_event(session, event)
    session.add.assert_not_called()
