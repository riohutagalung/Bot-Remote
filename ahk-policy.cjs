const fs = require('node:fs');
// A visible agent owns this policy. No service or startup is installed here.
exports.createAhkPolicy = ({readAhk, stopAhk, file, onChange = () => {}}) => {
  let blocked = false;
  if (fs.existsSync(file)) {
    const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (typeof saved.blocked !== 'boolean') throw Error('Kebijakan AHK lokal tidak valid');
    blocked = saved.blocked;
  }
  let state = {ahkEnabled:false, ahkKnown:false, ahkError:'', ahkBlocked:blocked, ahkPolicySupported:true};
  let queue = Promise.resolve();
  let pendingRefresh = null;
  const serial = task => { const result = queue.then(task); queue = result.catch(()=>{}); return result; };
  async function inspect() {
    const old = JSON.stringify(state);
    const next = {...state,ahkError:''};
    let readSucceeded = false;
    try {
      next.ahkEnabled = await readAhk();
      next.ahkKnown = true;
      readSucceeded = true;
      if (blocked && next.ahkEnabled) {
        console.log('[AHK] Blokir aktif: menghentikan proses AutoHotkey yang terdeteksi.');
        await stopAhk();
        next.ahkEnabled = await readAhk();
        if (next.ahkEnabled) throw Error('AutoHotkey masih aktif setelah perintah stop');
      }
    } catch(error) { next.ahkError = error.message; if(!readSucceeded)next.ahkKnown=false; }
    // Other status events must never publish an unfinished process inspection.
    state = {...next,ahkBlocked:blocked};
    if (old !== JSON.stringify(state)) onChange({...state});
    return {...state};
  }
  return {
    snapshot: () => ({...state}),
    refresh: () => {
      // A Windows process query/stop can exceed the polling interval.
      // Coalesce overlapping polls so commands cannot get stuck behind a backlog.
      if (!pendingRefresh) {
        pendingRefresh = serial(inspect);
        pendingRefresh.then(()=>{pendingRefresh=null;},()=>{pendingRefresh=null;});
      }
      return pendingRefresh;
    },
    command: action => serial(async()=>{
      if (!['stop_ahk','block_ahk','unblock_ahk'].includes(action)) throw Error('Perintah AHK tidak valid');
      if (action !== 'stop_ahk') {
        const next = action === 'block_ahk';
        fs.writeFileSync(file + '.tmp', JSON.stringify({blocked:next}) + '\n', {mode:0o600});
        fs.renameSync(file + '.tmp', file);
        blocked = next;
        state.ahkBlocked = blocked;
        console.log('[AHK] Blokir terus-menerus:', blocked ? 'AKTIF (nonaktifkan dari dashboard atau tutup agent)' : 'NONAKTIF');
      }
      let stopError;
      if (action === 'stop_ahk') { try { await stopAhk(); } catch(error) { stopError = error; } }
      const result = await inspect();
      if (stopError || result.ahkError) {
        state.ahkError = (stopError || Error(result.ahkError)).message;
        onChange({...state});
        throw Error(state.ahkError);
      }
      onChange({...state});
      return result;
    })
  };
};
