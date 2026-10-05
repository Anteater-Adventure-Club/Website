# Officer person search

People searches in check-in, walk-in and shared member pickers, the member directory,
event participants, and reimbursements rank close name matches before pagination.
Existing ride, event, membership, quarter, and payment filters define the candidate
set. Clearing the query restores each view's existing default order.

## Libraries and policy

Spelling distance comes from Talisman's `damerau-levenshtein` module in JavaScript
and RapidFuzz's corresponding OSA metric in Python. Both count adjacent
transpositions as one edit. Double Metaphone comes from the `double-metaphone`
JavaScript package and `Metaphone` Python package. The Munkres libraries assign
multiple query parts to distinct name parts, minimizing the weakest match class
and then maximizing average similarity. No distance, pronunciation, or assignment
algorithm is implemented in application code.

Normalize Unicode case, accents, apostrophes, hyphens, and whitespace. Preserve
displayed names and non-Latin letters. Bound queries to 100 Unicode code points.
Name matching classes, from strongest to weakest, are full exact names, exact name
parts, prefixes, substrings, spelling matches, and pronunciation hints. Within a
class, prefer greater similarity, then normalized name and stable record ID.

Spelling matches start at three letters: minimum similarity 70%, or 2/3 for a
three-letter query. Compare full name parts and similarly sized prefixes, with at
most two edits through seven letters and three edits thereafter. Shorter queries
remain literal. Sound-alike hints require Latin-letter tokens of at least four
letters, overlapping nonempty phonetic codes, and at least 60% spelling similarity.
Sean/Shawn/Shaun share an explicit pronunciation exception. Pronunciation hints
are approximate; an officer selects the actual person before any action.

Email and check-in phone matching remain literal. Email-like and phone-like queries
use contact matching rather than approximate name matching. Numeric phone searches
also ignore telephone formatting. Searching never links identities, creates a
member, or changes check-in, membership, seat, or reimbursement state.

## Data flow and validation

Check-in and reimbursements rank already-authorized local data. Server-backed
searches debounce 150 ms, cancel obsolete requests through React Query, and hide
obsolete member choices while a new query is pending. Pickers distinguish errors
from no close matches and provide retry. API response contracts remain unchanged.

The two paged endpoints score only ID/name/email candidates from the complete
filtered query, count qualifying results, then hydrate the requested page using
the same filters. No migration, search server, or external name lookup is needed.

The shared examples in `backend/tests/fixtures/person-search.json` run in both
pytest and Vitest. Integration checks cover authorization, group and membership
filters, default ordering, and best matches beyond the first 10 or 50 records.
`npm run test:e2e:search` exercises desktop Chromium, Android-profile Chromium, and
iPhone-profile WebKit. It requires the guarded local synthetic browser database.
The frontend image copies the shared fixture for TypeScript's test-file checking;
fixtures are not bundled into the site's runtime JavaScript.
