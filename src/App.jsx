import DesktopPanel from './DesktopPanel';
import HelpButton from './HelpButton';
import { normalizeBackend, selectBackend, readApiJson, discoverBackend } from './backend-url.js';
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
let URL_HTTP = selectBackend(window.location.origin, localStorage.getItem('rh-backend-url'), import.meta.env.VITE_API_URL);
const authHeaders = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem(SESS_KEY) || sessionStorage.getItem(SESS_KEY) || ''}` });
let URL_WS = URL_HTTP.replace(/^http/, "ws");

// ====================================================================
// LOGO RH (MENGGUNAKAN DIRECT LINK GAMBAR GOOGLE DRIVE - PADAT & FULL)
// ====================================================================
const URL_LOGO_DRIVE = "https://lh3.googleusercontent.com/d/1u8FZ2SMV2oqVXZ2No8A7PiAHNWPhLMdt";

const LogoRH = ({ className = "w-8 h-8" }) => (
  <img 
    src={URL_LOGO_DRIVE} 
    alt="RH Logo" 
    className={`${className} object-cover scale-110 transform transition-transform`}
    onError={(e) => {
      console.error("Gagal memuat logo dari Google Drive.");
    }}
  />
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
  const [desktopDevice, setDesktopDevice] = useState(null);
  const [bahasa, setBahasa] = useState('ID');
  const teks = KAMUS_BAHASA[bahasa];

  const [sudahLogin, setSudahLogin] = useState(false);
  const [cekSesiSelesai, setCekSesiSelesai] = useState(false);
  const [inputPassword, setInputPassword] = useState('');
  const [inputUsername, setInputUsername] = useState('');
  const [systemPending, setSystemPending] = useState(null);
  const [systemMessage, setSystemMessage] = useState(null);
  const backendNeedsSetup = URL_HTTP === window.location.origin && window.location.hostname.endsWith('.vercel.app');
  const [backendInput, setBackendInput] = useState(backendNeedsSetup ? '' : URL_HTTP);
  const [loginPending, setLoginPending] = useState(false);
  const [automaticConnection, setAutomaticConnection] = useState(true);
  const [backendAddress, setBackendAddress] = useState(URL_HTTP);

  const [perangkatDatabase, setPerangkatDatabase] = useState([]);
  const [perangkatOnlineLive, setPerangkatOnlineLive] = useState([]);

  const [kataKunciCari, setKataKunciCari] = useState('');
  const [wsTerhubung, setWsTerhubung] = useState(false);
  const [notifikasi, setNotifikasi] = useState(null);

  const [ahkPending, setAhkPending] = useState(null);
  const [ahkCommandError, setAhkCommandError] = useState(null);
  const [backendError, setBackendError] = useState(null);
  const [storageStatus, setStorageStatus] = useState(null);
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
    if (tokenOtorisasi && !backendNeedsSetup) setSudahLogin(true);
    setCekSesiSelesai(true);
  }, []);

  useEffect(() => {
    const closeAllDropdowns = () => setActiveDropdown(null);
    window.addEventListener('click', closeAllDropdowns);
    return () => window.removeEventListener('click', closeAllDropdowns);
  }, []);

  const refreshSharedConnection = async () => {
    if(!automaticConnection)return URL_HTTP;
    const selected=await discoverBackend({origin:window.location.origin,saved:localStorage.getItem('rh-backend-url')});
    URL_HTTP=selected;URL_WS=selected.replace(/^http/,'ws');
    setBackendInput(selected);setBackendAddress(selected);localStorage.setItem('rh-backend-url',selected);
    return selected;
  };

  const muatDataDariDatabase = async () => {
    try {
      const respon = await fetch(`${URL_HTTP}/api/devices`, {headers: authHeaders(), signal:AbortSignal.timeout(10000)});
      if (respon.status === 401) {
        localStorage.removeItem(SESS_KEY); sessionStorage.removeItem(SESS_KEY); setSudahLogin(false); return;
      }
      if (respon.ok) {
        const hasil = await readApiJson(respon);
        setStorageStatus(hasil.storage || null);
        setPerangkatDatabase(Array.isArray(hasil) ? hasil : hasil.devices || []);
        // A successful authenticated poll is also a fresh device snapshot.
        // Recover after a transient HTTP error even if WS has no new events.
        setPerangkatOnlineLive(Array.isArray(hasil) ? hasil : hasil.devices || []);
        setBackendError(null);
      } else {
        throw new Error(`Backend gagal merespons (HTTP ${respon.status}).`);
      }
    } catch (err) {
      console.error("Database connection synchronization failure:", err);
      setPerangkatOnlineLive([]);
      setBackendError(err.message);
      refreshSharedConnection().catch(()=>{});
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
    let disposed = false;

    const hubungkanKoneksiSinyal = () => {
      socket = new WebSocket(URL_WS);

      socket.onopen = () => {
        socket.send(JSON.stringify({type: "dashboard_auth", token: localStorage.getItem(SESS_KEY) || sessionStorage.getItem(SESS_KEY)}));
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
        setPerangkatOnlineLive([]);
        setBackendError('Koneksi agent terputus. Status perangkat belum terkonfirmasi. Gunakan alamat terbaru dalam Backend-URL.txt; jika web tidak terjangkau, jalankan Nonaktifkan-Blokir.cmd di laptop.');
        if (!disposed) timAsinkron = setTimeout(hubungkanKoneksiSinyal, 5000);
      };

      socket.onerror = () => {
        socket.close();
      };
    };

    hubungkanKoneksiSinyal();
    return () => {
      disposed = true;
      if (socket) socket.close();
      clearTimeout(timAsinkron);
    };
  }, [sudahLogin, bahasa, backendAddress]);

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
      const statusAktif = dataSinyalLive?.status === "Online";

      daftarHasilGabung.push({
        ...perangkat,
        isOnline: statusAktif,
        desktopEnabled: dataSinyalLive?.desktopEnabled === true,
        systemEnabled: dataSinyalLive?.systemEnabled === true,
        shutdownAt: dataSinyalLive?.shutdownAt || 0,
        shutdownError: dataSinyalLive?.shutdownError || "",
        shutdownAllowed: dataSinyalLive?.shutdownAllowed === true,
        shutdownPermissionKnown: dataSinyalLive?.shutdownPermissionKnown === true,
        shutdownPermissionError: dataSinyalLive?.shutdownPermissionError || "",
        ahkKnown: dataSinyalLive?.ahkKnown === true,
        ahkBlocked: dataSinyalLive?.ahkBlocked === true,
        ahkPolicySupported: dataSinyalLive?.ahkPolicySupported === true,
        ahkError: dataSinyalLive?.ahkError || "",
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
          isOnline: live.status === "Online",
          ahkEnabled: live.ahkEnabled || false,
          ahkKnown: live.ahkKnown === true,
          systemEnabled: live.systemEnabled === true,
          shutdownAt: live.shutdownAt || 0,
          shutdownError: live.shutdownError || "",
          shutdownAllowed: live.shutdownAllowed === true,
          shutdownPermissionKnown: live.shutdownPermissionKnown === true,
          shutdownPermissionError: live.shutdownPermissionError || "",
          ahkError: live.ahkError || "",
          ahkBlocked: live.ahkBlocked === true,
          ahkPolicySupported: live.ahkPolicySupported === true,
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

  const ubahStatusAhk = async (perangkat, requestedCommand) => {
    if (ahkPending) return;
    if (!wsTerhubung || !perangkat.isOnline) {
      setAhkCommandError({id:perangkat.serial,message:'Laptop belum tersambung. Perintah belum dikirim.'});
      return;
    }
    setAhkPending(perangkat.serial); setAhkCommandError(null);
    try {
      const aksiPerintah = requestedCommand || 'stop_ahk';

      const respon = await fetch(`${URL_HTTP}/api/command`, {
        method: 'POST',
        signal: AbortSignal.timeout(20000),
        headers: authHeaders(),
        body: JSON.stringify({
          deviceId: perangkat.serial,
          command: aksiPerintah
        }),
      });
      const result = await readApiJson(respon);
      if (!respon.ok) throw new Error(result.error || 'Perintah gagal');
      tampilkanNotifikasi(aksiPerintah === 'unblock_ahk' ? 'Blokir dinonaktifkan. AHK dapat dibuka manual.' : result.ahkBlocked ? 'Blokir AHK aktif pada agent laptop.' : 'AutoHotkey terkonfirmasi berhenti');
      muatDataDariDatabase();
    } catch (k) {
      setAhkCommandError({id:perangkat.serial,message:k.message});
    } finally {setAhkPending(null);}
  };

  const sendSystemAction = async (device, action) => {
    setSystemPending(device.serial); setSystemMessage(null);
    try {
      const response=await fetch(`${URL_HTTP}/api/system/${encodeURIComponent(device.serial)}`,{method:'POST',headers:authHeaders(),signal:AbortSignal.timeout(20000),body:JSON.stringify({action,confirmed:true})});
      const result=await readApiJson(response);
      if(!response.ok)throw Error(result.error || 'Aksi sistem gagal');
      setSystemMessage(result.status==='scheduled' ? 'Shutdown dijadwalkan dalam 10 detik. Gunakan Batalkan shutdown untuk membatalkan.' : result.status==='cancelled' ? 'Shutdown dibatalkan.' : `Permintaan tutup dikirim ke ${result.requested} jendela; ${result.failed} gagal. Aplikasi dapat meminta simpan dokumen.`);
      await muatDataDariDatabase();
    } catch(error) {setSystemMessage(error.message);}
    finally {setSystemPending(null);}
  };
  const confirmSystemAction = (device,action) => {
    if(action==='cancel_shutdown') {sendSystemAction(device,action);return;}
    triggerCustomConfirm(action==='shutdown' ? 'Matikan laptop ini?' : 'Tutup jendela aplikasi?',action==='shutdown' ? 'Laptop akan dimatikan dalam 10 detik setelah agent menerima perintah. Simpan pekerjaanmu. Kamu bisa memilih Batalkan shutdown selama hitung mundur. Aplikasi yang belum menyimpan data dapat menahan shutdown.' : 'Meminta jendela aplikasi di laptop ini menutup secara normal. Aplikasi dapat meminta simpan dokumen. Jendela agent dan terminal dipertahankan.',true,()=>sendSystemAction(device,action));
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
        headers: authHeaders(),
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
              headers: authHeaders()
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
    if (loginPending) return;
    setLoginPending(true);
    try {
      const selectedBackend = automaticConnection ? await refreshSharedConnection() : normalizeBackend(backendInput);
      if (selectedBackend !== URL_HTTP) {
        localStorage.removeItem(SESS_KEY); sessionStorage.removeItem(SESS_KEY);
      }
      URL_HTTP = selectedBackend;
      setBackendAddress(selectedBackend);
      URL_WS = selectedBackend.replace(/^http/, 'ws');
      localStorage.setItem('rh-backend-url', selectedBackend);
      setBackendInput(selectedBackend);
      setNotifikasi(null);
      const kirim = await fetch(`${selectedBackend}/api/login`, {
        method: 'POST', signal: AbortSignal.timeout(15000),
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username:inputUsername.trim(), password: inputPassword })
      });
      if (kirim.status === 405) throw new Error('Alamat ini hanya frontend. Isi Alamat backend laptop dengan alamat tunnel HTTPS laptop.');
      if (!kirim.headers.get('content-type')?.includes('application/json')) throw new Error(`Server mengembalikan HTTP ${kirim.status}, bukan layanan login Bot-Remote.`);
      const data = await kirim.json();

      if (kirim.ok && data.success) {
        sessionStorage.setItem(SESS_KEY, data.token);
        localStorage.setItem(SESS_KEY, data.token);
        setSudahLogin(true);
      } else {
        setNotifikasi(data.message || data.error || `Login ditolak (HTTP ${kirim.status})`);
      }
    } catch (error) {
      setNotifikasi(error.message === 'Failed to fetch' ? 'Server tidak terjangkau. Periksa alamat backend dan pastikan laptop aktif.' : error.message);
    } finally { setLoginPending(false); }
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
              headers: authHeaders(),
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
          <button title="Mengganti bahasa tampilan."
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
            {/* Box Wadah Logo RH yang dibuat overflow-hidden agar terpotong rapi */}
            <div className="w-16 h-16 bg-indigo-500/10 rounded-2xl flex items-center justify-center mx-auto border border-indigo-500/20 shadow-inner overflow-hidden">
              <LogoRH className="w-full h-full" />
            </div>
            <div className="space-y-1">
              <h1 className="text-xl font-black text-white tracking-tight uppercase">{teks.authTitle}</h1>
              <p className="text-xs text-slate-400">{teks.authSub}</p>
            </div>
          </div>

          <form className="space-y-3" onSubmit={e => {e.preventDefault(); eksekusiLoginAPI();}}>
            {notifikasi && <p role="alert" className="text-sm text-rose-300">{notifikasi}</p>}
            <label className="block text-xs text-slate-300">Username
              <input name="username" aria-label="Username" autoComplete="username" placeholder="Username" value={inputUsername} onChange={e=>setInputUsername(e.target.value)} className="w-full mt-1 px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white text-center text-sm" required />
            </label>
            <label className="block text-xs text-slate-300">Password
            <input
              name="password" aria-label="Password" autoComplete="current-password" required
              type="password"
              value={inputPassword}
              onChange={(e) => setInputPassword(e.target.value)}
              placeholder={teks.authPlace}
              className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white text-center text-sm focus:outline-none focus:border-indigo-500 font-mono transition"
            />
            </label>
            <details className="rounded-xl border border-slate-800 p-3 text-xs text-slate-400">
              <summary className="cursor-pointer text-slate-300">Pengaturan koneksi laptop</summary>
              <label className="flex gap-2 items-center mt-3"><input type="checkbox" checked={automaticConnection} onChange={e=>setAutomaticConnection(e.target.checked)} />Temukan koneksi tersimpan di GitHub secara otomatis</label>
              <label className="block mt-3">Alamat server laptop (opsional, untuk koneksi manual)
                <input name="connection-url" disabled={automaticConnection} type="url" aria-label="Alamat server laptop (URL)" autoComplete="off" placeholder="https://alamat-laptop.trycloudflare.com" value={backendInput} onChange={e=>setBackendInput(e.target.value)} className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white" />
              </label>
              <p className="mt-2">Koneksi otomatis membaca alamat terbaru yang disimpan aplikasi di GitHub. Kamu cukup mengisi username dan password. Pengaturan manual hanya dipakai bila mode otomatis dinonaktifkan.</p>
            </details>
            <button title="Masuk dengan username dan password ke laptop yang terhubung."
              type="submit" disabled={loginPending}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl text-xs tracking-wider uppercase transition-all"
            >
              {loginPending ? 'Menghubungkan…' : teks.authBtn}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased">
      <header className="bg-slate-900/80 border-b border-slate-800/80 sticky top-0 backdrop-blur-md z-40 px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          {/* Container logo di header yang dibuat overflow-hidden agar memenuhi sudut */}
          <div className="w-10 h-10 bg-slate-950 rounded-xl flex items-center justify-center border border-slate-800 shadow-md overflow-hidden">
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
          <button title="Mengganti bahasa tampilan."
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

          <button title="Keluar dari sesi dashboard pada browser ini."
            onClick={() => { fetch(`${URL_HTTP}/api/logout`, {method: 'POST', headers: authHeaders()}); setDesktopDevice(null); localStorage.removeItem(SESS_KEY); sessionStorage.removeItem(SESS_KEY); setSudahLogin(false); }}
            className="px-3 py-1.5 bg-slate-800 hover:bg-rose-950 text-slate-300 hover:text-rose-400 border border-slate-700 hover:border-rose-900 rounded-xl text-xs font-bold transition"
          >
            {teks.logout}
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        <p className="text-xs text-slate-400 break-all">Koneksi: {automaticConnection ? "otomatis" : "manual"}. Data laptop disimpan pada server, bukan hanya di browser.</p>
        {storageStatus && <p role="status" className="text-xs text-slate-400">{storageStatus.status==='synced' ? 'Koneksi dan cadangan perangkat tersimpan di GitHub.' : storageStatus.githubEnabled ? 'Data lokal tersimpan. Sinkronisasi GitHub: '+(storageStatus.error || 'menunggu pembaruan') : 'Data lokal tersimpan. Sinkronisasi GitHub belum aktif.'}</p>}
        {systemMessage && <p role="status" className="p-4 rounded-xl bg-indigo-950 text-indigo-200">{systemMessage}</p>}
        {backendError && <p role="alert" className="p-4 rounded-xl bg-rose-950 text-rose-200">{backendError}</p>}
        {desktopDevice && <DesktopPanel key={desktopDevice.serial} device={desktopDevice} base={URL_HTTP} headers={authHeaders} onClose={() => setDesktopDevice(null)} /> }
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
            <button title="Menyimpan data laptop pada backend." onClick={() => simpanKeDatabasePusat(null)} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all">
              {teks.formBtnSave}
            </button>
            {idSedangDiedit && (
              <button title="Membatalkan perubahan formulir." onClick={() => { setIdSedangDiedit(null); setDataForm({ name: '', serial: '', model: '', wifi: '', ip: '', mac: '' }); }} className="px-4 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold">{teks.formBtnCancel}</button>
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
            <button title="Mengunduh salinan daftar laptop sebagai JSON." onClick={lakukanEksporData} className="flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-bold text-slate-300 hover:bg-slate-800 transition">
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
                    <p className="text-xs text-amber-300">Blokir: {perangkat.ahkPolicySupported ? (perangkat.ahkBlocked ? (perangkat.ahkError ? 'AKTIF — GAGAL memeriksa atau menghentikan AHK; lihat pesan Windows' : 'AKTIF — AHK dihentikan otomatis selama agent berjalan') : 'Nonaktif — boleh dibuka manual') : 'Agent perlu diperbarui'}</p>
                    <p className="text-xs text-slate-400">AHK: {perangkat.ahkKnown ? (perangkat.ahkEnabled ? 'Aktif' : 'Berhenti') : 'Status belum dapat diperiksa'}</p>
                    {(ahkCommandError?.id === perangkat.serial || perangkat.ahkError) && <p role="alert" className="text-xs text-rose-300 max-w-xl">{ahkCommandError?.id === perangkat.serial ? ahkCommandError.message : perangkat.ahkError}</p>}
                    {!!perangkat.shutdownAt && <p role="alert" className="text-rose-300 text-xs">Shutdown menunggu: gunakan Batalkan shutdown segera jika ingin membatalkan.</p>}
                    {perangkat.shutdownPermissionError && <p className="text-xs text-amber-300 max-w-xl">{perangkat.shutdownPermissionError}</p>}
                    {perangkat.shutdownError && <p role="alert" className="text-rose-300 text-xs">{perangkat.shutdownError}</p>}
                    <p className="text-xs text-slate-500 mt-0.5">WiFi: {perangkat.wifi} | IP: {perangkat.ip}</p>

                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-end relative">
                  <HelpButton help={"Meminta semua jendela aplikasi menutup secara normal. Dokumen yang belum disimpan dapat meminta keputusanmu. Agent dan terminal tetap terbuka."} className="px-4 py-2 rounded-xl text-xs bg-slate-700 disabled:opacity-40" disabled={!perangkat.isOnline || !perangkat.systemEnabled || !!systemPending} onClick={()=>confirmSystemAction(perangkat,"close_windows")}>Tutup jendela aplikasi</HelpButton>
                  <HelpButton help={perangkat.shutdownPermissionError || (!perangkat.shutdownPermissionKnown ? 'Sedang memeriksa izin Windows pada agent.' : "Menjadwalkan shutdown 10 detik setelah dikonfirmasi. Dapat dibatalkan selama hitung mundur; tidak memaksa dokumen yang belum disimpan.")} className="px-4 py-2 rounded-xl text-xs bg-rose-800 disabled:opacity-40" disabled={!perangkat.isOnline || !perangkat.systemEnabled || !perangkat.shutdownAllowed || !!systemPending} onClick={()=>confirmSystemAction(perangkat,"shutdown")}>Matikan laptop</HelpButton>
                  {!!perangkat.shutdownAt && <HelpButton help={"Membatalkan hitung mundur shutdown selama agent belum mengirim perintah ke Windows."} className="px-4 py-2 rounded-xl text-xs bg-amber-800 disabled:opacity-40" disabled={!perangkat.isOnline} onClick={()=>confirmSystemAction(perangkat,"cancel_shutdown")}>Batalkan shutdown</HelpButton>}
                  <HelpButton help={"Membuka kontrol layar, mouse, dan keyboard. Memerlukan ALLOW_DESKTOP_CONTROL pada agent; mode ini saat ini dinonaktifkan."} className="px-4 py-2 bg-indigo-600 rounded-xl text-xs disabled:opacity-40" disabled={!perangkat.isOnline || !perangkat.desktopEnabled} onClick={() => setDesktopDevice(perangkat)}>Kontrol Laptop</HelpButton>
                  <HelpButton help={perangkat.ahkBlocked ? 'Mencabut blokir otomatis. AutoHotkey boleh dibuka manual kembali; tombol ini tidak menjalankan script.' : "Mengaktifkan blokir: AutoHotkey yang dibuka manual akan dihentikan lagi secara otomatis selama agent berjalan."} className="px-4 py-2 rounded-xl text-xs bg-emerald-900 disabled:opacity-40" disabled={!perangkat.isOnline || !perangkat.ahkPolicySupported || !!ahkPending} onClick={()=>ubahStatusAhk(perangkat,perangkat.ahkBlocked ? 'unblock_ahk' : 'block_ahk')}>{ahkPending===perangkat.serial ? 'Menunggu client…' : perangkat.ahkBlocked ? 'Nonaktifkan blokir' : 'Blokir AHK terus'}</HelpButton>
                  <HelpButton help={"Menghentikan AutoHotkey yang sedang berjalan sekali saja. Jika blokir terus tidak aktif, script boleh dibuka manual lagi."} className="px-4 py-2 rounded-xl text-xs bg-rose-900 disabled:opacity-40" disabled={!perangkat.isOnline || !!ahkPending} onClick={()=>ubahStatusAhk(perangkat,'stop_ahk')}>Matikan sekali</HelpButton>

                  <div className="relative">
                    <button title="Membuka pilihan simpan, ubah, dan hapus data laptop."
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveDropdown(activeDropdown === perangkat.serial ? null : perangkat.serial);
                      }}
                      className="p-2 bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 rounded-xl transition"
                      aria-label={teks.btnMoreAction}
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {activeDropdown === perangkat.serial && (
                      <div className="absolute right-0 mt-2 w-44 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-100">
                        <button title="Menyimpan data laptop pada backend."
                          onClick={() => {
                            simpanKeDatabasePusat(perangkat);
                            setActiveDropdown(null);
                          }}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 transition text-left"
                        >
                          <Save className="w-3.5 h-3.5 text-indigo-400" />
                          {teks.formBtnSave}
                        </button>

                        <button title="Mengubah nama dan informasi laptop."
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

                        <button title="Menghapus catatan laptop setelah konfirmasi."
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
              <button title="Membatalkan tindakan tanpa mengirim perintah."
                onClick={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2 rounded-xl text-xs transition"
              >
                {teks.modalCancel}
              </button>
              <button title="Mengirim tindakan yang telah dijelaskan dalam konfirmasi."
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
