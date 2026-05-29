import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Download,
  Upload,
  Trash2,
  AlertCircle,
  Search,
  Laptop,
  Plus,
  Sliders,
  ShieldCheck,
  Radio,
  CheckCircle,
  XCircle,
  Activity,
  Languages,
  MoreVertical,
  Save,
  Edit2
} from 'lucide-react';

const SESS_KEY = 'rh-auth-session';
const URL_HTTP = "https://bot-remote-production.up.railway.app";
const URL_WS = "wss://bot-remote-production.up.railway.app";

// ====================================================================
// LOGO RH PROPER (INLINE SVG - SEUSAI GAMBAR GEOMETRIS NEON CYAN)
// ====================================================================
const LogoRH = ({ className = "w-8 h-8" }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 100 100" 
    className={className} 
    fill="none"
  >
    {/* Struktur Huruf H Geometris */}
    <path 
      d="M 51 14 V 39 H 70 V 63 H 51 V 88 M 70 51 H 92 M 92 14 V 88" 
      stroke="#00d2ff" 
      strokeWidth="6.5" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
    {/* Struktur Huruf R Lengkung & Kaki Diagonal */}
    <path 
      d="M 8 14 H 51 M 8 14 C 28 14, 45 20, 45 38 C 45 54, 28 62, 28 62 M 7 35 H 18 C 23 35, 23 49, 18 49 H 7 M 7 65 L 44 88 H 51" 
      stroke="#00d2ff" 
      strokeWidth="6.5" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
  </svg>
);

