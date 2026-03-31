-- BlockVault: Users export script for pgAdmin
-- Run this inside pgAdmin Query Tool on the same database used by the backend.

-- 1. View all signup users
SELECT
    id,
    name,
    email,
    is_active,
    is_admin,
    email_verified,
    email_verified_at,
    last_login_at,
    created_at
FROM users
ORDER BY created_at DESC;

-- 2. Export all signup users as CSV from pgAdmin
-- In pgAdmin Query Tool:
--   Run the SELECT below
--   Then use "Download as CSV" / "Save Results to File"
SELECT
    id,
    name,
    email,
    is_active,
    is_admin,
    email_verified,
    email_verified_at,
    last_login_at,
    created_at
FROM users
ORDER BY created_at DESC;

-- 3. Optional: only verified signup users
SELECT
    id,
    name,
    email,
    is_active,
    is_admin,
    email_verified,
    email_verified_at,
    last_login_at,
    created_at
FROM users
WHERE email_verified = TRUE
ORDER BY created_at DESC;

-- 4. Optional: PostgreSQL server-side CSV export
-- Replace the path below with a valid server-accessible path.
-- This works only if PostgreSQL has permission to write there.
COPY (
    SELECT
        id,
        name,
        email,
        is_active,
        is_admin,
        email_verified,
        email_verified_at,
        last_login_at,
        created_at
    FROM users
    ORDER BY created_at DESC
) TO 'C:\\temp\\blockvault_users_export.csv'
WITH (FORMAT CSV, HEADER TRUE);
