import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Play, Square, SkipForward, Plus, Settings, Monitor, Database, Trash2, 
  MoveUp, MoveDown, Type, Wifi, UploadCloud, RefreshCw, 
  Layers, Zap, Search, LayoutList, HardDrive, Link2, Eye, Fingerprint,
  Clock, Volume2, Image as ImageIcon, Grid, Radio, PlusCircle, X, ChevronsRight,
  Server, Save, RotateCcw, Activity, Terminal, RefreshCcw, AlertTriangle, Globe
} from 'lucide-react';

const App = () => {
  // --- ÉTAT GLOBAL ---
  const [activeTab, setActiveTab] = useState('rundown');
  const [rundown, setRundown] = useState([]); 
  const [scResources, setScResources] = useState([]); 
  const [isSyncing, setIsSyncing] = useState(false);
  const [apiLogs, setApiLogs] = useState([]); 
  const [connectionStatus, setConnectionStatus] = useState('connecting'); // disconnected, connecting, connected, error, simulation
  const [activeRundownId, setActiveRundownId] = useState(null);
  const [isMockMode, setIsMockMode] = useState(false); // Mode Simulation

  // ÉTATS PREVIEW/PGM
  const [pvwItem, setPvwItem] = useState(null); 
  const [pgmItem, setPgmItem] = useState(null); 
  const [timer, setTimer] = useState(0); 
  
  const [config, setConfig] = useState({
    superconductorIp: '127.0.0.1',
    superconductorPort: '5500', // Port officiel
    metusIp: '192.168.1.100',
    ftpPath: '/RTBF/DAILY_CLIPS/',
    useProxy: true // ACTIVÉ PAR DÉFAUT pour éviter les problèmes CORS
  });

  // --- MOTEUR API SUPERCONDUCTOR (HYBRIDE) ---
  
  const addLog = (type, message) => {
    const timestamp = new Date().toLocaleTimeString();
    setApiLogs(prev => [`[${timestamp}] [${type}] ${message}`, ...prev].slice(0, 50));
  };

  const scApiCall = useCallback(async (endpoint, method = 'GET', body = null) => {
    // LOGIQUE URL : Si Proxy activé, on utilise un chemin relatif (/api/...) géré par Vite.
    // Sinon, on tape directement l'IP (ce qui causera des erreurs CORS si le navigateur n'est pas configuré pour).
    let url;
    if (config.useProxy) {
        url = `/api/internal${endpoint}`; // Passe par le proxy Vite (vite.config.js)
    } else {
        url = `http://${config.superconductorIp}:${config.superconductorPort}/api/internal${endpoint}`;
    }
    
    // Si mode simulation forcé
    if (isMockMode) {
      addLog('MOCK', `${method} ${endpoint} (Simulated)`);
      return getMockResponse(endpoint);
    }

    addLog('REQ', `${method} ${url}`);
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); 

      // OPTIMISATION : Pas de headers complexes pour GET simple
      const options = {
        method,
        signal: controller.signal,
      };

      if (method !== 'GET' && method !== 'HEAD') {
        options.headers = { 'Content-Type': 'application/json' };
        if (body) options.body = JSON.stringify(body);
      }

      const response = await fetch(url, options);
      clearTimeout(timeoutId);

      // Si on reçoit du HTML (souvent le cas si le proxy échoue et renvoie la page index.html), c'est une erreur
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") === -1) {
         throw new Error("Réponse invalide (HTML reçu au lieu de JSON). Vérifiez le Proxy.");
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      addLog('RES', `Success`); 
      setConnectionStatus('connected');
      return data;

    } catch (error) {
      const isTimeout = error.name === 'AbortError';
      const isCors = error.message.includes('Failed to fetch');
      
      let errorMessage = error.message;
      if (isTimeout) errorMessage = 'Connection Timed Out (5s)';
      if (isCors) errorMessage = 'Blocked (CORS) or Network Error';

      console.warn("API Error:", error);
      addLog('ERR', `Failed: ${errorMessage}`);
      
      setConnectionStatus('error'); 
      return null;
    }
  }, [config, isMockMode]);

  // Fonction pour forcer la reconnexion réelle
  const retryRealConnection = () => {
    setIsMockMode(false);
    setConnectionStatus('connecting');
    addLog('SYS', 'Tentative de reconnexion au serveur réel...');
    fetchScState(); // Relance la découverte
  };

  // Générateur de fausses réponses (Backup)
  const getMockResponse = (endpoint) => {
    if (endpoint.includes('/rundowns/')) return { rundownIds: ['mock-rd-01.json'] };
    if (endpoint.includes('/rundown/')) return {
      parts: [
        { uuid: 'part-1', name: 'Sujet Liège 2110', slug: 'LUIK_SMPTE.mp4', duration: 45 },
        { uuid: 'part-2', name: 'Interview Namur', slug: 'NAMUR_INT.mp4', duration: 120 },
      ]
    };
    if (endpoint.includes('/project/')) return {
      media: [{ name: 'L3_NEWS.ft', type: 'template' }, { name: 'INTRO.mp4', type: 'video' }]
    };
    return { success: true };
  };

  // --- LOGIQUE METIER ---

  const fetchScState = async () => {
    setIsSyncing(true);
    if (!isMockMode) setConnectionStatus('connecting');
    
    // 1. Rundowns
    const response = await scApiCall('/rundowns/');
    
    let targetRundownId = null;

    if (response) {
      // Cas 1 : Format objet { rundownIds: [...] }
      if (response.rundownIds && Array.isArray(response.rundownIds) && response.rundownIds.length > 0) {
        targetRundownId = response.rundownIds[0];
      } 
      // Cas 2 : Format tableau direct (Fallback)
      else if (Array.isArray(response) && response.length > 0) {
        targetRundownId = response[0].uuid || response[0].id;
      }
    }
    
    if (targetRundownId) {
      setActiveRundownId(targetRundownId);
      addLog('SYS', `Rundown trouvé: ${targetRundownId}`);
      
      // 2. Details Rundown
      const rundownDetail = await scApiCall(`/rundown/?uuid=${targetRundownId}`);
      
      if (rundownDetail && rundownDetail.parts) {
        const mappedItems = rundownDetail.parts.map((part, idx) => ({
          id: part.uuid || `local_${idx}`,
          label: part.name || 'Untitled',
          videoFile: part.slug || 'No Media',
          duration: part.duration || 30,
          source: 'superconductor',
          layer: '10',
          playing: false,
          gfxItems: [] 
        }));
        setRundown(mappedItems);
        addLog('SYS', `Rundown chargé: ${mappedItems.length} items`);
      }
    } else if (response === null && !isMockMode) {
       addLog('WARN', 'Impossible de récupérer les Rundowns (Erreur réseau/CORS)');
    }
    
    // 3. Project Resources
    const projectData = await scApiCall('/project/');
    if (projectData && projectData.media) {
      setScResources(projectData.media.map(m => ({
        name: m.name,
        type: m.type.includes('video') ? 'video' : 'template',
        category: 'Imported'
      })));
    }

    setIsSyncing(false);
  };

  // --- ACTIONS ---

  const handleCue = (item) => {
    setPvwItem(JSON.parse(JSON.stringify(item))); 
  };

  const handleTake = async () => {
    if (!pvwItem) return;
    await scApiCall('/playPart/', 'POST', { uuid: pvwItem.id });
    
    const newRundown = rundown.map(i => ({...i, playing: false}));
    const itemIndex = newRundown.findIndex(i => i.id === pvwItem.id);
    if (itemIndex >= 0) {
      newRundown[itemIndex].playing = true;
      setRundown(newRundown);
      setPgmItem(pvwItem);
      setTimer(pvwItem.duration || 30);
      setPvwItem(null); 
      if (itemIndex + 1 < newRundown.length) setPvwItem(newRundown[itemIndex + 1]);
    }
  };

  const handlePlayNext = async () => {
    await scApiCall('/playNext/', 'POST', {});
    addLog('CMD', 'Triggered PlayNext');
  };

  const stopAll = async () => {
    await scApiCall('/stopPart/', 'POST', {});
    setPgmItem(null);
    setTimer(0);
    setRundown(prev => prev.map(i => ({ ...i, playing: false })));
  };

  // --- UI HELPERS ---
  const updateItemField = (id, field, value) => {
    const updater = (list) => list.map(item => {
      if (item.id === id) return { ...item, [field]: value };
      return item;
    });
    setRundown(updater(rundown));
    if (pvwItem?.id === id) setPvwItem({ ...pvwItem, [field]: value });
    if (pgmItem?.id === id) setPgmItem({ ...pgmItem, [field]: value });
  };

  const addGfxToItem = (itemId) => {
    const newGfx = { id: Date.now().toString(), template: 'L3_DEFAULT.ft', layer: 20, data: { _NOM: '', _FONCTION: '' } };
    const updateGfx = (item) => ({ ...item, gfxItems: [...(item.gfxItems || []), newGfx] });
    setRundown(prev => prev.map(i => i.id === itemId ? updateGfx(i) : i));
    if (pvwItem?.id === itemId) setPvwItem(updateGfx(pvwItem));
  };

  const removeGfxFromItem = (itemId, gfxId) => {
    const updateGfx = (item) => ({ ...item, gfxItems: item.gfxItems.filter(g => g.id !== gfxId) });
    setRundown(prev => prev.map(i => i.id === itemId ? updateGfx(i) : i));
    if (pvwItem?.id === itemId) setPvwItem(updateGfx(pvwItem));
  };

  // --- TIMER & INIT ---
  useEffect(() => {
    let interval;
    if (pgmItem && timer > 0) {
      interval = setInterval(() => { setTimer((prev) => prev - 1); }, 1000);
    }
    return () => clearInterval(interval);
  }, [pgmItem, timer]);

  useEffect(() => {
    fetchScState();
  }, []);

  return (
    <div className="min-h-screen bg-[#0f1115] text-slate-200 font-sans flex flex-col selection:bg-blue-500/30 overflow-hidden">
      
      {/* HEADER */}
      <header className="bg-[#161920] border-b border-white/5 h-16 flex justify-between items-center px-4 shrink-0 z-50">
        <div className="flex items-center gap-4">
          <div className="bg-blue-600 p-2 rounded-lg text-white">
            <Zap size={20} fill="currentColor" />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tighter">PLAYLINK <span className="text-blue-500">MASTER</span></h1>
            {/* STATUS BADGE INTERACTIF */}
            <div 
              className={`flex items-center gap-2 text-[9px] font-mono select-none ${connectionStatus === 'error' || connectionStatus === 'simulation' ? 'cursor-pointer hover:opacity-80' : ''}`}
              onClick={connectionStatus === 'error' || connectionStatus === 'simulation' ? retryRealConnection : undefined}
              title={connectionStatus === 'error' ? "Click to retry real connection" : "Connection status"}
            >
               <span className={`w-2 h-2 rounded-full ${connectionStatus === 'connected' ? 'bg-green-500' : connectionStatus === 'error' ? 'bg-red-500' : 'bg-yellow-500 animate-pulse'}`}></span>
               <span className={`uppercase font-bold ${connectionStatus === 'error' ? 'text-red-500' : connectionStatus === 'connected' ? 'text-green-500' : 'text-yellow-500'}`}>
                 {connectionStatus === 'simulation' ? 'OFFLINE SIMULATION (RETRY)' : connectionStatus === 'error' ? 'CONNECTION FAILED' : connectionStatus}
               </span>
               {(connectionStatus === 'error' || connectionStatus === 'simulation') && <RefreshCcw size={10} className="ml-1"/>}
            </div>
          </div>
        </div>
        <div className="flex gap-4 items-center">
           <div className="flex items-center gap-2 bg-black/20 rounded-lg p-1 border border-white/5">
             <div className={`px-3 py-1 rounded text-[10px] font-black uppercase ${pgmItem ? 'bg-red-500/20 text-red-500 animate-pulse' : 'text-slate-600'}`}>ON AIR</div>
             <div className="h-4 w-[1px] bg-white/10"></div>
             <button onClick={retryRealConnection} className={`px-3 py-1 rounded text-[10px] font-black uppercase hover:bg-white/5 transition-colors ${isSyncing ? 'text-blue-400' : 'text-slate-400'}`}>
               {isSyncing ? 'SYNCING...' : 'FORCE SYNC'}
             </button>
           </div>
           <button 
             onClick={() => setActiveTab(activeTab === 'admin' ? 'rundown' : 'admin')}
             className={`p-2 rounded-full transition-all ${activeTab === 'admin' ? 'bg-blue-600 text-white' : 'hover:bg-white/10 text-slate-400'}`}
           >
             <Settings size={20} />
           </button>
        </div>
      </header>

      <main className="flex-1 flex flex-row overflow-hidden">
        
        {/* COL 1: RESOURCES */}
        <aside className="w-64 bg-[#12141a] border-r border-white/5 flex flex-col shrink-0">
          <div className="p-4 border-b border-white/5">
             <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex gap-2"><LayoutList size={12}/> Templates & Media</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
             {scResources.length === 0 && (
               <div className="p-6 text-center">
                 <p className="text-xs text-slate-600 italic mb-2">Aucune ressource</p>
                 <button onClick={retryRealConnection} className="text-[10px] bg-white/5 hover:bg-white/10 px-3 py-1 rounded border border-white/10">Rafraîchir</button>
               </div>
             )}
             {scResources.map((res, i) => (
               <div key={i} className="p-3 bg-white/5 rounded-lg text-xs font-medium hover:bg-white/10 cursor-pointer flex items-center gap-2 group">
                 {res.type === 'video' ? <HardDrive size={12} className="text-blue-500"/> : <Type size={12} className="text-purple-500"/>}
                 <span className="truncate flex-1">{res.name}</span>
                 {res.type === 'template' && <span className="text-[9px] text-slate-600 group-hover:text-slate-400 border border-slate-700 px-1 rounded">{res.category}</span>}
               </div>
             ))}
          </div>
        </aside>

        {activeTab === 'rundown' ? (
          <>
            {/* COL 2: RUNDOWN */}
            <section className="flex-1 flex flex-col min-w-0 bg-[#0f1115] relative">
              <div className="flex-1 overflow-y-auto p-6 space-y-2 custom-scrollbar pb-32">
                 {rundown.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-64 text-slate-600 space-y-4">
                      <div className="p-4 bg-white/5 rounded-full"><Database size={32} className="opacity-50"/></div>
                      <p className="text-sm font-medium">Rundown vide ou non synchronisé</p>
                      {connectionStatus === 'error' && (
                        <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded border border-red-500/20">
                          <AlertTriangle size={14}/>
                          CORS Blocked: Vérifiez l'option "Use Proxy" (Admin)
                        </div>
                      )}
                    </div>
                 )}
                 {rundown.map((item, index) => (
                   <div 
                     key={item.id}
                     onClick={() => handleCue(item)}
                     className={`
                       group flex items-start gap-4 p-4 rounded-xl border cursor-pointer transition-all
                       ${pgmItem?.id === item.id ? 'bg-red-500/10 border-red-500/50' : 
                         pvwItem?.id === item.id ? 'bg-green-500/10 border-green-500/50' : 
                         'bg-[#1c2029] border-white/5 hover:border-white/10'}
                     `}
                   >
                     <div className="w-8 text-center text-slate-500 font-black text-sm pt-2">{index + 1}</div>
                     <div className="w-16 h-10 bg-black/40 rounded flex items-center justify-center border border-white/5 mt-1 shrink-0">
                        <Monitor size={16} className="text-slate-600"/>
                     </div>
                     <div className="flex-1 min-w-0">
                        <div className={`font-bold truncate text-lg ${pgmItem?.id === item.id ? 'text-red-400' : 'text-white'}`}>{item.label}</div>
                        <div className="flex items-center gap-2 mt-1 mb-2">
                          <span className="text-[10px] font-mono text-slate-500 bg-black/30 px-1.5 py-0.5 rounded border border-white/5">{item.videoFile}</span>
                        </div>
                        {item.gfxItems && item.gfxItems.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {item.gfxItems.map((gfx, i) => (
                              <div key={i} className="flex items-center gap-1.5 bg-[#0f1115] px-2 py-1 rounded border border-white/10 text-[10px]">
                                 <Layers size={10} className="text-purple-500" />
                                 <span className="text-slate-400 font-bold">{gfx.template}</span>
                              </div>
                            ))}
                          </div>
                        )}
                     </div>
                     <div className="w-20 text-right font-mono text-xs text-slate-500 pt-2 shrink-0">
                        {Math.floor(item.duration / 60)}:{(item.duration % 60).toString().padStart(2,'0')}
                     </div>
                     <div className="w-8 flex justify-center pt-2 shrink-0">
                        {pgmItem?.id === item.id && <Radio size={16} className="text-red-500 animate-pulse" />}
                        {pvwItem?.id === item.id && !pgmItem?.id === item.id && <Eye size={16} className="text-green-500" />}
                     </div>
                   </div>
                 ))}
              </div>

              {/* TRANSPORT */}
              <div className="absolute bottom-6 left-6 right-6 bg-[#161920] border border-white/10 rounded-2xl p-2 shadow-2xl flex items-center gap-2 z-10">
                  <div className="flex-1 flex items-center justify-center gap-6">
                     <button onClick={handlePlayNext} className="p-4 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-400 hover:text-white transition-all">
                       <SkipForward size={20}/>
                     </button>
                     <button 
                       onClick={handleTake}
                       disabled={!pvwItem}
                       className={`
                         h-16 px-12 rounded-xl font-black text-xl tracking-widest flex items-center gap-2 shadow-lg transition-all
                         ${pvwItem ? 'bg-green-600 hover:bg-green-500 text-white hover:scale-105 active:scale-95' : 'bg-slate-800 text-slate-600 cursor-not-allowed'}
                       `}
                     >
                       TAKE <Play size={24} fill="currentColor"/>
                     </button>
                  </div>
                  <button onClick={stopAll} className="p-4 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-xl border border-red-500/20 transition-all font-black uppercase text-xs">PANIC</button>
              </div>
            </section>

            {/* COL 3: INSPECTOR */}
            <aside className="w-96 bg-[#0b0c0f] border-l border-white/5 flex flex-col shrink-0">
              <div className="aspect-video bg-black relative border-b border-white/5 group">
                 <div className="absolute top-2 left-2 flex gap-1">
                   <span className="bg-red-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded">PGM</span>
                 </div>
                 <div className="w-full h-full flex items-center justify-center flex-col">
                    {pgmItem ? (
                      <>
                        <ImageIcon size={48} className="text-slate-700 mb-2"/>
                        <div className="text-xs font-mono text-slate-500">{pgmItem.videoFile}</div>
                      </>
                    ) : (
                      <div className="w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20"></div>
                    )}
                 </div>
                 {pgmItem && (
                   <div className="absolute top-2 right-2 text-xl font-black font-mono tracking-tighter text-white bg-black/50 px-2 rounded">
                      {Math.floor(timer / 60)}:{(timer % 60).toString().padStart(2,'0')}
                   </div>
                 )}
              </div>

              <div className="flex-1 flex flex-col overflow-hidden">
                 <div className="p-4 border-b border-white/5 bg-[#12141a]">
                   <div className="text-[10px] font-black uppercase text-blue-500 tracking-widest flex items-center gap-2">
                     <Settings size={12}/> Inspector ({pvwItem ? 'PREVIEW' : pgmItem ? 'ON AIR' : 'NONE'})
                   </div>
                 </div>
                 
                 {pvwItem || pgmItem ? (
                   <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
                     {(() => {
                       const target = pvwItem || pgmItem;
                       const id = target.id;
                       return (
                         <>
                           <div className="space-y-3">
                             <h4 className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-2"><Monitor size={12}/> Video Source</h4>
                             <input className="w-full bg-white/5 border border-white/5 rounded-lg p-2 text-sm text-white focus:border-blue-500 outline-none font-bold"
                               value={target.label}
                               onChange={(e) => updateItemField(id, 'label', e.target.value)}
                             />
                           </div>
                           <div className="space-y-3 pt-4 border-t border-white/5">
                             <div className="flex justify-between items-center">
                               <h4 className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-2"><Layers size={12}/> GFX Stack</h4>
                               <button onClick={() => addGfxToItem(id)} className="text-[10px] bg-purple-600 hover:bg-purple-500 text-white px-2 py-1 rounded flex items-center gap-1 transition-colors">
                                 <PlusCircle size={10} /> ADD
                               </button>
                             </div>
                             <div className="space-y-3">
                               {target.gfxItems?.map((gfx, idx) => (
                                 <div key={gfx.id} className="bg-[#161920] border border-white/10 rounded-xl overflow-hidden shadow-sm">
                                   <div className="bg-white/5 p-2 flex items-center gap-2 border-b border-white/5">
                                     <div className="bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded text-[9px] font-black">{idx + 1}</div>
                                     <span className="flex-1 text-xs font-bold">{gfx.template}</span>
                                     <button onClick={() => removeGfxFromItem(id, gfx.id)} className="text-slate-600 hover:text-red-500"><X size={12}/></button>
                                   </div>
                                 </div>
                               ))}
                             </div>
                           </div>
                         </>
                       )
                     })()}
                   </div>
                 ) : (
                   <div className="h-full flex items-center justify-center text-center text-slate-600 text-xs italic p-4">
                     <ChevronsRight size={24} className="opacity-20 mb-2"/>
                     Sélectionnez un élément
                   </div>
                 )}
              </div>
            </aside>
          </>
        ) : (
          /* PAGE ADMIN */
          <section className="flex-1 bg-[#0f1115] overflow-y-auto p-12">
            <div className="max-w-4xl mx-auto space-y-12 animate-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center justify-between border-b border-white/10 pb-6">
                <div>
                  <h2 className="text-3xl font-black text-white tracking-tighter uppercase mb-2">System <span className="text-blue-500">Config</span></h2>
                  <p className="text-slate-500 text-sm">Endpoints API & Disaster Recovery Settings.</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-[#161920] border border-white/5 rounded-3xl p-8 space-y-6">
                  <h3 className="text-xs font-black uppercase text-blue-500 tracking-[0.2em] flex items-center gap-2 mb-6">
                    <Zap size={16} /> API Bridge
                  </h3>
                  <div className="space-y-4">
                    
                    {/* OPTION PROXY */}
                    <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-bold text-blue-400 flex items-center gap-2">
                          <Globe size={14}/> Use Proxy (Bypass CORS)
                        </label>
                        <input 
                          type="checkbox" 
                          checked={config.useProxy}
                          onChange={(e) => setConfig({...config, useProxy: e.target.checked})}
                          className="w-4 h-4 accent-blue-500"
                        />
                      </div>
                      <p className="text-[10px] text-slate-400 leading-tight">
                        Cochez cette case si vous avez configuré le proxy dans <code>vite.config.js</code> pour éviter les erreurs CORS. (Recommandé en local).
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Server IP</label>
                      <div className="flex items-center bg-[#0f1115] border border-white/10 rounded-xl px-4 py-3">
                        <Server size={16} className="text-slate-600 mr-3" />
                        <input type="text" className="bg-transparent text-sm font-mono text-white outline-none w-full"
                          value={config.superconductorIp}
                          onChange={(e) => setConfig({...config, superconductorIp: e.target.value})}
                          disabled={config.useProxy} // IP fixée dans vite.config.js si proxy
                        />
                      </div>
                      {config.useProxy && <span className="text-[9px] text-slate-600 italic ml-1">Géré par le proxy</span>}
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Port</label>
                      <input type="text" className="bg-[#0f1115] border border-white/10 rounded-xl px-4 py-3 text-sm font-mono text-white w-full"
                        value={config.superconductorPort}
                        onChange={(e) => setConfig({...config, superconductorPort: e.target.value})}
                        disabled={config.useProxy}
                      />
                    </div>
                    <div className="pt-4 flex gap-2">
                        <button 
                          onClick={retryRealConnection}
                          className="flex-1 bg-green-600 hover:bg-green-500 text-white py-2 rounded-lg text-xs font-bold uppercase transition-colors"
                        >
                          Test Connection
                        </button>
                        <button 
                          onClick={() => setIsMockMode(true)}
                          className="flex-1 bg-yellow-600/20 hover:bg-yellow-600/40 text-yellow-500 py-2 rounded-lg text-xs font-bold uppercase transition-colors"
                        >
                          Force Simulation
                        </button>
                    </div>
                  </div>
                </div>
                <div className="bg-[#161920] border border-white/5 rounded-3xl p-8 flex flex-col h-[300px]">
                  <h3 className="text-xs font-black uppercase text-slate-500 tracking-[0.2em] flex items-center gap-2 mb-4">
                    <Terminal size={16} /> Live Logs
                  </h3>
                  <div className="flex-1 bg-[#0f1115] rounded-xl p-4 overflow-y-auto font-mono text-[10px] space-y-1 border border-white/10 custom-scrollbar">
                    {apiLogs.map((log, i) => (
                      <div key={i} className={`truncate ${log.includes('ERR') ? 'text-red-400' : log.includes('REQ') ? 'text-blue-400' : log.includes('MOCK') ? 'text-yellow-500' : 'text-green-400'}`}>
                        {log}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
};

export default App;