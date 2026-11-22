/* مخطط PostgreSQL. التواريخ نصوص بصيغة UTC «YYYY-MM-DD HH:MM:SS» كما تتوقعها الواجهة. */
const NOW = "(to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'))";

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS users(
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  google_id TEXT UNIQUE,
  linkedin_id TEXT UNIQUE,
  role TEXT NOT NULL CHECK(role IN ('student','company','admin')),
  name TEXT NOT NULL,
  avatar TEXT,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  token_version INTEGER NOT NULL DEFAULT 0,
  email_verified INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT ${NOW}
);
CREATE TABLE IF NOT EXISTS student_profiles(
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  spec TEXT NOT NULL DEFAULT 'برمجة',
  status TEXT NOT NULL DEFAULT 'طالب',
  bio TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS company_profiles(
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  sector TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  about TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  map_url TEXT NOT NULL DEFAULT '',
  contact_email TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS skills(
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT 'مبتدئ'
);
CREATE TABLE IF NOT EXISTS portfolio(
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  url TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS postings(
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK(kind IN ('job','project')),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  spec TEXT NOT NULL DEFAULT 'برمجة',
  pay INTEGER NOT NULL,
  cur TEXT NOT NULL DEFAULT 'IQD',
  hours INTEGER,
  schedule TEXT,
  shift TEXT,
  type TEXT,
  days INTEGER,
  address TEXT NOT NULL DEFAULT '',
  map_url TEXT NOT NULL DEFAULT '',
  reqs TEXT NOT NULL DEFAULT '[]',
  suitable_for TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL DEFAULT ${NOW}
);
CREATE TABLE IF NOT EXISTS applications(
  id SERIAL PRIMARY KEY,
  posting_id INTEGER NOT NULL REFERENCES postings(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL DEFAULT '',
  projects TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending',
  stage TEXT,
  created_at TEXT NOT NULL DEFAULT ${NOW},
  UNIQUE(posting_id, student_id)
);
CREATE TABLE IF NOT EXISTS messages(
  id SERIAL PRIMARY KEY,
  application_id INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  sender_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT ${NOW}
);
CREATE TABLE IF NOT EXISTS works(
  id SERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  rating INTEGER NOT NULL,
  comment TEXT NOT NULL DEFAULT '',
  company_name TEXT NOT NULL DEFAULT '',
  amount INTEGER NOT NULL DEFAULT 0,
  cur TEXT NOT NULL DEFAULT 'IQD',
  created_at TEXT NOT NULL DEFAULT ${NOW}
);
CREATE TABLE IF NOT EXISTS wallet_tx(
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  amount INTEGER NOT NULL,
  cur TEXT NOT NULL DEFAULT 'IQD',
  created_at TEXT NOT NULL DEFAULT ${NOW}
);
CREATE TABLE IF NOT EXISTS invites(
  id SERIAL PRIMARY KEY,
  posting_id INTEGER NOT NULL REFERENCES postings(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL DEFAULT ${NOW},
  UNIQUE(posting_id, student_id)
);
CREATE TABLE IF NOT EXISTS password_resets(
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT UNIQUE NOT NULL,
  expires_at BIGINT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT ${NOW}
);
CREATE INDEX IF NOT EXISTS idx_reset_user ON password_resets(user_id);
CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS translations(h TEXT NOT NULL, lang TEXT NOT NULL, tr_out TEXT NOT NULL, PRIMARY KEY(h, lang));
CREATE INDEX IF NOT EXISTS idx_post_company ON postings(company_id);
CREATE INDEX IF NOT EXISTS idx_app_posting ON applications(posting_id);
CREATE INDEX IF NOT EXISTS idx_app_student ON applications(student_id);
CREATE INDEX IF NOT EXISTS idx_msg_app ON messages(application_id);
`;

/* ترحيل العملة: الدينار «د.ع» ← IQD، والريال السعودي «ر.س» ← دولار أمريكي USD (بسعر 3.75). يُنفَّذ عند كل إقلاع وهو آمن للتكرار. */
export const MIGRATE = `
ALTER TABLE users ADD COLUMN IF NOT EXISTS linkedin_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS users_linkedin_id_key ON users(linkedin_id);
/* «مناسب لـ»: كان شارة ثابتة على كل فرصة. للقواعد القديمة تحتفظ الصفوف الموجودة بالشارة السابقة، وتبدأ الجديدة فارغة. */
ALTER TABLE postings ADD COLUMN IF NOT EXISTS suitable_for TEXT NOT NULL DEFAULT 'مناسب للخريجين الجدد';
ALTER TABLE postings ALTER COLUMN suitable_for SET DEFAULT '';
UPDATE postings SET cur='IQD' WHERE cur='د.ع';
UPDATE works SET cur='IQD' WHERE cur='د.ع';
UPDATE wallet_tx SET cur='IQD' WHERE cur='د.ع';
UPDATE postings SET pay=GREATEST(1, ROUND(pay / 3.75)::int), cur='USD' WHERE cur='ر.س';
UPDATE works SET amount=ROUND(amount / 3.75)::int, cur='USD' WHERE cur='ر.س';
UPDATE wallet_tx SET amount=ROUND(amount / 3.75)::int, cur='USD' WHERE cur='ر.س';
`;
