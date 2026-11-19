-- Profil layanan bisa ditandai "buka di browser luar" (satu tab, paling ringan).
-- Dipakai untuk layanan yang login-nya tidak bisa di dalam app (mis. Google): klik dari sidebar
-- langsung membuka browser bawaan, tanpa mampir ke halaman penolakan.
ALTER TABLE profiles ADD COLUMN external INTEGER NOT NULL DEFAULT 0;
