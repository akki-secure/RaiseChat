import { Router, Response, NextFunction } from 'express';
import pool from '../config/db.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { upload, validateFileSize } from '../middleware/upload.js';
import { uploadToS3 } from '../utils/s3.js';

const router = Router();
router.use(requireAuth);

// POST /api/upload
router.post('/', upload.single('file'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'ファイルが選択されていません' });
      return;
    }

    const sizeError = validateFileSize(req.file);
    if (sizeError) {
      res.status(400).json({ error: sizeError });
      return;
    }

    const url = await uploadToS3(req.file);

    const { message_id } = req.body;
    if (message_id) {
      await pool.query(
        'INSERT INTO attachments (message_id, url, file_type, size) VALUES ($1, $2, $3, $4)',
        [message_id, url, req.file.mimetype, req.file.size]
      );
    }

    res.status(201).json({
      url,
      file_type: req.file.mimetype,
      size: req.file.size,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
