# AI Club Member Platform — PostgreSQL Database Schema Reference

This document provides the complete PostgreSQL schema definition, entity relationships, data types, constraints, and indexing strategy for the AI Club platform.

---

## 1. Schema Overview

The database contains 24 application tables and 1 version tracking table:

```
├── Identity & Security
│   ├── users
│   ├── sessions
│   ├── student_profiles
│   └── profile_skills
├── Content Management (CMS)
│   ├── content_entries
│   ├── gallery_categories
│   ├── gallery_items
│   ├── files
│   ├── settings
│   └── activity_logs
├── Assessment Engine
│   ├── assessment_banks
│   ├── assessment_bank_questions
│   ├── assessments
│   ├── assessment_questions
│   ├── assessment_attempts
│   └── assessment_answers
└── Community & Moderation
    ├── community_posts
    ├── community_comments
    ├── community_post_votes
    ├── community_comment_votes
    ├── community_reports
    ├── community_media
    ├── community_media_variants
    └── community_post_attachments
```

---

## 2. Table Definitions & Constraints

### 2.1 Identity & Security

#### `users`
Accounts for administrators and students.
* `id` (`TEXT PRIMARY KEY`): Unique UUID.
* `member_id` (`TEXT NOT NULL`): Roll number or Admin ID. Unique case-insensitive index on `LOWER(member_id)`.
* `email` (`TEXT`): Contact email. Unique case-insensitive partial index on `LOWER(email)` where email is not null.
* `name` (`TEXT NOT NULL`): Full display name.
* `password_hash` (`TEXT NOT NULL`): Salted scrypt password hash.
* `role` (`TEXT NOT NULL CHECK (role IN ('admin','student'))`).
* `status` (`TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','suspended'))`).
* `permissions` (`JSONB NOT NULL DEFAULT '[]'::jsonb`): Array of permission strings.
* `must_change_password` (`BOOLEAN NOT NULL DEFAULT FALSE`): Flag forcing password change on next login.
* `password_changed_at` (`TIMESTAMPTZ`): Timestamp of last password change.
* `created_at` (`TIMESTAMPTZ NOT NULL DEFAULT NOW()`).
* `updated_at` (`TIMESTAMPTZ NOT NULL DEFAULT NOW()`).

#### `sessions`
Server-side active user sessions.
* `id` (`TEXT PRIMARY KEY`): Unique UUID.
* `token_hash` (`TEXT NOT NULL UNIQUE`): SHA-256 hash of the session token.
* `user_id` (`TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE`).
* `expires_at` (`TIMESTAMPTZ NOT NULL`).
* `created_at` (`TIMESTAMPTZ NOT NULL DEFAULT NOW()`).
* **Indexes:** `sessions_token_idx` on `token_hash`, `sessions_expiry_idx` on `expires_at`.

#### `student_profiles`
Extended academic profile for student accounts.
* `user_id` (`TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE`).
* `department` (`TEXT NOT NULL DEFAULT ''`).
* `academic_year` (`INTEGER CHECK (academic_year IS NULL OR (academic_year >= 1 AND academic_year <= 6))`).
* `github_url` (`TEXT`), `linkedin_url` (`TEXT`), `hackerrank_url` (`TEXT`).
* `description` (`TEXT NOT NULL DEFAULT ''`).
* `avatar_file_id` (`TEXT REFERENCES files(id) ON DELETE SET NULL`).
* `created_at` (`TIMESTAMPTZ NOT NULL DEFAULT NOW()`).
* `updated_at` (`TIMESTAMPTZ NOT NULL DEFAULT NOW()`).
* **Indexes:** `student_profiles_directory_idx` on `(department, academic_year, user_id)`.

#### `profile_skills`
Student skills for directory filtering.
* `user_id` (`TEXT NOT NULL REFERENCES student_profiles(user_id) ON DELETE CASCADE`).
* `skill_name` (`TEXT NOT NULL`).
* `sort_order` (`INTEGER NOT NULL DEFAULT 0`).
* `created_at` (`TIMESTAMPTZ NOT NULL DEFAULT NOW()`).
* **Primary Key:** `(user_id, skill_name)`.

---

### 2.2 Files & CMS

