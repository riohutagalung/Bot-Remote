# Petunjuk untuk Codex: pasang client Bot-Remote pada laptop ini

Permintaan pemilik: pasang agent Bot-Remote pada laptop Windows ini agar muncul pada satu dashboard https://rhremote.vercel.app/. Repository: https://github.com/riohutagalung/Bot-Remote.

## Status penting paket

Saat petunjuk ini dibuat, 21 November 2026, backend bersama beralamat tetap belum selesai disediakan. Implementasi berjalan pada satu laptop pusat melalui Cloudflare Quick Tunnel. Jangan menganggap layanan pusat sudah tersedia hanya karena frontend Vercel dapat dibuka.

client.exe lokal yang pernah dibuat adalah launcher untuk folder aplikasi lengkap, bukan installer mandiri. Binary lama dalam repository belum tentu sesuai sumber terbaru. Jangan sekadar menyalin atau menjalankan binary tersebut.

## Hasil yang diminta

- Laptop ini menjadi agent tambahan pada backend yang sama, bukan membuat server/dashboard pusat baru.
- Pengguna cukup login di satu dashboard untuk melihat seluruh perangkat.
- Identitas laptop unik, disimpan lokal, dan tetap sama setelah restart.
- Agent terlihat, dapat dihentikan dan dihapus pengguna, berjalan sebagai pengguna biasa.
- Fungsi AHK: mendeteksi proses AutoHotkey standar, matikan sekali, atau blokir terus sampai dinonaktifkan. Tidak menjalankan script pengguna dari web.

## Urutan kerja

1. Periksa petunjuk repository dan sumber versi terbaru sebelum pemasangan. Periksa agent yang sudah berjalan agar tidak ada dua agent dengan identitas sama. Jangan menghapus instalasi lama sebelum penggantinya terverifikasi.
2. Verifikasi bahwa backend pusat sudah tersedia dengan alamat WSS tetap dan mekanisme pendaftaran yang sah. Jika belum tersedia, jelaskan bahwa pemasangan otomatis lintas laptop belum dapat diselesaikan. Jangan mengganti pusat dengan localhost atau membuat tunnel baru pada setiap laptop.
3. Gunakan paket pemasangan yang telah disiapkan pemilik untuk akun yang sama. Konfigurasi harus mengandung alamat pusat dan kredensial pendaftaran yang diperlukan. Jangan mengambil kredensial dari akun atau aplikasi lain.
4. Pada implementasi saat ini, agent memakai SERVER_URL dan AGENT_TOKEN; token harus cocok dengan backend. Token ini memberi akses sebagai agent, sehingga hanya boleh didistribusikan secara privat ke perangkat pemilik. Jangan menaruhnya di GitHub publik, log, jawaban chat, atau source frontend. Password dashboard dan deploy key GitHub tidak diperlukan pada laptop agent tambahan.
5. Buat DEVICE_ID unik yang persisten, misalnya UUID. Jangan menggunakan nilai contoh laptop-rio yang sama pada semua laptop. Tinjau kode untuk memastikan DEVICE_ID benar-benar dipakai sebagai identitas koneksi.
6. Pasang dependency yang dibutuhkan versi sumber tersebut. Mode agent menggunakan client.cjs; local.js dan Start-Remote.ps1 menjalankan backend lokal dan bukan launcher agent tambahan yang tepat. Jangan menjalankan Setup.ps1 begitu saja tanpa memeriksa efeknya.
7. Siapkan launcher agent yang terlihat, memakai konfigurasi privat lokal. Kontrol desktop dimatikan secara default. Kontrol sistem hanya diaktifkan sesuai izin pemilik; jangan mengubah hak Windows atau mencoba melewati penolakan akses.
8. Uji koneksi sampai backend mengakui agent dan dashboard menunjukkan laptop ini Online. Putus-sambungkan agent untuk memeriksa reconnect dan pastikan catatan perangkat tetap tersimpan ketika Offline. Jangan mematikan laptop atau menutup aplikasi kerja untuk pengujian tanpa instruksi khusus.
9. Untuk uji blokir AHK gunakan script uji kosong yang dapat dibuang, bukan script kerja. Pastikan blokir bisa dinonaktifkan dan pemilik dapat menjalankan script manual lagi. Kembalikan pilihan blokir sesuai permintaan pemilik.
10. Laporkan lokasi pemasangan, cara menjalankan/menghentikan/menghapus, identitas perangkat, hasil verifikasi, dan kendala yang belum selesai. Jangan menyatakan berhasil hanya karena proses muncul di Task Manager.

## Batas akses antar-chat

Codex di laptop lain tidak otomatis mengetahui riwayat percakapan ini atau memiliki file konfigurasi privat dari laptop pusat. Berikan petunjuk ini dan paket pendaftaran privat yang sesuai. Petunjuk ini tidak mengandung token, password, atau private key.
