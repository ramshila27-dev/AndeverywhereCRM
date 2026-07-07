# Andeverywhere — Travel CRM & AI Itinerary Builder

An internal web app for travel agencies: generate detailed, day-by-day trip
itineraries with AI, then manage them through a lightweight client pipeline
(draft → quoted → booked).

Built with **Next.js 14 (App Router) + TypeScript**, **Prisma + PostgreSQL**,
**Tailwind CSS**, and the **Anthropic Claude API** for itinerary generation.

> **This is the MVP: the AI itinerary builder.** The data model and structure
> are set up so the full CRM layer (clients, leads, bookings) can be added on
> top without a rewrite.

## Features

- **AI itinerary generation** — capture destination, dates, party size, budget,
  interests, and pace; Claude returns a structured, editable multi-day plan.
- **Structured output** — the model is constrained to a JSON schema, so results
  render reliably as day-by-day cards with times, places, categories, and costs.
- **Save & manage** — persist itineraries and move them through a status
  pipeline (draft → quoted → booked).
- **Runs without an API key** — a built-in demo planner produces a plausible
  itinerary so you can try the whole flow before wiring up Claude.

## Prerequisites

- Node.js 20+
- Docker (for the local PostgreSQL database), or an existing Postgres instance

## Getting started

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
#    Edit .env — set ANTHROPIC_API_KEY to enable real AI generation.
#    (Leave it blank to use the built-in demo planner.)

# 3. Start PostgreSQL
docker compose up -d

# 4. Create the database schema
npm run db:push

