# News sources and permission register

Reviewed: **2026-10-22**. This records evidence for the intended implementation, not a legal opinion or a claim of publisher endorsement. **No source is enabled by the migration; no production collection was enabled.**

## Reviewed source: arXiv research metadata

- Source ID: `arxiv-research`; official Atom API, not web scraping.
- Request URL: `https://export.arxiv.org/api/query?search_query=cat:cs.AI+OR+cat:cs.LG+OR+cat:cs.SE&sortBy=submittedDate&sortOrder=descending&max_results=30`.
- [Official API terms](https://info.arxiv.org/help/api/tou.html) permit retrieving, storing, transforming and sharing descriptive metadata under **CC0 1.0**. Papers have separate copyright/licensing; this is not permission to republish papers.
- [API access / acknowledgment](https://info.arxiv.org/help/api/index.html) requests: “Thank you to arXiv for use of its open access interoperability.” Displayed with collected entries. No affiliation or endorsement is implied.
- Use here: title, identifier, classification, timestamps, abstract-page link; an original deterministic summary of these facts. No abstract/full paper, authors' contact details, PDFs, publisher logos or external images are stored.
- Rate: a single connection; at most one request per three seconds across controlled machines. This implementation reserves a six-hour source interval in the database, retries at most once after four seconds, and honors longer Retry-After reservations. Coordinate other applications using the same source separately.
- Runtime test: one bounded HTTPS request successfully parsed 30 entries on 2026-10-22; nothing was persisted or published.
- Permission evidence verified: yes, for this narrow metadata use. Enabled by default: **no**. An authorized news administrator must activate it after migration and deployment review.

## Disabled candidates

The references below are investigation entry points, **not completed permission reviews or a claim that collection is prohibited**. No crawler/API adapter is activated for these providers. Public visibility, a feed, a software license, or attribution alone does not establish redistribution permission.

| Source | Candidate access / reference | State and reason | Review date |
| --- | --- | --- | --- |
| Google News | RSS candidate; [Google terms](https://policies.google.com/terms) | Disabled. Third-party publisher redistribution rights not established. | 2026-10-22 |
| Django weblog | [Official RSS](https://www.djangoproject.com/rss/weblog/), [weblog](https://www.djangoproject.com/weblog/) | Disabled. Feed exists, but blog redistribution permission was not established. Code/trademark licensing is insufficient. | 2026-10-22 |
| Devpost | API/feed to be confirmed; [terms reference](https://info.devpost.com/terms) | Disabled. Authorized access and intended redistribution rights unverified. | 2026-10-22 |
| Major League Hacking | Organizer feed/API to be confirmed; [organizer site](https://mlh.io/) | Disabled. Organizer permission and feed/API terms unverified. | 2026-10-22 |
| Unstop | API/feed to be confirmed; [organizer site](https://unstop.com/) | Disabled. Authorized access and redistribution rights unverified. | 2026-10-22 |
| Other publications / universities | None configured | Disabled/not allowlisted until independently reviewed. | 2026-10-22 |

## Adding a provider

1. Review its actual feed/API terms, relevant content license, rate limits, permitted transformations and required attribution. Record evidence and date here. Obtain permission where necessary. Do not use a scraping workaround.
2. Add a reviewed entry in `server/news/sources.json`, including exact HTTPS URL, `verified`, terms/license, attribution, permitted article hosts, category, content type, minimum polling interval and summary mode. Use `metadata` for factual discovery summaries or `research-metadata` for preprint metadata. RSS, Atom and Atom API responses use the shared parser; other API formats need an explicitly reviewed adapter.
3. Keep credentials server-only if a future approved API needs them; current sources require none. Never put them in this catalog or API responses.
4. Add mocked source fixtures and normalization/permission tests. Administrator activation creates its database configuration row without changes to the ingestion core.
5. Re-review terms before activation and periodically thereafter. Disabling a source also removes its aggregated entries from both public APIs; records remain available to administrators. Re-enabling retains prior moderation decisions and does not overwrite rejected/hidden edits during collection.


## Additional reviewed official feeds (2026-10-22)

This section supersedes the earlier note that arXiv was the only reviewed source. These are narrow, factual feed-metadata integrations: titles, official links, dates, independent short summaries and source attribution. No feed description, article text, media, branding or third-party material is copied. The source catalog's `verified: true` means **reviewed for this restricted use only**, not unrestricted publisher endorsement or permission to republish content. All three sources are **disabled** in the new additive migration until an authorized administrator explicitly enables them.

| Source ID | Official feed | Rights evidence | Category / release rule |
| --- | --- | --- | --- |
| `nasa-technology` | `https://www.nasa.gov/technology/feed/` | [NASA official RSS directory](https://www.nasa.gov/rss-feeds/) and [NASA media guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/) | Technology News; eligible for auto-publication after activation, subject to policy |
| `nist-information-technology` | `https://www.nist.gov/news-events/information%20technology/rss.xml` | [NIST official RSS directory](https://www.nist.gov/coo/nist-rss-feeds) and [NIST copyright/disclaimers](https://www.nist.gov/copyrights-disclaimers) | Technology News; eligible for auto-publication after activation, subject to policy |
| `nist-events` | `https://www.nist.gov/news-events/events/rss.xml` | Same two official NIST references | Events and Opportunities; **always held for administrator verification and approval** |

**NASA:** Agency-produced public information is generally reusable for educational/informational purposes; exceptions include copyrighted third-party contributions, protected insignia/logos and uses implying NASA endorsement. Only metadata and outgoing official links are used; publisher-host allowlist is `www.nasa.gov`, `nasa.gov`, and `science.nasa.gov`. Attribution: "Source: NASA Technology. NASA does not endorse AI Club." The catalog requests the exact current HTTPS feed, no redirect following, six-hour minimum polling.

**NIST:** The agency states that information on its sites, unless marked as copyrighted, is generally public and distributable with appropriate credit. This integration uses only feed factual metadata and original boilerplate summaries, excluding copyright-marked materials and images. Only `www.nist.gov` / `nist.gov` outgoing article hosts are allowed. NIST credit appears with collected entries, without endorsement claims. Each exact official HTTPS RSS feed has six-hour minimum polling.

**NIST event date semantics:** On the official event feed, RSS `pubDate` represents the **scheduled event start** (which can be in the future), not an article publishing timestamp. This source uses the first-discovery timestamp for its news-listing date and stores the feed-supplied start in `opportunity.startDate`. Deadline, eligibility, attendance and registration are **not inferred**, and the stored opportunity remains unverified/pending until the admin checks the organizer details. Events use a fixed source category to prevent a headline such as "AI workshop" from being auto-published as AI news. No event end date is invented.

**Live feed inspection from RAGUL, read-only (2026-10-22):** NASA Technology: 10 accepted of 10 items (XML ~435 KiB). NIST Information Technology: 36 accepted of 40; four were skipped as invalid/incomplete metadata. NIST Events: 28 accepted of 28. All remained read-only: no database persistence, source activation or external images downloaded.

**Code additions:** `003_reviewed_news_sources.sql` registers the new IDs disabled by default without overwriting existing source choices. The catalog pins official feed URLs, rights references, publisher hosts, source categories and attribution. Metadata normalization and PostgreSQL ingestion now preserve source-supplied event starts in `opportunity` while retaining manual approval. The SSRF IP classifier now accepts NASA's legitimate public `192.0.66.108` CDN address but continues to reject reserved/test ranges including `192.0.0.0/24`, `192.0.2.0/24`, `198.51.100.0/24` and `203.0.113.0/24`.

**Candidate gap:** No authorized, reviewed Devpost/MLH/Unstop (or other competition-organizer) feed has been found. Hackathons and local student competitions still require verified manual admin posts or a future independently approved organizer feed. Do **not** infer hackathon start dates or registration deadlines from normal article titles. All other previously listed candidates remain unverified and disabled.

These source decisions are an engineering rights review, not legal advice or proof that every feed item is unencumbered; re-check publisher terms and individual-item restrictions before production source activation.
