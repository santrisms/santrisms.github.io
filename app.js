(function () {
  'use strict';

  // ──────────────────────────────────────────────
  // Constants & Storage Keys
  // ──────────────────────────────────────────────
  const CONFIG_KEY = 'ytBattleConfig';
  const STATE_KEY = 'ytBattleScoresState';
  const CMD_KEY = 'ytBattleCommand';
  const MAX_FEED_ITEMS = 100;
  const TOAST_DURATION = 4000;
  const SCORE_ANIM_DURATION = 500;
  const CPM_UPDATE_INTERVAL = 5000;
  const MAX_RETRIES = 3;
  const RETRY_DELAY_BASE = 2000;

  // Action mapping
  const ACTION_MAPPING = {
    like: { emoji: '👍', text: 'LIKE', className: 'action-like' },
    subscribe: { emoji: '🔔', text: 'SUBSCRIBE', className: 'action-subscribe' },
    comment: { emoji: '💬', text: 'COMMENT', className: 'action-comment' },
    share: { emoji: '🔄', text: 'SHARE', className: 'action-share' }
  };

  // ──────────────────────────────────────────────
  // State variables
  // ──────────────────────────────────────────────
  const config = {};
  const scores = { player1: 0, player2: 0 };
  const displayedScores = { player1: 0, player2: 0 };
  
  let userVotes = {};
  let commentHistory = [];
  let totalProcessed = 0;
  
  let isPolling = false;
  let isBattleRunning = false;
  let feedComments = [];
  let pollTimeoutId = null;
  let cpmIntervalId = null;

  let currentLiveChatId = null;
  let currentPageToken = null;
  let processedCommentIds = new Set();
  let retryCount = 0;

  let player1PhotoData = null;
  let player2PhotoData = null;
  let activeCelebrationEffect = 'stars';

  // API Rotation Keys
  let apiKeys = [];
  let currentKeyIndex = 0;

  // Firebase
  let dbRef = null;
  let firebaseApp = null;
  let lastCommandTimestamp = 0;

  // BGM Playlist
  let activeTrackId = 'none';
  let playlistTracks = [];

  // DOM elements cache
  const dom = {};

  function cacheDom() {
    dom.battleDisplay    = document.getElementById('battle-display');
    dom.displayTitle     = document.getElementById('display-title');
    dom.p1Photo          = document.getElementById('p1-photo');
    dom.p2Photo          = document.getElementById('p2-photo');
    dom.p1Name           = document.getElementById('p1-name');
    dom.p2Name           = document.getElementById('p2-name');
    dom.p1Score          = document.getElementById('p1-score');
    dom.p2Score          = document.getElementById('p2-score');
    dom.p1Percent        = document.getElementById('p1-percent');
    dom.p2Percent        = document.getElementById('p2-percent');
    dom.p1Bar            = document.getElementById('p1-bar');
    dom.p2Bar            = document.getElementById('p2-bar');
    dom.displayTrigger   = document.getElementById('display-trigger');
    dom.feedContainer    = document.getElementById('feed-container');
    dom.displayCta       = document.getElementById('display-cta');
    dom.connectionStatus = document.getElementById('connection-status');
    dom.bgParticles      = document.getElementById('bg-particles');
    dom.scoreboard       = document.querySelector('.scoreboard');
    
    // Scale Wrappers
    dom.battleHeaderWrapper = document.querySelector('.battle-header-scale-wrapper');
    dom.scoreboardWrapper   = document.querySelector('.scoreboard-scale-wrapper');
    dom.triggerWrapper      = document.querySelector('.trigger-scale-wrapper');
    dom.feedWrapper         = document.querySelector('.live-feed-scale-wrapper');
    dom.ctaWrapper          = document.querySelector('.cta-scale-wrapper');
    
    // Top Controls
    dom.btnBack          = document.getElementById('btn-back');
    dom.btnFullscreen    = document.getElementById('btn-fullscreen');

    // Action Badges
    dom.p1ActionBadge    = document.getElementById('p1-action-badge');
    dom.p2ActionBadge    = document.getElementById('p2-action-badge');

    // Popover Audio Controls
    dom.btnAudioPopoverToggle = document.getElementById('btn-audio-popover-toggle');
    dom.audioSettingsPopover  = document.getElementById('audio-settings-popover');
    dom.btnAudioPlay          = document.getElementById('btn-audio-play');
    dom.btnAudioPause         = document.getElementById('btn-audio-pause');
    dom.btnAudioStop          = document.getElementById('btn-audio-stop');
    dom.audioVolume           = document.getElementById('audio-volume');
    dom.audioLoop             = document.getElementById('audio-loop');
    dom.audioStatusText       = document.getElementById('audio-status-text');
    dom.audioTrackSelect      = document.getElementById('audio-track-select');

    dom.toastContainer   = document.getElementById('toast-container');
  }

  // BGM Audio handle
  const bgmAudio = new Audio();
  bgmAudio.loop = true;

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

  async function initMusic() {
    try {
      await initDb();
      const tracksFromDb = await getAllTracks();
      playlistTracks = tracksFromDb.map(track => {
        if (track.type === 'local' && track.data instanceof Blob) {
          track.src = URL.createObjectURL(track.data);
        } else {
          track.src = track.data;
        }
        return track;
      });
      populateTrackDropdown();
    } catch (err) {
      console.warn('Error loading playlist from IndexedDB:', err);
    }
  }

  function populateTrackDropdown() {
    if (!dom.audioTrackSelect) return;
    dom.audioTrackSelect.innerHTML = '<option value="none">Kosong</option>';
    playlistTracks.forEach(track => {
      const opt = document.createElement('option');
      opt.value = track.id;
      opt.textContent = (track.type === 'local' ? '📁 ' : '🔗 ') + track.name;
      dom.audioTrackSelect.appendChild(opt);
    });
    dom.audioTrackSelect.value = activeTrackId;
  }

  function loadActiveTrackSrc(trackId) {
    if (activeTrackId === trackId && bgmAudio.src) {
      if (dom.audioTrackSelect) dom.audioTrackSelect.value = trackId;
      return;
    }

    activeTrackId = trackId;
    if (dom.audioTrackSelect) dom.audioTrackSelect.value = trackId;
    
    if (trackId === 'none') {
      bgmAudio.src = '';
      updateAudioWidgetStatus();
      return;
    }
    const track = playlistTracks.find(t => t.id === trackId);
    if (track && track.src) {
      bgmAudio.src = track.src;
    } else {
      bgmAudio.src = '';
    }
    updateAudioWidgetStatus();
  }

  // BGM Auto-Advance (Playlist Loop)
  bgmAudio.addEventListener('ended', function () {
    if (bgmAudio.loop) return;
    if (playlistTracks.length <= 1) return;
    const currentIdx = playlistTracks.findIndex(t => t.id === activeTrackId);
    if (currentIdx !== -1) {
      const nextIdx = (currentIdx + 1) % playlistTracks.length;
      const nextTrack = playlistTracks[nextIdx];
      loadActiveTrackSrc(nextTrack.id);
      playBgm();
      showToast(`Memutar track selanjutnya: ${nextTrack.name}`, 'info', 1000);
    }
  });

  // ==================== CONFIGURATION MANAGEMENT ====================
  function loadConfig() {
    try {
      const raw = localStorage.getItem(CONFIG_KEY);
      if (!raw) return;
      const loaded = JSON.parse(raw);
      Object.assign(config, loaded);

      if (config.apiKeys) apiKeys = config.apiKeys;
      if (config.currentKeyIndex !== undefined) currentKeyIndex = config.currentKeyIndex;
      if (config.activeTrackId) activeTrackId = config.activeTrackId;
    } catch (err) {
      console.warn('Failed to parse config on load:', err);
    }
  }

  function applyConfigToUi() {
    try {
      dom.displayTitle.textContent = config.battleTitle || '⚔️ YouTube Battle';
      dom.p1Name.textContent = config.player1Name ? config.player1Name.split(',')[0].toUpperCase() : 'PLAYER 1';
      dom.p2Name.textContent = config.player2Name ? config.player2Name.split(',')[0].toUpperCase() : 'PLAYER 2';

      // Photos
      if (config.player1Photo) {
        player1PhotoData = config.player1Photo;
        dom.p1Photo.src = player1PhotoData;
        dom.p1Photo.style.display = 'block';
      } else {
        dom.p1Photo.style.display = 'none';
      }

      if (config.player2Photo) {
        player2PhotoData = config.player2Photo;
        dom.p2Photo.src = player2PhotoData;
        dom.p2Photo.style.display = 'block';
      } else {
        dom.p2Photo.style.display = 'none';
      }

      const p1Wrapper = dom.p1Photo.closest('.player-photo-wrapper');
      const p2Wrapper = dom.p2Photo.closest('.player-photo-wrapper');
      applyPhotoStyle(p1Wrapper, dom.p1Photo, config.photoShape || 'bulat', config.photoSize || '150');
      applyPhotoStyle(p2Wrapper, dom.p2Photo, config.photoShape || 'bulat', config.photoSize || '150');

      // Trigger Text
      dom.displayTrigger.textContent = config.triggerText || '';
      dom.displayTrigger.className = 'trigger-text';
      dom.displayTrigger.classList.add('fs-' + (config.triggerFontSize || '28'));
      if (config.triggerAnimation && config.triggerAnimation !== 'static') {
        dom.displayTrigger.classList.add('anim-' + config.triggerAnimation);
      }

      // Bottom CTA
      dom.displayCta.textContent = config.ctaText || '';
      dom.displayCta.className = 'bottom-cta-text';
      dom.displayCta.classList.add('fs-' + (config.ctaFontSize || '20'));
      if (config.ctaAnimation && config.ctaAnimation !== 'static') {
        dom.displayCta.classList.add('anim-' + config.ctaAnimation);
      }

      activeCelebrationEffect = config.celebrationEffect || 'stars';

      // Colors
      const colorPlayer1Card = config.colorPlayer1Card || '#11052c';
      const colorPlayer2Card = config.colorPlayer2Card || '#11052c';
      const colorTrigger = config.colorTrigger || '#11052c';
      const colorFeed = config.colorFeed || '#11052c';
      const colorCta = config.colorCta || '#a855f7';
      const colorPlayer1Text = config.colorPlayer1Text || '#ffb703';
      const colorPlayer2Text = config.colorPlayer2Text || '#219ebc';
      const colorP1Badge = config.colorP1Badge || '#ef4444';
      const colorP1BadgeText = config.colorP1BadgeText || '#ffffff';
      const colorP2Badge = config.colorP2Badge || '#3b82f6';
      const colorP2BadgeText = config.colorP2BadgeText || '#ffffff';

      const opacityPlayer1Card = config.opacityPlayer1Card !== undefined ? parseFloat(config.opacityPlayer1Card) : 0.4;
      const opacityPlayer2Card = config.opacityPlayer2Card !== undefined ? parseFloat(config.opacityPlayer2Card) : 0.4;
      const opacityTrigger = config.opacityTrigger !== undefined ? parseFloat(config.opacityTrigger) : 0.35;
      const opacityFeed = config.opacityFeed !== undefined ? parseFloat(config.opacityFeed) : 0.35;
      const opacityCta = config.opacityCta !== undefined ? parseFloat(config.opacityCta) : 0.15;

      applyColors(
        colorPlayer1Card, colorPlayer2Card, colorTrigger, colorFeed, colorCta,
        opacityPlayer1Card, opacityPlayer2Card, opacityTrigger, opacityFeed, opacityCta,
        colorPlayer1Text, colorPlayer2Text,
        colorP1Badge, colorP2Badge, colorP1BadgeText, colorP2BadgeText
      );

      // Sizing
      const cardWidth = config.cardWidth !== undefined ? parseInt(config.cardWidth, 10) : 260;
      const playerNameSize = config.playerNameSize !== undefined ? parseFloat(config.playerNameSize) : 1.5;
      const playerScoreSize = config.playerScoreSize !== undefined ? parseFloat(config.playerScoreSize) : 5;

      if (dom.scoreboard) {
        dom.scoreboard.style.setProperty('--player-card-width', cardWidth + 'px');
        dom.scoreboard.style.setProperty('--player-name-size', playerNameSize + 'rem');
        dom.scoreboard.style.setProperty('--player-score-size', playerScoreSize + 'rem');
      }

      const feedHeight = config.feedHeight !== undefined ? parseInt(config.feedHeight, 10) : 350;
      const liveFeedEl = document.querySelector('.live-feed');
      if (liveFeedEl) {
        liveFeedEl.style.setProperty('--feed-height', feedHeight + 'px');
      }

      // Apply Sizing Scales (0% to 100% mapped to 0.0 to 2.0 scale)
      const scaleTitle = config.scaleTitle !== undefined ? config.scaleTitle / 50 : 1.0;
      const scalePlayerCard = config.scalePlayerCard !== undefined ? config.scalePlayerCard / 50 : 1.0;
      const scaleTrigger = config.scaleTrigger !== undefined ? config.scaleTrigger / 50 : 1.0;
      const scaleFeed = config.scaleFeed !== undefined ? config.scaleFeed / 50 : 1.0;
      const scaleCta = config.scaleCta !== undefined ? config.scaleCta / 50 : 1.0;

      document.documentElement.style.setProperty('--scale-title', scaleTitle);
      document.documentElement.style.setProperty('--scale-player-card', scalePlayerCard);
      document.documentElement.style.setProperty('--scale-trigger', scaleTrigger);
      document.documentElement.style.setProperty('--scale-feed', scaleFeed);
      document.documentElement.style.setProperty('--scale-cta', scaleCta);

      // Apply Zoom directly as inline style to the wrappers (dual-safety for Chrome variable zoom bug)
      if (dom.battleHeaderWrapper) {
        dom.battleHeaderWrapper.style.zoom = scaleTitle;
        dom.battleHeaderWrapper.style.display = scaleTitle === 0 ? 'none' : '';
      }
      
      if (dom.scoreboardWrapper) {
        dom.scoreboardWrapper.style.zoom = scalePlayerCard;
        dom.scoreboardWrapper.style.display = scalePlayerCard === 0 ? 'none' : '';
      }

      if (dom.triggerWrapper) {
        dom.triggerWrapper.style.zoom = scaleTrigger;
        dom.triggerWrapper.style.display = scaleTrigger === 0 ? 'none' : '';
      }

      if (dom.feedWrapper) {
        dom.feedWrapper.style.zoom = scaleFeed;
        dom.feedWrapper.style.display = scaleFeed === 0 ? 'none' : '';
      }

      if (dom.ctaWrapper) {
        dom.ctaWrapper.style.zoom = scaleCta;
        dom.ctaWrapper.style.display = scaleCta === 0 ? 'none' : '';
      }

      // Actions
      const p1Action = config.player1Action || 'none';
      const p2Action = config.player2Action || 'none';
      updateActionBadge(dom.p1ActionBadge, p1Action, 'player1');
      updateActionBadge(dom.p2ActionBadge, p2Action, 'player2');

      // Music tracks
      if (playlistTracks.length > 0) {
        populateTrackDropdown();
        loadActiveTrackSrc(activeTrackId);
      }

    } catch (err) {
      console.warn('Failed to apply config:', err);
    }
  }

  function applyPhotoStyle(wrapper, photo, shape, size) {
    if (!wrapper || !photo) return;
    wrapper.style.width = size + 'px';
    wrapper.style.height = size + 'px';
    
    wrapper.classList.remove('shape-bulat', 'shape-kotak', 'shape-olive');
    photo.classList.remove('shape-bulat', 'shape-kotak', 'shape-olive');

    wrapper.classList.add('shape-' + shape);
    photo.classList.add('shape-' + shape);
  }

  function hexToRgba(hex, alpha) {
    hex = hex.replace('#', '');
    if (hex.length === 3) {
      hex = hex.split('').map(char => char + char).join('');
    }
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function applyColors(cCard1, cCard2, cTrigger, cFeed, cCta, opCard1, opCard2, opTrigger, opFeed, opCta, cText1, cText2, cBadge1, cBadge2, cBadgeText1, cBadgeText2) {
    document.querySelectorAll('.player-card.player-1').forEach(el => {
      el.style.backgroundColor = hexToRgba(cCard1, opCard1);
    });
    document.querySelectorAll('.player-card.player-2').forEach(el => {
      el.style.backgroundColor = hexToRgba(cCard2, opCard2);
    });

    const triggerWrap = document.querySelector('.trigger-text-wrapper');
    if (triggerWrap) {
      triggerWrap.style.backgroundColor = hexToRgba(cTrigger, opTrigger);
    }

    const feedEl = document.querySelector('.live-feed');
    if (feedEl) {
      feedEl.style.backgroundColor = hexToRgba(cFeed, opFeed);
    }

    const ctaText = document.querySelector('.bottom-cta-text');
    if (ctaText) {
      ctaText.style.backgroundColor = hexToRgba(cCta, opCta);
      ctaText.style.borderColor = hexToRgba(cCta, opCta * 1.5 > 1 ? 1 : opCta * 1.5);
    }

    // Text colors
    if (dom.p1Name && dom.p1Score) {
      dom.p1Name.style.color = cText1;
      dom.p1Score.style.color = cText1;
    }
    if (dom.p2Name && dom.p2Score) {
      dom.p2Name.style.color = cText2;
      dom.p2Score.style.color = cText2;
    }

    // Action Badge Custom Colors
    if (dom.p1ActionBadge) {
      dom.p1ActionBadge.style.backgroundColor = cBadge1;
      dom.p1ActionBadge.style.borderColor = cBadge1;
      dom.p1ActionBadge.style.color = cBadgeText1;
    }
    if (dom.p2ActionBadge) {
      dom.p2ActionBadge.style.backgroundColor = cBadge2;
      dom.p2ActionBadge.style.borderColor = cBadge2;
      dom.p2ActionBadge.style.color = cBadgeText2;
    }
  }

  function updateActionBadge(badgeEl, actionValue, player) {
    if (!badgeEl) return;
    badgeEl.classList.remove('action-like', 'action-subscribe', 'action-comment', 'action-share');
    
    if (actionValue === 'none') {
      badgeEl.classList.add('hidden');
      return;
    }

    badgeEl.classList.remove('hidden');
    const mapping = ACTION_MAPPING[actionValue];
    if (mapping) {
      badgeEl.classList.add(mapping.className);
      const emojiEl = badgeEl.querySelector('.action-emoji');
      const textEl = badgeEl.querySelector('.action-text');
      if (emojiEl) emojiEl.textContent = mapping.emoji;
      
      let pointText = '';
      if (config.showActionPoints) {
        const ptsVal = player === 'player1' ? (config.player1ActionPoints || 5) : (config.player2ActionPoints || 5);
        pointText = ` (+${ptsVal})`;
      }
      if (textEl) textEl.textContent = mapping.text + pointText;
    }
  }

  // ==================== SAVE/RESTORE SCORES STATE ====================
  function saveScoresState() {
    const stateObj = {
      player1: scores.player1,
      player2: scores.player2,
      totalComments: totalProcessed,
      userVotes: userVotes,
      commentHistory: commentHistory,
      isBattleRunning: isBattleRunning,
      feedComments: feedComments,
      currentLiveChatId: currentLiveChatId,
      currentPageToken: currentPageToken,
      apiKeys: apiKeys,
      currentKeyIndex: currentKeyIndex
    };

    try {
      localStorage.setItem(STATE_KEY, JSON.stringify(stateObj));

      // Push score state to Firebase online
      if (config.syncMode === 'firebase' && dbRef) {
        dbRef.child('state').update({
          player1: scores.player1,
          player2: scores.player2,
          totalComments: totalProcessed,
          isBattleRunning: isBattleRunning,
          feedComments: feedComments
        });
      }
    } catch (err) {
      console.warn('Failed to save scores state:', err);
    }
  }

  function restoreScoresState() {
    try {
      const raw = localStorage.getItem(STATE_KEY);
      if (!raw) return;
      const stateObj = JSON.parse(raw);

      scores.player1 = stateObj.player1 || 0;
      scores.player2 = stateObj.player2 || 0;
      displayedScores.player1 = stateObj.player1 || 0;
      displayedScores.player2 = stateObj.player2 || 0;
      totalProcessed = stateObj.totalComments || 0;
      userVotes = stateObj.userVotes || {};
      commentHistory = stateObj.commentHistory || [];
      isBattleRunning = stateObj.isBattleRunning || false;
      
      try {
        const rawComments = localStorage.getItem('ytBattleCommentsFeed');
        feedComments = rawComments ? JSON.parse(rawComments) : [];
      } catch (e) {
        console.warn('Failed to restore feed comments:', e);
        feedComments = [];
      }

      currentLiveChatId = stateObj.currentLiveChatId || null;
      currentPageToken = stateObj.currentPageToken || null;
      if (stateObj.apiKeys) apiKeys = stateObj.apiKeys;
      if (stateObj.currentKeyIndex !== undefined) currentKeyIndex = stateObj.currentKeyIndex;

      dom.p1Score.textContent = scores.player1;
      dom.p2Score.textContent = scores.player2;

      // Update progress bar
      const total = scores.player1 + scores.player2;
      let p1Pct = 50;
      let p2Pct = 50;
      if (total > 0) {
        p1Pct = (scores.player1 / total) * 100;
        p2Pct = 100 - p1Pct;
      }
      dom.p1Bar.style.width = p1Pct + '%';
      dom.p2Bar.style.width = p2Pct + '%';
      dom.p1Percent.textContent = parseFloat(p1Pct.toFixed(1)) + '%';
      dom.p2Percent.textContent = parseFloat(p2Pct.toFixed(1)) + '%';

      // Restore comments in chat feed without triggering re-saving to state
      if (dom.feedContainer) {
        dom.feedContainer.innerHTML = '';
        feedComments.forEach(c => {
          addCommentToFeed(c.username, c.message, c.playerSide, c.avatarUrl, false);
        });
      }

      // Re-apply burning effects
      const card1 = document.querySelector('.player-card.player-1');
      const card2 = document.querySelector('.player-card.player-2');
      if (card1) card1.classList.remove('burning-effect');
      if (card2) card2.classList.remove('burning-effect');
      const diff = scores.player1 - scores.player2;
      if (diff >= 3) {
        if (card1) card1.classList.add('burning-effect');
      } else if (diff <= -3) {
        if (card2) card2.classList.add('burning-effect');
      }

      // Resume polling if it was running or if videoUrl is present
      if (isBattleRunning || (config.videoUrl && !isPolling)) {
        isPolling = true;
        updateConnectionStatus('connected');
        
        cpmIntervalId = setInterval(function () {
          // just display comments cpm
        }, CPM_UPDATE_INTERVAL);

        if (currentLiveChatId) {
          schedulePoll(2000);
        } else {
          startPolling();
        }
      }
    } catch (err) {
      console.warn('Failed to restore scores state:', err);
    }
  }

  // ==================== BGM CONTROLS ====================
  function playBgm() {
    if (!bgmAudio.src || bgmAudio.src === window.location.href) {
      if (dom.audioStatusText) dom.audioStatusText.textContent = 'Musik Kosong';
      return;
    }
    bgmAudio.play()
      .then(() => updateAudioWidgetStatus())
      .catch((err) => {
        console.warn('Audio play failure:', err);
        updateAudioWidgetStatus();
      });
  }

  function pauseBgm() {
    bgmAudio.pause();
    updateAudioWidgetStatus();
  }

  function stopBgm() {
    bgmAudio.pause();
    bgmAudio.currentTime = 0;
    updateAudioWidgetStatus();
  }

  function updateAudioWidgetStatus() {
    if (dom.audioLoop) dom.audioLoop.checked = bgmAudio.loop;
    if (dom.audioVolume) dom.audioVolume.value = bgmAudio.volume;

    if (!bgmAudio.src || bgmAudio.src === window.location.href) {
      if (dom.audioStatusText) dom.audioStatusText.textContent = 'Musik Kosong';
      return;
    }

    if (bgmAudio.paused) {
      if (bgmAudio.currentTime === 0) {
        if (dom.audioStatusText) dom.audioStatusText.textContent = 'Musik Berhenti';
      } else {
        if (dom.audioStatusText) dom.audioStatusText.textContent = 'Musik Dijeda';
      }
    } else {
      if (dom.audioStatusText) dom.audioStatusText.textContent = 'Musik Diputar';
    }
  }

  // ==================== FIREBASE ONLINE SYNC ====================
  async function initFirebase() {
    if (dbRef) {
      dbRef.off();
      dbRef = null;
    }

    if (config.syncMode !== 'firebase') {
      return;
    }

    const fbApiKey = config.fbApiKey || "AIzaSyAYNvoPQp6G2H5NOOKz8yqEN5dBELXTlLA";
    const fbProjectId = config.fbProjectId || "live-score-69d3d";
    const fbDatabaseUrl = config.fbDatabaseUrl || "https://live-score-69d3d-default-rtdb.firebaseio.com";
    const sessionId = config.fbSessionId || 'default-session';

    if (!fbApiKey || !fbProjectId || !fbDatabaseUrl) {
      showToast('Firebase credentials missing in configuration!', 'warning');
      return;
    }

    try {
      if (firebase.apps && firebase.apps.length > 0) {
        try {
          await firebase.app().delete();
        } catch (e) {
          console.warn('Failed to delete firebase app:', e);
        }
        firebaseApp = null;
      }

      const firebaseConfig = {
        apiKey: fbApiKey,
        authDomain: fbProjectId + ".firebaseapp.com",
        databaseURL: fbDatabaseUrl,
        projectId: fbProjectId,
        storageBucket: fbProjectId + ".appspot.com"
      };
      firebaseApp = firebase.initializeApp(firebaseConfig);
      dbRef = firebase.database().ref('sessions/' + sessionId);

      // Listen to config changes from Admin panel
      dbRef.child('config').on('value', function(snapshot) {
        const val = snapshot.val();
        if (val) {
          localStorage.setItem(CONFIG_KEY, JSON.stringify(val));
          loadConfig();
          applyConfigToUi();
        }
      });

      // Listen to commands from Admin panel
      dbRef.child('commands').on('value', function(snapshot) {
        const cmd = snapshot.val();
        if (cmd && cmd.timestamp > lastCommandTimestamp) {
          lastCommandTimestamp = cmd.timestamp;
          executeCommand(cmd.action, cmd.data);
        }
      });

    } catch (err) {
      console.error('Firebase initialization error on battle screen:', err);
      showToast('Koneksi Firebase gagal pada layar OBS!', 'error');
    }
  }

  // Local Storage Commands Listener (Fallback for Local mode)
  window.addEventListener('storage', function(e) {
    if (e.key === CONFIG_KEY) {
      loadConfig();
      applyConfigToUi();
      initFirebase();
      return;
    }

    if (!config.syncMode || config.syncMode === 'local') {
      if (e.key === CMD_KEY) {
        try {
          const cmd = JSON.parse(e.newValue);
          if (cmd && cmd.timestamp > lastCommandTimestamp) {
            lastCommandTimestamp = cmd.timestamp;
            executeCommand(cmd.action, cmd.data);
          }
        } catch (err) {
          // ignore
        }
      }
      if (e.key === STATE_KEY) {
        try {
          const stateObj = JSON.parse(e.newValue);
          if (stateObj && !isPolling) {
            scores.player1 = stateObj.player1 || 0;
            scores.player2 = stateObj.player2 || 0;
            animateScore(dom.p1Score, displayedScores.player1, scores.player1);
            animateScore(dom.p2Score, displayedScores.player2, scores.player2);
            displayedScores.player1 = scores.player1;
            displayedScores.player2 = scores.player2;
            updateStats();
          }
        } catch (err) {
          // ignore
        }
      }
    }
  });

  function executeCommand(action, data) {
    switch (action) {
      case 'start':
        isBattleRunning = true;
        if (!isPolling) {
          currentPageToken = null;
          currentLiveChatId = null;
          apiKeys.forEach(k => {
            k.status = 'active';
            k.blockedAt = null;
          });
          currentKeyIndex = 0;
          startPolling();
        }
        resetScoresInternal(false);
        saveScoresState();
        break;
      case 'stop':
        isBattleRunning = false;
        pauseBgm();
        saveScoresState();
        break;
      case 'reset':
        resetScoresInternal(true);
        saveScoresState();
        break;
      case 'bgm':
        if (data) {
          if (data.action === 'play') {
            if (data.trackId !== activeTrackId) {
              loadActiveTrackSrc(data.trackId);
            }
            if (data.volume !== undefined) bgmAudio.volume = data.volume;
            playBgm();
          } else if (data.action === 'pause') {
            pauseBgm();
          } else if (data.action === 'stop') {
            stopBgm();
          } else if (data.action === 'volume') {
            if (data.volume !== undefined) bgmAudio.volume = data.volume;
            updateAudioWidgetStatus();
          }
        }
        break;
      case 'mock_comments':
        if (Array.isArray(data)) {
          processMessages(data);
        }
        break;
    }
  }

  // ==================== YOUTUBE DATA API CLIENT POLLING ====================
  function getCurrentApiKey() {
    if (apiKeys.length === 0) return null;
    return apiKeys[currentKeyIndex].key;
  }

  function ensureActiveKey() {
    if (apiKeys.length === 0) return false;
    if (apiKeys[currentKeyIndex].status !== 'blocked') return true;
    
    let nextIndex = (currentKeyIndex + 1) % apiKeys.length;
    let found = false;
    for (let i = 0; i < apiKeys.length; i++) {
      const idx = (nextIndex + i) % apiKeys.length;
      if (apiKeys[idx].status !== 'blocked') {
        currentKeyIndex = idx;
        found = true;
        break;
      }
    }
    
    if (found) {
      try {
        const raw = localStorage.getItem(CONFIG_KEY);
        if (raw) {
          const cfg = JSON.parse(raw);
          cfg.currentKeyIndex = currentKeyIndex;
          localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
          if (config.syncMode === 'firebase' && dbRef) {
            dbRef.child('config').update({ currentKeyIndex });
          }
        }
      } catch (err) {}
      return true;
    }
    return false;
  }

  function rotateToNextKey() {
    if (apiKeys.length <= 1) return false;
    
    // Mark current key as blocked due to quota limit
    apiKeys[currentKeyIndex].status = 'blocked';
    apiKeys[currentKeyIndex].blockedAt = Date.now();
    
    // Find next unblocked key
    let nextIndex = (currentKeyIndex + 1) % apiKeys.length;
    let found = false;
    for (let i = 0; i < apiKeys.length; i++) {
      const idx = (nextIndex + i) % apiKeys.length;
      if (apiKeys[idx].status !== 'blocked') {
        currentKeyIndex = idx;
        found = true;
        break;
      }
    }
    
    if (!found) {
      return false; // All keys are blocked
    }
    
    // Write back to config
    try {
      const raw = localStorage.getItem(CONFIG_KEY);
      if (raw) {
        const cfg = JSON.parse(raw);
        cfg.apiKeys = apiKeys;
        cfg.currentKeyIndex = currentKeyIndex;
        localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
        
        if (config.syncMode === 'firebase' && dbRef) {
          dbRef.child('config').update({ apiKeys, currentKeyIndex });
        }
      }
    } catch (err) {
      // ignore
    }
    
    return true;
  }

  function extractVideoId(urlOrId) {
    if (!urlOrId) return null;
    urlOrId = urlOrId.trim();
    if (urlOrId.length === 11) return urlOrId;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = urlOrId.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  }

  async function getActiveLiveChatId(videoId, apiKey) {
    const url = `https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails&id=${videoId}&key=${apiKey}`;
    const response = await fetch(url);
    if (!response.ok) {
      if (response.status === 403) {
        throw new Error('QUOTA_EXCEEDED: API Key kuota habis.');
      }
      throw new Error(`HTTP Error ${response.status}`);
    }
    const body = await response.json().catch(() => ({}));
    if (body.error) {
      if (body.error.errors && body.error.errors.some(e => e.reason === 'quotaExceeded')) {
        throw new Error('QUOTA_EXCEEDED: API Key kuota habis.');
      }
      throw new Error(body.error.message || 'Gagal terhubung ke API YouTube');
    }
    if (!body.items || body.items.length === 0) {
      throw new Error('Video tidak ditemukan.');
    }
    const details = body.items[0].liveStreamingDetails;
    if (!details || !details.activeLiveChatId) {
      throw new Error('Video ini tidak sedang siaran LIVE atau fitur Live Chat dimatikan.');
    }
    return details.activeLiveChatId;
  }

  async function fetchChatMessages(liveChatId, apiKey, pageToken) {
    let url = `https://www.googleapis.com/youtube/v3/liveChat/messages?liveChatId=${liveChatId}&part=authorDetails,snippet&key=${apiKey}&maxResults=200`;
    if (pageToken) url += `&pageToken=${pageToken}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      if (response.status === 403) {
        throw new Error('QUOTA_EXCEEDED: API Key kuota habis.');
      }
      throw new Error(`HTTP Error ${response.status}`);
    }
    const body = await response.json().catch(() => ({}));
    if (body.error) {
      if (body.error.errors && body.error.errors.some(e => e.reason === 'quotaExceeded')) {
        throw new Error('QUOTA_EXCEEDED: API Key kuota habis.');
      }
      throw new Error(body.error.message || 'Gagal mengambil chat.');
    }
    return body;
  }

  async function startPolling() {
    if (!ensureActiveKey()) {
      updateConnectionStatus('error');
      showToast('Semua API Key kuota habis!', 'error');
      return;
    }

    const apiKey = getCurrentApiKey();
    const videoId = extractVideoId(config.videoUrl);

    if (!apiKey) {
      showToast('Masukkan minimal satu API Key!', 'error');
      return;
    }
    if (!videoId) {
      showToast('Tautan/ID Video YouTube Live tidak valid!', 'error');
      return;
    }

    updateConnectionStatus('connecting');
    retryCount = 0;

    try {
      currentLiveChatId = await getActiveLiveChatId(videoId, apiKey);
    } catch (err) {
      if (err.message.startsWith('QUOTA_EXCEEDED') && rotateToNextKey()) {
        showToast('API Key kuota habis, merotasi key...', 'warning', 1500);
        return startPolling();
      }
      updateConnectionStatus('error');
      showToast(err.message.replace('QUOTA_EXCEEDED:', ''), 'error');
      return;
    }

    isPolling = true;

    try {
      const tokenToUse = currentPageToken || null;
      const initial = await fetchChatMessages(currentLiveChatId, apiKey, tokenToUse);
      currentPageToken = initial.nextPageToken;
      updateConnectionStatus('connected');

      if (tokenToUse !== null) {
        if (initial.items && initial.items.length > 0) {
          processMessages(initial.items);
        }
        showToast('Terhubung kembali! Melanjutkan polling chat...', 'success', 1000);
      } else {
        if (config.historyMode === 'history-all') {
          if (initial.items && initial.items.length > 0) {
            processMessages(initial.items);
          }
          showToast('Terhubung! Memproses history komentar chat...', 'success', 1000);
        } else {
          if (initial.items && initial.items.length > 0) {
            processMessages(initial.items, true);
          }
          showToast('Terhubung! Menghitung chat baru mulai sekarang...', 'success', 1000);
        }
      }

      saveScoresState();
      schedulePoll(initial.pollingIntervalMillis);
    } catch (err) {
      if (err.message.startsWith('QUOTA_EXCEEDED') && rotateToNextKey()) {
        return startPolling();
      }
      updateConnectionStatus('error');
      showToast('Gagal memproses inisialisasi chat: ' + err.message.replace('QUOTA_EXCEEDED:', ''), 'error');
      isPolling = false;
    }
  }

  function schedulePoll(delayMs) {
    if (!isPolling) return;
    pollTimeoutId = setTimeout(async function () {
      if (!isPolling) return;

      const apiKey = getCurrentApiKey();
      if (!apiKey) {
        updateConnectionStatus('error');
        showToast('Tidak ada API Key yang aktif!', 'error');
        stopPolling();
        return;
      }

      try {
        const result = await fetchChatMessages(currentLiveChatId, apiKey, currentPageToken);
        currentPageToken = result.nextPageToken;
        updateConnectionStatus('connected');
        retryCount = 0;

        if (result.items && result.items.length > 0) {
          processMessages(result.items);
          saveScoresState();
        }

        schedulePoll(result.pollingIntervalMillis);
      } catch (err) {
        if (err.message.startsWith('QUOTA_EXCEEDED') && rotateToNextKey()) {
          showToast('Kuota API Key habis, merotasi...', 'warning', 1000);
          return schedulePoll(200);
        }
        
        retryCount++;
        if (retryCount <= MAX_RETRIES) {
          updateConnectionStatus('connecting');
          const delay = RETRY_DELAY_BASE * Math.pow(2, retryCount - 1);
          schedulePoll(delay);
        } else {
          updateConnectionStatus('error');
          showToast('Koneksi terputus. Gagal melakukan polling chat setelah beberapa kali coba.', 'error');
          stopPolling();
        }
      }
    }, delayMs || 2500);
  }

  function stopPolling() {
    isPolling = false;
    if (pollTimeoutId) {
      clearTimeout(pollTimeoutId);
      pollTimeoutId = null;
    }
    if (cpmIntervalId) {
      clearInterval(cpmIntervalId);
      cpmIntervalId = null;
    }
    updateConnectionStatus('disconnected');
  }

  // ==================== WORD MATCHING & FUZZY MATCH LOGIC ====================
  function levenshteinDistance(a, b) {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }
    return matrix[b.length][a.length];
  }

  function getSimilarity(a, b) {
    const maxLength = Math.max(a.length, b.length);
    if (maxLength === 0) return 1.0;
    return 1.0 - (levenshteinDistance(a, b) / maxLength);
  }

  function enrichKeywords(keywords) {
    const enriched = [...keywords];
    const themes = [
      {
        keys: ['ronaldo', 'cr7', 'cristiano'],
        translations: ['ronaldo', 'cr7', 'رونالدو', 'Роналду', 'ロナウド', 'C罗', '罗纳尔多', 'रोनाल्डो', 'Ρονάλντο', 'siu', 'siuu', 'siuuu', 'cristiano']
      },
      {
        keys: ['messi', 'leo', 'lionel'],
        translations: ['messi', 'leo', 'ميسي', 'Месси', 'メッシ', '梅西', 'मेस्सी', 'Μέσι', 'ankara', 'lionel']
      },
      {
        keys: ['surga', 'heaven', 'jannah'],
        translations: ['surga', 'heaven', 'jannah', 'الجنة', 'جنة', 'Рай', '天国', 'てんごく', 'paradise', 'celestial', 'cielo']
      },
      {
        keys: ['neraka', 'hell', 'jahannam'],
        translations: ['neraka', 'hell', 'jahannam', 'جهنم', 'النار', 'Ад', '地獄', 'じごく', 'underworld', 'infierno', 'fuego']
      },
      {
        keys: ['kucing', 'cat', 'neko'],
        translations: ['kucing', 'cat', 'neko', 'cats', 'gato', 'قط', 'кошка', 'кот', '猫', 'ねこ']
      },
      {
        keys: ['anjing', 'dog', 'inu'],
        translations: ['anjing', 'dog', 'inu', 'dogs', 'perro', 'كلب', 'собака', 'пес', '犬', 'いぬ']
      }
    ];

    keywords.forEach(k => {
      const val = k.toLowerCase().trim();
      if (!val) return;
      
      themes.forEach(theme => {
        const isMatch = theme.keys.some(tk => val.includes(tk) || tk.includes(val));
        if (isMatch) {
          theme.translations.forEach(trans => {
            if (!enriched.some(x => x.toLowerCase().trim() === trans.toLowerCase().trim())) {
              enriched.push(trans);
            }
          });
        }
      });
    });

    return enriched;
  }

  function matchKeywords(word, keywords, threshold = 0.8) {
    const w = word.trim().toLowerCase();
    if (!w) return false;
    
    for (let i = 0; i < keywords.length; i++) {
      const keyword = keywords[i].trim().toLowerCase();
      if (!keyword) continue;

      if (w.includes(keyword)) return true;
      if (getSimilarity(w, keyword) >= threshold) return true;
    }
    return false;
  }

  function processMessages(items, skipScoring = false) {
    const keywords1 = enrichKeywords((config.player1Name || '').split(',').map(k => k.trim()));
    const keywords2 = enrichKeywords((config.player2Name || '').split(',').map(k => k.trim()));
    const threshold = config.fuzzyThreshold !== undefined ? parseFloat(config.fuzzyThreshold) : 0.8;

    const p1Weight = config.player1Weight || 1;
    const p2Weight = config.player2Weight || 1;

    const p1Action = config.player1Action || 'none';
    const p2Action = config.player2Action || 'none';
    const p1ActionPoints = config.player1ActionPoints || 5;
    const p2ActionPoints = config.player2ActionPoints || 5;

    let p1Added = 0;
    let p2Added = 0;

    const isScoringActive = isBattleRunning && !skipScoring;

    items.forEach(item => {
      if (processedCommentIds.has(item.id)) return;
      processedCommentIds.add(item.id);

      const username = item.authorDetails.displayName;
      const avatarUrl = item.authorDetails.profileImageUrl;
      const message = item.snippet.displayMessage || '';

      const cleanMsg = message.toLowerCase();
      const words = cleanMsg.split(/\s+/);

      let votedP1 = false;
      let votedP2 = false;

      // Scan words for player keywords
      words.forEach(word => {
        if (matchKeywords(word, keywords1, threshold)) votedP1 = true;
        if (matchKeywords(word, keywords2, threshold)) votedP2 = true;
      });

      // Scan message for action keywords
      const isLike = cleanMsg.includes('like') || cleanMsg.includes('#like');
      const isSub = cleanMsg.includes('sub') || cleanMsg.includes('subscribe') || cleanMsg.includes('#subscribe');
      const isShare = cleanMsg.includes('share') || cleanMsg.includes('#share');

      let targetPlayer = null;

      if (votedP1 && !votedP2) {
        if (isScoringActive) {
          userVotes[username] = 'player1';
        }
        targetPlayer = 'player1';
      } else if (votedP2 && !votedP1) {
        if (isScoringActive) {
          userVotes[username] = 'player2';
        }
        targetPlayer = 'player2';
      } else if (!votedP1 && !votedP2 && (isLike || isSub || isShare)) {
        // Fallback to user's memory choice
        if (userVotes[username]) {
          targetPlayer = userVotes[username];
        }
      }

      if (targetPlayer) {
        if (isScoringActive) {
          totalProcessed++;
          commentHistory.push(Date.now());

          if (targetPlayer === 'player1') {
            let earned = p1Weight;
            if (p1Action === 'like' && isLike) earned = p1ActionPoints;
            else if (p1Action === 'subscribe' && isSub) earned = p1ActionPoints;
            else if (p1Action === 'share' && isShare) earned = p1ActionPoints;

            p1Added += earned;
            showScoreIncrement('player1', earned);
            addCommentToFeed(username, message, 'player1', avatarUrl);
            triggerCelebration('player1');
          } else {
            let earned = p2Weight;
            if (p2Action === 'like' && isLike) earned = p2ActionPoints;
            else if (p2Action === 'subscribe' && isSub) earned = p2ActionPoints;
            else if (p2Action === 'share' && isShare) earned = p2ActionPoints;

            p2Added += earned;
            showScoreIncrement('player2', earned);
            addCommentToFeed(username, message, 'player2', avatarUrl);
            triggerCelebration('player2');
          }
        } else {
          // Display comments with their respective colors, but DO NOT add scores/particles!
          addCommentToFeed(username, message, targetPlayer, avatarUrl);
        }
      } else {
        // Neutral chat that does not contain player keywords, still show in feed!
        addCommentToFeed(username, message, 'neutral', avatarUrl);
      }
    });

    if (isScoringActive && (p1Added > 0 || p2Added > 0)) {
      scores.player1 += p1Added;
      scores.player2 += p2Added;
      updateScores();
    }
  }

  // ==================== RENDER SCOREBOARD ====================
  function updateScores() {
    animateScore(dom.p1Score, displayedScores.player1, scores.player1);
    animateScore(dom.p2Score, displayedScores.player2, scores.player2);

    displayedScores.player1 = scores.player1;
    displayedScores.player2 = scores.player2;

    const total = scores.player1 + scores.player2;
    let p1Pct = 50;
    let p2Pct = 50;
    if (total > 0) {
      p1Pct = (scores.player1 / total) * 100;
      p2Pct = 100 - p1Pct;
    }

    dom.p1Bar.style.width = p1Pct + '%';
    dom.p2Bar.style.width = p2Pct + '%';
    dom.p1Percent.textContent = parseFloat(p1Pct.toFixed(1)) + '%';
    dom.p2Percent.textContent = parseFloat(p2Pct.toFixed(1)) + '%';

    updateStats();

    // Burning fire effect
    const card1 = document.querySelector('.player-card.player-1');
    const card2 = document.querySelector('.player-card.player-2');
    if (card1) card1.classList.remove('burning-effect');
    if (card2) card2.classList.remove('burning-effect');

    const diff = scores.player1 - scores.player2;
    if (diff >= 3) {
      if (card1) card1.classList.add('burning-effect');
    } else if (diff <= -3) {
      if (card2) card2.classList.add('burning-effect');
    }
  }

  function animateScore(element, from, to) {
    if (from === to) return;
    const startTimestamp = performance.now();
    
    function step(currentTime) {
      const elapsed = currentTime - startTimestamp;
      const progress = Math.min(elapsed / SCORE_ANIM_DURATION, 1);
      // Ease out quad
      const ease = progress * (2 - progress);
      const currentVal = Math.floor(from + (to - from) * ease);
      element.textContent = currentVal;
      
      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        element.textContent = to;
      }
    }
    requestAnimationFrame(step);
    pulseElement(element);
  }

  function pulseElement(el) {
    el.style.transform = 'scale(1.2) translateY(-2px)';
    el.style.transition = 'transform 0.15s ease-out';
    setTimeout(() => {
      el.style.transform = 'scale(1)';
    }, 150);
  }

  function showScoreIncrement(playerSide, amount) {
    // Disabled as requested by user to prevent +1 layout stacking/indicator display
    return;
  }

  // ==================== LIVE COMMENT FEED ====================
  function addCommentToFeed(username, message, playerSide, avatarUrl, saveToState = true) {
    const container = dom.feedContainer;
    if (!container) return;

    if (saveToState) {
      feedComments.push({ username, message, playerSide, avatarUrl });
      while (feedComments.length > MAX_FEED_ITEMS) {
        feedComments.shift();
      }
      try {
        localStorage.setItem('ytBattleCommentsFeed', JSON.stringify(feedComments));
      } catch (e) {
        console.warn('Failed to save feed comments to localStorage:', e);
      }
    }

    const emptyMsg = container.querySelector('.feed-empty');
    if (emptyMsg) emptyMsg.remove();

    const sideClass = playerSide === 'player1' ? 'comment-player-1' : (playerSide === 'player2' ? 'comment-player-2' : 'comment-neutral');

    const wrapper = document.createElement('div');
    wrapper.className = `comment-item ${sideClass} new`;

    const avatar = document.createElement('img');
    avatar.className = 'comment-avatar';
    avatar.src = avatarUrl || 'https://www.gstatic.com/youtube/src/web/image/presentation/loading_personalization.gif';
    avatar.alt = username;
    avatar.onerror = function () {
      avatar.src = 'https://www.gstatic.com/youtube/src/web/image/presentation/loading_personalization.gif';
    };

    const details = document.createElement('div');
    details.className = 'comment-body';

    const userEl = document.createElement('div');
    userEl.className = 'comment-username';
    userEl.textContent = username;

    const textEl = document.createElement('div');
    textEl.className = 'comment-text';
    textEl.textContent = message;

    details.appendChild(userEl);
    details.appendChild(textEl);
    wrapper.appendChild(avatar);
    wrapper.appendChild(details);

    // Smart Scroll: auto scroll to bottom if user is close to the bottom
    const isAtBottom = (container.scrollHeight - container.clientHeight - container.scrollTop) < 60;

    container.appendChild(wrapper);

    while (container.children.length > MAX_FEED_ITEMS) {
      container.removeChild(container.firstChild);
    }

    if (isAtBottom) {
      container.scrollTop = container.scrollHeight;
    }

    wrapper.addEventListener('animationend', () => {
      wrapper.classList.remove('new');
    }, { once: true });
  }

  function updateStats() {
    const totalEl = document.getElementById('total-comments');
    if (totalEl) totalEl.textContent = totalProcessed;
  }

  function updateConnectionStatus(status) {
    const el = dom.connectionStatus;
    if (!el) return;
    el.className = '';
    
    if (status === 'connecting') {
      el.classList.add('status-connecting');
      el.textContent = '⏳ Menyambungkan...';
    } else if (status === 'connected') {
      el.classList.add('status-connected');
      el.textContent = '🟢 Terhubung';
    } else if (status === 'disconnected') {
      el.classList.add('status-disconnected');
      el.textContent = '🔴 Terputus';
    } else if (status === 'error') {
      el.classList.add('status-error');
      el.textContent = '❌ Error';
    }
  }

  // ==================== STAR & CONFETTI CELEBRATIONS ====================
  function triggerCelebration(playerSide) {
    const photoWrapper = playerSide === 'player1'
      ? dom.p1Photo.closest('.player-photo-wrapper')
      : dom.p2Photo.closest('.player-photo-wrapper');

    if (!photoWrapper) return;

    let effect = activeCelebrationEffect;
    if (effect === 'random') {
      const effects = ['stars', 'fireworks', 'popper'];
      effect = effects[Math.floor(Math.random() * effects.length)];
    }

    switch (effect) {
      case 'stars':
        createStarCelebration(photoWrapper);
        break;
      case 'fireworks':
        createFireworksCelebration(photoWrapper, playerSide);
        break;
      case 'popper':
        createPopperCelebration(photoWrapper);
        break;
    }
  }

  function createStarCelebration(wrapper) {
    const colors = ['#fbbf24', '#f59e0b', '#fff', '#c084fc', '#22d3ee', '#06b6d4'];
    for (let i = 0; i < 18; i++) {
      const star = document.createElement('div');
      star.className = 'pop-particle pop-star';

      const angle = Math.random() * Math.PI * 2;
      const distance = 50 + Math.random() * 80;
      const dx = Math.cos(angle) * distance;
      const dy = Math.sin(angle) * distance;
      const size = (8 + Math.random() * 12) + 'px';
      const duration = (0.6 + Math.random() * 0.6) + 's';
      const scale = 0.5 + Math.random() * 1;
      const rot = (Math.random() * 360) + 'deg';
      const color = colors[Math.floor(Math.random() * colors.length)];

      star.style.setProperty('--dx', dx + 'px');
      star.style.setProperty('--dy', dy + 'px');
      star.style.setProperty('--size', size);
      star.style.setProperty('--duration', duration);
      star.style.setProperty('--scale', scale);
      star.style.setProperty('--rot', rot);
      star.style.setProperty('--color', color);

      wrapper.appendChild(star);
      star.addEventListener('animationend', () => star.remove());
    }
  }

  function createFireworksCelebration(wrapper, playerSide) {
    const colors = playerSide === 'player1'
      ? ['#fbbf24', '#f59e0b', '#fff', '#fb923c']
      : ['#22d3ee', '#06b6d4', '#fff', '#3b82f6'];

    for (let b = 0; b < 3; b++) {
      setTimeout(function () {
        const fw = document.createElement('div');
        fw.className = 'pop-particle pop-firework';

        const offsetAngle = Math.random() * Math.PI * 2;
        const offsetDist = Math.random() * 45;
        fw.style.left = (50 + Math.cos(offsetAngle) * offsetDist) + '%';
        fw.style.top = (50 + Math.sin(offsetAngle) * offsetDist) + '%';

        const color = colors[Math.floor(Math.random() * colors.length)];
        const duration = (0.8 + Math.random() * 0.5) + 's';

        fw.style.setProperty('--color', color);
        fw.style.setProperty('--duration', duration);

        wrapper.appendChild(fw);
        fw.addEventListener('animationend', () => fw.remove());
      }, b * 200);
    }
  }

  function createPopperCelebration(wrapper) {
    const colors = ['#f43f5e', '#ec4899', '#d946ef', '#a855f7', '#8b5cf6', '#3b82f6', '#0ea5e9', '#06b6d4', '#10b981', '#22c55e', '#eab308', '#f97316'];
    for (let i = 0; i < 24; i++) {
      const conf = document.createElement('div');
      conf.className = 'pop-particle pop-popper';

      const angle = Math.random() * Math.PI * 2;
      const distance = 40 + Math.random() * 110;
      const dx = Math.cos(angle) * distance;
      const dy = Math.sin(angle) * distance;
      const size = (6 + Math.random() * 10) + 'px';
      const duration = (0.5 + Math.random() * 0.7) + 's';
      const scale = 0.5 + Math.random() * 1.2;
      const rot = (Math.random() * 720) + 'deg';
      const color = colors[Math.floor(Math.random() * colors.length)];

      const shapeType = Math.random();
      if (shapeType < 0.33) {
        conf.style.setProperty('--radius', '50%');
      } else if (shapeType < 0.66) {
        conf.style.clipPath = 'polygon(50% 0%, 0% 100%, 100% 100%)';
      }

      conf.style.setProperty('--dx', dx + 'px');
      conf.style.setProperty('--dy', dy + 'px');
      conf.style.setProperty('--size', size);
      conf.style.setProperty('--duration', duration);
      conf.style.setProperty('--scale', scale);
      conf.style.setProperty('--rot', rot);
      conf.style.setProperty('--color', color);

      wrapper.appendChild(conf);
      conf.addEventListener('animationend', () => conf.remove());
    }
  }

  function resetScoresInternal(clearComments = true) {
    let p1Initial = config.player1InitialScore || 0;
    let p2Initial = config.player2InitialScore || 0;

    scores.player1 = p1Initial;
    scores.player2 = p2Initial;
    displayedScores.player1 = p1Initial;
    displayedScores.player2 = p2Initial;
    commentHistory = [];
    totalProcessed = 0;
    processedCommentIds.clear();
    userVotes = {};

    dom.p1Score.textContent   = p1Initial;
    dom.p2Score.textContent   = p2Initial;

    const total = p1Initial + p2Initial;
    let p1Pct = 50;
    let p2Pct = 50;
    if (total > 0) {
      p1Pct = (p1Initial / total) * 100;
      p2Pct = 100 - p1Pct;
    }

    dom.p1Bar.style.width     = p1Pct + '%';
    dom.p2Bar.style.width     = p2Pct + '%';
    dom.p1Percent.textContent = parseFloat(p1Pct.toFixed(1)) + '%';
    dom.p2Percent.textContent = parseFloat(p2Pct.toFixed(1)) + '%';
    
    updateStats();

    if (clearComments) {
      feedComments = [];
      try {
        localStorage.removeItem('ytBattleCommentsFeed');
      } catch (e) {}
      if (dom.feedContainer) {
        dom.feedContainer.innerHTML = '';
      }
    }

    const card1 = document.querySelector('.player-card.player-1');
    const card2 = document.querySelector('.player-card.player-2');
    if (card1) card1.classList.remove('burning-effect');
    if (card2) card2.classList.remove('burning-effect');

    // Add burning effect if initial scores differ by >= 3
    const diff = p1Initial - p2Initial;
    if (diff >= 3) {
      if (card1) card1.classList.add('burning-effect');
    } else if (diff <= -3) {
      if (card2) card2.classList.add('burning-effect');
    }

    // Default empty comment block
    const empty = document.createElement('div');
    empty.className = 'feed-empty';
    empty.innerHTML = '<span class="feed-empty-icon">💬</span><p>Menunggu komentar masuk...</p>';
    dom.feedContainer.appendChild(empty);

    saveScoresState();
  }

  // ==================== TOAST NOTIFICATIONS ====================
  function showToast(message, type = 'info', duration = 1000) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    const colors = {
      success: 'linear-gradient(135deg, #22c55e 0%, #15803d 100%)',
      error: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
      warning: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
      info: 'linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)'
    };
    toast.style.background = colors[type] || colors.info;

    dom.toastContainer.appendChild(toast);

    setTimeout(function () {
      toast.classList.add('toast-exit');
      toast.addEventListener('animationend', function () {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, { once: true });
    }, duration);
  }

  // ==================== BGM WIDGET POPOVER ====================
  function toggleAudioPopover() {
    dom.audioSettingsPopover.classList.toggle('hidden');
    if (!dom.audioSettingsPopover.classList.contains('hidden')) {
      updateAudioWidgetStatus();
    }
  }

  // ==================== FULLSCREEN HANDLER ====================
  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        showToast('Gagal masuk mode fullscreen: ' + err.message, 'error');
      });
    } else {
      document.exitFullscreen();
    }
  }

  function handleKeyboard(event) {
    const tag = (event.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

    switch (event.key.toLowerCase()) {
      case 'f':
        event.preventDefault();
        toggleFullscreen();
        break;
      case 'escape':
        event.preventDefault();
        // Redirect escaping back to admin page
        window.location.href = 'admin.html';
        break;
    }
  }

  // ==================== BIND EVENTS ====================
  function bindEvents() {
    // Navigation & Fullscreen
    dom.btnBack.addEventListener('click', () => {
      window.location.href = 'admin.html';
    });
    dom.btnFullscreen.addEventListener('click', toggleFullscreen);
    document.addEventListener('keydown', handleKeyboard);

    // Audio controls inside popover (local override)
    dom.btnAudioPopoverToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleAudioPopover();
    });

    document.addEventListener('click', (e) => {
      if (dom.audioSettingsPopover && !dom.audioSettingsPopover.classList.contains('hidden')) {
        if (!e.target.closest('.audio-control-container')) {
          dom.audioSettingsPopover.classList.add('hidden');
        }
      }
    });

    dom.btnAudioPlay.addEventListener('click', playBgm);
    dom.btnAudioPause.addEventListener('click', pauseBgm);
    dom.btnAudioStop.addEventListener('click', stopBgm);

    dom.audioVolume.addEventListener('input', (e) => {
      bgmAudio.volume = parseFloat(e.target.value);
    });

    dom.audioLoop.addEventListener('change', (e) => {
      bgmAudio.loop = e.target.checked;
    });

    dom.audioTrackSelect.addEventListener('change', (e) => {
      loadActiveTrackSrc(e.target.value);
      playBgm();
    });
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
      try {
        localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
      } catch (err) {}
    }

    applyConfigToUi();
    restoreScoresState();
    bindEvents();
    initFirebase();

    if (config.videoUrl && !isPolling) {
      startPolling();
    }
  }

  window.addEventListener('DOMContentLoaded', init);

})();
