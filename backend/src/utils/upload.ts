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

const leaveAttachmentDir = path.isAbsolute(env.UPLOAD_DIR)
  ? env.UPLOAD_DIR
  : path.join(process.cwd(), env.UPLOAD_DIR);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    if (!fs.existsSync(leaveAttachmentDir)) {
      fs.mkdirSync(leaveAttachmentDir, { recursive: true });
    }
    cb(null, leaveAttachmentDir);
  },
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

// CV upload — PDF + DOC/DOCX only
const cvDir = path.join(process.cwd(), 'uploads', 'cv');

const cvStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    if (!fs.existsSync(cvDir)) fs.mkdirSync(cvDir, { recursive: true });
    cb(null, cvDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `cv-${Date.now()}-${crypto.randomUUID().slice(0, 8)}${ext}`;
    cb(null, uniqueName);
  },
});

const CV_ALLOWED_MIME = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/heif',
];

const CV_ALLOWED_EXT = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png', '.heic'];

export const uploadCv = multer({
  storage: cvStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (CV_ALLOWED_MIME.includes(file.mimetype) || CV_ALLOWED_EXT.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('File must be PDF, DOC, DOCX, JPG, JPEG, PNG, or HEIC.'));
    }
  },
});
