const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel', // .xls
    'application/pdf', // .pdf
    'application/msword', // .doc
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/zip', // .zip
    'application/x-zip-compressed', // .zip (Windows)
    'application/x-rar-compressed', // .rar
    'application/octet-stream', // generic binary (fallback for zip)
    'image/png',
    'image/jpeg',
    'image/jpg'
  ];
  
  if (
    allowedTypes.includes(file.mimetype) || 
    file.originalname.endsWith('.xlsx') || 
    file.originalname.endsWith('.xls') ||
    file.originalname.endsWith('.pdf') ||
    file.originalname.endsWith('.doc') ||
    file.originalname.endsWith('.docx') ||
    file.originalname.endsWith('.zip') ||
    file.originalname.endsWith('.rar') ||
    file.originalname.endsWith('.png') ||
    file.originalname.endsWith('.jpg') ||
    file.originalname.endsWith('.jpeg')
  ) {
    cb(null, true);
  } else {
    cb(new Error('Only Excel, PDF, Word, ZIP/RAR, and Image files are allowed'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 25 * 1024 * 1024 // 25MB limit (for coding round zips)
  }
});

module.exports = upload;
