# TicketHub Design Document

TicketHub is a website that sells tickets for concerts and events. This document follows the six-part framework: requirements, estimates, API, data model, architecture and trade-offs. A separate section explains how the design stops two people from buying the same seat.

## 1. Requirements

### Functional requirements
- Users can register, log in and log out.
- Users can browse and search upcoming events.
- Users can view an event and see which seats are available.
- Users can choose seats and **hold** them for a short time (5 minutes) while they pay.
- Users can pay for held seats and receive their tickets.
- Users can view their tickets and past orders.
- Held seats are released automatically if the user does not pay in time.

### Non-functional requirements
- **Correctness (most important):** a seat must never be sold to two people. This matters more than speed.
- **Speed:** browsing pages should load in under 1 second, and holding a seat should answer in under 2 seconds, even during a big sale.
- **Fairness:** during a big sale, people should be served in the order they arrived, and one person or bot should not be able to grab all the seats.
- **Availability:** the site should stay up during a big sale, and it is better to make people wait than to crash.
- **Scalability:** it must handle a sudden jump from a few requests a second to thousands.
- **Durability:** a paid order must never be lost.
- **Security:** payments go through a trusted payment provider, passwords are hashed, and traffic uses HTTPS.

## 2. Estimates

### Facts
- 2 million registered users.
- Normal day: 50,000 visitors, each viewing 10 pages, and 5,000 tickets sold.
- Big sale: 200,000 people try to buy 20,000 seats within the first 10 minutes (600 seconds).

### Normal traffic
- Page views per day: 50,000 × 10 = **500,000**
- Average: 500,000 ÷ 86,400 ≈ **6 requests per second**
- Peak (5× the average): about **29 requests per second**
- Tickets sold: 5,000 a day ≈ **0.06 per second**, or about one every 17 seconds. Purchases are tiny compared to browsing.

### Big sale peak
Assumptions for each of the 200,000 people during the first 10 minutes: they load the seat map **5 times**, try to hold seats **2 times**, and only the buyers who got a hold go on to pay.

- Seat map views: 200,000 × 5 = 1,000,000, which is about **1,670 per second**
- Hold attempts: 200,000 × 2 = 400,000, which is about **670 per second**
- Payments: at most 20,000, which is about **33 per second**
- Total: about 1,420,000 requests in 600 seconds, so about **2,400 requests per second on average**
- The first minute is busier, so I plan for a spike of 3× that, about **7,000 requests per second**
- Only 20,000 of the 200,000 people (10%) can succeed. The other **180,000 will see "sold out"**, so the system must handle failure politely.

### Comparison
| Measure | Normal day | Big sale | Difference |
|---------|-----------|----------|------------|
| Requests per second (average) | about 6 | about 2,400 | about 400× more |
| Requests per second (peak) | about 29 | about 7,000 | about 240× more |
| Tickets sold per second | about 0.06 | about 33 | about 580× more |

**Conclusion:** a normal day is easy for one small system, but the big sale is hundreds of times heavier and happens suddenly. The design has to be built for the big sale, not for a normal day. The traffic is mostly reads (viewing seats), but the hard part is the competing writes to the same 20,000 seats.

## 3. API

Base URL: `https://api.tickethub.example/v1`. Requests after login carry `Authorization: Bearer <token>`.

| # | Method | Path | Description | Success status |
|---|--------|------|-------------|----------------|
| 1 | POST | `/auth/login` | Log in and get a token | `200 OK` |
| 2 | GET | `/events` | Browse and search events (`?q=`, `?page=`) | `200 OK` |
| 3 | GET | `/events/{id}` | View one event's details | `200 OK` |
| 4 | GET | `/events/{id}/seats` | View seats and whether each is available, held or sold | `200 OK` |
| 5 | POST | `/events/{id}/holds` | Hold one or more seats for 5 minutes | `201 Created` |
| 6 | DELETE | `/holds/{holdId}` | Release held seats | `204 No Content` |
| 7 | POST | `/orders` | Pay for a hold and create the order and tickets | `201 Created` |
| 8 | GET | `/me/tickets` | View my tickets | `200 OK` |

### Example: hold seats

Request to `POST /events/12/holds`:

```json
{ "seatIds": [101, 102] }
```

Success, `201 Created`:

```json
{ "holdId": "h_8841", "seatIds": [101, 102], "expiresAt": "2026-11-20T18:05:00Z" }
```

If someone else already has seat 102, the server answers `409 Conflict` and holds nothing:

```json
{ "error": { "code": "SEAT_UNAVAILABLE", "message": "Seat 102 is no longer available" } }
```

### Example: pay

Request to `POST /orders`:

```json
{ "holdId": "h_8841", "paymentToken": "tok_abc123" }
```

Success, `201 Created`:

```json
{ "orderId": 5521, "status": "paid", "tickets": [{ "seatId": 101 }, { "seatId": 102 }] }
```

