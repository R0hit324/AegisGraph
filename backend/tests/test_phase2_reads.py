"""Phase 2 read-endpoint tests: members roster and organization audit trail.

These cover the two endpoints added for the Phase 2 frontend:
- GET /organizations/{org_id}/members  (viewer and above)
- GET /organizations/{org_id}/audit    (admin and above)

Security expectations enforced here:
- Membership isolation: non-members are always denied.
- The audit response never carries IP addresses, user agents, tokens or
  password material — only action/outcome/timestamp/actor display fields.
"""

from __future__ import annotations

from collections.abc import Iterator

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

PASSWORD = "S3curePassw0rd!"


@pytest.fixture()
def app_instance(app: FastAPI) -> FastAPI:
    """Type alias so multiple TestClients can share the same app/database."""
    return app


def _register(client: TestClient, username: str) -> dict[str, object]:
    """Register a user; the HttpOnly session cookie stays in the client jar."""
    response = client.post(
        "/auth/register",
        json={"username": username, "email": f"{username}@example.com", "password": PASSWORD},
    )
    assert response.status_code == 201, response.text
    me = client.get("/auth/me")
    assert me.status_code == 200
    return me.json()


def _client_for(app: FastAPI) -> Iterator[TestClient]:
    with TestClient(app, raise_server_exceptions=False) as test_client:
        yield test_client


def test_members_roster_requires_membership(app_instance: FastAPI) -> None:
    alice_client = next(_client_for(app_instance), None)
    assert alice_client is not None
    _register(alice_client, "roster_owner")
    dave_client = next(_client_for(app_instance), None)
    assert dave_client is not None
    _register(dave_client, "outsider")

    orgs = alice_client.get("/organizations").json()
    assert len(orgs) >= 1
    org_id = orgs[0]["id"]

    # Owner sees a roster containing only usernames and roles.
    roster = alice_client.get(f"/organizations/{org_id}/members")
    assert roster.status_code == 200
    members = roster.json()
    assert len(members) == 1
    assert set(members[0].keys()) == {"user_id", "username", "role", "joined_at"}
    assert members[0]["role"] == "owner"

    # A user who is not a member of the organization is denied — even for reads.
    forbidden = dave_client.get(f"/organizations/{org_id}/members")
    assert forbidden.status_code == 403


def test_members_roster_visible_to_viewer(app_instance: FastAPI) -> None:
    alice_client = next(_client_for(app_instance), None)
    assert alice_client is not None
    _register(alice_client, "viewer_admin")
    carol_client = next(_client_for(app_instance), None)
    assert carol_client is not None
    carol = _register(carol_client, "plain_viewer")
    carol_id = carol["id"]

    orgs = alice_client.get("/organizations").json()
    org_id = orgs[0]["id"]

    added = alice_client.post(
        f"/organizations/{org_id}/members",
        json={"user_id": carol_id, "role": "viewer"},
    )
    assert added.status_code == 201, added.text

    roster = carol_client.get(f"/organizations/{org_id}/members")
    assert roster.status_code == 200
    assert any(member["username"] == "plain_viewer" for member in roster.json())


def test_audit_trail_admin_only_and_never_leaks_sensitive_fields(
    app_instance: FastAPI,
) -> None:
    alice_client = next(_client_for(app_instance), None)
    assert alice_client is not None
    _register(alice_client, "audit_admin")
    carol_client = next(_client_for(app_instance), None)
    assert carol_client is not None
    carol = _register(carol_client, "audit_viewer")
    carol_id = carol["id"]

    orgs = alice_client.get("/organizations").json()
    org_id = orgs[0]["id"]

    # Generate an org-scoped audit event.
    added = alice_client.post(
        f"/organizations/{org_id}/members",
        json={"user_id": carol_id, "role": "viewer"},
    )
    assert added.status_code == 201

    # A viewer must not read the audit trail (403), but can still see members.
    denied = carol_client.get(f"/organizations/{org_id}/audit")
    assert denied.status_code == 403
    viewer_sees_members = carol_client.get(f"/organizations/{org_id}/members")
    assert viewer_sees_members.status_code == 200

    # An owner reads the trail: action/outcome/timestamp/actor only.
    trail = alice_client.get(f"/organizations/{org_id}/audit")
    assert trail.status_code == 200
    events = trail.json()
    assert len(events) >= 1
    assert any(event["action"] == "org_member_add" for event in events)

    allowed_fields = {"id", "action", "outcome", "created_at", "actor_username", "organization_name"}
    for event in events:
        assert set(event.keys()) == allowed_fields, event
        assert "ip_address" not in event
        assert "user_agent" not in event
        assert "details" not in event
        # Events without an actor must not invent one.
        if event["action"] == "org_member_add":
            assert event["actor_username"] == "audit_admin"