const KAMUS_BAHASA = {
  ID: {
    loading: "MEMUAT DASBOR PUSAT...",
    authTitle: "RH Remote Dashboard",
    authSub: "Masukkan kunci akses untuk masuk",
    authPlace: "Kata Sandi",
    authBtn: "Masuk Dashboard",
    subTitle: "Manajemen Jaringan Laptop Target & Kontrol Engine",
    statusWsActive: "KONEKSI AKTIF",
    statusWsClose: "TERPUTUS",
    logout: "Keluar",
    statDb: "Total Terdaftar",
    statOnline: "Laptop Online",
    statOffline: "Laptop Offline",
    statAhk: "AHK Menyala",
    formTitleAdd: "Daftarkan / Override Perangkat Manual",
    formTitleEdit: "Ubah Nilai Database Perangkat",
    formPlaceName: "Nama Laptop / Alias",
    formPlaceSerial: "Serial Number (Wajib) *",
    formPlaceModel: "Model / Seri Laptop",
    formPlaceWifi: "Nama WiFi Target",
    formPlaceIp: "Alamat IP Lokal",
    formPlaceMac: "MAC Address",
    formPlaceScript: "Nama Script AHK (Opsional)",
    formBtnSave: "Simpan Permanen",
    formBtnCancel: "Batal",
    searchPlace: "Cari berdasarkan nama, serial key, IP, atau nama WiFi...",
    btnExport: "Ekspor JSON",
    btnImport: "Impor JSON",
    emptyData: "BELUM ADA DATA DI DATABASE. HIDUPKAN CLIENT.EXE ATAU INPUT MANUAL.",
    tagOnline: "ONLINE",
    tagOffline: "STANDBY",
    tagUnsaved: "Belum Disimpan",
    btnControlOn: "AHK: NYALA 🟢",
    btnControlOff: "AHK: MATI 🔴",
    btnControlOffline: "OFFLINE 📡",
    btnEdit: "Ubah Data",
    notifWs: "Sistem telemetri aktif",
    notifAhkSend: "Sinyal kontrol dikirim ke",
    notifDbSaved: "Data terkunci ke server backend",
    notifDbDeleted: "Data dihapus dari database",
    notifExport: "Database berhasil diekspor",
    notifImport: "Impor massal sukses",
    alertSerial: "Serial Number wajib diisi!",
    btnMoreAction: "Aksi Perangkat",
    modalConfirmTitle: "Konfirmasi Tindakan",
    modalDangerTitle: "⚠️ TINDAKAN BERBAHAYA",
    modalCancel: "Batal",
    modalContinue: "Lanjutkan",
    confirmDelete1: "Hapus permanen laptop ini dari database pusat?",
    confirmDelete2: "APAKAH KAU BETUL-BETUL YAKIN? Tindakan ini akan menghapus data secara permanen dari cloud backend!"
  },
  EN: {
    loading: "BOOTING MASTER SYSTEM...",
    authTitle: "RH Remote Dashboard",
    authSub: "Enter validation key to gain access",
    authPlace: "Access Token Password",
    authBtn: "Access Dashboard",
    subTitle: "Automated Remote Hardware Synchronizer & Microengine Control",
    statusWsActive: "LIVE STREAM",
    statusWsClose: "STREAM CLOSED",
    logout: "Sign Out",
    statDb: "Total Stored",
    statOnline: "Active Nodes",
    statOffline: "Standby Nodes",
    statAhk: "Running AHK",
    formTitleAdd: "Manual Hardware Registry & Configuration Override",
    formTitleEdit: "Edit Hardware Database Baseline",
    formPlaceName: "Laptop Custom Alias",
    formPlaceSerial: "Hardware Serial Identity Key *",
    formPlaceModel: "Hardware Model",
    formPlaceWifi: "Access Point SSID",
    formPlaceIp: "Local Network IP",
    formPlaceMac: "MAC Address Frame",
    formPlaceScript: "AHK Script Name (Optional)",
    formBtnSave: "Commit to Database",
    formBtnCancel: "Cancel",
    searchPlace: "Query cluster by alias name, bios serial, IP route, or SSID...",
    btnExport: "Export Schema",
    btnImport: "Import Schema",
    emptyData: "NO TRACKED HARDWARE FOUND. RUN CLIENT.EXE OR TRANSACT MANUALLY.",
    tagOnline: "ACTIVE",
    tagOffline: "STANDBY",
    tagUnsaved: "Not Saved Yet",
    btnControlOn: "AHK: RUNNING 🟢",
    btnControlOff: "AHK: INACTIVE 🔴",
    btnControlOffline: "OFFLINE 📡",
    btnEdit: "Edit Baseline",
    notifWs: "Telemetry pipeline linked",
    notifAhkSend: "Control signal dispatched to",
    notifDbSaved: "Schema locked into cluster cloud",
    notifDbDeleted: "Record purged from database memory",
    notifExport: "Cluster data schema exported",
    notifImport: "Bulk system integration successful",
    alertSerial: "Hardware Serial Identifier is required!",
    btnMoreAction: "Node Actions",
    modalConfirmTitle: "Action Confirmation",
    modalDangerTitle: "⚠️ CRITICAL DESTRUCTION WORKFLOW",
    modalCancel: "Cancel",
    modalContinue: "Proceed",
    confirmDelete1: "Permanently clear this hardware entry from remote master cloud?",
    confirmDelete2: "ARE YOU ABSOLUTELY SURE? This action purges structural records irreversibly from cloud database!"
  }
};

