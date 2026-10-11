# SnapShare Scaling Plan

SnapShare is a photo-sharing app. Users upload photos and scroll a feed of photos from people they follow.

## 1. Assumptions

- There are **10 million** registered users.
- **10%** of them are active each day.
- Each active user uploads **1 photo** per day and views **50 feed pages** per day.
- An average photo is **2 MB**, and each photo also gets a **50 KB** thumbnail.
- One feed view means one feed page request.
- Activity is spread evenly over 24 hours for the average. The **peak is 5 times the average**.
- There are 86,400 seconds in a day and 365 days in a year.
- 1 TB = 1,000,000 MB (decimal units), and numbers are rounded.
- Storage counts one copy of each file. Backups and copies in other locations would multiply it.

**Daily active users (DAU)**

- 10,000,000 × 10% = **1,000,000 active users per day**

## 2. Estimates

### Uploads per second
- Uploads per day: 1,000,000 users × 1 photo = **1,000,000 uploads per day**
- Average: 1,000,000 ÷ 86,400 ≈ **12 uploads per second**
- Peak (5×): 12 × 5 ≈ **58 uploads per second**

### Feed views per second
- Feed views per day: 1,000,000 users × 50 views = **50,000,000 views per day**
- Average: 50,000,000 ÷ 86,400 ≈ **579 views per second**
- Peak (5×): 579 × 5 ≈ **2,900 views per second**

### Photo storage per year
- Originals per day: 1,000,000 × 2 MB = 2 TB
- Thumbnails per day: 1,000,000 × 50 KB = 50 GB = 0.05 TB
- Total per day: 2.05 TB
- Originals per year: 2 TB × 365 = **730 TB**
- Thumbnails per year: 0.05 TB × 365 ≈ **18 TB**
- Total per year: **about 748 TB (roughly 0.75 PB)**

## 3. Read-heavy or write-heavy?

SnapShare is **read-heavy**. There are about 50 million feed views per day but only 1 million uploads per day, so there are **50 reads for every write**.

What this means for the design:

- Reads must be made cheap, so I use a **CDN and a cache** to answer most requests without touching the database.
- The database needs **read replicas**, so many reads can be spread across several copies.
- Writes (uploads) are fewer, so a single primary database can handle them, and the slow work can be done in the background.
- The app servers can be added in numbers to serve the high read load.

## 4. Why photos should not be stored in the database

- **Size:** 748 TB of photos a year would make the database huge, slow to back up and slow to copy to replicas.
- **Cost:** database storage is far more expensive per GB than file storage.
- **Speed:** the database should answer small, fast queries, not send 2 MB files.
- **Delivery:** photo files stored as files can be served by a CDN directly, but files stored inside a database cannot.

Instead, the photo files go into **object storage**, which is cheap, very durable and built for huge numbers of files. The database stores only the **metadata**: the photo id, the owner, the caption, the time, and the **URL** of the file in object storage.

## 5. Architecture diagram

```
                      +---------------------+
                      |  Users (app / web)  |
                      +----------+----------+
                                 |
                                 v
                      +---------------------+
   photo files  <---- |        CDN          |
   (cached near       +----------+----------+
    the user)                    | API requests
                                 v
                      +---------------------+
                      |    Load balancer    |
                      +----------+----------+
                                 |
              +------------------+------------------+
              |                  |                  |
              v                  v                  v
        +-----------+      +-----------+      +-----------+
        | App server|      | App server|      | App server|
        +-----+-----+      +-----+-----+      +-----+-----+
              |                  |                  |
              +---------+--------+---------+--------+
                        |        |         |
            +-----------+   +----+----+    +-------------+
            |               |         |                  |
            v               v         v                  v
      +-----------+   +----------+  +-----------+   +-----------+
      |   Cache   |   | Database |  |  Object   |   |   Queue   |
      | (feeds,   |   | PRIMARY  |  |  storage  |   | (thumb    |
      |  hot data)|   | (writes) |  | (photos)  |   |  jobs)    |
      +-----------+   +----+-----+  +-----+-----+   +-----+-----+
                           |              ^               |
                  replicates              |               v
                           v              |        +-------------+
                      +----------+        +------- |   Worker    |
                      | Database |   saves         | (makes the  |
                      | READ     |   thumbnail     |  thumbnail) |
                      | REPLICA  |                 +-------------+
                      | (reads)  |
                      +----------+
```

Reading a feed: CDN → load balancer → app server → cache (or read replica if the cache misses) → the photo URLs → the photos come from the CDN.

## 6. What each component does

- **CDN:** it keeps copies of photos and thumbnails close to users, which solves slow image loading and takes most of the traffic off our servers.
- **Load balancer:** it spreads incoming requests across the app servers, which solves the problem of one server being overloaded and lets us keep running if one server fails.
- **App servers:** they run the application logic (login, upload, feed), and because they hold no data themselves we can add more as traffic grows.
- **Cache:** it keeps frequently requested data such as feeds in fast memory, which solves the problem of the database being hit by the same read over and over.
- **Database with a read replica:** the primary stores the metadata and handles writes while the read replica handles the many reads, which solves the problem of one database being unable to serve 2,900 reads per second.
- **Object storage:** it holds the photo files cheaply and durably, which solves the problem of storing about 748 TB a year without overloading the database.
- **Queue:** it holds the thumbnail jobs until a worker is ready, which solves the problem of uploads being slow or lost when processing takes time.
- **Worker:** it takes jobs from the queue and creates thumbnails in the background, which solves the problem of making the user wait while the image is resized.

## 7. Upload flow, step by step

1. The user picks a photo and taps upload, and the app sends it to SnapShare.
2. The request goes through the load balancer, which picks an app server.
3. The app server checks that the user is logged in and that the file is a valid image of an allowed size.
4. The app server saves the original 2 MB photo in **object storage** and gets back its URL.
5. The app server writes a row to the **primary database** with the photo id, user id, caption, time, the URL and the status "processing".
6. The app server puts a **thumbnail job** on the **queue**.
7. The app server replies "upload successful" to the user straight away, without waiting for the thumbnail.
8. A **worker** takes the job from the queue, reads the original from object storage, creates the 50 KB thumbnail and saves it in object storage.
9. The worker updates the database row with the thumbnail URL and the status "ready".
10. The cache entries for the followers' feeds are refreshed, so the photo shows up in their feeds and is served through the CDN.

If the worker fails, the job stays in the queue and is tried again, so no thumbnail is lost.

## 8. Trade-offs

- **Cache speed versus fresh data:** the cache makes feeds fast, but a cached feed can be slightly out of date, so a new photo might take a few seconds to appear. I accept this because feeds do not need to be exact to the second.
- **Read replica lag:** a replica copies data from the primary a moment later, so a read right after a write can return old data. This is fine for feeds, but reads that must be exact (for example, showing a user their own new post) can go to the primary.
- **Fast upload versus an instant thumbnail:** making thumbnails in the background keeps uploads fast, but a photo may briefly appear without its thumbnail. I accept this because a quick response matters more to the user.
- **Cost versus speed:** a CDN, cache and extra servers cost money. They are worth it for a read-heavy app, but they also add complexity, with more parts to run and monitor.
