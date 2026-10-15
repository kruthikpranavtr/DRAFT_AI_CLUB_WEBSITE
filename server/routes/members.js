import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { requirePasswordChanged,requireUser } from '../auth.js';
import { findStudentProfile,profileResponse } from '../profiles.js';
import { sendStoredFile } from '../storage.js';

const router = Router();
router.use(requireUser,requirePasswordChanged);

router.get('/media/:id',async (req,res,next) => {
  try {
    const record = db.prepare(`SELECT f.* FROM files f
      JOIN student_profiles p ON p.avatar_file_id=f.id
      JOIN users u ON u.id=p.user_id
      WHERE f.id=? AND f.is_public=0 AND f.purpose='profile-avatar'
        AND u.role='student' AND u.status='active'`).get(req.params.id);
    if (!record) return res.status(404).json({ error:'Profile photo not found.' });
    res.setHeader('Cache-Control','private, no-store');
    await sendStoredFile(record,res,'inline');
  } catch (error) { next(error); }
});

const paginationSchema = z.object({
  limit:z.coerce.number().int().min(1).max(50).default(24),
  offset:z.coerce.number().int().min(0).max(1000000).default(0),
});

router.get('/',(req,res) => {
  const search = String(req.query.search || '').trim().slice(0,80);
  const department = String(req.query.department || '').trim().slice(0,120);
  const academicYear = req.query.academicYear ? Number(req.query.academicYear) : null;
  const parsed = paginationSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error:'Invalid directory pagination.' });
  const { limit,offset } = parsed.data;
  const filters = [`u.role='student'`,`u.status='active'`];
  const values = [];
  if (search) {
    filters.push(`(u.name LIKE ? OR p.department LIKE ? OR EXISTS (
      SELECT 1 FROM profile_skills ps WHERE ps.user_id=u.id AND ps.skill_name LIKE ?
    ))`);
    const query = `%${search}%`;
    values.push(query,query,query);
  }
  if (department) { filters.push('p.department=?'); values.push(department); }
  if (Number.isInteger(academicYear) && academicYear >= 1 && academicYear <= 6) {
    filters.push('p.academic_year=?'); values.push(academicYear);
  }
  const where = filters.join(' AND ');
  const total = db.prepare(`SELECT count(*) count FROM users u
    LEFT JOIN student_profiles p ON p.user_id=u.id WHERE ${where}`).get(...values).count;
  const rows = db.prepare(`SELECT u.id,u.member_id,u.name,u.updated_at,
      p.department,p.academic_year,p.github_url,p.linkedin_url,p.hackerrank_url,p.description,
      p.avatar_file_id,p.updated_at profile_updated_at
    FROM users u LEFT JOIN student_profiles p ON p.user_id=u.id
    WHERE ${where} ORDER BY u.name COLLATE NOCASE,u.id LIMIT ? OFFSET ?`).all(...values,limit,offset);
  res.json({ items:rows.map(row => profileResponse(row,{ includeIdentity:row.id === req.user.id })),total,limit,offset });
});

router.get('/:id',(req,res) => {
  const row = findStudentProfile(req.params.id);
  if (!row || row.status !== 'active') return res.status(404).json({ error:'Member profile not found.' });
  res.json({ profile:profileResponse(row,{ includeIdentity:row.id === req.user.id }) });
});

export default router;
