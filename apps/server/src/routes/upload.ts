import { Router, Response, NextFunction } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { upload, validateFileSize } from '../middleware/upload.js';
import { uploadToS3 } from '../utils/s3.js';

const router = Router();
router.use(requireAuth);

// POST /api/upload
// S3 へ保存して URL を返すだけ。添付の登録はメッセージ送信 API が行う
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