export default function App() {
  const [bahasa, setBahasa] = useState('EN');
  const teks = KAMUS_BAHASA[bahasa];

  const [sudahLogin, setSudahLogin] = useState(false);
  const [cekSesiSelesai, setCekSesiSelesai] = useState(false);
  const [inputPassword, setInputPassword] = useState('');

  const [perangkatDatabase, setPerangkatDatabase] = useState([]);
  const [perangkatOnlineLive, setPerangkatOnlineLive] = useState([]);

  const [kataKunciCari, setKataKunciCari] = useState('');
  const [wsTerhubung, setWsTerhubung] = useState(false);
  const [notifikasi, setNotifikasi] = useState(null);

  const [namaScriptInput, setNamaScriptInput] = useState({});
  const [activeDropdown, setActiveDropdown] = useState(null);

  const [modalConfig, setModalConfig] = useState({
    isOpen: false,
    title: '',
    message: '',
    isDanger: false,
    onConfirm: null
  });

  const [dataForm, setDataForm] = useState({
    name: '', serial: '', model: '', wifi: '', ip: '', mac: ''
  });
  const [idSedangDiedit, setIdSedangDiedit] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const tokenOtorisasi = localStorage.getItem(SESS_KEY) || sessionStorage.getItem(SESS_KEY);
    if (tokenOtorisasi) setSudahLogin(true);
    setCekSesiSelesai(true);
  }, []);

  useEffect(() => {
    const closeAllDropdowns = () => setActiveDropdown(null);
    window.addEventListener('click', closeAllDropdowns);
    return () => window.removeEventListener('click', closeAllDropdowns);
  }, []);

  const muatDataDariDatabase = async () => {
    try {
      const respon = await fetch(`${URL_HTTP}/api/devices`);
      if (respon.ok) {
        const hasil = await respon.json();
        setPerangkatDatabase(Array.isArray(hasil) ? hasil : hasil.devices || []);
      }
    } catch (err) {
      console.error("Database connection synchronization failure:", err);
    }
  };

  useEffect(() => {
    if (!sudahLogin) return;
    muatDataDariDatabase();
    const intervalDinamis = setInterval(muatDataDariDatabase, 5000);
    return () => clearInterval(intervalDinamis);
  }, [sudahLogin]);

  useEffect(() => {
    if (!sudahLogin) return;

    let socket;
    let timAsinkron;

    const hubungkanKoneksiSinyal = () => {
      socket = new WebSocket(URL_WS);

      socket.onopen = () => {
        setWsTerhubung(true);
        tampilkanNotifikasi(teks.notifWs);
      };

      socket.onmessage = (acara) => {
        try {
          const dataMasuk = JSON.parse(acara.data);
          if (dataMasuk.type === 'device_list' || dataMasuk.devices) {
            setPerangkatOnlineLive(dataMasuk.devices || []);
          }
        } catch (galat) {
          console.error('Failed to parse network signaling packet:', galat);
        }
      };

      socket.onclose = () => {
        setWsTerhubung(false);
        timAsinkron = setTimeout(hubungkanKoneksiSinyal, 5000);
      };

      socket.onerror = () => {
        socket.close();
      };
    };

    hubungkanKoneksiSinyal();
    return () => {
      if (socket) socket.close();
      clearTimeout(timAsinkron);
    };
  }, [sudahLogin, bahasa]);

  const tampilkanNotifikasi = (pesan) => {
    setNotifikasi(pesan);
    setTimeout(() => setNotifikasi(null), 3000);
  };

  const triggerCustomConfirm = (title, message, isDanger, onConfirmBlock) => {
    setModalConfig({
      isOpen: true,
      title,
      message,
      isDanger,
      onConfirm: () => {
        onConfirmBlock();
        setModalConfig(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const masterDaftarPerangkat = useMemo(() => {
    const daftarHasilGabung = [];
    const petaOnline = new Map();

    perangkatOnlineLive.forEach((live) => {
      if (!live || !live.id) return;
      petaOnline.set(live.id.trim().toLowerCase(), live);
    });

    const serialTerprosesDariDb = new Set();

    perangkatDatabase.forEach(perangkat => {
      if (!perangkat || !perangkat.serial) return;
      const kunciSerial = perangkat.serial.trim().toLowerCase();
      serialTerprosesDariDb.add(kunciSerial);

      const dataSinyalLive = petaOnline.get(kunciSerial);
      const statusAktif = petaOnline.has(kunciSerial);

      daftarHasilGabung.push({
        ...perangkat,
        isOnline: statusAktif,
        ahkEnabled: dataSinyalLive ? (dataSinyalLive.ahkEnabled || false) : (perangkat.ahkEnabled || false),
        ip: dataSinyalLive?.info?.ip || perangkat.ip || '-',
        mac: dataSinyalLive?.info?.mac || perangkat.mac || '-',
        wifi: dataSinyalLive?.info?.wifi || perangkat.wifi || '-',
        model: dataSinyalLive?.info?.model || perangkat.model || '-',
        name: perangkat.name || dataSinyalLive?.info?.hostname || 'Laptop Target',
        terbacaOtomatisBelumDisimpan: false
      });
    });

    perangkatOnlineLive.forEach((live) => {
      if (!live || !live.id) return;
      const kunciLiveSerial = live.id.trim().toLowerCase();

      if (!serialTerprosesDariDb.has(kunciLiveSerial)) {
        daftarHasilGabung.push({
          id: `auto-${live.id}`,
          name: live.info?.hostname || 'New Client Node',
          serial: live.id.trim(),
          model: live.info?.model || 'Windows Client',
          wifi: live.info?.wifi || '-',
          ip: live.info?.ip || '-',
          mac: live.info?.mac || '-',
          isOnline: true,
          ahkEnabled: live.ahkEnabled || false,
          terbacaOtomatisBelumDisimpan: true
        });
      }
    });

    return daftarHasilGabung;
  }, [perangkatDatabase, perangkatOnlineLive]);

  const panelStatistik = useMemo(() => {
    const total = masterDaftarPerangkat.length;
    const online = masterDaftarPerangkat.filter(p => p.isOnline).length;
    const offline = total - online;
    const ahkAktif = masterDaftarPerangkat.filter(p => p.isOnline && p.ahkEnabled).length;
    return { total, online, offline, ahkAktif };
  }, [masterDaftarPerangkat]);

  const ubahStatusAhk = async (perangkat) => {
    try {
      const aksiPerintah = perangkat.ahkEnabled ? 'stop_ahk' : 'start_ahk';
      const scriptSpesifik = namaScriptInput[perangkat.serial] || "";

      const respon = await fetch(`${URL_HTTP}/api/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: perangkat.serial,
          command: aksiPerintah,
          scriptName: scriptSpesifik
        }),
      });
      if (respon.ok) {
        tampilkanNotifikasi(`${teks.notifAhkSend} ${perangkat.name} ${scriptSpesifik ? `(${scriptSpesifik})` : ''}`);
        muatDataDariDatabase();
      }
    } catch (k) {
      console.error('Execution signal failed', k);
    }
  };

  const simpanKeDatabasePusat = async (dataTarget) => {
    const payload = dataTarget?.serial ? dataTarget : dataForm;

    if (!payload.serial) {
      tampilkanNotifikasi(teks.alertSerial);
      return;
    }
    try {
      const targetIdRoute = idSedangDiedit ? idSedangDiedit : payload.serial.toString().trim();
      const jalurUrl = `${URL_HTTP}/api/devices/${targetIdRoute}`;

      const hasilKirim = await fetch(jalurUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: targetIdRoute,
          serial: payload.serial,
          name: payload.name || 'Laptop Stored',
          model: payload.model || '-',
          wifi: payload.wifi || '-',
          ip: payload.ip || '-',
          mac: payload.mac || '-'
        })
      });

      if (hasilKirim.ok) {
        tampilkanNotifikasi(teks.notifDbSaved);
        setDataForm({ name: '', serial: '', model: '', wifi: '', ip: '', mac: '' });
        setIdSedangDiedit(null);
        muatDataDariDatabase();
      } else {
        tampilkanNotifikasi('Gagal mengamankan entri data ke cloud server.');
      }
    } catch (e) {
      tampilkanNotifikasi('Database transaction failure');
    }
  };

  const hapusPerangkatPermanen = (serialTarget) => {
    triggerCustomConfirm(teks.modalConfirmTitle, teks.confirmDelete1, false, () => {
      setTimeout(() => {
        triggerCustomConfirm(teks.modalDangerTitle, teks.confirmDelete2, true, async () => {
          try {
            const hapus = await fetch(`${URL_HTTP}/api/devices/${serialTarget}`, {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' }
            });
            if (hapus.ok) {
              tampilkanNotifikasi(teks.notifDbDeleted);
              muatDataDariDatabase();
            } else {
              tampilkanNotifikasi('Gagal membersihkan data baseline dari server.');
            }
          } catch (g) {
            tampilkanNotifikasi('Purge failure');
          }
        });
      }, 400);
    });
  };

  const eksekusiLoginAPI = async () => {
    try {
      const kirim = await fetch(`${URL_HTTP}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: inputPassword })
      });
      const data = await kirim.json();

      if (kirim.ok && data.success) {
        sessionStorage.setItem(SESS_KEY, data.token);
        localStorage.setItem(SESS_KEY, data.token);
        setSudahLogin(true);
      } else {
        tampilkanNotifikasi(data.message || 'Access Refused');
      }
    } catch (error) {
      tampilkanNotifikasi('Gagal terkoneksi ke server.');
    }
  };

  const lakukanEksporData = () => {
    const stringData = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(perangkatDatabase, null, 2));
    const tautanUnduh = document.createElement('a');
    tautanUnduh.setAttribute("href", stringData);
    tautanUnduh.setAttribute("download", `RH_Database_Backup.json`);
    document.body.appendChild(tautanUnduh);
    tautanUnduh.click();
    tautanUnduh.remove();
    tampilkanNotifikasi(teks.notifExport);
  };

  const lakukanImporData = (elemen) => {
    const pembacaBerkas = new FileReader();
    if (!elemen.target.files[0]) return;

    pembacaBerkas.readAsText(elemen.target.files[0], "UTF-8");
    pembacaBerkas.onload = async (peristiwa) => {
      try {
        const dataUrai = JSON.parse(peristiwa.target.result);
        if (!Array.isArray(dataUrai)) return;

        for (const item of dataUrai) {
          if (item.serial || item.id) {
            const targetKey = item.serial || item.id;
            await fetch(`${URL_HTTP}/api/devices/${targetKey}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(item)
            });
          }
        }
        tampilkanNotifikasi(teks.notifImport);
        muatDataDariDatabase();
      } catch (er) {
        console.error(er);
      }
    };
  };

  const daftarHasilPencarian = masterDaftarPerangkat.filter(p =>
    Object.values(p).join(' ').toLowerCase().includes(kataKunciCari.toLowerCase())
  );

  if (!cekSesiSelesai) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-300 gap-4 font-mono">
        <Activity className="w-8 h-8 text-indigo-500 animate-spin" />
        <p className="text-xs tracking-widest animate-pulse">{teks.loading}</p>
      </div>
    );
  }

  if (!sudahLogin) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute top-4 right-4 z-50">
          <button
            onClick={() => setBahasa(bahasa === "ID" ? "EN" : "ID")}
            className="flex items-center gap-1.5 px-3 py-1.5
             bg-slate-900 border border-slate-800 rounded-xl
             text-xs font-bold text-indigo-400 hover:bg-slate-800
             transition shadow-md"
          >
            {bahasa === "ID" ? (
              <>
                <img
                  src="https://flagcdn.com/id.svg"
                  alt="Indonesia"
                  className="w-5 h-3 object-cover rounded-sm shadow-sm inline-block"
                />
                <span className="uppercase">ID</span>
              </>
            ) : (
              <>
                <img
                  src="https://flagcdn.com/us.svg"
                  alt="English"
                  className="w-5 h-3 object-cover rounded-sm shadow-sm inline-block"
                />
                <span className="uppercase">ENG</span>
              </>
            )}
          </button>
        </div>
        
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.08),transparent_60%)]" />
        
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl w-full max-w-md space-y-6 shadow-2xl relative z-10 backdrop-blur-sm">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-slate-950 rounded-2xl flex items-center justify-center mx-auto border border-slate-800 shadow-inner p-2.5">
              <LogoRH className="w-full h-full" />
            </div>
            <div className="space-y-1">
              <h1 className="text-xl font-black text-white tracking-tight uppercase">{teks.authTitle}</h1>
              <p className="text-xs text-slate-400">{teks.authSub}</p>
            </div>
          </div>

          <div className="space-y-3">
            <input
              type="password"
              value={inputPassword}
              onChange={(e) => setInputPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && eksekusiLoginAPI()}
              placeholder={teks.authPlace}
              className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white text-center text-sm focus:outline-none focus:border-indigo-500 font-mono transition"
            />
            <button
              onClick={eksekusiLoginAPI}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl text-xs tracking-wider uppercase transition-all"
            >
              {teks.authBtn}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased">
      <header className="bg-slate-900/80 border-b border-slate-800/80 sticky top-0 backdrop-blur-md z-40 px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-950 rounded-xl flex items-center justify-center border border-slate-800 p-1.5 shadow-md">
            <LogoRH className="w-full h-full" />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
              RH Control Panel <span className="text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono px-1.5 py-0.5 rounded">v5.0</span>
            </h1>
            <p className="text-xs text-slate-400 font-medium">{teks.subTitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap justify-end">
          <button
            onClick={() => setBahasa(bahasa === "ID" ? "EN" : "ID")}
            className="flex items-center gap-1.5 px-3 py-1.5
             bg-slate-800 hover:bg-slate-700 border border-slate-700
             text-xs font-bold rounded-xl text-indigo-400 transition shadow-sm"
          >
            {bahasa === "ID" ? (
              <>
                <img
                  src="https://flagcdn.com/id.svg"
                  alt="Indonesia"
                  className="w-5 h-3 object-cover rounded-sm shadow-sm inline-block"
                />
                <span className="uppercase">ID</span>
              </>
            ) : (
              <>
                <img
                  src="https://flagcdn.com/us.svg"
                  alt="English"
                  className="w-5 h-3 object-cover rounded-sm shadow-sm inline-block"
                />
                <span className="uppercase">ENG</span>
              </>
            )}
          </button>

          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold font-mono border ${wsTerhubung ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/5 border-rose-500/20 text-rose-400'}`}>
            <Radio className={`w-3.5 h-3.5 ${wsTerhubung ? 'animate-pulse' : ''}`} />
            {wsTerhubung ? teks.statusWsActive : teks.statusWsClose}
          </div>

          <button
            onClick={() => { localStorage.removeItem(SESS_KEY); sessionStorage.removeItem(SESS_KEY); setSudahLogin(false); }}
            className="px-3 py-1.5 bg-slate-800 hover:bg-rose-950 text-slate-300 hover:text-rose-400 border border-slate-700 hover:border-rose-900 rounded-xl text-xs font-bold transition"
          >
            {teks.logout}
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl relative overflow-hidden">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{teks.statDb}</p>
            <p className="text-3xl font-black text-white mt-2 font-mono">{panelStatistik.total}</p>
            <div className="absolute right-3 bottom-3 text-slate-800 font-black text-4xl select-none pointer-events-none">DB</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl relative overflow-hidden">
            <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" /> {teks.statOnline}
            </p>
            <p className="text-3xl font-black text-white mt-2 font-mono">{panelStatistik.online}</p>
            <div className="absolute right-3 bottom-3 text-emerald-500/5"><CheckCircle className="w-12 h-12" /></div>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl relative overflow-hidden">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{teks.statOffline}</p>
            <p className="text-3xl font-black text-slate-400 mt-2 font-mono">{panelStatistik.offline}</p>
            <div className="absolute right-3 bottom-3 text-rose-500/5"><XCircle className="w-12 h-12" /></div>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl relative overflow-hidden">
            <p className="text-xs font-bold text-indigo-400 uppercase tracking-wider">{teks.statAhk}</p>
            <p className="text-3xl font-black text-indigo-400 mt-2 font-mono">{panelStatistik.ahkAktif}</p>
            <div className="absolute right-3 bottom-3 text-indigo-500/10 text-4xl">⚙️</div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-4">
          <h2 className="text-xs font-black uppercase text-slate-300 tracking-widest flex items-center gap-2">
            <Plus className="w-4 h-4 text-indigo-500" /> {idSedangDiedit ? teks.formTitleEdit : teks.formTitleAdd}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: teks.formPlaceName, key: 'name' },
              { label: teks.formPlaceSerial, key: 'serial' },
              { label: teks.formPlaceModel, key: 'model' },
              { label: teks.formPlaceWifi, key: 'wifi' },
              { label: teks.formPlaceIp, key: 'ip' },
              { label: teks.formPlaceMac, key: 'mac' }
            ].map((kolom) => (
              <input
                key={kolom.key}
                type="text"
                value={dataForm[kolom.key]}
                disabled={idSedangDiedit && kolom.key === 'serial'}
                onChange={(e) => setDataForm({ ...dataForm, [kolom.key]: e.target.value })}
                placeholder={kolom.label}
                className={`bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 transition ${idSedangDiedit && kolom.key === 'serial' ? 'opacity-50 cursor-not-allowed' : ''}`}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={() => simpanKeDatabasePusat(null)} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all">
              {teks.formBtnSave}
            </button>
            {idSedangDiedit && (
              <button onClick={() => { setIdSedangDiedit(null); setDataForm({ name: '', serial: '', model: '', wifi: '', ip: '', mac: '' }); }} className="px-4 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold">{teks.formBtnCancel}</button>
            )}
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="relative w-full md:flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder={teks.searchPlace}
              value={kataKunciCari}
              onChange={(e) => setKataKunciCari(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-2xl text-xs text-white focus:outline-none font-medium"
            />
          </div>
          <div className="flex gap-2 w-full md:w-auto justify-end">
            <button onClick={lakukanEksporData} className="flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-bold text-slate-300 hover:bg-slate-800 transition">
              <Download className="w-3.5 h-3.5 text-indigo-400" /> {teks.btnExport}
            </button>
            <label className="flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-bold text-slate-300 hover:bg-slate-800 transition cursor-pointer">
              <Upload className="w-3.5 h-3.5 text-emerald-400" /> {teks.btnImport}
              <input type="file" accept=".json" ref={fileInputRef} onChange={lakukanImporData} className="hidden" />
            </label>
          </div>
        </div>

        <div className="space-y-3">
          {daftarHasilPencarian.length === 0 ? (
            <div className="bg-slate-900 border border-dashed border-slate-800 rounded-2xl text-center py-12 text-slate-500 text-xs font-mono">
              <AlertCircle className="w-6 h-6 mx-auto mb-2 text-slate-700" />
              {teks.emptyData}
            </div>
          ) : (
            daftarHasilPencarian.map((perangkat) => (
              <div
                key={perangkat.serial}
                className={`bg-slate-900 border rounded-2xl p-4 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 transition-all ${perangkat.terbacaOtomatisBelumDisimpan
                  ? 'border-cyan-500 bg-gradient-to-r from-cyan-950/20 to-transparent'
                  : 'border-slate-800/80'
                  }`}
              >
                <div className="flex items-start gap-3 flex-1 w-full">
                  <div className={`p-3 rounded-xl border ${perangkat.isOnline ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400' : 'bg-slate-950 border-slate-800 text-slate-600'}`}>
                    <Laptop className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold text-sm text-white tracking-tight">{perangkat.name}</h4>
                      <span className={`text-[9px] font-black font-mono px-2 py-0.5 rounded-full border tracking-wider ${perangkat.isOnline
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                        : 'bg-slate-950 border-slate-800 text-slate-500'
                        }`}>
                        {perangkat.isOnline ? teks.tagOnline : teks.tagOffline}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 font-mono mt-1">Serial: {perangkat.serial}</p>
                    <p className="text-xs text-slate-500 mt-0.5">WiFi: {perangkat.wifi} | IP: {perangkat.ip}</p>

                    {perangkat.isOnline && (
                      <div className="mt-2 max-w-xs">
                        <input
                          type="text"
                          placeholder={teks.formPlaceScript}
                          value={namaScriptInput[perangkat.serial] || ""}
                          onChange={(e) => setNamaScriptInput({
                            ...namaScriptInput,
                            [perangkat.serial]: e.target.value
                          })}
                          className="w-full px-2 py-1 bg-slate-950 border border-slate-800 rounded-lg text-[11px] text-white focus:outline-none focus:border-indigo-500 font-mono transition"
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full lg:w-auto justify-end relative">
                  <button
                    onClick={() => ubahStatusAhk(perangkat)}
                    disabled={!perangkat.isOnline}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${!perangkat.isOnline
                      ? 'bg-slate-950 border border-slate-800 text-slate-600 cursor-not-allowed'
                      : perangkat.ahkEnabled
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                        : 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20'
                      }`}
                  >
                    {!perangkat.isOnline ? teks.btnControlOffline : perangkat.ahkEnabled ? teks.btnControlOn : teks.btnControlOff}
                  </button>

                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveDropdown(activeDropdown === perangkat.serial ? null : perangkat.serial);
                      }}
                      className="p-2 bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 rounded-xl transition"
                      title={teks.btnMoreAction}
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {activeDropdown === perangkat.serial && (
                      <div className="absolute right-0 mt-2 w-44 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-100">
                        <button
                          onClick={() => {
                            simpanKeDatabasePusat(perangkat);
                            setActiveDropdown(null);
                          }}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 transition text-left"
                        >
                          <Save className="w-3.5 h-3.5 text-indigo-400" />
                          {teks.formBtnSave}
                        </button>

                        <button
                          onClick={() => {
                            setIdSedangDiedit(perangkat.serial);
                            setDataForm({
                              name: perangkat.name,
                              serial: perangkat.serial,
                              model: perangkat.model,
                              wifi: perangkat.wifi,
                              ip: perangkat.ip,
                              mac: perangkat.mac
                            });
                            setActiveDropdown(null);
                            window.scrollTo({ top: 120, behavior: 'smooth' });
                          }}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 transition text-left border-t border-slate-800/60"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-cyan-400" />
                          {teks.btnEdit}
                        </button>

                        <button
                          onClick={() => {
                            hapusPerangkatPermanen(perangkat.serial);
                            setActiveDropdown(null);
                          }}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold text-rose-400 hover:bg-rose-950/40 transition text-left border-t border-slate-800/60"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          {teks.logout === "Keluar" ? "Hapus Permanen" : "Purge Database"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      {modalConfig.isOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 max-w-sm w-full rounded-2xl p-6 shadow-2xl relative space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl ${modalConfig.isDanger ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'}`}>
                <AlertCircle className="w-5 h-5" />
              </div>
              <h3 className={`text-sm font-black tracking-tight uppercase ${modalConfig.isDanger ? 'text-rose-400' : 'text-white'}`}>
                {modalConfig.title}
              </h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed font-medium">
              {modalConfig.message}
            </p>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2 rounded-xl text-xs transition"
              >
                {teks.modalCancel}
              </button>
              <button
                onClick={modalConfig.onConfirm}
                className={`flex-1 font-bold py-2 rounded-xl text-xs text-white transition ${modalConfig.isDanger ? 'bg-rose-600 hover:bg-rose-500' : 'bg-indigo-600 hover:bg-indigo-500'}`}
              >
                {teks.modalContinue}
              </button>
            </div>
          </div>
        </div>
      )}

      {notifikasi && (
        <div className="fixed bottom-4 right-4 bg-indigo-600 text-white font-mono text-xs font-bold px-4 py-3 rounded-xl shadow-2xl z-50 border border-indigo-500 animate-bounce">
          {notifikasi}
        </div>
      )}
    </div>
  );
}