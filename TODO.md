# Kayu Ping

Kayu ping adalah aplikasi pencatatan keuangan sederhana untuk bisnis kayu yang
mudah dioperasikan dan dipakai di lapangan

## Teknologi

- react native
- expo
- expo router
- expo sqlite
- drizzle orm

## Tema

- primary: "#319119ff",
- text: "#1C1C1E",
- border: "#D1D1D6",
- secondary: "#F2F2F7",
- background: "#FEFEFE",
- danger: "#FF3B30",

## Skema Data

### Contact

- id - **int (PK)**
- name - **varchar**
- phone_number - **varchar**
- category - **varchar**
  //ket: supplier, langganan, supir, lainnya
- notes - **varchar (nullable)**
- created at - **datetime (default current)**

## List Halaman

### Halaman Utama

#### Layar depan

- Sebuah judul dan logo KayuPing di atas
- Berisi empat button border. Yaitu Kontak, Transaksi, Laporan, dan Pengaturan, disusun dalam bentuk grid 2x2 dilengkapi Icon

### Halaman Kontak

#### Layar List Kontak

- di navigation bar terdapat tombol back dan judul "Kontak"
- menampilkan list kontak item secara infinite scroll
- di setiap card kontak, tampilkan empat item. Di kanan ada Inisial berbentuk avatar (dua kata pertama). Di sebelahnya letakkan kolom vertical berisi nama, nomor telepon (light text), dan badge (kategori kontak)
- pada setiap card, jika di klik akan mengarah ke halaman "Detail Kontak"
- jika belum ada list kontak, tampilkan keterangan "belum ada kontak" di tengah layar dan button "Tambah Kontak" menuju "Layar tambah Kontak"
- di bawah kanan terdapat floating button berwarna primary berisi logo plus, jika di klik akan mengarah ke "layar Tambah Kontak"

#### Layar Tambah Kontak

- di navigation bar terdapat tombol back dan judul "Tambah Kontak"
- di tengah terdapat input form atas bawah. Yang pertama adalah "Nama" berupa teks, yang kedua adalah "Nomor Telepon" berupa teks (harus no telp valid), dan yang ketiga adalah "Kategori" dropdown berisi tiga item: supplier, langganan, supir, lainnya, yang keempat adalah "Catatan" berupa teksarea yang bersifat opsional.
- Di bawahnya terdapat button "Simpan" berwarna primary, yang jika di klik akan menambah data kontak baru ke dalam database dan muncul toast bila success/error.

#### Layar Detail Kontak

- Pada bagian tengah tunjukkan avatar berupa inisial (dua kata pertama) besar, kemudian disusul nama (bold), nomor telepon di bawahnya, kategori (badge),
