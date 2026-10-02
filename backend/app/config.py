import os
from dataclasses import dataclass, field
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    environment: str = field(default_factory=lambda: os.getenv("APP_ENV", "development"))
    app_url: str = field(default_factory=lambda: os.getenv("APP_URL", "http://localhost:5173").rstrip("/"))
    database_url: str = field(
        default_factory=lambda: os.getenv("DATABASE_URL", "postgresql+psycopg://aac:aac@localhost:55432/aac")
    )
    session_secret: str = field(default_factory=lambda: os.getenv("SESSION_SECRET", ""))
    google_client_id: str = field(default_factory=lambda: os.getenv("GOOGLE_CLIENT_ID", ""))
    google_client_secret: str = field(default_factory=lambda: os.getenv("GOOGLE_CLIENT_SECRET", ""))
    initial_officers: str = field(
        default_factory=lambda: os.getenv("INITIAL_OFFICER_EMAILS", "gdodge@uci.edu")
    )
    media_root: Path = field(default_factory=lambda: Path(os.getenv("MEDIA_ROOT", "./media")))
    release_sha: str = field(default_factory=lambda: os.getenv("RELEASE_SHA", "development"))
    venmo: str = field(default_factory=lambda: os.getenv("DUES_VENMO_HANDLE", ""))
    zelle: str = field(default_factory=lambda: os.getenv("DUES_ZELLE_CONTACT", ""))
    cash: str = field(
        default_factory=lambda: os.getenv("DUES_CASH_INSTRUCTIONS", "Pay an officer at a club meeting.")
    )
    discord: str = field(default_factory=lambda: os.getenv("DISCORD_URL", ""))

    def validate(self):
        if self.environment == "production":
            if len(self.session_secret) < 32 or not self.app_url.startswith("https://"):
                raise RuntimeError("Production requires HTTPS APP_URL and a strong SESSION_SECRET")
        elif not self.session_secret:
            object.__setattr__(self, "session_secret", "local-development-only-do-not-deploy")
        return self
