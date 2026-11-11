
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA = path.join(__dirname, 'data');

const storiesFile = path.join(DATA, 'stories.json');
const settingsFile = path.join(DATA, 'settings.json');
const adminFile = path.join(DATA, 'admin.json');
const uploadsDir = path.join(__dirname, 'public', 'uploads');

fs.mkdirSync(DATA, { recursive: true });
fs.mkdirSync(uploadsDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
      const ext = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' }[file.mimetype];
      cb(null, 'background-' + Date.now() + ext);
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    cb(null, ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.mimetype));
  }
});

function readJSON(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    fs.writeFileSync(file, JSON.stringify(fallback, null, 2));
    return fallback;
  }
}

function saveJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

if (!fs.existsSync(storiesFile)) saveJSON(storiesFile, []);
if (!fs.existsSync(settingsFile)) {
  saveJSON(settingsFile, {
    appName: 'عالم الحكايات',
    ticker: 'مرحباً بكم في عالم الحكايات ✦ اكتشفوا أجمل القصص'
  });
}

if (!fs.existsSync(adminFile)) {
  const username = process.env.ADMIN_USER || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'Hekayat@2026';

  saveJSON(adminFile, {
    username,
    passwordHash: bcrypt.hashSync(password, 12)
  });

  console.log('تم إنشاء حساب المدير الأولي.');
}

app.use(express.json({ limit: '2mb' }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'change-this-secret-before-public-deployment',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    maxAge: 1000 * 60 * 60 * 8
  }
}));

app.use(express.static(path.join(__dirname, 'public')));

function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  res.status(401).json({ message: 'يجب تسجيل دخول المدير أولاً' });
}

app.post('/api/admin/background', requireAdmin, (req, res) => {
  upload.single('background')(req, res, err => {
    if (err) {
      return res.status(400).json({
        message: err.code === 'LIMIT_FILE_SIZE' ? 'حجم الصورة يجب ألا يتجاوز 5 ميغابايت' : err.message
      });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'اختر صورة بصيغة JPG أو PNG أو WebP أو GIF' });
    }
    const settings = readJSON(settingsFile, {});
    settings.background = '/uploads/' + req.file.filename;
    saveJSON(settingsFile, settings);
    res.json({ message: 'تم تغيير خلفية التطبيق بنجاح', background: settings.background });
  });
});


// عرض القصص
app.get('/api/stories', (req, res) => {
  res.json(readJSON(storiesFile, []));
});

// عرض إعدادات الواجهة العامة
app.get('/api/settings', (req, res) => {
  const settings = readJSON(settingsFile, {});
  res.json({
    appName: settings.appName,
    ticker: settings.ticker
  });
});

// تسجيل دخول المدير
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body || {};
  const admin = readJSON(adminFile, {});

  if (
    typeof username !== 'string' ||
    typeof password !== 'string' ||
    username !== admin.username ||
    !bcrypt.compareSync(password, admin.passwordHash)
  ) {
    return res.status(401).json({
      message: 'اسم المدير أو كلمة المرور غير صحيحة'
    });
  }

  req.session.regenerate(err => {
    if (err) {
      return res.status(500).json({ message: 'تعذر إنشاء الجلسة' });
    }

    req.session.isAdmin = true;
    res.json({ message: 'تم تسجيل الدخول بنجاح' });
  });
});

// التحقق من جلسة المدير
app.get('/api/admin/status', requireAdmin, (req, res) => {
  res.json({ authenticated: true });
});

// تسجيل الخروج
app.post('/api/admin/logout', requireAdmin, (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ message: 'تم تسجيل الخروج' });
  });
});

// تعديل الشريط المتحرك واسم التطبيق
app.post('/api/admin/settings', requireAdmin, (req, res) => {
  const settings = readJSON(settingsFile, {});
  const { ticker, appName } = req.body || {};

  if (ticker !== undefined) {
    if (typeof ticker !== 'string' || ticker.length > 500) {
      return res.status(400).json({ message: 'نص الشريط غير صالح' });
    }
    settings.ticker = ticker;
  }

  if (appName !== undefined) {
    if (typeof appName !== 'string' || appName.length > 100) {
      return res.status(400).json({ message: 'اسم التطبيق غير صالح' });
    }
    settings.appName = appName;
  }

  saveJSON(settingsFile, settings);
  res.json({ message: 'تم حفظ الإعدادات' });
});

// إضافة قصة
app.post('/api/admin/stories', requireAdmin, (req, res) => {
  const { title, description, content, category } = req.body || {};

  if (
    typeof title !== 'string' || !title.trim() ||
    typeof content !== 'string' || !content.trim()
  ) {
    return res.status(400).json({ message: 'العنوان والمحتوى مطلوبان' });
  }

  const stories = readJSON(storiesFile, []);

  const story = {
    id: Date.now(),
    title: title.trim(),
    description: String(description || '').slice(0, 1000),
    content: content.trim(),
    category: String(category || 'قصص قصيرة').slice(0, 100),
    createdAt: new Date().toISOString()
  };

  stories.unshift(story);
  saveJSON(storiesFile, stories);

  res.status(201).json({
    message: 'تمت إضافة القصة بنجاح',
    story
  });
});

// حذف قصة
app.delete('/api/admin/stories/:id', requireAdmin, (req, res) => {
  const stories = readJSON(storiesFile, []);
  const updated = stories.filter(
    story => String(story.id) !== req.params.id
  );

  if (updated.length === stories.length) {
    return res.status(404).json({ message: 'القصة غير موجودة' });
  }

  saveJSON(storiesFile, updated);
  res.json({ message: 'تم حذف القصة' });
});

// تغيير كلمة مرور المدير
app.post('/api/admin/password', requireAdmin, (req, res) => {
  const { oldPassword, newPassword } = req.body || {};
  const admin = readJSON(adminFile, {});

  if (!bcrypt.compareSync(oldPassword || '', admin.passwordHash)) {
    return res.status(400).json({ message: 'كلمة المرور الحالية غير صحيحة' });
  }

  if (typeof newPassword !== 'string' || newPassword.length < 10) {
    return res.status(400).json({
      message: 'كلمة المرور الجديدة يجب أن تكون 10 أحرف على الأقل'
    });
  }

  admin.passwordHash = bcrypt.hashSync(newPassword, 12);
  saveJSON(adminFile, admin);

  res.json({ message: 'تم تغيير كلمة المرور بنجاح' });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', app: 'عالم الحكايات' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('================================');
  console.log('   عالم الحكايات يعمل الآن');
  console.log('   http://localhost:' + PORT);
  console.log('================================');
});

