# Library API Design: Books

This is a REST API design for the `books` resource of a library. All requests and responses use JSON. The base URL is `https://api.library.example`.

A book looks like this:

```json
{
  "id": 12,
  "title": "Things Fall Apart",
  "author": "Chinua Achebe",
  "year": 1958,
  "isbn": "9780385474542",
  "available": true
}
```

## Endpoints

### 1. List all books
- **Method:** `GET`
- **Path:** `/books`
- **Description:** Returns every book in the library.
- **Request body:** none
- **Success status:** `200 OK`

### 2. Get one book
- **Method:** `GET`
- **Path:** `/books/{id}` (for example `/books/12`)
- **Description:** Returns the single book with that id.
- **Request body:** none
- **Success status:** `200 OK`

### 3. Create a book
- **Method:** `POST`
- **Path:** `/books`
- **Description:** Adds a new book to the library.
- **Example request body:**

```json
{
  "title": "Things Fall Apart",
  "author": "Chinua Achebe",
  "year": 1958,
  "isbn": "9780385474542"
}
```

- **Success status:** `201 Created` (the response includes the new book and its id)

### 4. Update a book
- **Method:** `PUT`
- **Path:** `/books/{id}` (for example `/books/12`)
- **Description:** Replaces the details of an existing book.
- **Example request body:**

```json
{
  "title": "Things Fall Apart",
  "author": "Chinua Achebe",
  "year": 1958,
  "isbn": "9780385474542",
  "available": false
}
```

- **Success status:** `200 OK`

### 5. Delete a book
- **Method:** `DELETE`
- **Path:** `/books/{id}` (for example `/books/12`)
- **Description:** Removes the book from the library.
- **Request body:** none
- **Success status:** `204 No Content`

### 6. List books by an author
- **Method:** `GET`
- **Path:** `/books?author={name}` (for example `/books?author=Chinua%20Achebe`)
- **Description:** Returns only the books written by the given author, using a query parameter.
- **Request body:** none
- **Success status:** `200 OK` (an empty list `[]` if the author has no books)

## Error codes

### 400 Bad Request
The request is invalid, so the server cannot process it.

- **Example:** `POST /books` is sent without a `title`, or with `"year": "last year"` instead of a number.
- **Example response:**

```json
{ "error": "title is required" }
```

### 404 Not Found
The book or path that was asked for does not exist.

- **Example:** `GET /books/9999` when no book has the id 9999. The same happens for `PUT` and `DELETE` on a missing id.
- **Example response:**

```json
{ "error": "Book 9999 not found" }
```