# 5. Run the dev server
npm run dev
```

Then open http://localhost:3000.

## Environment variables

| Variable            | Required | Description                                                       |
| ------------------- | -------- | ----------------------------------------------------------------- |
| `DATABASE_URL`      | yes      | PostgreSQL connection string (matches `docker-compose.yml`).      |
| `ANTHROPIC_API_KEY` | no       | Enables Claude-powered generation. Unset → built-in demo planner. |
| `ANTHROPIC_MODEL`   | no       | Model id for generation. Defaults to `claude-opus-4-8`.           |

## Project structure

```
prisma/schema.prisma          # Itinerary model (extensible toward CRM)
src/lib/ai.ts                 # Claude integration + demo fallback
src/lib/types.ts              # Shared domain types
src/lib/prisma.ts             # Prisma client singleton
src/app/page.tsx              # Dashboard (list of itineraries)
src/app/itineraries/new       # AI generation form
src/app/itineraries/[id]      # Itinerary detail + status/delete
src/app/api/itineraries/*     # REST API (generate, CRUD)
src/components/*               # UI components
```

## API

| Method   | Route                       | Purpose                          |
| -------- | --------------------------- | -------------------------------- |
| `POST`   | `/api/itineraries/generate` | Generate an itinerary (no save)  |
| `GET`    | `/api/itineraries`          | List saved itineraries           |
| `POST`   | `/api/itineraries`          | Save a generated itinerary       |
| `GET`    | `/api/itineraries/:id`      | Fetch one                        |
| `PATCH`  | `/api/itineraries/:id`      | Update (title/status/notes/days) |
| `DELETE` | `/api/itineraries/:id`      | Delete                           |

## Contracting rates catalog

The supplier rate sheets (Hong Kong & Macau **hotels**, **transfers**, and
**activities**) are modeled as a normalized catalog in `prisma/schema.prisma`.
The unifying pattern across all three domains is **seasonal pricing**: every
product has a set of named seasons (date bands), and each rate is keyed by
`(product, season, secondary-axis)`:

| Domain     | Product    | Secondary axis            | Rate model                     |
| ---------- | ---------- | ------------------------- | ------------------------------ |
| Hotels     | `RoomType` | occupancy (`maxPax`)      | `RoomRate` per room per night  |
| Hotels     | `HotelExtra` | extra bed / child        | `HotelExtraRate`               |
| Transfers  | `Transfer` | `VehicleType` (8 sizes)   | `TransferRate` per vehicle     |
| Activities | `Activity` | `PaxType` (adult / child) | `ActivityRate` per person      |

Notes:

- Rates are stored **net** as contracted. `netRate` is a `Decimal(10,2)`.
- A missing/unavailable rate is `NULL` (the sheets use a sentinel of `1` for
  "closed / not available"); the importer converts these to `NULL`.
- Amounts are assumed to be **HKD** (`currency` field, override per product).
- Hotel seasons are per-hotel date bands and can carry a day-of-week
  restriction (e.g. `Sun,Mon,Tue,Wed,Thu`), captured in `HotelSeason.daysOfWeek`.

### Importing the rate sheets

`scripts/import-rates.mjs` reads the two workbooks and (re)builds the catalog.
It wipes and rebuilds the catalog tables on each run and never touches
`Itinerary`.

```bash
npm run db:import -- path/to/Master_Sheet_Hongkong_Hotels.xlsx path/to/HK_Land_Part_net.xlsx
```

A sample import of the provided sheets loads: **12 hotels · 50 room types ·
3,670 room rates · 36 extras · 42 transfers · 8 vehicle types · 78 activities.**

> The supplier workbooks contain proprietary net rates and are **not** committed
> to the repository — pass their paths to the importer at runtime.

## Queries & lifecycle (CRM)

A **Query** is the CRM entry point — a travel enquiry captured on the
**New Query** form (`/queries/new`): source, reference id, sales team, tags;
destination(s), start date, nights, adults, children with ages, total FOC;
guest salutation/name, multiple phone numbers, optional email/location; and
free-text comments.

Queries move through a lifecycle (the **Trips** sidebar on `/queries`):

```
New Query → In Progress → On Hold → Converted → On Trip → Past Trips
                     ↘ Dropped   ↘ Canceled
```

Transitions are enforced server-side (`QUERY_TRANSITIONS` in
`src/lib/types.ts`); the detail page only offers valid next states, and the
sidebar filters/counts queries by state. Creating a quote for a query is an
explicit **convert**: the quote links back (`Quote.queryId`) and the query
advances to **Converted** automatically. "Start a quote →" on a query prefills
the quote builder (destination, dates, pax) from the enquiry.

| Method | Route                | Purpose                                       |
| ------ | -------------------- | --------------------------------------------- |
| `GET`  | `/api/queries?status=` | List, filtered by lifecycle state           |
| `POST` | `/api/queries`       | Create a query (enters at New Query)          |
| `GET`  | `/api/queries/:id`   | Query + linked quotes                         |
| `PATCH`| `/api/queries/:id`   | Advance lifecycle (validated) / edit fields   |
| `DELETE`| `/api/queries/:id`  | Delete                                        |

## Auto-priced quoting

The **Quote builder** (`/quotes/new`) assembles an itemized, net-rate quote
directly from the contracting catalog:

- **Accommodation** — pick a destination → hotel → room; the pricing engine
  resolves **each night** to its applicable season (honoring date bands and
  day-of-week restrictions) and sums the contracted rates. Nights with no
  contracted rate are flagged and excluded.
- **Transfers** — search the catalog and pick a vehicle size; the rate is
  pulled from the contract.
- **Activities** — search and add attractions/tickets with adult/child pax; the
  amount is `adultRate × adults + childRate × children`.
- A live summary rail totals everything in the destination's currency (HKD).
  Saving snapshots the line items and the authoritative server-computed total.

The destination selector is driven by the distinct cities present in the
catalog, so **new destinations appear automatically** once their inventory is
imported — no code change needed.

The pricing logic lives in `src/lib/pricing.ts` (pure, testable functions:
`nightsBetween`, `seasonMatches`, `priceStay`). Quote catalog + pricing APIs:

| Method | Route                              | Purpose                                   |
| ------ | ---------------------------------- | ----------------------------------------- |
| `GET`  | `/api/catalog/cities`              | Distinct destinations (with hotel counts) |
| `GET`  | `/api/catalog/hotels?city=`        | Hotels for a destination                  |
| `GET`  | `/api/catalog/hotels/:id/rooms`    | Room types for a hotel                    |
| `POST` | `/api/pricing/hotel`               | Per-night stay pricing (season resolved)  |
| `GET`  | `/api/catalog/transfers?q=`        | Transfers with per-vehicle rates          |
| `GET`  | `/api/catalog/activities?q=`       | Activities with adult/child rates         |
| `GET`/`POST` | `/api/quotes`                | List / save quotes                        |
| `GET`/`PATCH`/`DELETE` | `/api/quotes/:id`  | Fetch / update status / delete            |

## Roadmap (next: the CRM layer)

- `Client` and `Lead` models, with itineraries linked to a client
- Contact management, notes, and activity timeline
- Employee authentication and per-agent ownership
- Dashboard with pipeline stats and revenue
