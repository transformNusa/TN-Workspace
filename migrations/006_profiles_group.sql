-- Kelompok layanan di sidebar (mis. Core, Web). Bisa diubah per profil di
-- Pengaturan -> Layanan Web. Baris lama diisi otomatis dari jenis layanannya:
-- layanan inti (WhatsApp, Telegram, Sunfish) masuk "Core", sisanya "Web".
ALTER TABLE profiles ADD COLUMN group_name TEXT NOT NULL DEFAULT '';
UPDATE profiles SET group_name = CASE
  WHEN service IN ('whatsapp', 'telegram', 'sunfish') THEN 'Core'
  ELSE 'Web'
END WHERE group_name = '';
