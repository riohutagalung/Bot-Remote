# Bot-Remote — pasang di laptop, kontrol tanpa Railway

Jalur utama versi ini: **HP/komputer pengontrol → Tailscale privat → dashboard di laptop → agent lokal → layar/mouse/keyboard**. Laptop menjalankan server dan client sekaligus. Tidak ada server Railway yang perlu disewa.

## Pemasangan satu kali pada laptop yang dikontrol

1. Install Node.js 24+ dan Python 3.11+ (aktifkan Add Python to PATH).
2. Ekstrak paket ke folder tetap milikmu, misalnya Documents/Bot-Remote.
3. Buka PowerShell di folder itu, jalankan `./Setup.ps1`. Jika kebijakan PowerShell memblokir, jalankan `powershell -NoProfile -ExecutionPolicy Bypass -File ./Setup.ps1` untuk eksekusi file ini saja.
4. Setup memasang dependency, membuat konfigurasi lokal dengan password acak, dan membangun dashboard. Buka `.env` untuk melihat nilai `DASHBOARD_PASSWORD`; itu password dashboard, bukan password Administrator Windows.
5. Klik dua kali `Start-Laptop.cmd`. Buka http://127.0.0.1:8080 dan login, lalu pilih Kontrol Laptop.
6. Opsional: jalankan `./Install-Startup.ps1` agar aplikasi mulai otomatis setelah pengguna login Windows. Jendela agent tetap terlihat. `./Remove-Startup.ps1` membatalkan pengaturan itu.

Script pemasangan disertakan, belum dijalankan pada Windows asli di sesi ini. Setup tidak mengganti `.env` yang sudah ada. Jika meng-upgrade konfigurasi lama, periksa token dan password; launcher lokal mengabaikan SERVER_URL lama serta memakai loopback agar tidak lagi tersambung ke Railway. Hentikan client.exe versi lama secara manual agar tidak berjalan ganda.

## Kontrol dari HP atau komputer lain, termasuk beda WiFi

