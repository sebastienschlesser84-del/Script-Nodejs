import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Monitor, Layers, Wifi, WifiOff, FileVideo, RefreshCw, 
  Activity, Plus, Play, Trash2, Zap, 
  Repeat, Settings, Type, PlusCircle, 
  Terminal, X, FolderPlus, Folder, PlayCircle, StopCircle, LayoutGrid,
  Save, Volume2, Mic, Image as ImageIcon,
  MoreVertical, Command, FileJson, Clock, ChevronDown, ChevronRight,
  Link as LinkIcon, AlertCircle, ArrowRightCircle, Lock, Unlock,
  Grid, VolumeX, SkipForward, Disc, ListPlus, Minus, ChevronsDown, ChevronsUp,
  Download, Upload, FileUp, FileDown, ArrowUp, ArrowDown, FilePlus,
  PanelLeft, PanelLeftClose, PanelRight, PanelRightClose, Maximize, Pause,
  CloudDownload, CloudOff, FileDigit, Eraser, GripVertical, Target, FileQuestion, Ban
} from 'lucide-react';

const API_URL = "http://localhost:3000"; 
const HEARTBEAT_INTERVAL = 3000;

export default function App() {
  // --- ÉTATS SYSTÈME ---
  const [isConnected, setIsConnected] = useState(false);
  const [mediaLibrary, setMediaLibrary] = useState([]);
  const [templateLibrary, setTemplateLibrary] = useState([]); 
  const [savedPresets, setSavedPresets] = useState([]); 
  
  // NOUVEAU : État pour les fichiers FTP
  const [ftpFiles, setFtpFiles] = useState([]);
  const [loadingFtp, setLoadingFtp] = useState(false);

  const [activeTab, setActiveTab] = useState('MEDIA'); 
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [logs, setLogs] = useState([]);
  const [showMultiview, setShowMultiview] = useState(true);
  
  // --- ÉTATS LAYOUT (VISIBILITÉ PANNEAUX) ---
  const [showLeftPanel, setShowLeftPanel] = useState(true);
  const [showRightPanel, setShowRightPanel] = useState(true);

  // --- ÉTATS PLAYLIST ---
  const [playlists, setPlaylists] = useState([
    { 
      id: 'pl-default', 
      name: 'RUNDOWN 20H', 
      collapsed: false, 
      locked: false,
      color: 'blue',
      items: [] 
    },
    { 
      id: 'pl-jingles', 
      name: 'BANQUE JINGLES', 
      collapsed: false, 
      locked: true,
      color: 'purple',
      items: [] 
    }
  ]);
  
  const [expandedItems, setExpandedItems] = useState(new Set()); 
  const [expandedGfxInspector, setExpandedGfxInspector] = useState(new Set()); 
  const [targetPlaylistId, setTargetPlaylistId] = useState('pl-default');
  const fileInputRef = useRef(null);

  // --- ÉTATS MOTEUR LIVE ---
  const [selectedItemId, setSelectedItemId] = useState(null); 
  const [previewItemId, setPreviewItemId] = useState(null); 
  
  const [activeLayers, setActiveLayers] = useState({});
  const [autoChainMaster, setAutoChainMaster] = useState(false);

  const playingTimers = useRef({}); 

  // --- LOGGER ---
  const addLog = useCallback((msg, type = 'info') => {
    const time = new Date().toLocaleTimeString('fr-FR', { hour12: false });
    setLogs(p => [{ id: Date.now(), time, msg, type }, ...p].slice(0, 50));
  }, []);

  // --- COMMUNICATION BACKEND ---
  const sendCasparCommand = async (endpoint, body) => {
    if (!isConnected) return;
    try {
      await fetch(`${API_URL}/caspar/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
    } catch (e) {
      addLog(`Erreur API ${endpoint}`, 'error');
    }
  };

  const fetchLibrary = async () => {
    setLoadingMedia(true);
    try {
      const resMedia = await fetch(`${API_URL}/caspar/files`);
      if (resMedia.ok) {
        const files = await resMedia.json();
        const formattedMedia = files.map(f => ({
          id: f.name.toUpperCase(), // On normalise en majuscule pour la comparaison
          type: f.type === 'MOVIE' ? 'VIDEO' : 'IMAGE',
          duration: 30, // Durée par défaut
          size: f.size
        }));
        setMediaLibrary(formattedMedia);
      }
      const resTempl = await fetch(`${API_URL}/caspar/templates`);
      if (resTempl.ok) {
        const templates = await resTempl.json();
        const formattedTempl = templates.map(t => ({
          id: t.name,
          fields: [] 
        }));
        setTemplateLibrary(formattedTempl);
      }
      addLog("Bibliothèques synchronisées", "success");
    } catch (e) {
      addLog("Erreur synchronisation bibliothèques", "error");
    } finally {
      setLoadingMedia(false);
    }
  };

  // --- SYNC FTP ---
  const handleFtpSync = async () => {
      setLoadingFtp(true);
      addLog("Sync FTP en cours...", "info");
      try {
          const res = await fetch(`${API_URL}/ftp/sync`);
          const data = await res.json();
          if (data.success) {
              setFtpFiles(data.files);
              addLog(`${data.files.length} nouveaux fichiers trouvés`, "success");
          } else {
              addLog("Erreur FTP: " + data.error, "error");
          }
      } catch (e) {
          addLog("Erreur connexion Backend FTP", "error");
      } finally {
          setLoadingFtp(false);
      }
  };

  useEffect(() => {
    const checkConnection = async () => {
      try {
        const res = await fetch(`${API_URL}/health`);
        const data = await res.json();
        if (data.casparConnection && !isConnected) {
          addLog("Connexion CasparCG établie", "success");
          fetchLibrary();
        }
        setIsConnected(data.casparConnection);
      } catch (e) {
        setIsConnected(false);
      }
    };
    checkConnection();
    const interval = setInterval(checkConnection, HEARTBEAT_INTERVAL);
    return () => clearInterval(interval);
  }, [isConnected]);

  // --- GESTION PRESETS ---
  const saveAsPreset = (gfxItem) => {
     const name = prompt("Nom du Preset (ex: LOWER_THIRD_INVITE) :", gfxItem.template);
     if (name) {
        const newPreset = {
           uniqId: `preset-${Date.now()}`,
           label: name,
           template: gfxItem.template,
           data: { ...gfxItem.data }, 
           layer: gfxItem.layer,
           channel: gfxItem.channel
        };
        setSavedPresets([...savedPresets, newPreset]);
        addLog(`Preset "${name}" sauvegardé`, "success");
        if(showLeftPanel) setActiveTab('SAVED');
     }
  };

  const deletePreset = (uniqId) => {
      if(window.confirm("Supprimer ce preset ?")) {
          setSavedPresets(prev => prev.filter(p => p.uniqId !== uniqId));
      }
  };

  // --- IMPORT / EXPORT PLAYLISTS ---
  const exportPlaylists = () => {
      const dataStr = JSON.stringify(playlists, null, 2);
      const blob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `playlink_backup_${new Date().toISOString().slice(0,10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      addLog("Playlists exportées", "success");
  };

  const importPlaylists = (event) => {
      const file = event.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
          try {
              const imported = JSON.parse(e.target.result);
              if (Array.isArray(imported)) {
                  setPlaylists(imported);
                  addLog("Playlists importées avec succès", "success");
              } else {
                  addLog("Format JSON invalide", "error");
              }
          } catch (err) {
              addLog("Erreur de lecture du fichier", "error");
          }
      };
      reader.readAsText(file);
      event.target.value = null;
  };

  // --- LOGIQUE PLAYLIST ---
  const createPlaylist = () => {
    const name = prompt("Nom de la nouvelle playlist :");
    if (name) {
      const newPl = { 
        id: `pl-${Date.now()}`, 
        name: name.toUpperCase(), 
        items: [],
        collapsed: false,
        locked: false,
        color: 'gray'
      };
      setPlaylists([...playlists, newPl]);
      setTargetPlaylistId(newPl.id);
    }
  };

  const togglePlaylistLock = (plId) => {
    setPlaylists(prev => prev.map(pl => 
      pl.id === plId ? { ...pl, locked: !pl.locked } : pl
    ));
  };

  const toggleItemExpansion = (uniqId) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(uniqId)) next.delete(uniqId);
      else next.add(uniqId);
      return next;
    });
  };

  const toggleGfxInspector = (gfxId) => {
    setExpandedGfxInspector(prev => {
       const next = new Set(prev);
       if(next.has(gfxId)) next.delete(gfxId);
       else next.add(gfxId);
       return next;
    });
  };

  // --- LOGIQUE DE REORDERING & DRAG DROP ---
  const movePlaylistItem = (plId, index, direction) => {
      setPlaylists(prev => prev.map(pl => {
          if (pl.id !== plId || pl.locked) return pl;
          const newItems = [...pl.items];
          if (direction === -1 && index > 0) {
              [newItems[index], newItems[index - 1]] = [newItems[index - 1], newItems[index]];
          } else if (direction === 1 && index < newItems.length - 1) {
              [newItems[index], newItems[index + 1]] = [newItems[index + 1], newItems[index]];
          }
          return { ...pl, items: newItems };
      }));
  };

  const moveGfxItem = (parentItemUniqId, gfxIndex, direction) => {
      updateItem(parentItemUniqId, (item) => {
          const newGfx = [...item.gfxItems];
          if (direction === -1 && gfxIndex > 0) {
              [newGfx[gfxIndex], newGfx[gfxIndex - 1]] = [newGfx[gfxIndex - 1], newGfx[gfxIndex]];
          } else if (direction === 1 && gfxIndex < newGfx.length - 1) {
              [newGfx[gfxIndex], newGfx[gfxIndex + 1]] = [newGfx[gfxIndex + 1], newGfx[gfxIndex]];
          }
          return { gfxItems: newGfx };
      });
  };

  const deleteGfxItem = (parentItemUniqId, gfxId) => {
      updateItem(parentItemUniqId, (item) => {
          const newGfx = item.gfxItems.filter(g => g.id !== gfxId);
          return { gfxItems: newGfx };
      });
  };

  const handleDragStart = (e, plId, index) => {
    e.dataTransfer.setData("application/json", JSON.stringify({ plId, index }));
    e.dataTransfer.effectAllowed = "move";
    e.currentTarget.style.opacity = '0.5'; 
  };

  const handleDragEnd = (e) => {
    e.currentTarget.style.opacity = '1';
    e.currentTarget.style.background = '';
  };

  const handleDragOver = (e) => {
     e.preventDefault(); 
     e.dataTransfer.dropEffect = "move";
     e.currentTarget.style.background = '#1e3a8a30'; 
  };

  const handleDragLeave = (e) => {
     e.currentTarget.style.background = '';
  };

  const handleDrop = (e, targetPlId, targetIndex) => {
      e.preventDefault();
      e.currentTarget.style.background = '';

      const dataStr = e.dataTransfer.getData("application/json");
      if (!dataStr) return;
      
      try {
          const { plId: sourcePlId, index: sourceIndex } = JSON.parse(dataStr);
          if (sourcePlId !== targetPlId) return; 
          if (sourceIndex === targetIndex) return;

          setPlaylists(prev => prev.map(pl => {
             if (pl.id !== targetPlId || pl.locked) return pl;

             const newItems = [...pl.items];
             const [movedItem] = newItems.splice(sourceIndex, 1);
             newItems.splice(targetIndex, 0, movedItem);

             return { ...pl, items: newItems };
          }));
      } catch (err) {
          console.error("Drop error", err);
      }
  };

  // Ajout item
  const addItemToPlaylist = (asset = null, isPreset = false, asStandaloneTemplate = false, isFtpFile = false) => {
    const targetPl = playlists.find(p => p.id === targetPlaylistId);
    
    if (!targetPl) { addLog("Aucune playlist cible", "error"); return; }
    if (targetPl.locked) { addLog("Playlist verrouillée", "error"); return; }

    // CAS SPECIAL : Ajout manuel (Placeholder)
    if (asset === 'MANUAL_PLACEHOLDER') {
        const name = prompt("Nom du fichier (ID Caspar) :");
        if (!name) return;
        const newItem = {
          uniqId: `uid-${Date.now()}-${Math.floor(Math.random()*1000)}`,
          id: name.toUpperCase(),
          type: 'VIDEO',
          label: name.toUpperCase(),
          duration: 30,
          layer: 10,
          channel: 1, 
          loop: false,
          autoNext: false,
          volume: 1.0,
          gfxItems: [] 
        };
        setPlaylists(prev => prev.map(pl => {
          if (pl.id !== targetPlaylistId) return pl;
          return { ...pl, items: [...pl.items, newItem] };
        }));
        setSelectedItemId(newItem.uniqId);
        addLog(`Placeholder ajouté: ${name}`, "warning");
        return;
    }

    // CAS 0: Fichier FTP
    if (isFtpFile) {
        const newItem = {
          uniqId: `uid-${Date.now()}-${Math.floor(Math.random()*1000)}`,
          id: asset.name, 
          type: 'VIDEO',
          label: `VIDEO/${asset.name}`,
          duration: 30, 
          layer: 10,
          channel: 1, 
          loop: false,
          autoNext: false,
          volume: 1.0,
          gfxItems: [] 
        };
        setPlaylists(prev => prev.map(pl => {
          if (pl.id !== targetPlaylistId) return pl;
          return { ...pl, items: [...pl.items, newItem] };
        }));
        setSelectedItemId(newItem.uniqId);
        addLog(`Fichier FTP ajouté: ${asset.name}`, "success");
        return;
    }

    // CAS 1: Preset GFX ou Template lié
    if ((isPreset && !asStandaloneTemplate) || (!isPreset && !asStandaloneTemplate && asset.id && !asset.size && asset.type !== 'VIDEO')) {
       if (selectedItemId && selectedItem && selectedItem.type === 'VIDEO') {
          const presetGfx = {
             id: Date.now(),
             template: asset.template || asset.id,
             layer: asset.layer || 20,
             channel: asset.channel || selectedItem.channel, 
             delay: 0, 
             duration: 5,
             mode: 'AUTO_FINISH', 
             loop: false, 
             data: { ...(asset.data || {}) }
          };
          updateItem(selectedItemId, (item) => ({ gfxItems: [...item.gfxItems, presetGfx] }));
          setExpandedItems(prev => new Set(prev).add(selectedItemId));
          setExpandedGfxInspector(prev => new Set(prev).add(presetGfx.id));
          if(!showRightPanel) setShowRightPanel(true);
          addLog(`GFX lié à ${selectedItem.label}`, "success");
       } else if (asStandaloneTemplate === false && !isPreset && asset.type !== 'VIDEO') {
          addLog("Sélectionnez une vidéo pour lier, ou utilisez '+' pour standalone", "warning");
       } else {
          addLog("Sélectionnez une vidéo ou ajoutez comme clip", "info");
       }
       return;
    }

    // CAS 2: Template Standalone
    if (asStandaloneTemplate) {
        const newTemplateItem = {
            uniqId: `uid-${Date.now()}-${Math.floor(Math.random()*1000)}`,
            id: asset.id || asset.template, 
            type: 'TEMPLATE_CLIP', 
            label: asset.label || asset.id,
            duration: 10, 
            layer: 20,
            channel: 1,
            loop: false,
            autoNext: false,
            volume: 0,
            gfxItems: [], 
            data: asset.data || {} 
        };
        
        setPlaylists(prev => prev.map(pl => {
            if (pl.id !== targetPlaylistId) return pl;
            return { ...pl, items: [...pl.items, newTemplateItem] };
        }));
        setSelectedItemId(newTemplateItem.uniqId);
        addLog(`Template Clip ajouté: ${newTemplateItem.id}`, "success");
        return;
    }

    // CAS 3: Vidéo Standard
    const newItem = {
      uniqId: `uid-${Date.now()}-${Math.floor(Math.random()*1000)}`,
      id: asset ? asset.id : "NOUVEL_ELEMENT",
      type: 'VIDEO',
      label: asset ? asset.id : "Element Vide",
      duration: asset?.duration || 30,
      layer: 10,
      channel: 1, 
      loop: false,
      autoNext: false,
      volume: 1.0,
      gfxItems: [] 
    };

    setPlaylists(prev => prev.map(pl => {
      if (pl.id !== targetPlaylistId) return pl;
      return { ...pl, items: [...pl.items, newItem] };
    }));
    
    if(targetPl.collapsed) {
       setPlaylists(prev => prev.map(pl => pl.id === targetPlaylistId ? {...pl, collapsed: false} : pl));
    }

    setSelectedItemId(newItem.uniqId);
    addLog(`Vidéo ajoutée à ${targetPl.name}`, "success");
  };

  const updateItem = (itemUniqId, updateFnOrObj) => {
    const pl = playlists.find(p => p.items.some(i => i.uniqId === itemUniqId));
    if (pl && pl.locked) return;

    setPlaylists(prev => prev.map(pl => ({
      ...pl,
      items: pl.items.map(i => {
         if (i.uniqId !== itemUniqId) return i;
         const updates = typeof updateFnOrObj === 'function' ? updateFnOrObj(i) : updateFnOrObj;
         return { ...i, ...updates };
      })
    })));
  };

  const deleteItem = (plId, itemUniqId) => {
    const pl = playlists.find(p => p.id === plId);
    if (pl && pl.locked) return;

    setPlaylists(prev => prev.map(pl => {
      if (pl.id !== plId) return pl;
      return { ...pl, items: pl.items.filter(i => i.uniqId !== itemUniqId) };
    }));
    if (selectedItemId === itemUniqId) setSelectedItemId(null);
  };

  // --- MOTEUR DE TRANSPORT ---

  const handleCue = (item) => {
    setPreviewItemId(item.uniqId);
    setSelectedItemId(item.uniqId);
    addLog(`CUE: ${item.label} [CH:${item.channel}]`);
    
    if (item.type !== 'TEMPLATE_CLIP') {
        sendCasparCommand('load', {
            channel: item.channel,
            layer: item.layer,
            file: item.id,
            loop: item.loop 
        });
    }
  };

  const handlePlayPlaylist = (plId) => {
     const pl = playlists.find(p => p.id === plId);
     if (pl && pl.items.length > 0) {
        handleCue(pl.items[0]);
        setTimeout(() => handleTake(pl.items[0]), 200);
     }
  };

  const handleNext = () => {
     const refId = previewItemId || (Object.values(activeLayers).find(l => l.type === 'VIDEO' || l.type === 'TEMPLATE_CLIP')?.uniqId);
     if (!refId) return;

     let nextItem = null;
     playlists.forEach(pl => {
        const idx = pl.items.findIndex(i => i.uniqId === refId);
        if (idx !== -1 && idx < pl.items.length - 1) {
           nextItem = pl.items[idx + 1];
        }
     });

     if (nextItem) {
        handleCue(nextItem);
     } else {
        addLog("Fin de playlist atteinte", "info");
     }
  };

  const handleTake = (itemOverride = null) => {
    let itemToPlay = itemOverride;
    
    if (!itemToPlay && previewItemId) {
      for (const pl of playlists) {
        const found = pl.items.find(i => i.uniqId === previewItemId);
        if (found) itemToPlay = found;
      }
    }

    if (!itemToPlay) return;

    const layerKey = `${itemToPlay.channel}-${itemToPlay.layer}`;
    setPreviewItemId(null);
    
    setActiveLayers(prev => ({
      ...prev,
      [layerKey]: { 
        ...itemToPlay, 
        startTime: Date.now(), 
        remaining: parseInt(itemToPlay.duration) || 30,
        type: itemToPlay.type || 'VIDEO',
        finished: false
      }
    }));
    
    addLog(`TAKE CH${itemToPlay.channel}: ${itemToPlay.label}`, "success");
    
    // LOGIQUE DE LECTURE AMELIORÉE
    if (itemToPlay.type === 'TEMPLATE_CLIP') {
        sendCasparCommand('cg-add', {
            channel: itemToPlay.channel,
            layer: itemToPlay.layer,
            template: itemToPlay.id,
            data: itemToPlay.data || {}
        });
    } else {
        // CORRECTION: Pour les vidéos, on utilise 'load' (LOADBG AUTO) pour garantir le chargement ET la lecture immédiate
        // même si le fichier n'était pas préchargé. Cela résout le problème de devoir appuyer deux fois.
        sendCasparCommand('load', { 
            channel: itemToPlay.channel, 
            layer: itemToPlay.layer,
            file: itemToPlay.id,
            loop: itemToPlay.loop 
        });

        // On lance aussi les GFX liés avec leur délai
        itemToPlay.gfxItems.forEach(gfx => {
            if (gfx.delay >= 0) {
                setTimeout(() => playGfx(gfx, gfx.channel || itemToPlay.channel), gfx.delay * 1000);
            }
        });
    }
  };

  const playGfx = (gfx, defaultChannel) => {
    const targetChannel = gfx.channel || defaultChannel;
    const layerKey = `${targetChannel}-${gfx.layer}`;
    
    setActiveLayers(prev => ({
      ...prev,
      [layerKey]: {
        id: gfx.template,
        label: `GFX: ${gfx.template}`,
        layer: gfx.layer,
        channel: targetChannel,
        remaining: (gfx.mode === 'TIMER' || gfx.mode === 'AUTO_FINISH') ? gfx.duration : 0,
        type: 'GFX',
        mode: gfx.mode,
        loop: gfx.loop || false
      }
    }));

    addLog(`GFX PLAY: ${gfx.template}`, "info");
    
    sendCasparCommand('cg-add', {
        channel: targetChannel,
        layer: gfx.layer,
        template: gfx.template,
        data: gfx.data
    });

    if (gfx.duration > 0 && !gfx.loop) {
       const timerId = setTimeout(() => {
          if (gfx.mode === 'AUTO_FINISH') {
             cgStop(layerKey);
             addLog(`GFX ANIM OUT: ${gfx.template}`, "info");
          } else if (gfx.mode === 'TIMER') {
             stopLayer(layerKey);
          }
       }, gfx.duration * 1000);
       playingTimers.current[layerKey] = timerId;
    }
  };

  const cgStop = (layerKey) => {
     const [channel, layer] = layerKey.split('-');
     sendCasparCommand('cg-stop', { channel, layer });
     setTimeout(() => {
        setActiveLayers(prev => {
            const next = { ...prev };
            delete next[layerKey];
            return next;
        });
     }, 2000);
  };

  const stopLayer = (layerKey) => {
    const [channel, layer] = layerKey.split('-');
    if (playingTimers.current[layerKey]) {
      clearTimeout(playingTimers.current[layerKey]);
      delete playingTimers.current[layerKey];
    }
    setActiveLayers(prev => {
      const next = { ...prev };
      delete next[layerKey];
      return next;
    });
    sendCasparCommand('clear', { channel, layer });
  };

  const handlePanicChannel = (channel) => {
     addLog(`PANIC CH ${channel}`, "error");
     sendCasparCommand('clear', { channel });
     setActiveLayers(prev => {
        const next = {};
        Object.entries(prev).forEach(([key, val]) => {
           if(parseInt(key.split('-')[0]) !== channel) next[key] = val;
        });
        return next;
     });
  };

  // --- HEARTBEAT & TIMER ENGINE ---
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveLayers(prev => {
        const next = {};
        let changed = false;
        let triggerNext = null;
        
        Object.keys(prev).forEach(key => {
          const layer = prev[key];
          
          // CORRECTION: Assurer que les Template Clips en loop ne soient jamais tués par le timer
          const isInfinite = layer.loop || (layer.type === 'GFX' && layer.mode === 'MANUAL') || (layer.type === 'TEMPLATE_CLIP' && layer.loop);

          if (isInfinite) {
             next[key] = layer; 
          } else if (layer.remaining > 0) {
            next[key] = { ...layer, remaining: Math.max(0, layer.remaining - 1) };
            changed = true;
          } else if (layer.remaining === 0 && (layer.type === 'VIDEO' || layer.type === 'TEMPLATE_CLIP') && !layer.finished) {
             next[key] = { ...layer, remaining: 0, finished: true };
             changed = true;
             
             if (layer.type === 'VIDEO') {
                addLog(`Fin du Timer CH${layer.channel}: PAUSE`, "warning");
                sendCasparCommand('pause', { channel: layer.channel, layer: layer.layer });
             } else if (layer.type === 'TEMPLATE_CLIP') {
                 cgStop(`${layer.channel}-${layer.layer}`);
             }

             if (autoChainMaster && layer.autoNext) {
                playlists.forEach(pl => {
                   const idx = pl.items.findIndex(i => i.uniqId === layer.uniqId);
                   if (idx !== -1 && idx < pl.items.length - 1) {
                      triggerNext = pl.items[idx + 1];
                   }
                });
             }
          } else {
            next[key] = layer;
          }
        });
        
        if (triggerNext) {
           addLog(`AUTO-NEXT: ${triggerNext.label}`, "success");
           setTimeout(() => handleTake(triggerNext), 200);
        }

        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [autoChainMaster, playlists]); 

  let selectedItem = null;
  playlists.forEach(pl => {
    const found = pl.items.find(i => i.uniqId === selectedItemId);
    if (found) selectedItem = found;
  });

  return (
    <div className="flex flex-col h-screen w-full bg-[#12141a] text-slate-200 font-sans overflow-hidden select-none">
      
      <input 
          type="file" 
          ref={fileInputRef} 
          style={{display:'none'}} 
          accept=".json" 
          onChange={importPlaylists}
      />

      {/* HEADER AVEC BOUTONS GESTION LAYOUT */}
      <header className="h-14 bg-[#0a0c10] border-b border-gray-800 flex items-center justify-between px-4 shrink-0 shadow-md z-50">
        <div className="flex items-center gap-4">
           <button 
             onClick={() => setShowLeftPanel(!showLeftPanel)}
             className={`p-1.5 rounded transition-colors ${!showLeftPanel ? 'bg-blue-900/40 text-blue-400' : 'text-gray-500 hover:text-white'}`}
             title="Afficher/Masquer Bibliothèque"
           >
             {showLeftPanel ? <PanelLeftClose className="w-5 h-5"/> : <PanelLeft className="w-5 h-5"/>}
           </button>

           <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center shadow-lg shadow-blue-900/50">
             <Activity className="w-5 h-5 text-white" />
           </div>
           <div>
             <h1 className="font-bold text-sm tracking-widest text-white uppercase">PlayLink <span className="text-blue-500">Air</span></h1>
             <div className="text-[9px] font-mono text-gray-500">PRO EDITION</div>
           </div>
           
           <div className="h-6 w-px bg-gray-800 mx-2"></div>
           <button 
             onClick={() => setShowMultiview(!showMultiview)}
             className={`px-3 py-1 rounded text-[10px] font-bold border transition-all uppercase flex items-center gap-2 ${showMultiview ? 'bg-blue-900/30 text-blue-400 border-blue-800' : 'bg-gray-800 border-gray-700'}`}
           >
             <Grid className="w-3 h-3" />
           </button>
        </div>

        <div className="flex gap-2">
           {[1, 2, 3, 4].map(ch => (
              <button 
                key={ch}
                onClick={() => handlePanicChannel(ch)}
                className="w-16 h-8 rounded bg-red-950/30 border border-red-900 hover:bg-red-600 hover:text-white text-red-700 font-bold text-[9px] transition-all flex items-center justify-center gap-1"
                title={`Vider tout le contenu du canal ${ch}`}
              >
                <Ban className="w-3 h-3"/> CLEAR {ch}
              </button>
           ))}
        </div>

        <div className="flex items-center gap-4">
           <button 
             onClick={() => setAutoChainMaster(!autoChainMaster)}
             className={`flex items-center gap-2 px-3 py-1 rounded text-[10px] font-bold border transition-all uppercase ${autoChainMaster ? 'bg-green-900/30 text-green-400 border-green-600' : 'bg-gray-800 text-gray-500 border-gray-700'}`}
           >
             <LinkIcon className="w-3 h-3" /> Auto
           </button>
           <div className={`px-3 py-1 rounded text-[10px] font-black border uppercase ${isConnected ? 'bg-emerald-950/30 text-emerald-500 border-emerald-900' : 'bg-red-950 text-red-500 animate-pulse border-red-800'}`}>
             {isConnected ? 'ONLINE' : 'OFFLINE'}
           </div>

           <button 
             onClick={() => setShowRightPanel(!showRightPanel)}
             className={`p-1.5 rounded transition-colors ${!showRightPanel ? 'bg-blue-900/40 text-blue-400' : 'text-gray-500 hover:text-white'}`}
             title="Afficher/Masquer Inspecteur"
           >
             {showRightPanel ? <PanelRightClose className="w-5 h-5"/> : <PanelRight className="w-5 h-5"/>}
           </button>
        </div>
      </header>

      {/* MULTIVIEW DASHBOARD */}
      {showMultiview && (
        <div className="h-32 bg-[#000] border-b border-gray-800 grid grid-cols-4 gap-1 p-1 shrink-0">
           {[1, 2, 3, 4].map(ch => {
              const mainLayer = Object.values(activeLayers).find(l => l.channel === ch && (l.type === 'VIDEO' || l.type === 'TEMPLATE_CLIP'));
              
              // LOGIQUE NEXT ITEM (Par channel)
              let nextItemLabel = "--";
              if (mainLayer) {
                 playlists.forEach(pl => {
                    const idx = pl.items.findIndex(i => i.uniqId === mainLayer.uniqId);
                    if (idx !== -1 && idx < pl.items.length - 1) {
                       nextItemLabel = pl.items[idx+1].label;
                    }
                 });
              }

              return (
                <div key={ch} className="bg-[#111] border border-gray-800 rounded relative overflow-hidden flex flex-col items-center justify-center group">
                   <div className="absolute top-1 left-2 text-[10px] font-black text-gray-600">CH {ch}</div>
                   {mainLayer ? (
                      <>
                        <div className="text-sm font-bold text-gray-200 text-center px-2 truncate w-full flex flex-col items-center">
                            {mainLayer.label}
                            {mainLayer.type === 'TEMPLATE_CLIP' && <span className="text-[8px] bg-purple-900/50 px-1 rounded text-purple-200 mt-1">TEMPLATE</span>}
                        </div>
                        <div className={`text-2xl font-mono font-black mt-1 ${mainLayer.remaining < 10 && !mainLayer.loop ? 'text-red-500 animate-pulse' : 'text-green-500'}`}>
                           {mainLayer.loop ? 'LOOP' : mainLayer.remaining}
                        </div>
                        {!mainLayer.loop && <div className="absolute bottom-0 left-0 h-1 bg-green-600 transition-all duration-1000" style={{ width: `${(mainLayer.remaining / (mainLayer.duration || 30)) * 100}%` }}/>}
                        {mainLayer.loop && <Repeat className="absolute bottom-2 right-2 w-4 h-4 text-blue-500"/>}
                        
                        {/* AFFICHER NEXT ITEM - STYLE AGRANDI */}
                        <div className="absolute bottom-2 right-2 text-xs font-bold text-white bg-blue-900/90 px-2 py-1 rounded shadow-lg border border-blue-700 max-w-[150px] truncate flex items-center gap-1">
                           <SkipForward className="w-3 h-3 fill-current"/>
                           {nextItemLabel}
                        </div>
                      </>
                   ) : (
                      <div className="flex flex-col items-center opacity-30">
                         <Monitor className="w-8 h-8 text-gray-500"/>
                         <span className="text-[9px] uppercase mt-1 font-bold">No Signal</span>
                      </div>
                   )}
                </div>
              );
           })}
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        
        {/* COL 1: LIBRARY */}
        {showLeftPanel && (
        <aside className="w-72 bg-[#161920] border-r border-gray-800 flex flex-col z-20 shrink-0 transition-all">
          <div className="flex border-b border-gray-800">
            <button onClick={() => setActiveTab('MEDIA')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-wider border-b-2 ${activeTab === 'MEDIA' ? 'border-blue-500 text-white' : 'border-transparent text-gray-500'}`}>Media</button>
            <button onClick={() => setActiveTab('TEMPLATES')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-wider border-b-2 ${activeTab === 'TEMPLATES' ? 'border-purple-500 text-white' : 'border-transparent text-gray-500'}`}>Tpl</button>
            <button onClick={() => setActiveTab('FILES')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-wider border-b-2 flex items-center justify-center gap-1 ${activeTab === 'FILES' ? 'border-orange-500 text-white' : 'border-transparent text-gray-500'}`}>
                <CloudDownload className="w-3 h-3"/> Files
            </button>
            <button onClick={() => setActiveTab('SAVED')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-wider border-b-2 ${activeTab === 'SAVED' ? 'border-green-500 text-white' : 'border-transparent text-gray-500'}`}>Saved</button>
          </div>

          <div className="p-3 bg-black/20 border-b border-gray-800 space-y-2">
             <div className="flex items-center gap-2">
               <span className="text-[9px] text-gray-500 uppercase font-bold whitespace-nowrap">Ajouter vers :</span>
               <select 
                 className="flex-1 bg-[#111] border border-gray-700 text-[10px] text-white rounded px-2 py-1 outline-none truncate"
                 value={targetPlaylistId}
                 onChange={(e) => setTargetPlaylistId(e.target.value)}
               >
                 {playlists.map(pl => <option key={pl.id} value={pl.id}>{pl.name}</option>)}
               </select>
             </div>
             
             {/* BARRE OUTILS SPECIALE FTP SI ONGLET FILES */}
             {activeTab === 'FILES' ? (
                <div className="flex gap-2">
                    <button 
                        onClick={handleFtpSync} 
                        className={`flex-1 flex items-center justify-center gap-2 p-1.5 rounded text-[10px] font-bold border ${loadingFtp ? 'bg-orange-900/30 text-orange-400 border-orange-800' : 'bg-gray-800 text-white border-gray-600 hover:border-orange-500'}`}
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${loadingFtp ? 'animate-spin' : ''}`}/> SYNC FTP
                    </button>
                    <button 
                        onClick={() => setFtpFiles([])} 
                        className="p-1.5 bg-gray-800 rounded hover:text-red-500 border border-gray-600" 
                        title="Vider la liste"
                    >
                        <Trash2 className="w-3.5 h-3.5"/>
                    </button>
                </div>
             ) : (
                <div className="flex gap-2">
                    <input type="text" placeholder="Rechercher..." className="flex-1 bg-black/40 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300 outline-none" />
                    
                    {/* BOUTON CLIP VIDE AMELIORÉ */}
                    <button 
                        onClick={() => addItemToPlaylist('MANUAL_PLACEHOLDER')} 
                        className="px-2 py-1.5 bg-yellow-900/30 hover:bg-yellow-600 border border-yellow-800 rounded flex items-center gap-1 group transition-all" 
                        title="Ajouter Clip Vide"
                    >
                        <FilePlus className="w-3.5 h-3.5 text-yellow-500 group-hover:text-white"/>
                        <span className="text-[9px] font-black text-yellow-500 group-hover:text-white uppercase">Vide</span>
                    </button>

                    <button onClick={fetchLibrary} className="p-1.5 bg-gray-800 rounded hover:text-blue-400"><RefreshCw className={`w-3.5 h-3.5 ${loadingMedia ? 'animate-spin' : ''}`}/></button>
                </div>
             )}
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
             {activeTab === 'MEDIA' && mediaLibrary.map(file => (
                <div key={file.id} 
                  className="group p-2 bg-[#0f1115] border border-gray-800/50 hover:border-blue-500/50 rounded flex items-center justify-between cursor-pointer"
                  onClick={() => addItemToPlaylist(file)}
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <FileVideo className="w-4 h-4 text-blue-600 shrink-0"/>
                    <span className="text-[10px] font-bold truncate text-gray-300">{file.id}</span>
                  </div>
                  <PlusCircle className="w-4 h-4 text-gray-600 group-hover:text-blue-400 opacity-0 group-hover:opacity-100" />
                </div>
             ))}

             {activeTab === 'TEMPLATES' && templateLibrary.map(tpl => (
                <div key={tpl.id} className="group p-2 bg-[#0f1115] border border-gray-800/50 hover:border-purple-500/50 rounded flex items-center justify-between cursor-pointer relative"
                  onClick={() => addItemToPlaylist(tpl, false, false)}
                  title="Cliquer pour ajouter à la vidéo sélectionnée (ou Standalone via +)"
                >
                    <div className="flex items-center gap-3">
                       <FileJson className="w-4 h-4 text-purple-600 shrink-0"/>
                       <span className="text-[10px] font-bold text-gray-300">{tpl.id}</span>
                    </div>
                    <div className="flex gap-1">
                        <button 
                            className="p-1 rounded hover:bg-white/10 text-purple-400 opacity-0 group-hover:opacity-100"
                            title="Ajouter comme Clip Autonome"
                            onClick={(e) => { e.stopPropagation(); addItemToPlaylist(tpl, false, true); }}
                        >
                            <FilePlus className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
             ))}

             {activeTab === 'FILES' && (
                 ftpFiles.length > 0 ? ftpFiles.map((file, idx) => (
                    <div key={idx} 
                      className="group p-2 bg-[#1a150f] border border-orange-900/30 hover:border-orange-500/50 rounded flex items-center justify-between cursor-pointer"
                      onClick={() => addItemToPlaylist(file, false, false, true)}
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <FileDigit className="w-4 h-4 text-orange-600 shrink-0"/>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold truncate text-gray-300">{file.name}</span>
                            <span className="text-[8px] text-gray-500">{new Date(file.date).toLocaleTimeString()}</span>
                        </div>
                      </div>
                      <PlusCircle className="w-4 h-4 text-orange-500 opacity-0 group-hover:opacity-100" />
                    </div>
                 )) : (
                     <div className="text-center p-4 text-[10px] text-gray-500">
                         {loadingFtp ? "Scan en cours..." : "Aucun fichier récent."}
                     </div>
                 )
             )}

             {activeTab === 'SAVED' && savedPresets.map(preset => (
                <div key={preset.uniqId} className="group p-2 bg-[#0f1115] border border-green-900/30 hover:border-green-500/50 rounded flex items-center justify-between cursor-pointer"
                   onClick={() => addItemToPlaylist(preset, true)}
                >
                   <div className="flex items-center gap-3">
                      <Save className="w-4 h-4 text-green-600 shrink-0"/>
                      <div className="flex flex-col">
                         <span className="text-[10px] font-bold text-gray-300">{preset.label}</span>
                         <span className="text-[8px] text-gray-500">{preset.template}</span>
                      </div>
                   </div>
                   <div className="flex gap-1">
                      <button onClick={(e) => {e.stopPropagation(); deletePreset(preset.uniqId);}} className="p-1 rounded hover:bg-red-900/50 text-gray-500 hover:text-red-400">
                          <Trash2 className="w-3.5 h-3.5"/>
                      </button>
                      <Plus className="w-3 h-3 text-green-500 opacity-0 group-hover:opacity-100" />
                   </div>
                </div>
             ))}
          </div>
        </aside>
        )}

        {/* COL 2: RUNDOWNS */}
        <main className="flex-1 flex flex-col bg-[#0b0d11] relative min-w-0 border-r border-gray-800">
           {/* Transport Bar */}
           <div className="h-14 bg-[#161920] border-b border-gray-800 flex items-center px-4 gap-4 z-30 justify-between">
              
              {/* BOUTONS TAKE ET NEXT SUPPRIMÉS ICI, MAIS ON GARDE L'AFFICHAGE NEXT */}
              <div className="flex flex-col justify-center border-l-4 border-l-blue-600 pl-4 h-full">
                 <span className="text-[9px] text-gray-500 uppercase font-bold tracking-widest">Next Event</span>
                 <span className="text-sm font-mono text-white font-bold truncate max-w-[300px]">
                    {previewItemId ? playlists.flatMap(p=>p.items).find(i=>i.uniqId === previewItemId)?.label : "--"}
                 </span>
              </div>
              
              <div className="ml-auto flex items-center gap-2">
                  <button onClick={importPlaylists} className="text-[9px] bg-gray-800 hover:bg-gray-700 px-2 py-1 rounded text-gray-400 flex items-center gap-1" title="Importer Playlists">
                     <FileUp className="w-3 h-3"/>
                     <span onClick={() => fileInputRef.current.click()}>Import</span>
                  </button>
                  <button onClick={exportPlaylists} className="text-[9px] bg-gray-800 hover:bg-gray-700 px-2 py-1 rounded text-gray-400 flex items-center gap-1" title="Exporter Playlists">
                     <FileDown className="w-3 h-3"/> Export
                  </button>
                  <div className="w-px h-4 bg-gray-700 mx-1"></div>
                  <button onClick={createPlaylist} className="text-[9px] bg-gray-800 hover:bg-gray-700 px-2 py-1 rounded text-gray-400 flex items-center gap-1">
                     <FolderPlus className="w-3 h-3"/> New PL
                  </button>
              </div>
           </div>

           <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
              {playlists.map(pl => (
                <div key={pl.id} className={`rounded-lg border transition-all overflow-hidden ${pl.collapsed ? 'bg-[#161920] border-gray-800 h-10' : 'bg-[#12141a] border-gray-700 pb-2'}`}>
                   
                   {/* Playlist Header */}
                   <div className={`h-10 flex items-center px-4 justify-between bg-[#1a1d24]`}>
                      <div className="flex items-center gap-3 cursor-pointer select-none flex-1" onClick={() => setPlaylists(prev => prev.map(p => p.id === pl.id ? {...p, collapsed: !p.collapsed} : p))}>
                         {pl.collapsed ? <ChevronRight className="w-4 h-4 text-gray-500"/> : <ChevronDown className="w-4 h-4 text-white"/>}
                         <span className="font-bold text-xs text-gray-200 uppercase">{pl.name}</span>
                         {pl.locked && <Lock className="w-3 h-3 text-red-500" />}
                      </div>
                      <div className="flex gap-2">
                         <button 
                            className="p-1 hover:bg-white/10 rounded text-green-500"
                            title="Lancer la playlist"
                            onClick={(e) => { e.stopPropagation(); handlePlayPlaylist(pl.id); }}
                         >
                            <PlayCircle className="w-4 h-4"/>
                         </button>
                         <button 
                            className="p-1 hover:bg-white/10 rounded text-blue-400"
                            title="Clip Suivant"
                            onClick={(e) => { e.stopPropagation(); handleNext(); }}
                         >
                            <SkipForward className="w-4 h-4"/>
                         </button>

                         <button onClick={() => togglePlaylistLock(pl.id)} title={pl.locked ? "Déverrouiller" : "Verrouiller"}>
                           {pl.locked ? <Lock className="w-3.5 h-3.5 text-red-400"/> : <Unlock className="w-3.5 h-3.5 text-gray-600"/>}
                         </button>
                      </div>
                   </div>

                   {!pl.collapsed && (
                     <div className="mt-1">
                        {pl.items.map((item, idx) => {
                           const isSelected = item.uniqId === selectedItemId;
                           const isCued = item.uniqId === previewItemId;
                           const isOnAir = Object.values(activeLayers).some(l => l.uniqId === item.uniqId);
                           const hasGfx = item.gfxItems.length > 0;
                           const isExpanded = expandedItems.has(item.uniqId);
                           const isTemplateClip = item.type === 'TEMPLATE_CLIP';

                           // CHECK SI FICHIER MANQUANT (Pour les VIDEO uniquement)
                           const fileMissing = item.type === 'VIDEO' && !mediaLibrary.some(f => f.id === item.id);

                           return (
                              <div 
                                key={item.uniqId} 
                                className={`border-b border-gray-800/50 relative ${fileMissing ? 'bg-red-900/10 border-l-2 border-l-red-500' : ''}`}
                                draggable={!pl.locked}
                                onDragStart={(e) => handleDragStart(e, pl.id, idx)}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={(e) => handleDrop(e, pl.id, idx)}
                                onDragEnd={handleDragEnd}
                              >
                                  {/* Ligne Principale (Vidéo ou Template) */}
                                  <div 
                                    onClick={() => {
                                        setSelectedItemId(item.uniqId);
                                        if(!showRightPanel) setShowRightPanel(true);
                                    }}
                                    onDoubleClick={() => !pl.locked && !fileMissing && handleCue(item)}
                                    className={`flex items-center px-4 py-2 hover:bg-white/5 transition-colors cursor-pointer group ${isSelected ? 'bg-blue-900/20' : ''} ${isTemplateClip ? 'bg-purple-900/10' : ''}`}
                                  >
                                     <div className="w-6 flex justify-center shrink-0">
                                        {/* Poignée de Drag (visuel uniquement, tout l'élément est draggable) */}
                                        {!pl.locked && <GripVertical className="w-3 h-3 text-gray-600 opacity-0 group-hover:opacity-100 cursor-grab mr-1"/>}
                                        {isOnAir ? <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"/> : 
                                         isCued ? <div className="w-2 h-2 bg-green-500 rounded-full"/> : 
                                         <span className="text-[10px] font-mono text-gray-700">{idx+1}</span>}
                                     </div>

                                     <div className="flex-1 ml-2 min-w-0 flex items-center">
                                        {hasGfx && (
                                           <button onClick={(e) => { e.stopPropagation(); toggleItemExpansion(item.uniqId); }} className="mr-2 text-gray-500 hover:text-white">
                                              {isExpanded ? <ChevronDown className="w-3 h-3"/> : <ChevronRight className="w-3 h-3"/>}
                                           </button>
                                        )}
                                        {isTemplateClip && <FileJson className="w-3 h-3 text-purple-500 mr-2"/>}
                                        {fileMissing && <AlertCircle className="w-3 h-3 text-red-500 mr-2 shrink-0 animate-pulse"/>}
                                        
                                        <div className="flex flex-col min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className={`text-xs font-bold font-mono uppercase truncate ${isOnAir ? 'text-red-400' : isCued ? 'text-green-400' : fileMissing ? 'text-red-500' : 'text-gray-300'} ${isTemplateClip ? 'text-purple-300' : ''}`}>
                                                    {item.label}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-3 mt-0.5">
                                                <span className="text-[9px] text-gray-500 font-mono bg-gray-900 px-1 rounded border border-gray-800">CH{item.channel}</span>
                                                <span className="text-[9px] text-gray-600">L{item.layer}</span>
                                                {fileMissing && <span className="text-[8px] bg-red-900 text-red-200 px-1 rounded font-bold">MEDIA MISSING</span>}
                                                {item.loop && <Repeat className="w-2.5 h-2.5 text-blue-500"/>}
                                                {item.autoNext && <LinkIcon className="w-2.5 h-2.5 text-green-500"/>}
                                            </div>
                                        </div>
                                     </div>
                                     
                                     <div className="flex items-center gap-2 pr-2">
                                         
                                         {/* BOUTONS CUE / PLAY SUR LE CLIP */}
                                         <div className="flex items-center bg-gray-900/50 rounded border border-gray-800 mr-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                             <button 
                                                onClick={(e) => { e.stopPropagation(); handleCue(item); }}
                                                className={`p-1 hover:bg-gray-700 ${fileMissing ? 'text-gray-700 cursor-not-allowed' : 'text-gray-400 hover:text-white'}`}
                                                title="CUE (Charger)"
                                                disabled={fileMissing}
                                             >
                                                <Target className="w-3.5 h-3.5"/>
                                             </button>
                                             <div className="w-px h-3 bg-gray-800"></div>
                                             <button 
                                                onClick={(e) => { e.stopPropagation(); handleTake(item); }}
                                                className={`p-1 hover:bg-green-900/50 ${fileMissing ? 'text-gray-700 cursor-not-allowed' : 'text-gray-400 hover:text-green-400'}`}
                                                title="PLAY (Immédiat)"
                                                disabled={fileMissing}
                                             >
                                                <Play className="w-3.5 h-3.5 fill-current"/>
                                             </button>
                                         </div>

                                         <div className="text-xs font-mono font-bold text-gray-500 w-12 text-right">{item.duration}s</div>
                                         
                                         {/* BOUTONS REORDER */}
                                         {!pl.locked && (
                                            <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={(e) => { e.stopPropagation(); movePlaylistItem(pl.id, idx, -1); }} className="hover:text-blue-400 text-gray-600"><ArrowUp className="w-3 h-3"/></button>
                                                <button onClick={(e) => { e.stopPropagation(); movePlaylistItem(pl.id, idx, 1); }} className="hover:text-blue-400 text-gray-600"><ArrowDown className="w-3 h-3"/></button>
                                            </div>
                                         )}

                                         {!pl.locked && (
                                           <button onClick={(e) => { e.stopPropagation(); deleteItem(pl.id, item.uniqId); }} className="ml-2 opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-500">
                                              <Trash2 className="w-3.5 h-3.5"/>
                                           </button>
                                         )}
                                     </div>
                                  </div>

                                  {/* Sous-liste GFX */}
                                  {isExpanded && hasGfx && (
                                     <div className="bg-[#0b0d11] border-t border-gray-800 shadow-inner p-1 space-y-1">
                                        {item.gfxItems.map((gfx, gIdx) => {
                                            const nomLabel = gfx.data['_NOM'] || gfx.data['_nom'] || "";
                                            
                                            return (
                                               <div key={gfx.id} className="flex items-center justify-between bg-[#161920] rounded border border-gray-800 p-1 pl-3 group hover:border-gray-600">
                                                  <div className="flex flex-col flex-1 min-w-0">
                                                     <div className="flex items-center gap-2">
                                                         <Type className="w-3 h-3 text-purple-500"/>
                                                         <span className="text-[11px] font-bold text-gray-300 truncate">{gfx.template}</span>
                                                         {nomLabel && <span className="text-[9px] bg-blue-900 text-blue-200 px-1 rounded font-bold">{nomLabel}</span>}
                                                     </div>
                                                     <span className="text-[9px] text-gray-600 font-mono">Layer {gfx.layer} • {gfx.mode}</span>
                                                  </div>
                                                  
                                                  <div className="flex gap-2 items-center">
                                                     {/* GFX Reorder */}
                                                     {!pl.locked && (
                                                        <div className="flex flex-col gap-0.5 mr-2 opacity-0 group-hover:opacity-100">
                                                            <button onClick={(e) => { e.stopPropagation(); moveGfxItem(item.uniqId, gIdx, -1); }} className="hover:text-purple-400 text-gray-600"><ArrowUp className="w-2.5 h-2.5"/></button>
                                                            <button onClick={(e) => { e.stopPropagation(); moveGfxItem(item.uniqId, gIdx, 1); }} className="hover:text-purple-400 text-gray-600"><ArrowDown className="w-2.5 h-2.5"/></button>
                                                        </div>
                                                     )}

                                                     {/* BOUTON PLAY */}
                                                     <button 
                                                        onClick={() => playGfx(gfx, gfx.channel || item.channel)} 
                                                        className="h-8 w-12 bg-green-900/30 hover:bg-green-600 border border-green-800 hover:text-white text-green-500 rounded flex items-center justify-center transition-all shadow-sm"
                                                        title="Lancer GFX"
                                                     >
                                                        <Play className="w-4 h-4 fill-current"/>
                                                     </button>
                                                     
                                                     <button onClick={() => cgStop(`${gfx.channel || item.channel}-${gfx.layer}`)} className="h-8 w-8 bg-gray-800 hover:bg-red-900/50 text-gray-500 hover:text-red-400 border border-gray-700 rounded flex items-center justify-center">
                                                        <StopCircle className="w-4 h-4"/>
                                                     </button>

                                                     {/* NOUVEAU BOUTON SUPPRIMER GFX */}
                                                     {!pl.locked && (
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); deleteGfxItem(item.uniqId, gfx.id); }} 
                                                            className="h-8 w-8 bg-red-900/20 hover:bg-red-600 text-red-700 hover:text-white border border-red-900/30 rounded flex items-center justify-center ml-1"
                                                            title="Supprimer GFX"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5"/>
                                                        </button>
                                                     )}
                                                  </div>
                                               </div>
                                            );
                                        })}
                                     </div>
                                  )}
                              </div>
                           );
                        })}
                     </div>
                   )}
                </div>
              ))}
           </div>
        </main>

        {/* COL 3: INSPECTOR */}
        {showRightPanel && (
        <aside className="w-[350px] bg-[#161920] border-l border-[#2a2e37] flex flex-col z-40 shadow-2xl shrink-0 transition-all">
           <div className="p-3 border-b border-gray-800 bg-black/20 flex justify-between">
              <span className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Inspecteur</span>
              {selectedItem && playlists.find(p=>p.items.includes(selectedItem))?.locked && (
                 <span className="text-[9px] font-bold text-red-500 flex items-center gap-1"><Lock className="w-3 h-3"/> Lecture Seule</span>
              )}
           </div>

           <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-6">
              {selectedItem ? (
                 <>
                   {/* CONFIG VIDÉO / TEMPLATE MAIN */}
                   <section className="space-y-4">
                      
                      {/* LABEL EDITOR */}
                      <div className="flex items-center gap-3">
                         {selectedItem.type === 'TEMPLATE_CLIP' ? <FileJson className="w-5 h-5 text-purple-500"/> : <FileVideo className="w-5 h-5 text-blue-500"/>}
                         <div className="w-full">
                            <label className="text-[8px] text-gray-500 font-bold uppercase block mb-1">Label (Affichage Playlist)</label>
                            <input 
                                className="w-full bg-transparent border-b border-gray-700 text-sm font-bold text-white outline-none focus:border-blue-500"
                                value={selectedItem.label}
                                onChange={(e) => updateItem(selectedItem.uniqId, { label: e.target.value })}
                                disabled={playlists.find(p=>p.items.includes(selectedItem))?.locked}
                            />
                         </div>
                      </div>

                      {/* SOURCE FILE EDITOR (Pour VIDEO uniquement) */}
                      {selectedItem.type === 'VIDEO' && (
                          <div className={`p-3 rounded border ${!mediaLibrary.some(f => f.id === selectedItem.id) ? 'bg-red-900/10 border-red-500/50' : 'bg-black/20 border-gray-800'}`}>
                             <div className="flex justify-between items-center mb-1">
                                <label className="text-[9px] font-bold uppercase flex items-center gap-2">
                                    {mediaLibrary.some(f => f.id === selectedItem.id) ? <span className="text-green-500">● Média Valide</span> : <span className="text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> Média Introuvable</span>}
                                </label>
                             </div>
                             
                             {/* Champ Texte ID */}
                             <div className="flex gap-2 mb-2">
                                <input 
                                    className="flex-1 bg-[#111] border border-gray-700 text-[10px] text-white px-2 py-1 rounded font-mono"
                                    value={selectedItem.id}
                                    onChange={(e) => updateItem(selectedItem.uniqId, { id: e.target.value.toUpperCase() })}
                                    placeholder="NOM_DU_FICHIER"
                                />
                             </div>

                             {/* Dropdown Correction */}
                             {!mediaLibrary.some(f => f.id === selectedItem.id) && (
                                 <div>
                                     <label className="text-[8px] text-gray-400 block mb-1">Relier à un fichier existant :</label>
                                     <select 
                                        className="w-full bg-[#111] border border-red-900 text-[10px] text-white px-2 py-1 rounded"
                                        onChange={(e) => {
                                            if (e.target.value) {
                                                updateItem(selectedItem.uniqId, { id: e.target.value });
                                            }
                                        }}
                                        value=""
                                     >
                                         <option value="">-- Choisir un fichier --</option>
                                         {mediaLibrary.map(f => (
                                             <option key={f.id} value={f.id}>{f.id}</option>
                                         ))}
                                     </select>
                                 </div>
                             )}
                          </div>
                      )}
                      
                      {/* CHAMPS DYNAMIQUES SI TEMPLATE CLIP */}
                      {selectedItem.type === 'TEMPLATE_CLIP' && (
                          <div className="bg-[#0f1115] border border-gray-800 rounded p-3 mb-2">
                              {/* ... */}
                              <span className="text-[9px] font-bold text-gray-500 uppercase block mb-2">Champs Template Principal</span>
                              {Object.entries(selectedItem.data || {}).map(([key, val], kIdx) => (
                                 <div key={kIdx} className="flex gap-1 items-center mb-1">
                                    <input className="w-1/3 bg-black/30 border border-gray-800 text-[9px] text-purple-300 px-1 py-0.5" value={key} readOnly />
                                    <input className="flex-1 bg-black/30 border border-gray-800 text-[9px] text-white px-1 py-0.5" value={val} onChange={(e) => { const newData = { ...selectedItem.data }; newData[key] = e.target.value; updateItem(selectedItem.uniqId, { data: newData }); }} />
                                    <button onClick={() => { const newData = { ...selectedItem.data }; delete newData[key]; updateItem(selectedItem.uniqId, { data: newData }); }}><Minus className="w-3 h-3 text-red-500"/></button>
                                 </div>
                              ))}
                               <button onClick={() => { const newData = { ...(selectedItem.data || {}), [`_KEY${Object.keys(selectedItem.data || {}).length}`]: "" }; updateItem(selectedItem.uniqId, { data: newData }); }} className="w-full text-[9px] text-gray-500 border border-dashed border-gray-800 hover:border-purple-500 mt-1 rounded flex items-center justify-center gap-1"><ListPlus className="w-3 h-3"/> Ajouter Champ</button>
                          </div>
                      )}

                      {/* Grid settings */}
                      <div className="flex gap-4 items-end">
                         <div className="flex-1">
                            <label className="text-[9px] text-gray-500 font-bold uppercase block mb-1">Channel</label>
                            <input type="number" min="1" max="4" className="w-full bg-[#111] border border-gray-700 rounded p-1 text-xs text-white"
                               value={selectedItem.channel}
                               onChange={(e) => updateItem(selectedItem.uniqId, { channel: parseInt(e.target.value) })}
                               disabled={playlists.find(p=>p.items.includes(selectedItem))?.locked} />
                         </div>
                         <div className="flex-1">
                            <label className="text-[9px] text-gray-500 font-bold uppercase block mb-1">Layer</label>
                            <input type="number" className="w-full bg-[#111] border border-gray-700 rounded p-1 text-xs text-white"
                               value={selectedItem.layer}
                               onChange={(e) => updateItem(selectedItem.uniqId, { layer: parseInt(e.target.value) })}
                               disabled={playlists.find(p=>p.items.includes(selectedItem))?.locked} />
                         </div>
                         <button 
                            onClick={() => stopLayer(`${selectedItem.channel}-${selectedItem.layer}`)}
                            className="h-7 px-3 bg-red-900/30 hover:bg-red-600 border border-red-800 rounded text-[9px] font-bold text-red-400 hover:text-white mb-0.5"
                            title="Clear Layer"
                         >
                            CLEAR LAYER
                         </button>
                      </div>

                      {/* NOUVEAU : DURÉE ÉDITABLE */}
                      <div>
                            <label className="text-[9px] text-gray-500 font-bold uppercase flex justify-between">
                                <span>Durée Estimée (sec)</span>
                                <span className="text-[8px] text-yellow-600">Pause auto à la fin</span>
                            </label>
                            <input type="number" className="w-full bg-[#111] border border-gray-700 rounded p-1 text-xs text-white font-mono"
                               value={selectedItem.duration}
                               onChange={(e) => updateItem(selectedItem.uniqId, { duration: parseInt(e.target.value) })}
                               disabled={playlists.find(p=>p.items.includes(selectedItem))?.locked} />
                      </div>

                      <div className="flex gap-2">
                         <label className="flex items-center gap-2 cursor-pointer bg-black/20 p-2 rounded border border-gray-800 flex-1 hover:bg-white/5">
                            <input type="checkbox" checked={selectedItem.loop} onChange={() => updateItem(selectedItem.uniqId, { loop: !selectedItem.loop })} disabled={playlists.find(p=>p.items.includes(selectedItem))?.locked} />
                            <span className="text-[10px] uppercase text-gray-300 font-bold">Loop</span>
                         </label>
                         <label className="flex items-center gap-2 cursor-pointer bg-black/20 p-2 rounded border border-gray-800 flex-1 hover:bg-white/5">
                            <input type="checkbox" checked={selectedItem.autoNext} onChange={() => updateItem(selectedItem.uniqId, { autoNext: !selectedItem.autoNext })} disabled={playlists.find(p=>p.items.includes(selectedItem))?.locked} />
                            <span className="text-[10px] uppercase text-gray-300 font-bold">Auto Next</span>
                         </label>
                      </div>

                   </section>

                   <hr className="border-gray-800"/>

                   {/* GFX SECTION */}
                   {selectedItem.type !== 'TEMPLATE_CLIP' && (
                   <section className="space-y-4">
                      {/* ... Header GFX Section ... */}
                      <div className="flex justify-between items-center">
                         <h3 className="text-[11px] font-black text-purple-400 uppercase tracking-wider flex items-center gap-2">
                           <Layers className="w-3.5 h-3.5"/> Graphiques
                         </h3>
                      </div>

                      <div className="space-y-3">
                         {selectedItem.gfxItems.map((gfx, idx) => {
                             const isGfxExpanded = expandedGfxInspector.has(gfx.id);
                             const nomLabel = gfx.data['_NOM'] || gfx.data['_nom'] || "";

                             return (
                                <div key={gfx.id} className="bg-[#0f1115] border border-gray-800 rounded-lg overflow-hidden transition-all">
                                   <div className="p-2 flex justify-between items-center bg-[#161920] cursor-pointer hover:bg-[#1a1d24]" onClick={() => toggleGfxInspector(gfx.id)}>
                                      <div className="flex items-center gap-2 overflow-hidden">
                                         {isGfxExpanded ? <ChevronsUp className="w-3 h-3 text-gray-500"/> : <ChevronsDown className="w-3 h-3 text-gray-500"/>}
                                         <span className="text-[10px] font-bold text-gray-300 truncate w-24" title={gfx.template}>{gfx.template}</span>
                                         {nomLabel && <span className="text-[9px] bg-blue-900 text-blue-200 px-1 rounded font-bold truncate max-w-[80px]">{nomLabel}</span>}
                                      </div>
                                      <div className="flex gap-2">
                                         <button onClick={(e) => {e.stopPropagation(); saveAsPreset(gfx)}} className="text-green-500 hover:text-white"><Save className="w-3 h-3"/></button>
                                         <button onClick={(e) => {e.stopPropagation(); playGfx(gfx, gfx.channel || selectedItem.channel)}} className="text-blue-500 hover:text-white"><Play className="w-3 h-3"/></button>
                                         <button onClick={(e) => { e.stopPropagation(); if(!playlists.find(p=>p.items.includes(selectedItem))?.locked) { const newList = selectedItem.gfxItems.filter(g => g.id !== gfx.id); updateItem(selectedItem.uniqId, { gfxItems: newList }); } }} className="text-gray-600 hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
                                      </div>
                                   </div>
                                   {isGfxExpanded && (
                                       <div className="p-3 border-t border-gray-800">
                                           {/* ... (Contenu Inspecteur GFX inchangé) ... */}
                                           <div className="grid grid-cols-2 gap-2 mb-2">
                                              <div>
                                                 <label className="text-[8px] text-gray-600 font-bold uppercase">Mode</label>
                                                 <select className="w-full bg-[#111] border border-gray-800 rounded p-1 text-[10px] text-white" value={gfx.mode} onChange={(e) => { const newGfxs = [...selectedItem.gfxItems]; newGfxs[idx].mode = e.target.value; updateItem(selectedItem.uniqId, { gfxItems: newGfxs }); }}>
                                                    <option value="MANUAL">MANUEL</option>
                                                    <option value="TIMER">TIMER (CUT)</option>
                                                    <option value="AUTO_FINISH">AUTO OUT (ANIM)</option>
                                                 </select>
                                              </div>
                                              <div>
                                                 <label className="text-[8px] text-gray-600 font-bold uppercase">Durée (s)</label>
                                                 <input type="number" className="w-full bg-[#111] border border-gray-800 rounded p-1 text-[10px] text-white" value={gfx.duration} onChange={(e) => { const newGfxs = [...selectedItem.gfxItems]; newGfxs[idx].duration = parseInt(e.target.value); updateItem(selectedItem.uniqId, { gfxItems: newGfxs }); }} />
                                              </div>
                                           </div>
                                           
                                           <div className="grid grid-cols-2 gap-2 mb-2">
                                              <div>
                                                 <label className="text-[8px] text-gray-600 font-bold uppercase">GFX CH</label>
                                                 <input type="number" className="w-full bg-[#111] border border-gray-800 rounded p-1 text-[10px] text-white"
                                                    value={gfx.channel || selectedItem.channel}
                                                    onChange={(e) => {
                                                       const newGfxs = [...selectedItem.gfxItems]; newGfxs[idx].channel = parseInt(e.target.value);
                                                       updateItem(selectedItem.uniqId, { gfxItems: newGfxs });
                                                    }} disabled={playlists.find(p=>p.items.includes(selectedItem))?.locked} />
                                              </div>
                                              <div>
                                                 <label className="text-[8px] text-gray-600 font-bold uppercase">Layer</label>
                                                 <input type="number" className="w-full bg-[#111] border border-gray-800 rounded p-1 text-[10px] text-white"
                                                    value={gfx.layer}
                                                    onChange={(e) => {
                                                       const newGfxs = [...selectedItem.gfxItems]; newGfxs[idx].layer = parseInt(e.target.value);
                                                       updateItem(selectedItem.uniqId, { gfxItems: newGfxs });
                                                    }} disabled={playlists.find(p=>p.items.includes(selectedItem))?.locked} />
                                              </div>
                                           </div>
                                           
                                           <div className="mb-2">
                                              <label className="flex items-center gap-2 cursor-pointer">
                                                 <input 
                                                    type="checkbox" 
                                                    checked={gfx.loop || false} 
                                                    onChange={(e) => {
                                                       const newGfxs = [...selectedItem.gfxItems]; newGfxs[idx].loop = e.target.checked;
                                                       updateItem(selectedItem.uniqId, { gfxItems: newGfxs });
                                                    }}
                                                    disabled={playlists.find(p=>p.items.includes(selectedItem))?.locked}
                                                 />
                                                 <span className="text-[9px] text-gray-400 font-bold uppercase">Loop (Infini)</span>
                                              </label>
                                           </div>

                                           {/* KEY/VALUE EDITOR */}
                                           <div className="space-y-1 mt-2 border-t border-gray-800 pt-2">
                                              <div className="flex justify-between text-[8px] text-gray-500 uppercase font-bold">
                                                 <span>Clé</span><span>Valeur</span>
                                              </div>
                                              {Object.entries(gfx.data).map(([key, val], kIdx) => (
                                                 <div key={kIdx} className="flex gap-1 items-center">
                                                    <input 
                                                       className="w-1/3 bg-black/30 border border-gray-800 text-[9px] text-purple-300 px-1 py-0.5"
                                                       value={key}
                                                       onChange={(e) => {
                                                          const newKey = e.target.value;
                                                          const newData = { ...gfx.data }; delete newData[key]; newData[newKey] = val;
                                                          const newGfxs = [...selectedItem.gfxItems]; newGfxs[idx].data = newData;
                                                          updateItem(selectedItem.uniqId, { gfxItems: newGfxs });
                                                       }}
                                                    />
                                                    <input 
                                                       className="flex-1 bg-black/30 border border-gray-800 text-[9px] text-white px-1 py-0.5"
                                                       value={val}
                                                       onChange={(e) => {
                                                          const newData = { ...gfx.data }; newData[key] = e.target.value;
                                                          const newGfxs = [...selectedItem.gfxItems]; newGfxs[idx].data = newData;
                                                          updateItem(selectedItem.uniqId, { gfxItems: newGfxs });
                                                       }}
                                                    />
                                                    <button onClick={() => {
                                                        const newData = { ...gfx.data }; delete newData[key];
                                                        const newGfxs = [...selectedItem.gfxItems]; newGfxs[idx].data = newData;
                                                        updateItem(selectedItem.uniqId, { gfxItems: newGfxs });
                                                    }}><Minus className="w-3 h-3 text-red-500"/></button>
                                                 </div>
                                              ))}
                                              <button 
                                                 onClick={() => {
                                                    const newData = { ...gfx.data, [`_KEY${Object.keys(gfx.data).length}`]: "" };
                                                    const newGfxs = [...selectedItem.gfxItems]; newGfxs[idx].data = newData;
                                                    updateItem(selectedItem.uniqId, { gfxItems: newGfxs });
                                                 }}
                                                 className="w-full text-[9px] text-gray-500 border border-dashed border-gray-800 hover:border-purple-500 mt-1 rounded flex items-center justify-center gap-1"
                                              >
                                                 <ListPlus className="w-3 h-3"/> Ajouter Champ
                                              </button>
                                           </div>
                                       </div>
                                   )}
                                </div>
                             );
                         })}
                      </div>
                   </section>
                   )}
                 </>
              ) : (
                 <div className="h-full flex flex-col items-center justify-center opacity-20 text-center">
                    <Command className="w-16 h-16 mb-4"/>
                    <p className="text-xs font-black uppercase tracking-widest">Aucune Sélection</p>
                 </div>
              )}
           </div>
        </aside>
        )}
      </div>
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #555; }
      `}</style>
    </div>
  );
}