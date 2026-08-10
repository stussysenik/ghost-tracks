"""Stripe-backed export credits. This is the product's loss function.

Flow:
  1. App POSTs /billing/checkout with its opaque license_key + credit count.
     We create a Stripe Checkout Session (hosted payment page) and return its URL.
  2. User pays on Stripe's page. Stripe POSTs /billing/webhook on success.
     We verify the webhook signature, then grant credits to the license_key
     stored in the session's `client_reference_id`.
  3. App GETs /billing/status to show the discrete credit indicator.
  4. App POSTs /billing/consume before each GPX export; one credit is spent,
     atomically, server-side. No credit => no export.

The app NEVER holds the Stripe secret. All charging, credit creation, and
decrement happen here. The client holds only the opaque license_key.
"""

from __future__ import annotations

import os
from typing import Any

import stripe
from fastapi import APIRouter, HTTPException, Request

from models.schemas import (
    BillingStatusResponse,
    CheckoutRequest,
    CheckoutResponse,
    ClaimRequest,
    ConsumeRequest,
    ConsumeResponse,
)
from services.credits import consume, grant, remaining

router = APIRouter()

_STRIPE_KEY = os.getenv("STRIPE_SECRET_KEY")
_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")
# Cents. One credit == one export; default $2.00 per credit. Override in prod.
_CREDIT_UNIT_CENTS = int(os.getenv("CREDIT_UNIT_CENTS", "200"))

stripe.api_key = _STRIPE_KEY


def _stripe_ready() -> bool:
    return bool(_STRIPE_KEY)


@router.post("/billing/checkout", response_model=CheckoutResponse)
async def create_checkout(req: CheckoutRequest) -> CheckoutResponse:
    if not _stripe_ready():
        raise HTTPException(503, "Stripe is not configured on the server")
    try:
        session = stripe.checkout.Session.create(
            mode="payment",
            # Carry the license key through Stripe so the webhook can credit it
            # without the client ever being trusted.
            client_reference_id=req.license_key,
            metadata={"license_key": req.license_key, "credits": str(req.credits)},
            line_items=[
                {
                    "price_data": {
                        "currency": "usd",
                        "product_data": {
                            "name": "Ghost Tracks export credits",
                            "description": f"{req.credits} GPX export credits",
                        },
                        "unit_amount": _CREDIT_UNIT_CENTS,
                    },
                    "quantity": req.credits,
                }
            ],
            # Deep-links back into the app after payment. App adjusts as needed.
            success_url="ghosttracks://billing/success?session_id={CHECKOUT_SESSION_ID}",
            cancel_url="ghosttracks://billing/cancel",
        )
    except stripe.StripeError as e:
        raise HTTPException(502, f"Stripe error: {e}") from e
    if not session.url:
        raise HTTPException(502, "Stripe returned no checkout URL")
    return CheckoutResponse(session_url=session.url, session_id=session.id)


@router.get("/billing/status", response_model=BillingStatusResponse)
async def billing_status(license_key: str) -> BillingStatusResponse:
    bal = remaining(license_key)
    return BillingStatusResponse(licensed=bal > 0, remaining=bal)


@router.post("/billing/claim", response_model=BillingStatusResponse)
async def claim(req: ClaimRequest) -> BillingStatusResponse:
    """No-op status read kept for older clients; credits are grant-only via webhook."""
    bal = remaining(req.license_key)
    return BillingStatusResponse(licensed=bal > 0, remaining=bal)


@router.post("/billing/consume", response_model=ConsumeResponse)
async def consume_one(req: ConsumeRequest) -> ConsumeResponse:
    ok, left = consume(req.license_key)
    return ConsumeResponse(ok=ok, remaining=left)


@router.post("/billing/webhook", include_in_schema=False)
async def stripe_webhook(request: Request) -> dict[str, Any]:
    payload = await request.body()
    sig = request.headers.get("stripe-signature")

    if _WEBHOOK_SECRET:
        if not sig:
            raise HTTPException(400, "Missing Stripe-Signature header")
        try:
            event = stripe.Webhook.construct_event(payload, sig, _WEBHOOK_SECRET)
        except stripe.SignatureVerificationError as e:
            raise HTTPException(400, f"Invalid signature: {e}") from e
        except ValueError:
            raise HTTPException(400, "Malformed webhook payload")
    else:
        # Dev/test only: trust the payload when no secret is configured.
        import json

        event = json.loads(payload)

    if event.get("type") == "checkout.session.completed":
        session = event["data"]["object"]
        key = session.get("client_reference_id") or (
            session.get("metadata") or {}
        ).get("license_key")
        credits = int(
            (session.get("metadata") or {}).get("credits", "0")
        )
        if key and credits > 0:
            grant(key, credits)

    return {"received": True}
