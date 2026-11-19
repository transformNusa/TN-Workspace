-- Profil layanan bisa diatur "hanya luncurkan app native" (mis. Telegram Desktop). Path app native disimpan di sini.
ALTER TABLE profiles ADD COLUMN native_path TEXT;
