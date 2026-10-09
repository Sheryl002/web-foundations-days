# School Database Design

## Tables

### students
- Stores one row for each student.
- Columns: `id` (primary key), `name` (required) and `email` (required and unique, so two students cannot share an email address).

### courses
- Stores one row for each course.
- Columns: `id` (primary key), `title` (required) and `credits` (required).

### enrolments
- Stores one row each time a student is enrolled on a course.
- Columns: `id` (primary key), `student_id` (foreign key to `students`), `course_id` (foreign key to `courses`) and `grade` (a number from 0 to 100, empty until the work is marked).
- A `UNIQUE (student_id, course_id)` rule stops the same student from enrolling on the same course twice.

## Relationships

- **One student has many enrolments**, and **one course has many enrolments**. Each of these is a one-to-many relationship, shown by the foreign keys in `enrolments`.
- **Students and courses are many-to-many.** One student can take many courses, and one course has many students.
- **A join table is needed** because a relational table cannot hold a list of values in one column. Putting `course_id` in `students` would allow only one course per student, and putting `student_id` in `courses` would allow only one student per course. The `enrolments` table solves this by turning the many-to-many relationship into two one-to-many relationships. It is also the right place for the `grade`, because a grade belongs to a student on a particular course, not to the student or the course alone.

## Index

I would add an index on `enrolments(course_id)`:

```sql
CREATE INDEX idx_enrolments_course_id ON enrolments (course_id);
```

- **Reason:** queries such as "all students on one course" and "number of students per course" search and group the enrolments by `course_id`. Without an index the database has to read every row in `enrolments`, which gets slow as the school grows. The `UNIQUE (student_id, course_id)` rule already creates an index that helps searches by student, but not searches by course alone.

## SQL or NoSQL?

I would choose SQL for this system. The data is highly structured and made of related records, with students, courses and enrolments linked together. SQL handles those links well with joins, and the foreign keys, `NOT NULL`, `UNIQUE` and `CHECK` rules protect the data, for example by preventing duplicate enrolments or an enrolment for a student who does not exist. School records also need to stay accurate, so transactions help when several changes must succeed together. The questions people will ask, such as which students are on a course or who has no enrolments, are exactly what SQL queries are designed for. A NoSQL database could work for something with flexible or fast-changing data, but it would not give me these guarantees without extra code.
