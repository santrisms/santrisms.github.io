(function () {
  'use strict';

  // Constants
  const CONFIG_KEY = 'ytBattleConfig';
  const STATE_KEY = 'ytBattleScoresState';
  const CMD_KEY = 'ytBattleCommand';
  
  // State variables
  let apiKeys = [];
  let currentKeyIndex = 0;
  let activeTrackId = 'none';
  let playlistTracks = [];
  let player1PhotoData = null;
  let player2PhotoData = null;
  
  // Firebase variables
  let dbRef = null;
  let firebaseApp = null;
  
  // DOM Cache
  const dom = {};
  
  function cacheDom() {
    // Sync Mode
    dom.syncMode = document.getElementById('sync-mode');
    dom.fbSessionId = document.getElementById('fb-session-id');
    dom.firebaseConfigFields = document.getElementById('firebase-config-fields');
    dom.fbApiKey = document.getElementById('fb-api-key');
    dom.fbProjectId = document.getElementById('fb-project-id');
    dom.fbDatabaseUrl = document.getElementById('fb-database-url');

    // Dashboard
    dom.liveDashboard = document.getElementById('live-dashboard');
    dom.dashP1Name = document.getElementById('dash-p1-name');
    dom.dashP1Score = document.getElementById('dash-p1-score');
    dom.dashP2Name = document.getElementById('dash-p2-name');
    dom.dashP2Score = document.getElementById('dash-p2-score');
    dom.btnDashReset = document.getElementById('btn-dash-reset');
    dom.btnDashStop = document.getElementById('btn-dash-stop');
    dom.btnDashPlayBgm = document.getElementById('btn-dash-play-bgm');
    dom.btnDashPauseBgm = document.getElementById('btn-dash-pause-bgm');
    dom.btnDashStopBgm = document.getElementById('btn-dash-stop-bgm');
    dom.dashVolumeBgm = document.getElementById('dash-volume-bgm');
    dom.liveConnectionStatus = document.getElementById('live-connection-status');

    // API Keys
    dom.apiKeysList = document.getElementById('api-keys-list');
    dom.apiKeyNew = document.getElementById('api-key-new');
    dom.btnAddKey = document.getElementById('btn-add-key');
    dom.totalKeysCount = document.getElementById('total-keys-count');
    dom.activeKeyIndex = document.getElementById('active-key-index');

    // Config Input Fields
    dom.videoUrl = document.getElementById('video-url');
    dom.historyMode = document.getElementById('history-mode');
    dom.battleTitle = document.getElementById('battle-title');
    dom.player1Name = document.getElementById('player1-name');
    dom.player2Name = document.getElementById('player2-name');
    dom.player1Weight = document.getElementById('player1-weight');
    dom.player2Weight = document.getElementById('player2-weight');
    dom.player1InitialScore = document.getElementById('player1-initial-score');
    dom.player2InitialScore = document.getElementById('player2-initial-score');
    dom.photoShape = document.getElementById('photo-shape');
    dom.photoSize = document.getElementById('photo-size');
    dom.cardWidth = document.getElementById('card-width');
    dom.playerNameSize = document.getElementById('player-name-size');
    dom.playerScoreSize = document.getElementById('player-score-size');
    dom.player1Action = document.getElementById('player1-action');
    dom.player2Action = document.getElementById('player2-action');
    dom.player1ActionPoints = document.getElementById('player1-action-points');
    dom.player2ActionPoints = document.getElementById('player2-action-points');
    dom.showActionPoints = document.getElementById('show-action-points');
    dom.triggerTextInput = document.getElementById('trigger-text-input');
    dom.triggerFontSize = document.getElementById('trigger-font-size');
    dom.triggerAnimation = document.getElementById('trigger-animation');
    dom.ctaTextInput = document.getElementById('cta-text-input');
    dom.ctaFontSize = document.getElementById('cta-font-size');
    dom.ctaAnimation = document.getElementById('cta-animation');
    dom.celebrationEffect = document.getElementById('celebration-effect');
    dom.scaleTitle = document.getElementById('scale-title');
    dom.valScaleTitle = document.getElementById('val-scale-title');
    dom.scalePlayerCard = document.getElementById('scale-player-card');
    dom.valScalePlayerCard = document.getElementById('val-scale-player-card');
    dom.scaleTrigger = document.getElementById('scale-trigger');
    dom.valScaleTrigger = document.getElementById('val-scale-trigger');
    dom.scaleFeed = document.getElementById('scale-feed');
    dom.valScaleFeed = document.getElementById('val-scale-feed');
    dom.scaleCta = document.getElementById('scale-cta');
    dom.valScaleCta = document.getElementById('val-scale-cta');
    dom.feedHeight = document.getElementById('feed-height');
    dom.valFeedHeight = document.getElementById('val-feed-height');

    // Photos
    dom.player1Upload = document.getElementById('player1-upload');
    dom.player2Upload = document.getElementById('player2-upload');
    dom.player1Preview = document.getElementById('player1-preview');
    dom.player2Preview = document.getElementById('player2-preview');
    dom.uploadPlaceholder1 = document.getElementById('upload-placeholder-1');
    dom.uploadPlaceholder2 = document.getElementById('upload-placeholder-2');
    dom.uploadArea1 = document.getElementById('upload-area-1');
    dom.uploadArea2 = document.getElementById('upload-area-2');

    // Colors
    dom.colorPlayer1Card = document.getElementById('color-player1-card');
    dom.colorPlayer2Card = document.getElementById('color-player2-card');
    dom.colorTrigger = document.getElementById('color-trigger');
    dom.colorFeed = document.getElementById('color-feed');
    dom.colorCta = document.getElementById('color-cta');
    dom.valColorPlayer1Card = document.getElementById('val-color-player1-card');
    dom.valColorPlayer2Card = document.getElementById('val-color-player2-card');
    dom.valColorTrigger = document.getElementById('val-color-trigger');
    dom.valColorFeed = document.getElementById('val-color-feed');
    dom.valColorCta = document.getElementById('val-color-cta');

    // Opacities
    dom.opacityPlayer1Card = document.getElementById('opacity-player1-card');
    dom.opacityPlayer2Card = document.getElementById('opacity-player2-card');
    dom.opacityTrigger = document.getElementById('opacity-trigger');
    dom.opacityFeed = document.getElementById('opacity-feed');
    dom.opacityCta = document.getElementById('opacity-cta');
    dom.valOpacityPlayer1Card = document.getElementById('val-opacity-player1-card');
    dom.valOpacityPlayer2Card = document.getElementById('val-opacity-player2-card');
    dom.valOpacityTrigger = document.getElementById('val-opacity-trigger');
    dom.valOpacityFeed = document.getElementById('val-opacity-feed');
    dom.valOpacityCta = document.getElementById('val-opacity-cta');

    // Text Colors
    dom.colorPlayer1Text = document.getElementById('color-player1-text');
    dom.colorPlayer2Text = document.getElementById('color-player2-text');
    dom.valColorPlayer1Text = document.getElementById('val-color-player1-text');
    dom.valColorPlayer2Text = document.getElementById('val-color-player2-text');

    // Action Badges Colors
    dom.colorP1Badge = document.getElementById('color-p1-badge');
    dom.colorP1BadgeText = document.getElementById('color-p1-badge-text');
    dom.valColorP1Badge = document.getElementById('val-color-p1-badge');
    dom.valColorP1BadgeText = document.getElementById('val-color-p1-badge-text');

    dom.colorP2Badge = document.getElementById('color-p2-badge');
    dom.colorP2BadgeText = document.getElementById('color-p2-badge-text');
    dom.valColorP2Badge = document.getElementById('val-color-p2-badge');
    dom.valColorP2BadgeText = document.getElementById('val-color-p2-badge-text');

    // Music
    dom.bgmFile = document.getElementById('bgm-file');
    dom.bgmUrl = document.getElementById('bgm-url');
    dom.btnAddBgmUrl = document.getElementById('btn-add-bgm-url');
    dom.bgmPlaylistContainer = document.getElementById('bgm-playlist-container');

    // Fuzzy Match & Mock Simulation
    dom.fuzzyThreshold = document.getElementById('fuzzy-threshold');
    dom.mockP1Count = document.getElementById('mock-p1-count');
    dom.mockP2Count = document.getElementById('mock-p2-count');
    dom.mockEmojiOpt = document.getElementById('mock-emoji-opt');
    dom.btnSendMock = document.getElementById('btn-send-mock');

    // Main Actions
    dom.btnSave = document.getElementById('btn-save');
    dom.btnStart = document.getElementById('btn-start');
    dom.toastContainer = document.getElementById('toast-container');
  }

  // ==================== INDEXEDDB MUSIC STORE ====================
  let db;
  function initDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('ytBattleMusicDB', 1);
      request.onupgradeneeded = function (e) {
        const database = e.target.result;
        if (!database.objectStoreNames.contains('tracks')) {
          database.createObjectStore('tracks', { keyPath: 'id' });
        }
      };
      request.onsuccess = function (e) {
        db = e.target.result;
        resolve();
      };
      request.onerror = function (e) {
        console.error('IndexedDB open error:', e);
        reject(e);
      };
    });
  }

  function getAllTracks() {
    return new Promise((resolve) => {
      if (!db) return resolve([]);
      const tx = db.transaction('tracks', 'readonly');
      const store = tx.objectStore('tracks');
      const request = store.getAll();
      request.onsuccess = function () {
        resolve(request.result || []);
      };
      request.onerror = function () {
        resolve([]);
      };
    });
  }

  function saveTrack(track) {
    return new Promise((resolve) => {
      if (!db) return resolve(false);
      const tx = db.transaction('tracks', 'readwrite');
      const store = tx.objectStore('tracks');
      const request = store.put(track);
      request.onsuccess = function () {
        resolve(true);
      };
      request.onerror = function () {
        resolve(false);
      };
    });
  }

  function deleteTrackFromDb(id) {
    return new Promise((resolve) => {
      if (!db) return resolve(false);
      const tx = db.transaction('tracks', 'readwrite');
      const store = tx.objectStore('tracks');
      const request = store.delete(id);
      request.onsuccess = function () {
        resolve(true);
      };
      request.onerror = function () {
        resolve(false);
      };
    });
  }

  // ==================== MUSIC LOGIC ====================
  async function initMusic() {
    try {
      await initDb();
      const tracksFromDb = await getAllTracks();
      playlistTracks = tracksFromDb.map(track => {
        if (track.type === 'local' && track.data instanceof Blob) {
          track.src = URL.createObjectURL(track.data);
        } else {
          track.src = track.data; // string url
        }
        return track;
      });
      renderPlaylistUI();
    } catch (err) {
      console.error('Error initializing BGM storage:', err);
    }
  }

  function renderPlaylistUI() {
    dom.bgmPlaylistContainer.innerHTML = '';
    if (playlistTracks.length === 0) {
      dom.bgmPlaylistContainer.innerHTML = '<div style="color:var(--text-secondary); text-align:center; font-size:0.75rem; padding:8px;">Playlist Kosong</div>';
      return;
    }

    playlistTracks.forEach(track => {
      const item = document.createElement('div');
      item.className = 'api-key-item';
      item.style.display = 'flex';
      item.style.justifyContent = 'space-between';
      item.style.alignItems = 'center';
      item.style.padding = '4px 8px';
      item.style.marginBottom = '4px';
      item.style.background = track.id === activeTrackId ? 'rgba(168,85,247,0.15)' : 'rgba(255,255,255,0.03)';
      item.style.border = track.id === activeTrackId ? '1px solid var(--accent-purple)' : '1px solid rgba(255,255,255,0.05)';

      const info = document.createElement('span');
      info.style.fontSize = '0.72rem';
      info.style.overflow = 'hidden';
      info.style.textOverflow = 'ellipsis';
      info.style.whiteSpace = 'nowrap';
      info.style.flex = '1';
      info.textContent = (track.type === 'local' ? '📁 ' : '🔗 ') + track.name;
      info.style.cursor = 'pointer';
      
      // Select track on click
      info.addEventListener('click', () => {
        activeTrackId = track.id;
        saveConfig();
        renderPlaylistUI();
        sendBgmCommand('play', track.id);
        showToast(`Track "${track.name}" dipilih dan diputar!`, 'success');
      });

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'btn-key-delete';
      removeBtn.innerHTML = '✕';
      removeBtn.title = 'Hapus Track';
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteTrack(track.id);
      });

      item.appendChild(info);
      item.appendChild(removeBtn);
      dom.bgmPlaylistContainer.appendChild(item);
    });
  }

  async function handleAddLocalAudio(files) {
    if (!files || files.length === 0) return;
    showToast(`Mengimpor ${files.length} lagu...`, 'info');
    let loadedCount = 0;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const trackId = 'track_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
      const trackObj = {
        id: trackId,
        name: file.name,
        type: 'local',
        data: file
      };
      const ok = await saveTrack(trackObj);
      if (ok) {
        trackObj.src = URL.createObjectURL(file);
        playlistTracks.push(trackObj);
        loadedCount++;
      }
    }
    if (loadedCount > 0) {
      saveConfig();
      renderPlaylistUI();
      showToast(`Berhasil menambahkan ${loadedCount} lagu lokal!`, 'success');
    } else {
      showToast('Gagal menyimpan file audio ke database.', 'error');
    }
    dom.bgmFile.value = '';
  }

  async function handleAddOnlineUrl(urlInputEl) {
    const url = urlInputEl.value.trim();
    if (!url) return;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      showToast('URL musik harus diawali dengan http:// atau https://', 'error');
      return;
    }
    const name = url.substring(url.lastIndexOf('/') + 1) || 'Online Stream';
    const trackId = 'track_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    const trackObj = {
      id: trackId,
      name: name,
      type: 'online',
      data: url
    };
    const ok = await saveTrack(trackObj);
    if (ok) {
      trackObj.src = url;
      playlistTracks.push(trackObj);
      saveConfig();
      renderPlaylistUI();
      showToast('Musik online berhasil ditambahkan!', 'success');
      urlInputEl.value = '';
    } else {
      showToast('Gagal menyimpan track online.', 'error');
    }
  }

  async function deleteTrack(trackId) {
    const ok = await deleteTrackFromDb(trackId);
    if (ok) {
      const idx = playlistTracks.findIndex(t => t.id === trackId);
      if (idx !== -1) {
        const tr = playlistTracks[idx];
        if (tr.type === 'local' && tr.src) {
          URL.revokeObjectURL(tr.src);
        }
        playlistTracks.splice(idx, 1);
      }
      if (activeTrackId === trackId) {
        activeTrackId = 'none';
        sendBgmCommand('stop');
      }
      saveConfig();
      renderPlaylistUI();
      showToast('Lagu berhasil dihapus dari playlist!', 'success');
    } else {
      showToast('Gagal menghapus lagu dari database.', 'error');
    }
  }

  // ==================== CONFIGURATION MANAGEMENT ====================
  function saveConfig() {
    const config = {
      syncMode:           dom.syncMode.value,
      fbSessionId:        dom.fbSessionId.value.trim(),
      fbApiKey:           dom.fbApiKey.value.trim(),
      fbProjectId:        dom.fbProjectId.value.trim(),
      fbDatabaseUrl:      dom.fbDatabaseUrl.value.trim(),
      
      apiKeys:            apiKeys,
      currentKeyIndex:    currentKeyIndex,
      videoUrl:           dom.videoUrl.value.trim(),
      battleTitle:        dom.battleTitle.value.trim(),
      player1Name:        dom.player1Name.value.trim(),
      player2Name:        dom.player2Name.value.trim(),
      player1Weight:      parseInt(dom.player1Weight.value, 10) || 1,
      player2Weight:      parseInt(dom.player2Weight.value, 10) || 1,
      player1Photo:       player1PhotoData,
      player2Photo:       player2PhotoData,
      photoShape:         dom.photoShape.value,
      photoSize:          dom.photoSize.value,
      triggerText:        dom.triggerTextInput.value.trim(),
      triggerFontSize:    dom.triggerFontSize.value,
      triggerAnimation:   dom.triggerAnimation.value,
      ctaText:            dom.ctaTextInput.value.trim(),
      ctaFontSize:        dom.ctaFontSize.value,
      ctaAnimation:       dom.ctaAnimation.value,
      celebrationEffect:  dom.celebrationEffect.value,
      historyMode:        dom.historyMode.value,
      colorPlayer1Card:   dom.colorPlayer1Card.value,
      colorPlayer2Card:   dom.colorPlayer2Card.value,
      colorTrigger:       dom.colorTrigger.value,
      colorFeed:          dom.colorFeed.value,
      colorCta:           dom.colorCta.value,
      opacityPlayer1Card: parseFloat(dom.opacityPlayer1Card.value),
      opacityPlayer2Card: parseFloat(dom.opacityPlayer2Card.value),
      opacityTrigger:     parseFloat(dom.opacityTrigger.value),
      opacityFeed:        parseFloat(dom.opacityFeed.value),
      opacityCta:         parseFloat(dom.opacityCta.value),
      colorPlayer1Text:   dom.colorPlayer1Text.value,
      colorPlayer2Text:   dom.colorPlayer2Text.value,
      colorP1Badge:       dom.colorP1Badge.value,
      colorP1BadgeText:   dom.colorP1BadgeText.value,
      colorP2Badge:       dom.colorP2Badge.value,
      colorP2BadgeText:   dom.colorP2BadgeText.value,
      player1InitialScore: parseInt(dom.player1InitialScore.value, 10) || 0,
      player2InitialScore: parseInt(dom.player2InitialScore.value, 10) || 0,
      player1Action:      dom.player1Action.value,
      player2Action:      dom.player2Action.value,
      player1ActionPoints: parseInt(dom.player1ActionPoints.value, 10) || 5,
      player2ActionPoints: parseInt(dom.player2ActionPoints.value, 10) || 5,
       showActionPoints:   dom.showActionPoints.checked,
      fuzzyThreshold:     parseFloat(dom.fuzzyThreshold.value) || 0.8,
      cardWidth:          parseInt(dom.cardWidth.value, 10) || 260,
      playerNameSize:     parseFloat(dom.playerNameSize.value) || 1.5,
      playerScoreSize:    parseFloat(dom.playerScoreSize.value) || 5,
      scaleTitle:         parseInt(dom.scaleTitle.value, 10) !== undefined ? parseInt(dom.scaleTitle.value, 10) : 50,
      scalePlayerCard:    parseInt(dom.scalePlayerCard.value, 10) !== undefined ? parseInt(dom.scalePlayerCard.value, 10) : 50,
      scaleTrigger:       parseInt(dom.scaleTrigger.value, 10) !== undefined ? parseInt(dom.scaleTrigger.value, 10) : 50,
      scaleFeed:          parseInt(dom.scaleFeed.value, 10) !== undefined ? parseInt(dom.scaleFeed.value, 10) : 50,
      scaleCta:           parseInt(dom.scaleCta.value, 10) !== undefined ? parseInt(dom.scaleCta.value, 10) : 50,
      feedHeight:         parseInt(dom.feedHeight.value, 10) !== undefined ? parseInt(dom.feedHeight.value, 10) : 350,
      activeTrackId:      activeTrackId,
      playlist:           playlistTracks.map(t => ({ id: t.id, name: t.name, type: t.type }))
    };

    try {
      localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
      
      // Firebase Sync if Enabled
      if (config.syncMode === 'firebase' && dbRef) {
        dbRef.child('config').set(config);
      }
    } catch (err) {
      console.error('Failed to save config:', err);
      showToast('Gagal menyimpan setelan lokal!', 'error');
    }
  }

  function loadConfig() {
    try {
      const raw = localStorage.getItem(CONFIG_KEY);
      if (!raw) return;
      const config = JSON.parse(raw);

      // Sync settings
      if (config.syncMode) dom.syncMode.value = config.syncMode;
      dom.fbSessionId.value = config.fbSessionId || "default-session";
      dom.fbApiKey.value = config.fbApiKey || "AIzaSyAYNvoPQp6G2H5NOOKz8yqEN5dBELXTlLA";
      dom.fbProjectId.value = config.fbProjectId || "live-score-69d3d";
      dom.fbDatabaseUrl.value = config.fbDatabaseUrl || "https://live-score-69d3d-default-rtdb.firebaseio.com";

      // Inputs
      if (config.videoUrl) dom.videoUrl.value = config.videoUrl;
      if (config.battleTitle) dom.battleTitle.value = config.battleTitle;
      if (config.player1Name) dom.player1Name.value = config.player1Name;
      if (config.player2Name) dom.player2Name.value = config.player2Name;
      if (config.player1Weight) dom.player1Weight.value = config.player1Weight;
      if (config.player2Weight) dom.player2Weight.value = config.player2Weight;
      if (config.player1InitialScore !== undefined) dom.player1InitialScore.value = config.player1InitialScore;
      if (config.player2InitialScore !== undefined) dom.player2InitialScore.value = config.player2InitialScore;
      if (config.photoShape) dom.photoShape.value = config.photoShape;
      if (config.photoSize) dom.photoSize.value = config.photoSize;
      if (config.triggerText) dom.triggerTextInput.value = config.triggerText;
      if (config.triggerFontSize) dom.triggerFontSize.value = config.triggerFontSize;
      if (config.triggerAnimation) dom.triggerAnimation.value = config.triggerAnimation;
      if (config.ctaText) dom.ctaTextInput.value = config.ctaText;
      if (config.ctaFontSize) dom.ctaFontSize.value = config.ctaFontSize;
      if (config.ctaAnimation) dom.ctaAnimation.value = config.ctaAnimation;
      if (config.celebrationEffect) dom.celebrationEffect.value = config.celebrationEffect;
      if (config.historyMode) dom.historyMode.value = config.historyMode;
      if (config.player1Action) dom.player1Action.value = config.player1Action;
      if (config.player2Action) dom.player2Action.value = config.player2Action;
      if (config.player1ActionPoints !== undefined) dom.player1ActionPoints.value = config.player1ActionPoints;
      if (config.player2ActionPoints !== undefined) dom.player2ActionPoints.value = config.player2ActionPoints;
      if (config.showActionPoints !== undefined) dom.showActionPoints.checked = config.showActionPoints;
      if (config.fuzzyThreshold !== undefined) dom.fuzzyThreshold.value = config.fuzzyThreshold;
      if (config.cardWidth !== undefined) dom.cardWidth.value = config.cardWidth;
      if (config.playerNameSize !== undefined) dom.playerNameSize.value = config.playerNameSize;
      if (config.playerScoreSize !== undefined) dom.playerScoreSize.value = config.playerScoreSize;
      if (config.scaleTitle !== undefined) { dom.scaleTitle.value = config.scaleTitle; dom.valScaleTitle.textContent = config.scaleTitle + '%'; }
      if (config.scalePlayerCard !== undefined) { dom.scalePlayerCard.value = config.scalePlayerCard; dom.valScalePlayerCard.textContent = config.scalePlayerCard + '%'; }
      if (config.scaleTrigger !== undefined) { dom.scaleTrigger.value = config.scaleTrigger; dom.valScaleTrigger.textContent = config.scaleTrigger + '%'; }
      if (config.scaleFeed !== undefined) { dom.scaleFeed.value = config.scaleFeed; dom.valScaleFeed.textContent = config.scaleFeed + '%'; }
      if (config.scaleCta !== undefined) { dom.scaleCta.value = config.scaleCta; dom.valScaleCta.textContent = config.scaleCta + '%'; }
      if (config.feedHeight !== undefined) { dom.feedHeight.value = config.feedHeight; dom.valFeedHeight.textContent = config.feedHeight + 'px'; }

      // Colors
      if (config.colorPlayer1Card) dom.colorPlayer1Card.value = config.colorPlayer1Card;
      if (config.colorPlayer2Card) dom.colorPlayer2Card.value = config.colorPlayer2Card;
      if (config.colorTrigger) dom.colorTrigger.value = config.colorTrigger;
      if (config.colorFeed) dom.colorFeed.value = config.colorFeed;
      if (config.colorCta) dom.colorCta.value = config.colorCta;

      dom.valColorPlayer1Card.textContent = dom.colorPlayer1Card.value.toUpperCase();
      dom.valColorPlayer2Card.textContent = dom.colorPlayer2Card.value.toUpperCase();
      dom.valColorTrigger.textContent = dom.colorTrigger.value.toUpperCase();
      dom.valColorFeed.textContent = dom.colorFeed.value.toUpperCase();
      dom.valColorCta.textContent = dom.colorCta.value.toUpperCase();

      // Opacities
      if (config.opacityPlayer1Card !== undefined) dom.opacityPlayer1Card.value = config.opacityPlayer1Card;
      if (config.opacityPlayer2Card !== undefined) dom.opacityPlayer2Card.value = config.opacityPlayer2Card;
      if (config.opacityTrigger !== undefined) dom.opacityTrigger.value = config.opacityTrigger;
      if (config.opacityFeed !== undefined) dom.opacityFeed.value = config.opacityFeed;
      if (config.opacityCta !== undefined) dom.opacityCta.value = config.opacityCta;

      dom.valOpacityPlayer1Card.textContent = Math.round(dom.opacityPlayer1Card.value * 100) + '%';
      dom.valOpacityPlayer2Card.textContent = Math.round(dom.opacityPlayer2Card.value * 100) + '%';
      dom.valOpacityTrigger.textContent = Math.round(dom.opacityTrigger.value * 100) + '%';
      dom.valOpacityFeed.textContent = Math.round(dom.opacityFeed.value * 100) + '%';
      dom.valOpacityCta.textContent = Math.round(dom.opacityCta.value * 100) + '%';

      // Text Colors
      if (config.colorPlayer1Text) dom.colorPlayer1Text.value = config.colorPlayer1Text;
      if (config.colorPlayer2Text) dom.colorPlayer2Text.value = config.colorPlayer2Text;
      dom.valColorPlayer1Text.textContent = dom.colorPlayer1Text.value.toUpperCase();
      dom.valColorPlayer2Text.textContent = dom.colorPlayer2Text.value.toUpperCase();

      // Action Badges Colors
      if (config.colorP1Badge) dom.colorP1Badge.value = config.colorP1Badge;
      if (config.colorP1BadgeText) dom.colorP1BadgeText.value = config.colorP1BadgeText;
      if (config.colorP2Badge) dom.colorP2Badge.value = config.colorP2Badge;
      if (config.colorP2BadgeText) dom.colorP2BadgeText.value = config.colorP2BadgeText;

      dom.valColorP1Badge.textContent = dom.colorP1Badge.value.toUpperCase();
      dom.valColorP1BadgeText.textContent = dom.colorP1BadgeText.value.toUpperCase();
      dom.valColorP2Badge.textContent = dom.colorP2Badge.value.toUpperCase();
      dom.valColorP2BadgeText.textContent = dom.colorP2BadgeText.value.toUpperCase();

      // Photos preview
      if (config.player1Photo) {
        player1PhotoData = config.player1Photo;
        dom.player1Preview.src = player1PhotoData;
        dom.player1Preview.classList.remove('hidden');
        dom.uploadPlaceholder1.classList.add('hidden');
      }
      if (config.player2Photo) {
        player2PhotoData = config.player2Photo;
        dom.player2Preview.src = player2PhotoData;
        dom.player2Preview.classList.remove('hidden');
        dom.uploadPlaceholder2.classList.add('hidden');
      }

      // Keys
      if (config.apiKeys) apiKeys = config.apiKeys;
      if (config.currentKeyIndex !== undefined) currentKeyIndex = config.currentKeyIndex;
      
      // BGM
      if (config.activeTrackId) activeTrackId = config.activeTrackId;

      updateKeyDisplays();
    } catch (err) {
      console.warn('Failed to parse config on load:', err);
    }
  }

  // ==================== YOUTUBE DATA API KEYS MANAGEMENT ====================
  function addApiKey(key) {
    const trimmed = key.trim();
    if (!trimmed) return;
    if (apiKeys.some(k => k.key === trimmed)) {
      showToast('API Key sudah terdaftar!', 'warning');
      return;
    }
    apiKeys.push({
      key: trimmed,
      status: 'active',
      blockedAt: null
    });
    saveConfig();
    updateKeyDisplays();
    dom.apiKeyNew.value = '';
    showToast('API Key berhasil ditambahkan!', 'success');
  }

  function removeApiKey(index) {
    if (index >= 0 && index < apiKeys.length) {
      const removed = apiKeys.splice(index, 1);
      if (currentKeyIndex >= apiKeys.length) {
        currentKeyIndex = Math.max(0, apiKeys.length - 1);
      }
      saveConfig();
      updateKeyDisplays();
      showToast('API Key berhasil dihapus!', 'success');
    }
  }

  function updateKeyDisplays() {
    renderKeyList(dom.apiKeysList);
    dom.totalKeysCount.textContent = apiKeys.length;
    if (apiKeys.length === 0) {
      dom.activeKeyIndex.textContent = '-';
    } else {
      dom.activeKeyIndex.textContent = (currentKeyIndex + 1) + ' / ' + apiKeys.length;
    }
  }

  function renderKeyList(container) {
    container.innerHTML = '';
    if (apiKeys.length === 0) {
      container.innerHTML = '<div style="color:var(--text-secondary); text-align:center; font-size:0.75rem; padding:8px;">Belum ada API Key. Tambahkan di bawah.</div>';
      return;
    }

    const activeCount = apiKeys.filter(k => k.status === 'active').length;

    apiKeys.forEach((keyObj, index) => {
      const item = document.createElement('div');
      item.className = 'api-key-item';
      item.style.display = 'flex';
      item.style.justifyContent = 'space-between';
      item.style.alignItems = 'center';
      item.style.padding = '4px 8px';
      item.style.marginBottom = '4px';
      item.style.background = index === currentKeyIndex ? 'rgba(34, 197, 94, 0.1)' : 'rgba(255,255,255,0.03)';
      item.style.border = index === currentKeyIndex ? '1px solid var(--status-green)' : '1px solid rgba(255,255,255,0.05)';

      const mask = keyObj.key.substring(0, 8) + '...' + keyObj.key.substring(keyObj.key.length - 4);
      const isBlocked = keyObj.status === 'blocked';
      
      const badge = document.createElement('span');
      badge.style.fontSize = '0.68rem';
      badge.style.padding = '2px 6px';
      badge.style.borderRadius = '4px';
      badge.style.marginRight = '8px';
      if (isBlocked) {
        badge.style.background = 'rgba(239, 68, 68, 0.15)';
        badge.style.color = 'var(--status-red)';
        badge.textContent = 'Quota Limit';
      } else {
        badge.style.background = 'rgba(34, 197, 94, 0.15)';
        badge.style.color = 'var(--status-green)';
        badge.textContent = index === currentKeyIndex ? 'Active Key' : 'Ready';
      }

      const label = document.createElement('span');
      label.style.fontSize = '0.72rem';
      label.textContent = `#${index + 1} ${mask} `;
      label.appendChild(badge);

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'btn-key-delete';
      removeBtn.innerHTML = '✕';
      removeBtn.addEventListener('click', () => removeApiKey(index));

      item.appendChild(label);
      item.appendChild(removeBtn);
      container.appendChild(item);
    });
  }

  // ==================== FIREBASE REALTIME CONNECTION ====================
  function initFirebase() {
    const syncMode = dom.syncMode.value;
    const fbApiKey = dom.fbApiKey.value.trim();
    const fbProjectId = dom.fbProjectId.value.trim();
    const fbDatabaseUrl = dom.fbDatabaseUrl.value.trim();
    const sessionId = dom.fbSessionId.value.trim() || 'battle-default';

    if (syncMode !== 'firebase') {
      // Disconnect and use Local Storage
      if (dbRef) {
        dbRef.off();
        dbRef = null;
      }
      dom.liveDashboard.classList.add('hidden');
      return;
    }

    if (!fbApiKey || !fbProjectId || !fbDatabaseUrl) {
      showToast('Kredensial Firebase belum lengkap!', 'warning');
      return;
    }

    try {
      if (firebaseApp) {
        // App already initialized, just update database ref
        dbRef = firebase.database().ref('sessions/' + sessionId);
      } else {
        const firebaseConfig = {
          apiKey: fbApiKey,
          authDomain: fbProjectId + ".firebaseapp.com",
          databaseURL: fbDatabaseUrl,
          projectId: fbProjectId,
          storageBucket: fbProjectId + ".appspot.com"
        };
        firebaseApp = firebase.initializeApp(firebaseConfig);
        dbRef = firebase.database().ref('sessions/' + sessionId);
      }

      dom.liveDashboard.classList.remove('hidden');
      dom.liveConnectionStatus.textContent = 'Terhubung Online';
      dom.liveConnectionStatus.style.background = 'rgba(22, 163, 74, 0.15)';
      dom.liveConnectionStatus.style.color = 'var(--status-green)';

      // Listen to real-time state changes from OBS/Battle screen!
      dbRef.child('state').on('value', function(snapshot) {
        const state = snapshot.val();
        if (state) {
          dom.dashP1Score.textContent = state.player1 || 0;
          dom.dashP2Score.textContent = state.player2 || 0;
          
          if (state.isBattleRunning) {
            dom.liveDashboard.classList.remove('hidden');
            dom.btnStart.textContent = '🚀 Duel Berjalan (Terapkan Ulang)';
          } else {
            dom.btnStart.textContent = '🚀 Mulai & Terapkan Battle!';
          }
        }
      });
      
      // Listen to config changes to keep UI synchronized
      dbRef.child('config').on('value', function(snapshot) {
        const config = snapshot.val();
        if (config) {
          dom.dashP1Name.textContent = config.player1Name ? config.player1Name.split(',')[0].toUpperCase() : 'P1';
          dom.dashP2Name.textContent = config.player2Name ? config.player2Name.split(',')[0].toUpperCase() : 'P2';
        }
      });

    } catch (err) {
      console.error('Firebase connection error:', err);
      dom.liveConnectionStatus.textContent = 'Koneksi Error';
      dom.liveConnectionStatus.style.background = 'rgba(239, 68, 68, 0.15)';
      dom.liveConnectionStatus.style.color = 'var(--status-red)';
      showToast('Koneksi Firebase gagal! Cek data kredensial Anda.', 'error');
    }
  }

  // Local Storage listener for Local sync
  window.addEventListener('storage', function(e) {
    if (e.key === CONFIG_KEY) {
      loadConfig();
      updateKeyDisplays();
      if (dom.syncMode.value === 'local') {
        try {
          const cfg = JSON.parse(e.newValue);
          if (cfg) {
            dom.dashP1Name.textContent = cfg.player1Name ? cfg.player1Name.split(',')[0].toUpperCase() : 'P1';
            dom.dashP2Name.textContent = cfg.player2Name ? cfg.player2Name.split(',')[0].toUpperCase() : 'P2';
          }
        } catch (err) {
          // ignore
        }
      }
      return;
    }

    if (dom.syncMode.value === 'local') {
      if (e.key === STATE_KEY) {
        try {
          const state = JSON.parse(e.newValue);
          if (state) {
            dom.dashP1Score.textContent = state.player1 || 0;
            dom.dashP2Score.textContent = state.player2 || 0;
            if (state.isBattleRunning) {
              dom.liveDashboard.classList.remove('hidden');
            }
          }
        } catch (err) {
          // ignore
        }
      }
    }
  });

  // ==================== SEND COMMANDS ====================
  function sendCommand(action, data = {}) {
    const cmd = {
      action: action,
      data: data,
      timestamp: Date.now()
    };

    if (dom.syncMode.value === 'firebase' && dbRef) {
      dbRef.child('commands').set(cmd);
      if (action === 'start') {
        dbRef.child('state').update({ isBattleRunning: true });
      } else if (action === 'stop') {
        dbRef.child('state').update({ isBattleRunning: false });
      }
    } else {
      // Local Mode: set item to trigger storage event
      localStorage.setItem(CMD_KEY, JSON.stringify(cmd));
      
      // Update local state isBattleRunning
      try {
        const rawState = localStorage.getItem(STATE_KEY);
        const state = rawState ? JSON.parse(rawState) : {};
        if (action === 'start') {
          state.isBattleRunning = true;
          dom.liveDashboard.classList.remove('hidden');
        } else if (action === 'stop') {
          state.isBattleRunning = false;
        }
        localStorage.setItem(STATE_KEY, JSON.stringify(state));
      } catch (err) {
        // ignore
      }
    }
  }

  function sendBgmCommand(subAction, trackId = 'none') {
    const data = {
      action: subAction,
      trackId: trackId,
      volume: parseFloat(dom.dashVolumeBgm.value)
    };
    sendCommand('bgm', data);
  }

  // ==================== PHOTO UPLOAD HELPER ====================
  function handlePhotoUpload(player, event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('File harus berupa gambar!', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
      const dataUrl = e.target.result;
      if (player === 1) {
        player1PhotoData = dataUrl;
        dom.player1Preview.src = player1PhotoData;
        dom.player1Preview.classList.remove('hidden');
        dom.uploadPlaceholder1.classList.add('hidden');
      } else {
        player2PhotoData = dataUrl;
        dom.player2Preview.src = player2PhotoData;
        dom.player2Preview.classList.remove('hidden');
        dom.uploadPlaceholder2.classList.add('hidden');
      }
      saveConfig();
      showToast(`Foto Player ${player} berhasil diunggah!`, 'success');
    };
    reader.readAsDataURL(file);
  }

  // ==================== TOAST NOTIFICATIONS ====================
  function showToast(message, type = 'info', duration = 1000) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    // Simple color maps
    const colors = {
      success: 'linear-gradient(135deg, #22c55e 0%, #15803d 100%)',
      error: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
      warning: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
      info: 'linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)'
    };
    toast.style.background = colors[type] || colors.info;

    dom.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('toast-exit');
      toast.addEventListener('animationend', function () {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, { once: true });
    }, duration);
  }
  // ==================== MOCK COMMENTS SIMULATION ====================
  const MOCK_USERNAMES = [
    // Indonesian
    'putra_gacor', 'dian_official', 'budi_cyber', 'siti_gaming', 'ahmad_bola', 'faisal_pro', 'rizky_yt', 'andi_stream',
    'dewi_nonton', 'eko_fans', 'fajar_live', 'gita_pro', 'hendra_club', 'inda_tv', 'joko_boy', 'kartika_99',
    // English
    'alex_plays', 'emily_soccer', 'john_king', 'sarah_sweet', 'david_unstoppable', 'jessica_ch', 'michael_super',
    'rachel_star', 'james_goat', 'linda_football', 'robert_pro', 'patricia_tv', 'william_net', 'barbara_plays',
    // Spanish/Portuguese
    'carlos_bicho', 'maria_reina', 'jose_cr7', 'ana_messi', 'luis_elmejor', 'joao_siu', 'pedro_rey', 'isabella_gol',
    'miguel_futbol', 'sofia_cracks', 'fernando_pro', 'camila_campeon', 'diego_10', 'valentina_fan', 'gabriel_play',
    // Arabic
    'ahmed_alking', 'youssef_don', 'fatima_ball', 'omar_leomessi', 'zainab_sport', 'ali_legend', 'mariam_soccer',
    'mustafa_cr7', 'layla_goat', 'khaled_pro', 'mona_fans', 'ibrahim_football', 'nour_siu', 'hassan_tv',
    // Russian
    'ivan_football', 'dmitry_legend', 'olga_pro', 'elena_sport', 'sergey_gacor', 'anna_winner', 'alexey_cr7',
    'svetlana_goat', 'mikhail_99', 'tatiana_official', 'vladimir_plays', 'natasha_tv', 'andrey_net', 'marina_ch',
    // Japanese
    'takashi_soccer', 'yuki_gacor', 'sakura_chan', 'hiroshi_pro', 'kenji_legend', 'mayu_football', 'taro_king',
    'hanako_fans', 'shin_siu', 'yoko_tv', 'ken_plays', 'keiko_official', 'ryo_goles', 'miho_net'
  ];

  const MOCK_EMOJIS = ['🔥', '⚽', '🏆', '👑', '🐐', '💪', '👏', '⚡', '✨', '🤩', '🎯', '💯'];

  const WORD_TRANSLATIONS = {
    ronaldo: {
      id: 'Ronaldo', en: 'Ronaldo', ar: 'رونالدو', ru: 'Роналду', ja: 'ロナウド', es: 'Ronaldo'
    },
    messi: {
      id: 'Messi', en: 'Messi', ar: 'ميسي', ru: 'Месси', ja: 'メッシ', es: 'Messi'
    },
    surga: {
      id: 'Surga', en: 'Heaven', ar: 'الجنة', ru: 'Рай', ja: '天国', es: 'Paraíso'
    },
    neraka: {
      id: 'Neraka', en: 'Hell', ar: 'الجحيم', ru: 'Ад', ja: '地獄', es: 'Infierno'
    },
    kucing: {
      id: 'Kucing', en: 'Cat', ar: 'القط', ru: 'Кот', ja: '猫', es: 'Gato'
    },
    anjing: {
      id: 'Anjing', en: 'Dog', ar: 'الكلب', ru: 'Собака', ja: '犬', es: 'Perro'
    }
  };

  function getTranslations(word, defaultWord) {
    const w = word.toLowerCase();
    let match = null;
    for (const k in WORD_TRANSLATIONS) {
      if (w.includes(k) || k.includes(w)) {
        match = WORD_TRANSLATIONS[k];
        break;
      }
    }
    if (match) return match;
    return {
      id: defaultWord, en: defaultWord, ar: defaultWord, ru: defaultWord, ja: defaultWord, es: defaultWord
    };
  }

  function generateMockComments() {
    const p1Count = parseInt(dom.mockP1Count.value, 10) || 0;
    const p2Count = parseInt(dom.mockP2Count.value, 10) || 0;
    const includeEmoji = dom.mockEmojiOpt.value === 'yes';

    const p1Names = dom.player1Name.value.split(',').map(n => n.trim()).filter(Boolean);
    const p2Names = dom.player2Name.value.split(',').map(n => n.trim()).filter(Boolean);

    const p1Word = p1Names[0] || 'RONALDO';
    const p2Word = p2Names[0] || 'MESSI';

    const t1 = getTranslations(p1Word, p1Word);
    const t2 = getTranslations(p2Word, p2Word);

    const p1Templates = [
      // Indonesian
      `Ayo ${t1.id}!`,
      `${t1.id} pasti menang!`,
      `Go ${t1.id} GO!`,
      `${t1.id} nih bos senggol dong`,
      `Full support untuk ${t1.id}`,
      `${t1.id} juara kita`,
      // English
      `${t1.en} is the GOAT!`,
      `${t1.en} is the best ever!`,
      `Go ${t1.en}!`,
      `Unstoppable ${t1.en}!`,
      `${t1.en} is the king!`,
      // Spanish/Portuguese
      `¡Vamos ${t1.es}!`,
      `¡${t1.es} es el mejor del mundo!`,
      `¡El mejor de la historia ${t1.es}!`,
      // Arabic
      `${t1.ar} الأفضل في التاريخ! 🐐`,
      `عاش ${t1.ar}! 🔥`,
      `الأسطورة ${t1.ar}! ⚽`,
      // Russian
      `${t1.ru} лучший в мире!`,
      `Вперед ${t1.ru}!`,
      `${t1.ru} легенда!`,
      // Japanese
      `${t1.ja}最高！🔥`,
      `行け ${t1.ja}！⚽`,
      `${t1.ja}が一番！🏆`
    ];

    const p2Templates = [
      // Indonesian
      `Ayo ${t2.id}!`,
      `${t2.id} pasti menang!`,
      `Go ${t2.id} GO!`,
      `${t2.id} nih bos senggol dong`,
      `Full support untuk ${t2.id}`,
      `${t2.id} juara kita`,
      // English
      `${t2.en} is the GOAT!`,
      `${t2.en} is the best ever!`,
      `Go ${t2.en}!`,
      `Unstoppable ${t2.en}!`,
      `${t2.en} is the king!`,
      // Spanish/Portuguese
      `¡Vamos ${t2.es}!`,
      `¡${t2.es} es el mejor del mundo!`,
      `¡El mejor de la historia ${t2.es}!`,
      // Arabic
      `${t2.ar} الأفضل في التاريخ! 🐐`,
      `عاش ${t2.ar}! 🔥`,
      `الأسطورة ${t2.ar}! ⚽`,
      // Russian
      `${t2.ru} лучший в мире!`,
      `Вперед ${t2.ru}!`,
      `${t2.ru} легенда!`,
      // Japanese
      `${t2.ja}最高！🔥`,
      `行け ${t2.ja}！⚽`,
      `${t2.ja}が一番！🏆`
    ];

    const generated = [];

    // Helper to generate a random comment item
    function makeComment(playerNum, word, templates) {
      const baseName = MOCK_USERNAMES[Math.floor(Math.random() * MOCK_USERNAMES.length)];
      const hasSuffix = Math.random() > 0.5;
      const suffix = hasSuffix ? ['_123', '_88', '_99', '_77', '99', '07', '10', '7'][Math.floor(Math.random() * 8)] : '';
      const username = baseName + suffix;
      const avatarUrl = `https://api.dicebear.com/7.x/adventurer/svg?seed=${username}`;
      
      let message = templates[Math.floor(Math.random() * templates.length)];
      if (includeEmoji) {
        const emojiCount = Math.floor(Math.random() * 2) + 1;
        for (let i = 0; i < emojiCount; i++) {
          message += ' ' + MOCK_EMOJIS[Math.floor(MOCK_EMOJIS.length * Math.random())];
        }
      }

      return {
        id: 'mock_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        authorDetails: {
          displayName: username,
          profileImageUrl: avatarUrl
        },
        snippet: {
          displayMessage: message
        }
      };
    }

    // Add Player 1 comments
    for (let i = 0; i < p1Count; i++) {
      generated.push(makeComment(1, p1Word, p1Templates));
    }
    // Add Player 2 comments
    for (let i = 0; i < p2Count; i++) {
      generated.push(makeComment(2, p2Word, p2Templates));
    }

    // Shuffle generated comments so they arrive mixed
    for (let i = generated.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [generated[i], generated[j]] = [generated[j], generated[i]];
    }

    return generated;
  }

  function sendMockComments() {
    const comments = generateMockComments();
    if (comments.length === 0) {
      showToast('Masukkan jumlah komentar > 0!', 'warning');
      return;
    }
    sendCommand('mock_comments', comments);
    showToast(`Berhasil mengirim ${comments.length} komentar simulasi!`, 'success');
  }

  // ==================== BIND EVENTS ====================
  function bindEvents() {
    // Sync Mode Toggle
    dom.syncMode.addEventListener('change', (e) => {
      if (e.target.value === 'firebase') {
        dom.firebaseConfigFields.classList.remove('hidden');
      } else {
        dom.firebaseConfigFields.classList.add('hidden');
      }
      saveConfig();
      initFirebase();
    });

    // Firebase Credentials inputs
    dom.fbSessionId.addEventListener('input', () => { saveConfig(); initFirebase(); });
    dom.fbApiKey.addEventListener('input', () => { saveConfig(); initFirebase(); });
    dom.fbProjectId.addEventListener('input', () => { saveConfig(); initFirebase(); });
    dom.fbDatabaseUrl.addEventListener('input', () => { saveConfig(); initFirebase(); });

    // API Keys Add
    dom.btnAddKey.addEventListener('click', () => {
      addApiKey(dom.apiKeyNew.value);
    });
    dom.apiKeyNew.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') addApiKey(dom.apiKeyNew.value);
    });

    // File Uploads
    dom.uploadArea1.addEventListener('click', () => dom.player1Upload.click());
    dom.uploadArea2.addEventListener('click', () => dom.player2Upload.click());
    dom.player1Upload.addEventListener('change', (e) => handlePhotoUpload(1, e));
    dom.player2Upload.addEventListener('change', (e) => handlePhotoUpload(2, e));

    // Colors real-time updating hex values
    dom.colorPlayer1Card.addEventListener('input', (e) => { dom.valColorPlayer1Card.textContent = e.target.value.toUpperCase(); saveConfig(); });
    dom.colorPlayer2Card.addEventListener('input', (e) => { dom.valColorPlayer2Card.textContent = e.target.value.toUpperCase(); saveConfig(); });
    dom.colorTrigger.addEventListener('input', (e) => { dom.valColorTrigger.textContent = e.target.value.toUpperCase(); saveConfig(); });
    dom.colorFeed.addEventListener('input', (e) => { dom.valColorFeed.textContent = e.target.value.toUpperCase(); saveConfig(); });
    dom.colorCta.addEventListener('input', (e) => { dom.valColorCta.textContent = e.target.value.toUpperCase(); saveConfig(); });

    // Scales real-time updating text labels
    dom.scaleTitle.addEventListener('input', (e) => { dom.valScaleTitle.textContent = e.target.value + '%'; saveConfig(); });
    dom.scalePlayerCard.addEventListener('input', (e) => { dom.valScalePlayerCard.textContent = e.target.value + '%'; saveConfig(); });
    dom.scaleTrigger.addEventListener('input', (e) => { dom.valScaleTrigger.textContent = e.target.value + '%'; saveConfig(); });
    dom.scaleFeed.addEventListener('input', (e) => { dom.valScaleFeed.textContent = e.target.value + '%'; saveConfig(); });
    dom.scaleCta.addEventListener('input', (e) => { dom.valScaleCta.textContent = e.target.value + '%'; saveConfig(); });
    dom.feedHeight.addEventListener('input', (e) => { dom.valFeedHeight.textContent = e.target.value + 'px'; saveConfig(); });

    // Opacities real-time updating text labels
    dom.opacityPlayer1Card.addEventListener('input', (e) => { dom.valOpacityPlayer1Card.textContent = Math.round(e.target.value * 100) + '%'; saveConfig(); });
    dom.opacityPlayer2Card.addEventListener('input', (e) => { dom.valOpacityPlayer2Card.textContent = Math.round(e.target.value * 100) + '%'; saveConfig(); });
    dom.opacityTrigger.addEventListener('input', (e) => { dom.valOpacityTrigger.textContent = Math.round(e.target.value * 100) + '%'; saveConfig(); });
    dom.opacityFeed.addEventListener('input', (e) => { dom.valOpacityFeed.textContent = Math.round(e.target.value * 100) + '%'; saveConfig(); });
    dom.opacityCta.addEventListener('input', (e) => { dom.valOpacityCta.textContent = Math.round(e.target.value * 100) + '%'; saveConfig(); });

    // Text Colors real-time updating
    dom.colorPlayer1Text.addEventListener('input', (e) => { dom.valColorPlayer1Text.textContent = e.target.value.toUpperCase(); saveConfig(); });
    dom.colorPlayer2Text.addEventListener('input', (e) => { dom.valColorPlayer2Text.textContent = e.target.value.toUpperCase(); saveConfig(); });

    // Action Badges Colors real-time updating
    dom.colorP1Badge.addEventListener('input', (e) => { dom.valColorP1Badge.textContent = e.target.value.toUpperCase(); saveConfig(); });
    dom.colorP1BadgeText.addEventListener('input', (e) => { dom.valColorP1BadgeText.textContent = e.target.value.toUpperCase(); saveConfig(); });
    dom.colorP2Badge.addEventListener('input', (e) => { dom.valColorP2Badge.textContent = e.target.value.toUpperCase(); saveConfig(); });
    dom.colorP2BadgeText.addEventListener('input', (e) => { dom.valColorP2BadgeText.textContent = e.target.value.toUpperCase(); saveConfig(); });

    // BGM Actions
    dom.bgmFile.addEventListener('change', (e) => handleAddLocalAudio(e.target.files));
    dom.btnAddBgmUrl.addEventListener('click', () => handleAddOnlineUrl(dom.bgmUrl));
    dom.bgmUrl.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleAddOnlineUrl(dom.bgmUrl);
    });

    // Save & Start actions
    dom.btnSave.addEventListener('click', () => {
      saveConfig();
      showToast('Setelan berhasil disimpan!', 'success');
    });

    dom.btnStart.addEventListener('click', () => {
      // Reset blocked status and start at the first key
      apiKeys.forEach(k => {
        k.status = 'active';
        k.blockedAt = null;
      });
      currentKeyIndex = 0;
      saveConfig();
      sendCommand('start');
      dom.liveDashboard.classList.remove('hidden');
      showToast('Sinyal MULAI dikirimkan ke Layar OBS!', 'success');
      updateKeyDisplays();
    });

    // Dashboard Buttons
    dom.btnDashReset.addEventListener('click', () => {
      sendCommand('reset');
      showToast('Skor di-reset ke awal!', 'warning');
    });
    dom.btnDashStop.addEventListener('click', () => {
      sendCommand('stop');
      dom.liveDashboard.classList.add('hidden');
      showToast('Pertandingan dihentikan!', 'error');
    });

    // Dashboard BGM Remote Controls
    dom.btnDashPlayBgm.addEventListener('click', () => sendBgmCommand('play', activeTrackId));
    dom.btnDashPauseBgm.addEventListener('click', () => sendBgmCommand('pause'));
    dom.btnDashStopBgm.addEventListener('click', () => sendBgmCommand('stop'));
    dom.dashVolumeBgm.addEventListener('input', () => sendBgmCommand('volume'));

    // Simulation comments
    dom.btnSendMock.addEventListener('click', sendMockComments);
  }

  // ==================== INITIALIZATION ====================
  async function init() {
    cacheDom();
    await initMusic();
    loadConfig();
    
    // Check for room/session parameters in URL
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room') || urlParams.get('session');
    if (roomParam) {
      config.syncMode = 'firebase';
      config.fbSessionId = roomParam.trim();
      dom.syncMode.value = 'firebase';
      dom.fbSessionId.value = roomParam.trim();
      try {
        localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
      } catch (err) {}
    }

    // Enable/disable Firebase Config views initially
    if (dom.syncMode.value === 'firebase') {
      dom.firebaseConfigFields.classList.remove('hidden');
    } else {
      dom.firebaseConfigFields.classList.add('hidden');
    }

    bindEvents();
    initFirebase();
  }

  // Run on page load
  window.addEventListener('DOMContentLoaded', init);

})();