Other error statuses: `400` (bad request), `401` (not logged in), `404` (event or hold not found), `409` (seat taken), `410 Gone` (the hold expired), `429` (too many requests) and `503` (the site is busy and the user is placed in the waiting room).

## 4. Data model

| Table | Columns | Keys |
|-------|---------|------|
| `users` | `id`, `name`, `email`, `password_hash`, `created_at` | PK `id`, `email` unique |
| `events` | `id`, `title`, `venue`, `starts_at`, `on_sale_at` | PK `id` |
| `seats` | `id`, `event_id`, `section`, `row_label`, `seat_number`, `price`, `status` (available, held or sold), `held_by_user_id`, `hold_expires_at` | PK `id`, FK `event_id` to `events`, FK `held_by_user_id` to `users`, unique (`event_id`, `section`, `row_label`, `seat_number`) |
| `orders` | `id`, `user_id`, `total_amount`, `payment_reference`, `created_at` | PK `id`, FK `user_id` to `users`, `payment_reference` unique |
| `tickets` | `id`, `order_id`, `seat_id` | PK `id`, FK `order_id` to `orders`, FK `seat_id` to `seats`, **`seat_id` unique** |

### Relationships
- **One user has many orders** (`orders.user_id`).
- **One event has many seats** (`seats.event_id`). Each seat belongs to exactly one event.
- **One order has many tickets** (`tickets.order_id`), because a user can buy several seats in one order.
- **One seat has at most one ticket** (`tickets.seat_id` is unique). This is a one-to-one relationship from seat to ticket, and it protects against double-booking.
- **One user can hold many seats** at a time (`seats.held_by_user_id`).

### CREATE TABLE statements (SQLite style)

```sql
CREATE TABLE users (
  id            INTEGER PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL
);

CREATE TABLE events (
  id         INTEGER PRIMARY KEY,
  title      TEXT NOT NULL,
  venue      TEXT NOT NULL,
  starts_at  TEXT NOT NULL,
  on_sale_at TEXT NOT NULL
);

CREATE TABLE seats (
  id              INTEGER PRIMARY KEY,
  event_id        INTEGER NOT NULL REFERENCES events (id),
  section         TEXT NOT NULL,
  row_label       TEXT NOT NULL,
  seat_number     INTEGER NOT NULL,
  price           INTEGER NOT NULL,
  status          TEXT NOT NULL DEFAULT 'available'
                  CHECK (status IN ('available', 'held', 'sold')),
  held_by_user_id INTEGER REFERENCES users (id),
  hold_expires_at TEXT,
  UNIQUE (event_id, section, row_label, seat_number)
);

CREATE TABLE orders (
  id                INTEGER PRIMARY KEY,
  user_id           INTEGER NOT NULL REFERENCES users (id),
  total_amount      INTEGER NOT NULL,
  payment_reference TEXT NOT NULL UNIQUE,
  created_at        TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tickets (
  id       INTEGER PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders (id),
  seat_id  INTEGER NOT NULL UNIQUE REFERENCES seats (id)
);
```

## 5. How the design prevents two people buying the same seat

Double-booking is a **race condition**: two people click the same seat at the same moment, both see "available", and both succeed. The design stops this with four layers.

**1. One source of truth, never the cache.** The decision "is this seat free?" is always made in the **primary database**. The cache and read replicas only show the seat map, which can be a second out of date. They are never used to decide who gets a seat.

**2. An atomic hold using a conditional UPDATE.** To hold a seat, the server does the check and the change in one single statement, inside a transaction:

```sql
UPDATE seats
SET status = 'held',
    held_by_user_id = :user_id,
    hold_expires_at = :now_plus_5_minutes
WHERE id = :seat_id
  AND (status = 'available'
       OR (status = 'held' AND hold_expires_at < :now));
```

- The database locks the seat's row while it runs, so two requests for the same seat are handled **one after the other, never at the same time**.
- The first request changes the row, so it affects **1 row** and the user gets the hold.
- The second request now finds the status is `held`, so the condition fails, it affects **0 rows**, and the server returns `409 Conflict`.
- When several seats are requested together, the server does all the updates in one transaction. If any seat affects 0 rows, the whole transaction is **rolled back**, so the user never ends up with half of what they wanted.

**3. A short hold with an expiry.** A held seat is reserved for 5 minutes. If the user does not pay, a background worker (and the `hold_expires_at` check above) makes the seat available again. This stops people locking seats forever.

**4. A final safety net in the database.** When the user pays, one transaction checks that the seat is still held by this user and has not expired, creates the order, sets the seat to `sold`, and inserts the ticket. The `UNIQUE` constraint on `tickets.seat_id` means that even if there were a bug in the code, the database would **refuse to create a second ticket for the same seat** and the transaction would fail. Payment uses a unique `payment_reference`, so a retried request cannot charge the user twice.

The payment provider call is made **outside** the database transaction, so that locks are not held while waiting for a slow external service.

## 6. Architecture

