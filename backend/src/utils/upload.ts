import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import { env } from '../config/env';

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/heif',
];

const ALLOWED_FILE_EXTENSIONS = [
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.jpg',
  '.jpeg',
  '.png',
  '.heic',
];

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, env.UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}${ext}`;
    cb(null, uniqueName);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_MIME_TYPES.includes(file.mimetype) || ALLOWED_FILE_EXTENSIONS.includes(ext)) {
      cb(null, true);
      return;
    }
    cb(
      new Error(
        'File type not allowed. Use PDF, DOC, DOCX, XLS, XLSX, JPG, JPEG, PNG, or HEIC.',
      ),
    );
  },
});

// Avatar upload - smaller file size, images only
const avatarDir = path.join(process.cwd(), 'uploads', 'avatars');

const avatarStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    // Create directory if it doesn't exist
    if (!fs.existsSync(avatarDir)) {
      fs.mkdirSync(avatarDir, { recursive: true });
    }
    cb(null, avatarDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `avatar-${Date.now()}-${crypto.randomUUID().slice(0, 8)}${ext}`;
    cb(null, uniqueName);
  },
});

const AVATAR_ALLOWED = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

export const uploadAvatar = multer({
  storage: avatarStorage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB for avatars
  fileFilter: (_req, file, cb) => {
    if (AVATAR_ALLOWED.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Image type not allowed. Use JPG, PNG, GIF, or WEBP.'));
  },
});

const EXCEL_ALLOWED = [
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/octet-stream',
];

export const uploadUsersExcel = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (EXCEL_ALLOWED.includes(file.mimetype) || ['.xls', '.xlsx'].includes(ext)) {
      cb(null, true);
      return;
    }
    cb(new Error('File type not allowed. Use XLS or XLSX.'));
  },
});

const deviceImagesDir = path.join(process.cwd(), 'uploads', 'device-images');

const deviceImageStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    if (!fs.existsSync(deviceImagesDir)) {
      fs.mkdirSync(deviceImagesDir, { recursive: true });
    }
    cb(null, deviceImagesDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `device-${Date.now()}-${crypto.randomUUID().slice(0, 8)}${ext}`;
    cb(null, uniqueName);
  },
});

export const uploadDeviceImages = multer({
  storage: deviceImageStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB per image
  fileFilter: (_req, file, cb) => {
    if (AVATAR_ALLOWED.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Image type not allowed. Use JPG, PNG, GIF, or WEBP.'));
  },
});

export const uploadAttendanceExcel = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (EXCEL_ALLOWED.includes(file.mimetype) || ['.xls', '.xlsx'].includes(ext)) {
      cb(null, true);
      return;
    }

    cb(new Error('File type not allowed. Use XLS or XLSX.'));
  },
});