1. Install [Tailscale](https://tailscale.com/download) pada laptop dan perangkat pengontrol. Login ke jaringan Tailscale yang sama.
2. Pada laptop, setelah Start-Laptop berjalan, jalankan `tailscale serve --bg http://127.0.0.1:8080` di terminal. Jika command tidak ditemukan, buka ulang terminal setelah memasang Tailscale. Ikuti persetujuan HTTPS dari Tailscale jika muncul.
3. Buka alamat HTTPS yang ditampilkan Tailscale pada browser HP/komputer pengontrol yang terhubung ke Tailscale. Login memakai password dashboard.
4. Untuk melihat atau mematikan jalur: `tailscale serve status` / `tailscale serve reset`. Reset menghapus seluruh konfigurasi Serve di perangkat itu; jangan gunakan jika ada layanan Serve lain yang ingin dipertahankan.

Serve membatasi akses ke jaringan privat Tailscale. Tidak perlu membuka port router atau memakai Funnel publik. Sumber: https://tailscale.com/docs/reference/tailscale-cli/serve . Paket Personal tersedia gratis untuk penggunaan pribadi, ikuti ketentuan paket untuk penggunaan bisnis: https://tailscale.com/pricing . Akun dan persetujuan Tailscale tetap harus diselesaikan pemilik.

Laptop harus menyala, tersambung internet, dan pengguna sedang login ke desktop yang tidak terkunci untuk interaksi UI. Versi ini tidak mengendalikan layar login Windows, UAC secure desktop, atau menyalakan laptop yang mati. Menutup agent/Ctrl+C memutus kontrol. Mulai otomatis berlaku setelah login pengguna, bukan service tersembunyi sebelum login.

Kontrol manual tidak memakai API AI. Untuk instruksi bahasa alami, implementasi yang ada memakai API OpenAI dan masih memerlukan key/model milikmu; biaya AI terpisah dari hosting. Belum ada model AI lokal dalam paket ini. Fitur AI saat ini berupa usulan satu langkah dengan persetujuan, belum seluruh kemampuan Codex.

## Detail teknis dan mode server terpisah

## Kontrol desktop dengan persetujuan

Versi ini memperluas bot AHK menjadi kontrol layar utama laptop Windows: screenshot, klik, ketik Unicode, tombol dasar, scroll, dan usulan satu langkah AI. Setiap langkah AI harus ditinjau dan disetujui. Ini implementasi mandiri; tidak menyalin sistem internal Codex.

## Jalankan lokal di laptop

Butuh Node.js 24+, Python 3.11+, dan desktop Windows yang sedang login serta tidak terkunci. Agent berjalan dengan hak pengguna biasa, bukan administrator.

1. Ekstrak folder, buka PowerShell di folder proyek.
2. `npm ci`
3. `python -m pip install -r requirements-desktop.txt`
4. `Copy-Item .env.example .env`
5. Isi `.env`: `DASHBOARD_PASSWORD` minimal 12 karakter dan `AGENT_TOKEN` acak minimal 32 karakter. Buat token dengan `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Jangan membagikan `.env`.
6. `npm run build`
7. `npm run server`
8. Buka terminal kedua pada folder yang sama: `npm run agent`
9. Buka http://localhost:8080, login, pilih **Kontrol Laptop**, lalu **Ambil screenshot**. Klik gambar untuk klik pada layar asli. Ketik memakai kolom teks dan pilih tombol keyboard yang tersedia.

`ALLOW_DESKTOP_CONTROL=1` mengizinkan kontrol dan screenshot selama agent berjalan. Hentikan terminal agent dengan **Ctrl+C** untuk mencabut akses. Gerakkan mouse ke pojok kiri atas untuk memicu failsafe PyAutoGUI pada aksi input. Agent tidak memasang startup/service tersembunyi. Screenshot diambil per permintaan, bukan video kontinu. Untuk mode AHK saja, set `ALLOW_DESKTOP_CONTROL=0`.

## AI

Isi `OPENAI_API_KEY` dan `OPENAI_MODEL` di `.env` pada server; gunakan model yang mendukung input gambar dan function calling di akunmu. Restart server. Jangan menaruh key dalam variabel `VITE_*`. Masukkan instruksi, pilih **Minta langkah AI**, tinjau screenshot serta JSON usulan, lalu **Setujui dan jalankan sekali**. Usulan habis masa berlaku setelah 60 detik dan tidak bisa dipakai ulang. Minta langkah berikutnya untuk melihat kondisi layar terbaru. AI belum berjalan otonom terus-menerus.

Screenshot dikirim ke server saat memakai kontrol desktop, dan ke OpenAI ketika meminta langkah AI. Implementasi meminta `store:false` dan tidak menyimpan screenshot ke file database. AI menerima screenshot terbaru serta instruksi tugas; belum ada riwayat percakapan panjang. Biaya/akses API mengikuti akun penyedia; pengujian tanpa key tidak membuktikan integrasi model langsung.

## Server internet / beberapa laptop

Untuk mode server terpisah, set HOST=0.0.0.0 pada server dan gunakan proses Node yang mendukung WebSocket permanen (VPS atau layanan kontainer). `Dockerfile` melayani frontend dan backend pada port 8080. Sediakan volume persisten dan set `DATA_FILE` untuk database JSON, serta rahasia melalui environment hosting. Cocok untuk satu instance backend, belum database multi-instance.

Pada setiap laptop salin kode dan dependency Python, isi `.env` dengan `SERVER_URL=wss://alamat-backend`, `AGENT_TOKEN` sama dengan server, `DEVICE_ID` unik (huruf/angka/underscore/hyphen), `ALLOW_DESKTOP_CONTROL=1`, lalu jalankan `npm run agent`. Token agent adalah rahasia enrollment bersama; distribusikan hanya ke laptop milikmu. Rotasi token dengan menggantinya di server dan seluruh agent lalu restart proses. Sesi dashboard kedaluwarsa 8 jam atau saat server restart.

Jika frontend terpisah di Vercel, isi `VITE_API_URL=https://alamat-backend` saat build dan `DASHBOARD_ORIGIN=https://alamat-dashboard` di backend. Vercel hanya frontend; `vercel.json` tidak lagi mencoba meng-host WebSocket backend. Untuk pengembangan frontend gunakan `npm run dev` bersamaan server; izinkan origin http://localhost:5173 di backend.

## AutoHotkey

Install AutoHotkey pada laptop, letakkan `.ahk` di folder agent, lalu gunakan start/stop pada dashboard. Nama script dibatasi ke file `.ahk` dalam folder tersebut. Tombol Matikan AHK menghentikan seluruh proses AutoHotkey standar pada laptop yang dipilih, termasuk script yang dijalankan manual. Status diverifikasi dari proses Windows dan dashboard menunggu konfirmasi client. AHK yang dibungkus menjadi executable dengan nama lain belum dideteksi. Jika AHK berjalan sebagai Administrator, jalankan agent sebagai Administrator juga. Jika AutoHotkey ada di lokasi khusus, isi `AHK_EXE` dengan path executable. `client.exe` lama bukan hasil build versi ini; gunakan `npm run agent`.

## Validasi

`npm test` memeriksa autentikasi API dan WebSocket, relay screenshot dengan agent simulasi, validasi aksi, pergantian koneksi, dan logout. `npm run build` memeriksa build React. Pengujian ini tidak mengklik desktop asli atau memanggil API berbayar. Setelah pemasangan, uji manual pada dokumen kosong sebelum memakai aplikasi kerja.