```
   +----------------------+
   |  Users (web/mobile)  |
   +----------+-----------+
              |
              v
   +----------------------+
   |         DNS          |
   +----------+-----------+
              |
              v
   +----------------------+
   |         CDN          |  (event pages, images, scripts)
   +----------+-----------+
              | API requests
              v
   +----------------------+
   |   Waiting room       |  (lets a limited number of people in at a time)
   +----------+-----------+
              |
              v
   +----------------------+
   |    Load balancer     |
   +----------+-----------+
              |
     +--------+---------+----------------+
     |                  |                |
     v                  v                v
 +----------+      +----------+     +----------+
 | API      |      | API      |     | API      |   (added automatically
 | server 1 |      | server 2 |     | server N |    when traffic grows)
 +----+-----+      +----+-----+     +----+-----+
      |                 |                |
      +--------+--------+--------+-------+
               |                 |                |
               v                 v                v
        +-------------+   +--------------+   +-------------+
        |   Cache     |   | Database     |   |   Queue     |
        | (event info,|   | PRIMARY      |   | (emails,    |
        |  seat map,  |   | seats,orders |   |  tickets,   |
        |  rate limit)|   | (all writes) |   |  releases)  |
        +-------------+   +------+-------+   +------+------+
                                 |                  |
                      replicates |                  v
                                 v           +-------------+
                          +--------------+   |   Workers   |
                          | Database     |   +------+------+
                          | READ REPLICAS|          |
                          | (browsing)   |          v
                          +--------------+   +-------------+
                                             |  Payment    |
                                             |  provider   |
                                             +-------------+
```

### What each component does
- **DNS:** it translates `tickethub.example` into the address of our system, so users do not need server addresses and we can move servers without telling anyone.
- **CDN:** it serves event pages, images and scripts from locations near the user, so most of the big-sale traffic never reaches our servers.
- **Waiting room:** it lets only a limited number of people into the buying pages at a time and places the rest in a fair, first-come-first-served line, so the database is not hit by 200,000 people at once.
- **Load balancer:** it spreads requests across the API servers and avoids servers that have failed, so no single server is overloaded.
- **API servers:** they run the application logic (browse, hold, pay), and because they keep no data themselves we can add more quickly when a big sale starts.
- **Cache:** it keeps event details and a recent copy of the seat map (refreshed every second or two) and counts requests for rate limiting, so the database does not answer the same read thousands of times.
- **Primary database:** it holds users, seats, orders and tickets, takes every write, and makes the decision about who gets a seat, which gives us one reliable source of truth with transactions and constraints.
- **Read replicas:** they answer browsing and search queries, so the primary is left free for the hold and payment writes.
- **Queue:** it holds background jobs such as sending confirmation emails, creating ticket files and releasing expired holds, so users do not wait for slow tasks.
- **Workers:** they take jobs from the queue and run them in the background, and if a worker fails the job stays in the queue and is tried again.
- **Payment provider:** it handles card payments securely, so we never store card numbers.

### How it survives the big sale
- **Before the sale:** the CDN serves the event page, and the servers are scaled up in advance, since we know when the sale starts.
- **At the start:** the waiting room turns 200,000 people arriving at once into a steady flow of about 2,000 at a time.
- **While browsing:** the seat map comes from the cache and read replicas, which absorbs the roughly 1,670 requests per second for seat maps.
- **When holding seats:** only the hold and payment writes reach the primary database, which is about 700 per second at most. The database handles these safely, because the conditional update locks only the single seat row, not the whole table.
- **After seats run out:** the system quickly answers "sold out", so the other 180,000 people get a fast, polite reply, and nobody's request crashes the site.
- **Bots:** rate limiting in the cache and a limit of 4 tickets per account stop one person grabbing most of the seats.

## 7. Trade-offs

- **Waiting room: fairness and stability versus speed.** The waiting room keeps the site up and serves people in order, but some users wait several minutes and may get frustrated. I accept this because a crashed site, or a site where the fastest bot wins, is much worse.
- **Cached seat map: speed versus accuracy.** The seat map comes from the cache, so a seat may look available when it was just taken, and the user may get a `409` when they try to hold it. I accept this because accuracy is guaranteed where it matters, in the database at hold time, and showing everyone a live map would overload the primary database.
- **Holding seats for 5 minutes: fairness to buyers versus seats staying empty.** A hold gives people time to pay, but a seat held by someone who then leaves is unavailable for a while. A shorter hold sells seats faster but rushes people, so I chose 5 minutes as a balance.
- **One primary database: correctness versus write scaling.** One primary database makes the seat decision simple and safe, but all writes go through one place. At about 700 writes per second at peak, a good database can handle this. If the load grew far larger, I would split events across several databases, so each event's seats stay in one place.
- **Cost: extra servers, replicas and a waiting room cost money.** They sit mostly idle on a normal day, so I would scale them up only for big sales to avoid paying for them all the time.
