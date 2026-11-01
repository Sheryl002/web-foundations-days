# Reflection

## The most difficult concept
The most difficult concept for me was seeing how all the pieces of a system fit together, especially Git and GitHub at the start and later system design. At first I kept mixing up my local folders and my GitHub repositories, which caused errors such as "not a git repository". I overcame this by slowing down, reading each error message, and checking where I was with `dir` and `git status` before every step. I also learned to commit one small change at a time. In system design, I found it hard to know why each component was needed. It helped me to ask one question for each part: what problem does it solve? A cache solves repeated reads, a queue solves slow background work, and a read replica solves too many reads on one database.

## What I would improve in my capstone
Based on the feedback I received, I would improve the API client and the documents. I would add a way to edit a note with a PUT request, so the client covers every method in my API design. I would also make the error messages more specific, so a user can tell the difference between a network failure and a server problem. In the design documents, I would add more detail about how the system behaves when part of it fails.

## What I will learn next
Next I want to build a real backend with a database, instead of using a practice API. I plan to learn Node.js and SQL together, so I can build the endpoints I designed and test the seat-holding idea with real transactions. After that, I want to learn about authentication and deploying a project online.
