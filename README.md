# RH Remote — satu dashboard untuk semua laptop

Dashboard: https://rhremote.vercel.app/

## Pasang pada laptop lain

1. Unduh RH-Remote-Setup.exe dari halaman Releases repository ini.
2. Jalankan sebagai pengguna Windows biasa. Pilih Y untuk memasang. Installer menaruh aplikasi di LocalAppData/RH-Remote dan membuat shortcut desktop.
3. Pilih apakah agent mulai otomatis setelah login Windows. Jendela agent tetap terlihat.
4. Masukkan username dan password dashboard satu kali untuk mendaftarkan laptop. Alamat pusat sudah ada dalam aplikasi; tidak perlu URL, Node.js terpisah, atau kunci GitHub.
5. Buka dashboard. Laptop muncul Online setelah mengirim status; catatannya tetap tersimpan ketika Offline.

Jangan mengambil client.exe lama di root repository. Gunakan installer dari Releases; client.exe yang terpasang membutuhkan file pendukung pada folder instalasinya.

Codex di laptop lain: baca dokumen ini, unduh installer release terbaru, pasang pada laptop pemilik, dan verifikasi laptop muncul Online. Login pertama memerlukan akun dashboard pemilik. Jangan menyatakan selesai hanya karena proses agent terbuka.

## Arsitektur dan penggunaan

Vercel melayani frontend. Supabase project Bot-Remote di RH Management melayani API pusat dan database khusus. Semua agent melakukan koneksi HTTPS keluar ke alamat tetap, tanpa tunnel atau server di laptop pusat. Kredensial tiap perangkat berbeda, daftar perangkat persisten, dan hasil perintah menunggu pengakuan agent. Blokir AHK diperiksa lokal setiap 2 detik; status/perintah cloud dipoll sekitar 30 detik. Dashboard menyegarkan daftar sekitar 15 detik.

Matikan sekali menghentikan AutoHotkey standar yang berjalan. Blokir terus menghentikannya kembali jika dibuka manual. Nonaktifkan blokir mengizinkan script dibuka manual lagi. Agent hanya dapat mengontrol proses sesuai hak pengguna Windows. Mode screenshot/mouse/keyboard belum diaktifkan pada client pusat.

Tutup jendela dan shutdown memerlukan konfirmasi dashboard. Shutdown memeriksa hak Windows sebelum menjadwalkan hitung mundur 10 detik, dengan polling cepat selama hitung mundur untuk pembatalan. Aplikasi dengan pekerjaan belum disimpan dapat menahan penutupan. Jangan menguji shutdown pada pekerjaan aktif.

Ctrl+C atau tutup jendela agent untuk menghentikan akses. Nonaktifkan-Blokir.cmd meminta agent mencabut blokir lokal walau koneksi internet terputus. Menghapus shortcut RH Remote dari Startup menghentikan mulai otomatis. Setelah menutup agent, hapus folder LocalAppData/RH-Remote dan shortcut desktop untuk uninstall. Jangan menghapus identitas/kunci perangkat jika hanya memperbarui aplikasi.

## Biaya dan batas

Pembuatan proyek Supabase dikonfirmasi $0/bulan pada 21 November 2026. Tidak ada upgrade berbayar yang diaktifkan. Paket gratis tetap mempunyai kuota, dapat mengalami jeda, dan tidak menjamin gratis seumur hidup. Polling 30 detik sekitar 86.400 permintaan per laptop per 30 hari jika aktif 24 jam, ditambah penggunaan dashboard dan perintah. Periksa kuota sebelum menambah banyak laptop.

## Pengembangan

Sumber API ada di central/handler.js dan central/index.ts. Skema ada di central/schema.sql. RLS aktif dan tabel hanya diakses API server menggunakan kredensial internal Supabase. Login memakai hash PBKDF2, sesi kedaluwarsa, dan pembatasan percobaan. Rahasia akun tidak disertakan di GitHub/installer.

Build installer pada Windows: powershell -File installer/build.ps1. Workflow GitHub membangun dan menerbitkan installer ketika sumber client berubah di main. npm test memeriksa komponen lokal; pengujian integrasi cloud memakai perangkat simulasi dan tidak mematikan laptop asli.

File server.js/local.js dan alat tunnel lama dipertahankan sebagai sumber mode lama; dashboard produksi kini menggunakan API pusat.
