import hashlib
from urllib.parse import urlencode, urlsplit
from authlib.integrations.starlette_client import OAuth
from fastapi import APIRouter, Depends, Request
from fastapi.responses import RedirectResponse
from sqlalchemy import select, text
from .db import get_db
from .domain import advisory, audit, fail, utcnow
from .models import Identity, Marker, Member, Officer, RateLimit
from .schemas import MemberPrivate, SessionView

router = APIRouter(prefix="/api")


def uci_email(email):
    if not isinstance(email, str) or email.count("@") != 1:
        return False
    local, domain = email.strip().lower().split("@")
    return bool(local) and (domain == "uci.edu" or domain.endswith(".uci.edu"))


def safe_return(value):
    if (
        not value
        or not value.startswith("/")
        or value.startswith("//")
        or "\\" in value
        or any(ord(c) < 32 for c in value)
    ):
        return "/my-aac"
    return value if not urlsplit(value).netloc else "/my-aac"


def session_member_id(request: Request):
    if request.session.get("login_at", 0) < int(utcnow().timestamp()) - 28800:
        # Expire authentication without discarding an in-progress OAuth login.
        # An anonymous tab can read /session while another tab is at Google.
        request.session.pop("member_id", None)
        request.session.pop("login_at", None)
    return request.session.get("member_id")


def member(request: Request, db=Depends(get_db, scope="function")):
    mid = session_member_id(request)
    value = db.get(Member, mid) if isinstance(mid, int) else None
    if value is None:
        fail(401, "sign_in_required", "Sign in with your UCI account to continue.")
    return value


def officer(user=Depends(member), db=Depends(get_db, scope="function")):
    if db.get(Officer, user.id) is None:
        fail(403, "officer_required", "This page is for AAC officers.")
    return user


def limited(request, db, action, limit=30):
    ip = request.client.host if request.client else "unknown"
    key = action + ":" + hashlib.sha256(ip.encode()).hexdigest()[:32]
    window = int(utcnow().timestamp()) // 60
    if db.bind.dialect.name == "postgresql":
        count = db.execute(
            text("""INSERT INTO rate_limits (key, "window", count) VALUES (:key,:window,1)
            ON CONFLICT (key) DO UPDATE SET "window"=EXCLUDED."window",
            count=CASE WHEN rate_limits."window"=EXCLUDED."window" THEN rate_limits.count+1 ELSE 1 END
            RETURNING count"""),
            {"key": key, "window": window},
        ).scalar_one()
    else:
        entry = db.get(RateLimit, key)
        if entry is None:
            entry = RateLimit(key=key, window=window, count=1)
            db.add(entry)
        elif entry.window == window:
            entry.count += 1
        else:
            entry.window, entry.count = window, 1
        count = entry.count
    if count > limit:
        # Persist the count even when rejecting this request.
        db.commit()
        fail(429, "rate_limited", "Please wait a minute before trying again.")


def bootstrap(db, settings):
    advisory(db, 700)
    if db.get(Marker, "officer_bootstrap"):
        return
    for email in settings.initial_officers.split(","):
        email = email.strip().lower()
        if not uci_email(email):
            continue
        user = db.scalar(select(Member).where(Member.email == email))
        if user is None:
            user = Member(email=email, name=email.split("@")[0])
            db.add(user)
            db.flush()
        if db.get(Officer, user.id) is None:
            db.add(Officer(member_id=user.id))
    db.add(Marker(key="officer_bootstrap"))
    audit(db, None, "officer.bootstrap", "identity")
    db.commit()


def make_oauth(settings):
    oauth = OAuth()
    if settings.google_client_id and settings.google_client_secret:
        oauth.register(
            "google",
            client_id=settings.google_client_id,
            client_secret=settings.google_client_secret,
            server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
            client_kwargs={"scope": "openid email profile"},
        )
    return oauth


@router.get("/session", response_model=SessionView)
def session(request: Request, db=Depends(get_db, scope="function")):
    mid = session_member_id(request)
    user = db.get(Member, mid) if isinstance(mid, int) else None
    return {
        "member": MemberPrivate.model_validate(user).model_dump(mode="json") if user else None,
        "officer": bool(user and db.get(Officer, user.id)),
        "oauth_available": bool(request.app.state.settings.google_client_id),
        "profile_complete": bool(user and user.name and user.phone),
    }


@router.get("/auth/login")
async def login(request: Request, return_to: str = "/my-aac", db=Depends(get_db, scope="function")):
    # OAuth state is stored in a host-only session cookie. Start on the same
    # origin as the callback before creating that state (public shares may
    # bring a visitor to a different host).
    app_url = request.app.state.settings.app_url
    destination = safe_return(return_to)
    if str(request.base_url).rstrip("/") != app_url:
        return RedirectResponse(
            app_url + "/api/auth/login?" + urlencode({"return_to": destination}),
            status_code=303,
        )
    limited(request, db, "login", 20)
    google = request.app.state.oauth.create_client("google")
    if google is None:
        return RedirectResponse("/sign-in?error=unconfigured", status_code=303)
    request.session["return_to"] = destination
    return await google.authorize_redirect(request, app_url + "/api/auth/callback")


@router.get("/auth/callback")
async def callback(request: Request, db=Depends(get_db, scope="function")):
    google = request.app.state.oauth.create_client("google")
    if google is None:
        return RedirectResponse("/sign-in?error=unconfigured", status_code=303)
    try:
        token = await google.authorize_access_token(request)
        info = token.get("userinfo", {})
    except Exception:
        request.session.clear()
        return RedirectResponse("/sign-in?error=oauth", status_code=303)
    if not info.get("email_verified") or not uci_email(info.get("email")) or not info.get("sub"):
        request.session.clear()
        return RedirectResponse("/sign-in?error=uci", status_code=303)
    issuer = info.get("iss", "https://accounts.google.com")
    if issuer not in {"https://accounts.google.com", "accounts.google.com"}:
        fail(403, "invalid_issuer", "The identity provider could not be verified.")
    issuer = "https://accounts.google.com"
    email = info["email"].strip().lower()
    advisory(db, 701)
    identity = db.scalar(select(Identity).where(Identity.issuer == issuer, Identity.subject == info["sub"]))
    if identity:
        user = db.get(Member, identity.member_id)
    else:
        user = db.scalar(select(Member).where(Member.email == email))
        if user and db.scalar(select(Identity.id).where(Identity.member_id == user.id)):
            fail(
                409,
                "identity_conflict",
                "This email is already linked to another account. Contact an officer.",
            )
        if user is None:
            user = Member(email=email, name=info.get("name", email.split("@")[0])[:100])
            db.add(user)
            db.flush()
        elif user.name == email.split("@")[0]:
            user.name = info.get("name", user.name)[:100]
        db.add(Identity(member_id=user.id, issuer=issuer, subject=info["sub"]))
    destination = safe_return(request.session.get("return_to"))
    request.session.clear()
    request.session["member_id"] = user.id
    request.session["login_at"] = int(utcnow().timestamp())
    audit(db, user, "auth.login", user.id)
    return RedirectResponse(destination, status_code=303)


@router.post("/auth/logout")
def logout(request: Request):
    request.session.clear()
    return {"ok": True}
