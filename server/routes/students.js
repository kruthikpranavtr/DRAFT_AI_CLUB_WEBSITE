import crypto from 'node:crypto';
import { Router } from 'express';
import multer from 'multer';
import { ZodError } from 'zod';
import { audit,db,now } from '../db.js';
import { requirePasswordChanged,requireUser } from '../auth.js';
import { findStudentProfile,profileResponse,updateStudentProfile,ensureStudentProfile } from '../profiles.js';
import { studentProfileSchema } from '../validation.js';
import { profileImageMimeTypes,verifyProfileImage } from '../image-security.js';
import { deleteStoredFile,storeUpload } from '../storage.js';

const router = Router();
router.use(requireUser,requirePasswordChanged,(req,res,next) => {
  if (req.user.role !== 'student') return res.status(403).json({ error:'Student access required.' });
  next();
});

const upload = multer({
  storage:multer.memoryStorage(),
  limits:{ fileSize:5 * 1024 * 1024,files:1 },
  fileFilter(req,file,callback) {
    const allowed = profileImageMimeTypes.has(file.mimetype);
    callback(allowed ? null : new Error('Profile photos must be JPEG, PNG, or WebP images.'),allowed);
  },
});

router.get('/me/profile',(req,res) => {
  ensureStudentProfile(req.user.id);
  const row = findStudentProfile(req.user.id);
  res.json({ profile:profileResponse(row,{ includeEmail:true }) });
});

router.patch('/me/profile',(req,res,next) => {
  try {
    const input = studentProfileSchema.parse(req.body);
    db.transaction(() => {
      updateStudentProfile(req.user.id,input);
      audit(req.user.id,'profile.updated','student-profile',req.user.id,{
        fields:['department','academicYear','githubUrl','linkedinUrl','hackerrankUrl','description','skills'],
      });
    })();
    res.json({ profile:profileResponse(findStudentProfile(req.user.id),{ includeEmail:true }) });
  } catch (error) { next(error); }
});

router.post('/me/profile-photo',upload.single('photo'),async (req,res,next) => {
  let saved;
  try {
    if (!req.file) return res.status(400).json({ error:'Choose a profile photo.' });
    const verified = verifyProfileImage(req.file);
    saved = await storeUpload(req.file,{ prefix:'profile-avatars',extension:verified.extension });
    const id = crypto.randomUUID();
    const time = now();
    ensureStudentProfile(req.user.id,time);
    const old = db.prepare(`SELECT f.* FROM student_profiles p
      LEFT JOIN files f ON f.id=p.avatar_file_id WHERE p.user_id=?`).get(req.user.id);
    db.transaction(() => {
      db.prepare(`INSERT INTO files
        (id,original_name,stored_name,mime_type,size,storage_key,public_url,kind,is_public,created_at,updated_at,uploaded_by,purpose)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
        id,req.file.originalname,saved.storedName,verified.mimeType,req.file.size,saved.storageKey,
        `/api/members/media/${id}`,'image',0,time,time,req.user.id,'profile-avatar'
      );
      db.prepare('UPDATE student_profiles SET avatar_file_id=?,updated_at=? WHERE user_id=?')
        .run(id,time,req.user.id);
      if (old?.id) db.prepare('DELETE FROM files WHERE id=?').run(old.id);
      audit(req.user.id,'profile.photo_updated','student-profile',req.user.id,{ fileId:id });
    })();
    if (old?.id) deleteStoredFile(old).catch(error => console.error('Unable to remove replaced profile photo.',error));
    res.status(201).json({ avatarUrl:`/api/members/media/${id}` });
  } catch (error) {
    if (saved) deleteStoredFile({ storage_key:saved.storageKey }).catch(() => {});
    next(error);
  }
});

router.delete('/me/profile-photo',async (req,res,next) => {
  try {
    const old = db.prepare(`SELECT f.* FROM student_profiles p
      JOIN files f ON f.id=p.avatar_file_id WHERE p.user_id=?`).get(req.user.id);
    if (!old) return res.status(204).end();
    db.transaction(() => {
      db.prepare('UPDATE student_profiles SET avatar_file_id=NULL,updated_at=? WHERE user_id=?').run(now(),req.user.id);
      db.prepare('DELETE FROM files WHERE id=?').run(old.id);
      audit(req.user.id,'profile.photo_removed','student-profile',req.user.id);
    })();
    await deleteStoredFile(old);
    res.status(204).end();
  } catch (error) { next(error); }
});

router.use((error,req,res,next) => {
  if (error instanceof ZodError) return res.status(400).json({ error:'Please correct the profile fields.',issues:error.issues });
  if (error instanceof multer.MulterError) {
    return res.status(400).json({ error:error.code === 'LIMIT_FILE_SIZE' ? 'Profile photos must be 5 MB or smaller.' : error.message });
  }
  if (error?.code === 'INVALID_PROFILE_IMAGE' || error?.message?.startsWith('Profile photos must')) {
    return res.status(400).json({ error:error.message });
  }
  next(error);
});

export default router;
