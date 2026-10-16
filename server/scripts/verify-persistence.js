import pg from 'pg';

async function check() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const [banks, assessments, attempts, posts, comments, media] = await Promise.all([
    pool.query('SELECT title FROM assessment_banks WHERE title = $1', ['PostgreSQL Acceptance Bank']),
    pool.query('SELECT title, status FROM assessments WHERE title = $1', ['PostgreSQL Final Verification Assessment']),
    pool.query('SELECT count(*) FROM assessment_attempts'),
    pool.query('SELECT title, is_pinned, is_locked FROM community_posts WHERE title = $1', ['PostgreSQL Verification Announcement']),
    pool.query('SELECT count(*) FROM community_comments'),
    pool.query('SELECT count(*) FROM community_post_attachments'),
  ]);

  console.log('--- POSTGRESQL PERSISTENCE ACROSS SERVER RESTART ---');
  console.log('Bank preserved:', banks.rows[0]);
  console.log('Assessment preserved:', assessments.rows[0]);
  console.log('Attempts preserved:', attempts.rows[0].count);
  console.log('Post preserved:', posts.rows[0]);
  console.log('Comments preserved:', comments.rows[0].count);
  console.log('Attachments preserved:', media.rows[0].count);

  await pool.end();
}

check().catch(console.error);