#### `files`
Metadata for stored media (local disk or S3 object store).
* `id` (`TEXT PRIMARY KEY`): Unique UUID.
* `original_name` (`TEXT NOT NULL`), `stored_name` (`TEXT NOT NULL`).
* `mime_type` (`TEXT NOT NULL`), `size` (`BIGINT NOT NULL`).
* `storage_key` (`TEXT NOT NULL UNIQUE`).
* `public_url` (`TEXT NOT NULL`).
* `kind` (`TEXT NOT NULL CHECK (kind IN ('image','document','video','other'))`).
* `is_public` (`BOOLEAN NOT NULL DEFAULT FALSE`).
* `purpose` (`TEXT NOT NULL DEFAULT 'cms' CHECK (purpose IN ('cms','profile-avatar'))`).
* `created_at` (`TIMESTAMPTZ NOT NULL DEFAULT NOW()`).
* `updated_at` (`TIMESTAMPTZ NOT NULL DEFAULT NOW()`).
* `uploaded_by` (`TEXT REFERENCES users(id) ON DELETE SET NULL`).
* **Trigger:** `private_files_insert_guard` & `private_files_update_guard` enforce that `profile-avatar` files are private (`is_public = FALSE`) and `purpose` cannot be changed after creation.

#### `gallery_items`
Images displayed in the public gallery.
* `id` (`TEXT PRIMARY KEY`).
* `category_id` (`TEXT REFERENCES gallery_categories(id) ON DELETE SET NULL`).
* `title` (`TEXT NOT NULL`), `caption` (`TEXT`), `alt_text` (`TEXT NOT NULL`).
* `file_id` (`TEXT REFERENCES files(id) ON DELETE SET NULL`).
* `status` (`TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','hidden'))`).
* `sort_order` (`INTEGER NOT NULL DEFAULT 0`).
* **Trigger:** `gallery_media_insert_guard` & `gallery_media_update_guard` enforce that `file_id` must reference a CMS image file.

---

### 2.3 Assessment Engine

#### `assessment_banks` & `assessment_bank_questions`
Question repositories for building quizzes and tests.
* Supports both `mcq` and `coding` questions.
* MCQ questions store 4 options in `options_json` (`JSONB`) and a zero-indexed `correct_option` (0-3).

#### `assessments` & `assessment_questions`
Published assessments with immutable question snapshots.
* `selected_question_ids` (`JSONB`): IDs of chosen questions.
* `allow_backward` (`BOOLEAN`): Controls whether students can navigate to previous questions.
* `duration_minutes` (`INTEGER 1-360`).
* `start_at`, `end_at` (`TIMESTAMPTZ`): Schedule window.
* `attempt_limit` (`INTEGER 1-10`).
* `status` (`draft`, `published`, `closed`, `archived`).

#### `assessment_attempts` & `assessment_answers`
Student attempts and responses.
* Unique constraint: `UNIQUE (assessment_id, student_id, attempt_number)` ensures strictly ordered attempts.
* `score` (`REAL`), `graded_at` (`TIMESTAMPTZ`), `status` (`in_progress`, `submitted`).

---

### 2.4 Community & Moderation

#### `community_posts`
Feed posts with titles, body text, tags, link URLs, locking, and pinning.
* Maximum 3 pinned announcements enforced by application layer and moderation transaction.
* `status` (`visible`, `hidden`, `removed`, `deleted`).
* Deleted posts retain tombstones (`deleted_at`, `status = 'deleted'`).

#### `community_comments`
Threaded discussion comments.
* Maximum depth of 2 (top-level comment, reply, sub-reply).
* Composite foreign key: `FOREIGN KEY (parent_id, post_id) REFERENCES community_comments(id, post_id)` guarantees comments remain within the same post.
* Trigger: `community_comment_parent_guard` enforces valid depth hierarchy and prevents cycles.
* Trigger: `community_comment_ancestry_immutable` prevents altering `parent_id`, `post_id`, or `depth`.

#### `community_post_votes` & `community_comment_votes`
Upvotes and downvotes (+1, -1).
* Composite primary keys `(user_id, post_id)` and `(user_id, comment_id)` guarantee exactly one vote per user per entity.

#### `community_reports`
User moderation reports.
* Check constraint: `CHECK (((post_id IS NOT NULL)::int + (comment_id IS NOT NULL)::int) = 1)` guarantees reports target either a post or a comment, never both.

#### `community_media`, `community_media_variants`, `community_post_attachments`
Private image uploads for posts.
* Trigger: `community_attachment_owner_guard` ensures media attached to a post belongs to the author of the post.
