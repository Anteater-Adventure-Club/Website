"""Officer search policy around established spelling, phonetic and assignment libraries."""

import re
import unicodedata
from functools import lru_cache

from metaphone import doublemetaphone
from munkres import Munkres
from rapidfuzz.distance import OSA

from .domain import page
from .models import Member


def normalize_name(value):
    value = "".join(
        c for c in unicodedata.normalize("NFKD", value) if not unicodedata.category(c).startswith("M")
    )
    value = value.lower().replace("ß", "ss").replace("'", "").replace("’", "")
    return " ".join("".join(c if c.isalnum() else " " for c in value).split())


@lru_cache(maxsize=4096)
def phonetics(token):
    if len(token) < 4 or not re.fullmatch("[a-z]+", token):
        return frozenset()
    codes = set(doublemetaphone(token)) - {""}
    # Irish Sean is a pronunciation exception that Double Metaphone does not encode.
    if token in {"sean", "shawn", "shaun"}:
        codes.add("XN")
    return frozenset(codes)


def token_match(query, token):
    if query == token:
        return (1, 1.0)
    if token.startswith(query):
        return (2, len(query) / len(token))
    if query in token:
        return (3, len(query) / len(token))
    if len(query) < 3:
        return None
    maximum = 2 if len(query) <= 7 else 3
    threshold = 2 / 3 if len(query) == 3 else 0.7
    prefixes = {
        token,
        *(token[:n] for n in range(max(1, len(query) - maximum), min(len(token), len(query) + maximum) + 1)),
    }
    best = 0.0
    for prefix in prefixes:
        distance = OSA.distance(query, prefix, score_cutoff=maximum)
        if distance <= maximum:
            best = max(best, 1 - distance / max(len(query), len(prefix)))
    if best + 1e-12 >= threshold:
        return (4, best)
    similarity = OSA.normalized_similarity(query, token)
    if similarity >= 0.6 and phonetics(query).intersection(phonetics(token)):
        return (5, similarity)
    return None


def name_match(query, name):
    if not query or not name:
        return None
    if query == name:
        return (0, 1.0)
    parts, tokens = query.split(), name.split()
    if len(parts) > len(tokens):
        return None
    matches = [[token_match(part, token) for token in tokens] for part in parts]
    if any(not any(row) for row in matches):
        return None
    if len(parts) == 1:
        return min((match for match in matches[0] if match), key=lambda match: (match[0], -match[1]))
    # Reuse an assignment library: each query part must get a distinct name part.
    # First minimize the weakest match class, then maximize average similarity.
    for tier in range(max(min(m[0] for m in row if m) for row in matches), 6):
        costs = [
            [round((1 - m[1]) * 1_000_000) if m and m[0] <= tier else 1_000_000_000 for m in row]
            for row in matches
        ]
        pairs = Munkres().compute(costs)
        selected = [matches[i][j] for i, j in pairs]
        if len(selected) == len(parts) and all(m and m[0] <= tier for m in selected):
            return (tier, sum(m[1] for m in selected) / len(parts))
    return None


def rank_people(people, search):
    people = list(people)
    literal = search.strip()[:100].lower()
    if not literal:
        return people
    query = normalize_name(literal)
    digits = re.sub(r"\D", "", literal)
    phone_query = bool(digits and re.fullmatch(r"[\d\s()+.\-]+", literal))
    contact_query = "@" in literal or phone_query
    ranked = []
    for person in people:
        name = normalize_name(person["name"])
        match = None if contact_query else name_match(query, name)
        email = (person.get("email") or "").lower()
        phone = person.get("phone") or ""
        for value, needle in (
            (email, literal),
            (phone, literal),
            (re.sub(r"\D", "", phone), digits if phone_query else ""),
        ):
            if needle and value and needle in value:
                contact = (0 if needle == value else 3, len(needle) / len(value))
                if match is None or (contact[0], -contact[1]) < (match[0], -match[1]):
                    match = contact
        if match is not None:
            ranked.append(((match[0], -round(match[1], 12), name, person["id"]), person))
    return [person for _, person in sorted(ranked, key=lambda item: item[0])]


def ranked_page(db, query, model, search, limit, offset):
    """Score the complete authorized candidate set; hydrate only the requested page."""
    if not search.strip():
        return page(db, query, limit, offset)
    candidates = db.execute(
        query.with_only_columns(
            model.id.label("id"),
            Member.name.label("name"),
            Member.email.label("email"),
            maintain_column_froms=True,
        ).order_by(None)
    ).mappings()
    ranked = rank_people(candidates, search)
    ids = [row["id"] for row in ranked[offset : offset + limit]]
    if not ids:
        return {"items": [], "total": len(ranked)}
    objects = {row.id: row for row in db.scalars(query.where(model.id.in_(ids)).order_by(None))}
    return {"items": [objects[mid] for mid in ids if mid in objects], "total": len(ranked)}
