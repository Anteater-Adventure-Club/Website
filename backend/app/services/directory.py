"""Read UCI directory names without evaluating or returning directory HTML."""

import asyncio
import base64
import re
from html.parser import HTMLParser
import httpx
from ..auth import uci_email as is_uci_email


def email_address(value):
    return value.strip().lower()


URL = "https://directory.uci.edu/render-list"


class DirectoryUnavailable(Exception):
    pass


class DirectoryParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.records = []
        self.record = None
        self.row = []
        self.cell = None
        self.script = False

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "table" and "directory-info-table-section" in attrs.get("class", "").split():
            self.record = {}
        if self.record is None:
            return
        if tag == "tr":
            self.row = []
        if tag == "td":
            self.cell = {"text": [], "scripts": []}
        if tag == "script" and self.cell is not None:
            self.script = True
        if tag == "a" and self.cell is not None and attrs.get("href", "").startswith("mailto:"):
            self.cell["text"].append(" " + attrs["href"][7:] + " ")

    def handle_data(self, data):
        if self.record is not None and self.cell is not None:
            self.cell["scripts" if self.script else "text"].append(data)

    def handle_endtag(self, tag):
        if self.record is None:
            return
        if tag == "script":
            self.script = False
        if tag == "td" and self.cell is not None:
            self.row.append(self.cell)
            self.cell = None
        if tag == "tr" and len(self.row) >= 2:
            label = " ".join("".join(self.row[0]["text"]).split())
            cell = self.row[1]
            value = " ".join("".join(cell["text"]).split())
            if label == "Name":
                self.record["name"] = value
            if label == "Email":
                emails = set(re.findall(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+", value, re.I))
                for encoded in re.findall(
                    r"""atob\(\s*["']([A-Za-z0-9+/=]+)["']\s*\)""", "".join(cell["scripts"])
                ):
                    try:
                        emails.add(base64.b64decode(encoded, validate=True).decode("utf-8").strip())
                    except (ValueError, UnicodeError):
                        pass
                self.record["emails"] = {email_address(email) for email in emails if is_uci_email(email)}
        if tag == "table":
            self.records.append(self.record)
            self.record = None


def exact_name(html, email):
    parser = DirectoryParser()
    parser.feed(html)
    matches = [r for r in parser.records if email in r.get("emails", set())]
    if len(matches) != 1:
        return None
    name = matches[0].get("name", "").strip()
    return name if name and len(name) <= 100 else None


async def lookup_name(email):
    try:
        async with asyncio.timeout(5), httpx.AsyncClient(timeout=5, follow_redirects=False) as client:
            response = await client.post(URL, data={"uciKey": email, "filter": "all"})
            response.raise_for_status()
            if len(response.content) > 1_000_000:
                raise DirectoryUnavailable()
            data = response.json()
            if not isinstance(data, dict) or not isinstance(data.get("html"), str):
                raise DirectoryUnavailable()
            return exact_name(data["html"], email)
    except (httpx.HTTPError, ValueError, TypeError, TimeoutError) as exc:
        raise DirectoryUnavailable() from exc
