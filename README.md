# SpeakSafe ITSB (Flask + SQLite)

## Struktur folder
```
speaksafe/
  app.py                  backend: API, login, database SQLite
  requirements.txt        daftar library Python (Flask)
  setup.bat               sekali saja: buat venv + install library (Windows)
  run.bat                 jalankan web (Windows)
  templates/index.html    kerangka halaman (HTML)
  static/css/style.css    semua tampilan (warna, ukuran, layout, hover)
  static/js/app.js        semua interaksi (login, form, kalender, dll)
  static/img/             logo.png, favicon.png
  static/sop-ppkpt.pdf    <- taruh PDF SOP resmi di sini (nama persis ini)
  .vscode/                pengaturan VS Code (tombol Run F5)
```
`speaksafe.db` (database) dan `secret.key` dibuat otomatis saat pertama dijalankan. Jangan dikirim/di-commit.

## Menjalankan di VS Code
1. Pasang Python (centang "Add Python to PATH") dan VS Code + ekstensi Python.
2. VS Code -> File -> Open Folder -> pilih folder `speaksafe` (yang langsung berisi `app.py`).
3. Terminal -> New Terminal, lalu:
   ```
   python -m venv venv
   venv\Scripts\activate
   pip install -r requirements.txt
   python app.py
   ```
   (Atau klik dua kali `setup.bat` sekali, lalu `run.bat` untuk berikutnya.)
4. Buka http://127.0.0.1:5000. Stop dengan Ctrl+C.
5. Alternatif: tekan **F5** di VS Code (konfigurasi "SpeakSafe (jalankan Flask)").

Kalau `venv\Scripts\activate` ditolak (execution policy), jalankan `Set-ExecutionPolicy -Scope Process Bypass` dulu, atau pakai Command Prompt.

## Mengedit UI/UX
- **Warna & tema:** `static/css/style.css`, bagian `:root` paling atas.
- **Tampilan/ukuran/hover:** `static/css/style.css`.
- **Teks & susunan halaman:** `templates/index.html`.
- **Perilaku (klik, form, kalender, loading):** `static/js/app.js`.
- Setelah edit, cukup refresh browser (Ctrl+F5). Perubahan `app.py` otomatis dimuat ulang kalau jalan lewat F5.
- JANGAN mengubah atau menghapus atribut `id="..."` dan `data-...` di HTML tanpa menyesuaikan `app.js`, karena JavaScript memakainya.
- Ingin melihat data database: pasang ekstensi SQLite, klik kanan `speaksafe.db` -> Open Database.

## Reset data uji
Hentikan web, hapus `speaksafe.db`, jalankan lagi (database kosong dibuat otomatis).

## Dikirim ke teman
Kirim seluruh folder sebagai satu zip, TANPA `venv/`, `speaksafe.db`, `secret.key`, dan `__pycache__/`.
