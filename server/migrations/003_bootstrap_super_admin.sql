UPDATE users
SET permissions = json_insert(permissions, '$[#]', 'platform:super-admin'),
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE member_id = 'ADMIN-01' COLLATE NOCASE
  AND role = 'admin'
  AND NOT EXISTS (
    SELECT 1 FROM json_each(users.permissions)
    WHERE value = 'platform:super-admin'
  );
