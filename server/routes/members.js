import { Router } from 'express';
import { z } from 'zod';
import { queryOne, queryRows } from '../db.js';
import { requirePasswordChanged, requireUser } from '../auth.js';
import { findStudentProfile, profileResponse } from '../profiles.js';
import { sendStoredFile } from '../storage.js';

const router = Router();
router.use(requireUser, requirePasswordChanged);

router.get('/media/:id', async (req, res, next) => {
  try {
    const record = await queryOne(
      `SELECT f.* FROM files f
       JOIN student_profiles p ON p.avatar_file_id = f.id
       JOIN users u ON u.id = p.user_id
       WHERE f.id = $1 AND f.is_public = FALSE AND f.purpose = 'profile-avatar'
         AND u.role = 'student' AND u.status = 'active'`,
      [req.params.id]
    );
    if (!record) return res.status(404).json({ error: 'Profile photo not found.' });
    res.setHeader('Cache-Control', 'private, no-store');
    await sendStoredFile(record, res, 'inline');
  } catch (error) {
    next(error);
  }
});

const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(24),
  offset: z.coerce.number().int().min(0).max(1000000).default(0),
});

router.get('/', async (req, res, next) => {
  try {
    const search = String(req.query.search || '').trim().slice(0, 80);
    const department = String(req.query.department || '').trim().slice(0, 120);
    const academicYear = req.query.academicYear ? Number(req.query.academicYear) : null;
    const parsed = paginationSchema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid directory pagination.' });
    const { limit, offset } = parsed.data;
    const filters = ["u.role = 'student'", "u.status = 'active'"];
    const values = [];
    if (search) {
      values.push(`%${search}%`);
      const paramIdx = `$${values.length}`;
      filters.push(`(u.name ILIKE ${paramIdx} OR p.department ILIKE ${paramIdx} OR EXISTS (
        SELECT 1 FROM profile_skills ps WHERE ps.user_id = u.id AND ps.skill_name ILIKE ${paramIdx}
      ))`);
    }
    if (department) {
      values.push(department);
      filters.push(`p.department = $${values.length}`);
    }
    if (Number.isInteger(academicYear) && academicYear >= 1 && academicYear <= 6) {
      values.push(academicYear);
      filters.push(`p.academic_year = $${values.length}`);
    }
    const where = filters.join(' AND ');
    const countRow = await queryOne(
      `SELECT count(*)::int AS count FROM users u
       LEFT JOIN student_profiles p ON p.user_id = u.id WHERE ${where}`,
      values
    );
    const total = Number(countRow?.count) || 0;
    const queryValues = [...values, limit, offset];
    const limitIdx = `$${queryValues.length - 1}`;
    const offsetIdx = `$${queryValues.length}`;
    const rows = await queryRows(
      `SELECT u.id, u.member_id, u.name, u.updated_at,
          p.department, p.academic_year, p.github_url, p.linkedin_url, p.hackerrank_url, p.description,
          p.avatar_file_id, p.updated_at AS profile_updated_at
       FROM users u LEFT JOIN student_profiles p ON p.user_id = u.id
       WHERE ${where} ORDER BY LOWER(u.name), u.id LIMIT ${limitIdx} OFFSET ${offsetIdx}`,
      queryValues
    );
    const items = await Promise.all(
      rows.map((row) => profileResponse(row, { includeIdentity: row.id === req.user.id }))
    );
    res.json({ items, total, limit, offset });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const row = await findStudentProfile(req.params.id);
    if (!row) {
      const administrator = await queryOne(
        "SELECT id, name, status, updated_at FROM users WHERE id = $1 AND role = 'admin' AND status = 'active'",
        [req.params.id]
      );
      if (administrator) {
        const adminProfile = await profileResponse(administrator);
        return res.json({ profile: { ...adminProfile, description: 'AI Club administrator' } });
      }
    }
    if (!row || row.status !== 'active') return res.status(404).json({ error: 'Member profile not found.' });
    res.json({ profile: await profileResponse(row, { includeIdentity: row.id === req.user.id }) });
  } catch (error) {
    next(error);
  }
});

export default router;
