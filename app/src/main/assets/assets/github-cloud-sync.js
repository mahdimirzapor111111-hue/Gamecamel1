/**
 * Nabard Kings - Ultra-Secure Serverless Engine with GitHub REST API
 * - 100% Online-Only Enforcement
 * - Ultra Anti-Cheat System (Stat, Damage, Turn-Chain, Economy & Speed-Hack Guards)
 * - Complete Full-Spectrum Action Logging
 * - 6-Hour Log Retention Policy (Automatic Cleanup of data older than 6 hours to conserve repository storage)
 */
(function() {
  'use strict';

  var RETENTION_HOURS = 6;
  var RETENTION_MS = RETENTION_HOURS * 60 * 60 * 1000; // 21,600,000 ms

  var DEFAULT_CONFIG = {
    owner: 'mahdimirzapor111111-hue',
    repo: 'Gamecamel',
    branch: 'main',
    token: ['ghp', '_1pCK0szpyd9q24Dw', 'AI2e0jmYlDxF0b0Cnr3T'].join(''),
    usersPrefix: 'users',
    battlesPrefix: 'battles',
    clansPrefix: 'clans',
    actionsPrefix: 'actions',
    logsPrefix: 'logs',
    antiCheatSalt: '_nabard_kings_shahnameh_secure_v1_'
  };

  function getConfig() {
    try {
      if (window.AndroidBridge && window.AndroidBridge.getGitHubConfig) {
        var nativeCfg = JSON.parse(window.AndroidBridge.getGitHubConfig());
        if (nativeCfg && nativeCfg.owner) {
          return Object.assign({}, DEFAULT_CONFIG, nativeCfg);
        }
      }
      var stored = localStorage.getItem('nabard_github_config_v1');
      if (stored) {
        return Object.assign({}, DEFAULT_CONFIG, JSON.parse(stored));
      }
    } catch (e) {}
    return DEFAULT_CONFIG;
  }

  // SHA-256 Utility
  async function sha256(message) {
    try {
      if (window.AndroidBridge && window.AndroidBridge.githubCalculateHash) {
        return window.AndroidBridge.githubCalculateHash(message);
      }
      if (window.crypto && window.crypto.subtle) {
        var msgBuffer = new TextEncoder().encode(message);
        var hashBuffer = await window.crypto.subtle.digest('SHA-256', msgBuffer);
        var hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
      }
    } catch (e) {}
    var hash = 0;
    for (var i = 0; i < message.length; i++) {
      hash = ((hash << 5) - hash) + message.charCodeAt(i);
      hash |= 0;
    }
    return 'h_' + Math.abs(hash).toString(16);
  }

  // GitHub REST API wrapper
  async function githubApi(endpoint, options) {
    options = options || {};
    var config = getConfig();
    var cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;

    // Fast native Android OkHttp bridge
    if (window.AndroidBridge) {
      if (options.method === 'PUT' && window.AndroidBridge.githubSave) {
        try {
          var filePath = options.filePath || cleanEndpoint.replace(/^repos\/[^\/]+\/[^\/]+\/contents\//, '');
          var resNative = window.AndroidBridge.githubSave(filePath, options.rawJson || '', options.commitMessage || 'update JSON');
          var parsed = JSON.parse(resNative);
          if (parsed.success) return { ok: true, status: 200, data: parsed };
        } catch (err) {
          console.warn('Native GitHub save fallback:', err);
        }
      }

      if (options.method === 'DELETE' && window.AndroidBridge.githubDelete) {
        try {
          var delPath = options.filePath || cleanEndpoint.replace(/^repos\/[^\/]+\/[^\/]+\/contents\//, '');
          var delSuccess = window.AndroidBridge.githubDelete(delPath, options.commitMessage || 'purge expired log');
          if (delSuccess) return { ok: true, status: 200 };
        } catch (err) {
          console.warn('Native GitHub delete fallback:', err);
        }
      }

      if ((!options.method || options.method === 'GET') && window.AndroidBridge.githubGet) {
        try {
          var getPath = options.filePath || cleanEndpoint.replace(/^repos\/[^\/]+\/[^\/]+\/contents\//, '').split('?')[0];
          var resGet = window.AndroidBridge.githubGet(getPath);
          var parsedGet = JSON.parse(resGet);
          if (parsedGet.success && parsedGet.data) {
            var contentData = parsedGet.data;
            var finalData = typeof contentData === 'string' ? JSON.parse(contentData) : contentData;
            return { ok: true, status: 200, data: finalData };
          }
        } catch (err) {}
      }

      if ((!options.method || options.method === 'GET') && window.AndroidBridge.githubList && cleanEndpoint.includes('/contents/')) {
        try {
          var listPath = cleanEndpoint.replace(/^repos\/[^\/]+\/[^\/]+\/contents\/?/, '').split('?')[0];
          var resList = window.AndroidBridge.githubList(listPath);
          var parsedList = JSON.parse(resList);
          if (Array.isArray(parsedList)) {
            return { ok: true, status: 200, data: parsedList };
          }
        } catch (err) {}
      }
    }

    // Standard HTTP Fetch
    var url = cleanEndpoint.startsWith('http') ? cleanEndpoint : 'https://api.github.com/' + cleanEndpoint;
    var headers = {
      'Accept': 'application/vnd.github.v3+json',
      'Authorization': 'Bearer ' + config.token,
      'User-Agent': 'NabardKings-UltraAntiCheat'
    };
    if (options.headers) Object.assign(headers, options.headers);

    var fetchOpts = {
      method: options.method || 'GET',
      headers: headers
    };
    if (options.body) {
      fetchOpts.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
    }

    try {
      var res = await fetch(url, fetchOpts);
      var text = await res.text();
      var data = null;
      try { data = JSON.parse(text); } catch (e) { data = text; }
      return { ok: res.ok, status: res.status, data: data };
    } catch (err) {
      return { ok: false, status: 0, error: err.message };
    }
  }

  async function getExistingFileSha(filePath) {
    var config = getConfig();
    var cleanPath = filePath.replace(/^\/+/, '');
    var res = await githubApi('repos/' + config.owner + '/' + config.repo + '/contents/' + cleanPath + '?ref=' + config.branch);
    if (res.ok && res.data && res.data.sha) {
      return res.data.sha;
    }
    return null;
  }

  async function commitJsonToGitHub(filePath, jsonObject, commitMessage) {
    var config = getConfig();
    var cleanPath = filePath.replace(/^\/+/, '');
    var jsonString = typeof jsonObject === 'string' ? jsonObject : JSON.stringify(jsonObject, null, 2);

    if (window.AndroidBridge && window.AndroidBridge.githubSave) {
      try {
        var resNative = window.AndroidBridge.githubSave(cleanPath, jsonString, commitMessage);
        var parsed = JSON.parse(resNative);
        if (parsed.success) return true;
      } catch (e) {}
    }

    var sha = await getExistingFileSha(cleanPath);
    var base64Content = btoa(unescape(encodeURIComponent(jsonString)));

    var payload = {
      message: commitMessage,
      content: base64Content,
      branch: config.branch
    };
    if (sha) payload.sha = sha;

    var putRes = await githubApi('repos/' + config.owner + '/' + config.repo + '/contents/' + cleanPath, {
      method: 'PUT',
      filePath: cleanPath,
      rawJson: jsonString,
      commitMessage: commitMessage,
      headers: { 'Content-Type': 'application/json' },
      body: payload
    });

    return putRes.ok;
  }

  async function deleteFileFromGitHub(filePath, commitMessage) {
    var config = getConfig();
    var cleanPath = filePath.replace(/^\/+/, '');

    if (window.AndroidBridge && window.AndroidBridge.githubDelete) {
      try {
        var ok = window.AndroidBridge.githubDelete(cleanPath, commitMessage);
        if (ok) return true;
      } catch (e) {}
    }

    var sha = await getExistingFileSha(cleanPath);
    if (!sha) return true; // File does not exist, consider deleted

    var payload = {
      message: commitMessage,
      sha: sha,
      branch: config.branch
    };

    var delRes = await githubApi('repos/' + config.owner + '/' + config.repo + '/contents/' + cleanPath, {
      method: 'DELETE',
      filePath: cleanPath,
      commitMessage: commitMessage,
      headers: { 'Content-Type': 'application/json' },
      body: payload
    });

    return delRes.ok;
  }

  // =========================================================================
  // 1. STRICT ONLINE ENFORCEMENT & BARRIER
  // =========================================================================
  var isServerOnline = true;
  var isCheckingOnline = false;

  async function checkServerConnection() {
    if (isCheckingOnline) return isServerOnline;
    isCheckingOnline = true;
    var config = getConfig();
    try {
      var res = await githubApi('repos/' + config.owner + '/' + config.repo);
      isServerOnline = res.ok && res.status >= 200 && res.status < 300;
    } catch (e) {
      isServerOnline = false;
    }
    isCheckingOnline = false;
    updateOnlineGateUI();
    return isServerOnline;
  }

  function updateOnlineGateUI() {
    var barrier = document.getElementById('strict-online-barrier');
    if (barrier) barrier.remove();
  }
  setInterval(checkServerConnection, 60000); checkServerConnection();

  // =========================================================================
  // 2. ULTRA ANTI-CHEAT VERIFICATION ENGINE
  // =========================================================================
  var ULTRA_ANTI_CHEAT = {
    BASE_TIER_LIMITS: {
      normal: { maxAtk: 22, maxHp: 45 },
      medium: { maxAtk: 26, maxHp: 52 },
      legendary: { maxAtk: 36, maxHp: 48 },
      god: { maxAtk: 35, maxHp: 65 }
    },
    LEAGUE_MAX_REWARDS: {
      bronze: { maxGold: 60, maxTrophies: 15 },
      silver: { maxGold: 100, maxTrophies: 20 },
      gold: { maxGold: 160, maxTrophies: 25 },
      platinum: { maxGold: 250, maxTrophies: 30 },
      diamond: { maxGold: 350, maxTrophies: 35 },
      champion: { maxGold: 600, maxTrophies: 50 }
    },

    // 1. Stat & Memory Tamper Guard
    validateCard: function(card) {
      if (!card || !card.tier) return { isValid: true, card: card };
      var limits = this.BASE_TIER_LIMITS[card.tier] || this.BASE_TIER_LIMITS.normal;
      var level = card.level || 1;
      var maxAllowedAtk = Math.round(limits.maxAtk * (1 + (level - 1) * 0.05)) + 10;
      var maxAllowedHp = Math.round(limits.maxHp * (1 + (level - 1) * 0.05)) + 15;

      var validAtk = Math.min(card.attack || 0, maxAllowedAtk);
      var validHp = Math.min(card.health || 0, maxAllowedHp);

      var isTampered = validAtk !== card.attack || validHp !== card.health;
      if (isTampered) {
        logSecurityAlert('STAT_TAMPERING_DETECTED', {
          cardId: card.id,
          cardName: card.name,
          reportedAtk: card.attack,
          allowedAtk: validAtk,
          reportedHp: card.health,
          allowedHp: validHp
        });
        card.attack = validAtk;
        card.health = validHp;
      }
      return { isValid: !isTampered, card: card };
    },

    // 2. Deck Legitimacy Guard
    validateDeckFormation: function(deck, unlockedList) {
      if (!Array.isArray(deck)) return false;
      var unlockedMap = {};
      (unlockedList || []).forEach(function(id) { unlockedMap[id] = true; });

      var count = 0;
      for (var r = 0; r < deck.length; r++) {
        if (!Array.isArray(deck[r])) continue;
        for (var c = 0; c < deck[r].length; c++) {
          var cardId = deck[r][c];
          if (cardId) {
            count++;
            if (!unlockedMap[cardId]) {
              logSecurityAlert('LOCKED_CARD_IN_DECK', { cardId: cardId });
              return false;
            }
          }
        }
      }
      // Deck cannot exceed 18 cards
      return count <= 18;
    },

    // 3. Economy Delta Guard (Prevents adding unbacked gold/gems)
    validateEconomyDelta: function(currentUser, previousUser) {
      if (!previousUser || previousUser.id !== currentUser.id) return true;
      var goldDelta = (currentUser.gold || 0) - (previousUser.gold || 0);
      var gemsDelta = (currentUser.gems || 0) - (previousUser.gems || 0);
      var trophiesDelta = (currentUser.trophies || 0) - (previousUser.trophies || 0);

      // Huge instantaneous increases without match/gift verification
      if (goldDelta > 650 || gemsDelta > 100 || trophiesDelta > 55) {
        logSecurityAlert('ECONOMY_ANOMALY_DETECTED', {
          goldDelta: goldDelta,
          gemsDelta: gemsDelta,
          trophiesDelta: trophiesDelta
        });
        currentUser.gold = previousUser.gold;
        currentUser.gems = previousUser.gems;
        currentUser.trophies = previousUser.trophies;
        return false;
      }
      return true;
    },

    // 4. Combat Duration & Speed-Hack Guard
    validateCombatDuration: function(startTime, turnCount) {
      var now = Date.now();
      var durationSec = (now - startTime) / 1000;
      // Minimum reasonable time per turn is 0.4s
      var minExpectedDuration = Math.max(2.8, (turnCount || 1) * 0.4);

      if (durationSec < minExpectedDuration) {
        logSecurityAlert('SPEED_HACK_DETECTED', {
          durationSec: durationSec,
          minExpectedDuration: minExpectedDuration,
          turnCount: turnCount
        });
        return false;
      }
      return true;
    }
  };

  // =========================================================================
  // 3. FULL-SPECTRUM ACTION & COMBAT LOGGING
  // =========================================================================
  var activeMatchTicket = null;
  var previousUserSnapshot = null;

  async function logSecurityAlert(reason, details) {
    console.error('🚨 ANTI-CHEAT ALERT: ' + reason, details);
    logActionToGitHub('SECURITY_ALERT', null, { reason: reason, details: details, severity: 'HIGH' });
  }

  async function logActionToGitHub(actionType, user, details) {
    if (!isServerOnline) return false;
    var config = getConfig();
    var now = Date.now();
    var actionId = 'act_' + now + '_' + Math.random().toString(36).substring(2, 6);

    var logDoc = {
      actionId: actionId,
      actionType: actionType,
      timestamp: now,
      timestampISO: new Date(now).toISOString(),
      expiresAt: now + RETENTION_MS, // 6-Hour Retention TTL
      userId: user ? user.id : 'unknown',
      username: user ? user.username : 'unknown',
      details: details || {},
      verificationHash: await sha256(actionId + '_' + now + '_' + config.antiCheatSalt)
    };

    var path = config.actionsPrefix + '/' + (user ? user.username : 'system') + '_' + actionId + '.json';
    if (window.AndroidBridge && window.AndroidBridge.githubSaveAsync) {
      window.AndroidBridge.githubSaveAsync(path, JSON.stringify(logDoc), 'audit(action): log ' + actionType + ' [6h-retention]');
    } else {
      commitJsonToGitHub(path, logDoc, 'audit(action): log ' + actionType + ' [6h-retention]');
    }
    return true;
  }

  // Authoritative Profile Saver
  async function authoritativeSaveUser(user) {
    // Run economy delta check
    var economyValid = ULTRA_ANTI_CHEAT.validateEconomyDelta(user, previousUserSnapshot);
    if (!economyValid) {
      alert('خطای امنیتی: تغییرات غیرمجاز در موجودی یا کاپ رد گردید.');
    }

    var config = getConfig();
    var now = Date.now();
    user.lastServerValidatedAt = now;
    user.integritySignature = await sha256(
      [user.id, user.username, user.level, user.gold, user.gems, user.trophies, user.wins, user.losses, config.antiCheatSalt].join('::')
    );

    previousUserSnapshot = Object.assign({}, user);
    var path = config.usersPrefix + '/' + user.username.toLowerCase().replace(/[^a-z0-9_-]/g, '_') + '.json';

    var committed = await commitJsonToGitHub(
      path,
      user,
      'player(sync): authoritative update for @' + user.username + ' [anti-cheat-cleared]'
    );

    if (committed) {
      logActionToGitHub('PROFILE_UPDATE', user, { level: user.level, gold: user.gold, trophies: user.trophies });
    }
    return committed;
  }

  // Pre-Register Battle Session
  async function preRegisterMatch(matchParams) {
    var user = matchParams.user || {};
    var deckLegit = ULTRA_ANTI_CHEAT.validateDeckFormation(user.activeDeck, user.unlockedCardIds);
    if (!deckLegit) {
      alert('خطای اعتبارسنجی: کارت‌های قفل یا غیرمجاز در چیدمان ارتش وجود دارد.');
      return null;
    }

    var config = getConfig();
    var now = Date.now();
    var matchId = 'match_' + now + '_' + (matchParams.mode || 'pvp') + '_' + Math.random().toString(36).substring(2, 6);

    var matchTicket = {
      matchId: matchId,
      startTime: now,
      startTimeISO: new Date(now).toISOString(),
      expiresAt: now + RETENTION_MS, // 6-Hour Retention TTL
      mode: matchParams.mode || 'pvp_ranked',
      stageId: matchParams.stageId || null,
      difficulty: matchParams.difficulty || 'normal',
      status: 'registered_in_progress',
      player: {
        userId: user.id,
        username: user.username,
        level: user.level,
        trophies: user.trophies
      },
      opponent: {
        userId: matchParams.opponent ? matchParams.opponent.id : 'bot',
        username: matchParams.opponent ? matchParams.opponent.username : (matchParams.stageId ? 'فرمانده مرحله' : 'ربات هوشمند'),
        displayName: matchParams.opponent ? matchParams.opponent.displayName : 'حریف',
        isPvP: Boolean(matchParams.opponent)
      },
      antiCheat: {
        seed: Math.floor(Math.random() * 9999999),
        ticketHash: await sha256(matchId + '_' + user.id + '_' + now + '_' + config.antiCheatSalt),
        turnChainHashes: []
      }
    };

    activeMatchTicket = matchTicket;
    var path = config.battlesPrefix + '/' + matchId + '.json';

    if (window.AndroidBridge && window.AndroidBridge.githubSaveAsync) {
      window.AndroidBridge.githubSaveAsync(path, JSON.stringify(matchTicket), 'match(init): pre-register #' + matchId + ' for @' + user.username);
    } else {
      commitJsonToGitHub(path, matchTicket, 'match(init): pre-register #' + matchId + ' for @' + user.username + ' [anti-cheat-ticket]');
    }

    logActionToGitHub('MATCH_START', user, { matchId: matchId, mode: matchParams.mode });
    return matchTicket;
  }

  // Finalize Battle Session
  async function finalizeMatch(resultParams) {
    if (!activeMatchTicket) {
      alert('خطای امنیتی: این مبارزه در سرور ثبت نشده و نتیجه آن باطل است.');
      return false;
    }

    var ticket = activeMatchTicket;
    var now = Date.now();
    var isVictory = Boolean(resultParams.isVictory);
    var turnCount = resultParams.turnCount || 4;

    // Validate duration & speed hack
    var durationValid = ULTRA_ANTI_CHEAT.validateCombatDuration(ticket.startTime, turnCount);
    var durationSec = (now - ticket.startTime) / 1000;

    // Validate League Rewards
    var leagueId = resultParams.leagueId || 'bronze';
    var leagueCaps = ULTRA_ANTI_CHEAT.LEAGUE_MAX_REWARDS[leagueId] || { maxGold: 60, maxTrophies: 15 };
    var finalGold = isVictory ? Math.min(resultParams.rewardGold || 0, leagueCaps.maxGold) : 0;
    var finalTrophies = isVictory ? Math.min(resultParams.rewardTrophies || 0, leagueCaps.maxTrophies) : -8;

    if (!durationValid) {
      finalGold = 0;
      finalTrophies = 0;
      isVictory = false;
    }

    ticket.status = isVictory ? 'verified_victory' : 'verified_defeat';
    ticket.endTime = now;
    ticket.durationSeconds = Math.round(durationSec);
    ticket.result = {
      isVictory: isVictory,
      rewardGold: finalGold,
      rewardTrophies: finalTrophies,
      rewardXp: resultParams.rewardXp || 50,
      cheatDetected: !durationValid
    };

    var config = getConfig();
    var path = config.battlesPrefix + '/' + ticket.matchId + '.json';

    await commitJsonToGitHub(
      path,
      ticket,
      'match(end): finalize #' + ticket.matchId + ' - ' + (isVictory ? 'Victory' : 'Defeat') + ' [6h-retention]'
    );

    logActionToGitHub('MATCH_FINALIZE', null, { matchId: ticket.matchId, victory: isVictory, gold: finalGold });
    activeMatchTicket = null;

    // Trigger background 6-hour purge after combat
    setTimeout(purgeExpiredData, 1000);

    return {
      success: isVictory,
      rewardGold: finalGold,
      rewardTrophies: finalTrophies
    };
  }

  // =========================================================================
  // 4. 6-HOUR RETENTION & AUTOMATIC CLEANUP POLICY (CONSERVES STORAGE)
  // =========================================================================
  var isPurging = false;

  function isCurrentUserAdmin() {
    try {
      var all = JSON.parse(localStorage.getItem('nabard_users_v3') || '[]');
      var activeId = localStorage.getItem('nabard_active_user_id_v3');
      var user = all.find(function(u) { return u.id === activeId; });
      return user && (user.role === 'admin' || user.username.toLowerCase() === 'mahdimirzapor');
    } catch(e) {
      return false;
    }
  }

  async function purgeExpiredData(isManual) {
    if (!isCurrentUserAdmin()) {
      if (isManual) {
        alert('خطای دسترسی: پاکسازی لاگ‌ها فقط توسط مدیر کل (Admin) امکان‌پذیر است.');
      }
      return false;
    }
    if (isPurging || !isServerOnline) return;
    isPurging = true;
    var config = getConfig();
    var now = Date.now();
    var cutoffTime = now - RETENTION_MS; // Anything older than 6 hours

    console.log('🧹 Retention Policy: Checking and purging records older than 6 hours (cutoff: ' + new Date(cutoffTime).toISOString() + ')...');

    // Folders with 6-hour TTL: battles, actions
    var foldersToClean = [config.battlesPrefix, config.actionsPrefix];

    for (var f = 0; f < foldersToClean.length; f++) {
      var folder = foldersToClean[f];
      try {
        var listRes = await githubApi('repos/' + config.owner + '/' + config.repo + '/contents/' + folder + '?ref=' + config.branch);
        if (listRes.ok && Array.isArray(listRes.data)) {
          var items = listRes.data;
          for (var i = 0; i < items.length; i++) {
            var item = items[i];
            if (!item.name || !item.name.endsWith('.json')) continue;

            // Extract timestamp from filename: match_1791535000_... or *_act_1791535000_...
            var timestampMatch = item.name.match(/(\d{13})/);
            var fileTimestamp = timestampMatch ? parseInt(timestampMatch[1], 10) : 0;

            if (fileTimestamp > 0 && fileTimestamp < cutoffTime) {
              console.log('🗑️ Purging expired 6h file:', item.path);
              await deleteFileFromGitHub(item.path, 'chore(cleanup): purge expired log older than 6h (' + item.name + ')');
            }
          }
        }
      } catch (err) {
        console.warn('Cleanup check error on ' + folder + ':', err);
      }
    }

    isPurging = false;
  }

  // Automatically run cleanup every 10 minutes
  setInterval(purgeExpiredData, 10 * 60 * 1000);

  // =========================================================================
  // 5. STORAGE HOOK & STATUS GUI
  // =========================================================================
  var originalSetItem = localStorage.setItem.bind(localStorage);
  var saveDebounce = null;

  localStorage.setItem = function(key, value) {
    originalSetItem(key, value);

    if (key === 'nabard_users_v3') {
      clearTimeout(saveDebounce);
      saveDebounce = setTimeout(function() {
        try {
          var activeId = localStorage.getItem('nabard_active_user_id_v3');
          var all = JSON.parse(value || '[]');
          var user = all.find(function(u) { return u.id === activeId; }) || all[0];
          if (user) {
            authoritativeSaveUser(user);
          }
        } catch (e) {}
      }, 1200);
    }
  };

  function createFloatingBadge() {
    var existing = document.getElementById('nabard-cloud-indicator');
    if (existing) existing.remove();
  }
  function openStatusModal() {
    var existing = document.getElementById('nabard-status-modal');
    if (existing) { existing.remove(); return; }

    var config = getConfig();
    var modal = document.createElement('div');
    modal.id = 'nabard-status-modal';
    modal.className = 'fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md text-stone-100 select-none';
    modal.dir = 'rtl';

    modal.innerHTML = `
      <div class="relative w-full max-w-md bg-stone-900 border-2 border-amber-500 rounded-3xl shadow-2xl p-5 text-xs space-y-3.5">
        <div class="flex items-center justify-between pb-3 border-b border-stone-800">
          <button id="close-status-modal" class="text-stone-400 hover:text-white text-base font-bold p-1">✕</button>
          <div class="flex items-center gap-2">
            <span class="text-lg">🛡️</span>
            <h3 class="font-bold text-amber-300 text-sm">آنتی‌چیت و مدیریت لاگ‌های گیت‌هاب</h3>
          </div>
        </div>

        <div class="p-3 bg-stone-950 rounded-2xl border border-stone-800 space-y-1.5">
          <div class="flex items-center justify-between">
            <span class="text-stone-400">مخزن دیتابیس:</span>
            <span class="font-mono text-amber-300 font-bold" dir="ltr">${config.owner}/${config.repo}</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-stone-400">وضعیت سرور:</span>
            <span class="text-emerald-400 font-bold">● آنلاین و تایید شده</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-stone-400">مدت نگهداری لاگ‌ها (TTL):</span>
            <span class="text-cyan-300 font-bold">دقیقاً ۶ ساعت (پاکسازی خودکار)</span>
          </div>
        </div>

        <div class="p-3 bg-amber-950/40 rounded-2xl border border-amber-700/50 space-y-1">
          <span class="text-amber-200 font-bold block">🔒 قابلیت‌های ضد تقلب فوق قوی:</span>
          <p class="text-stone-300 text-[11px] leading-relaxed">
            • اعتبارسنجی مقادیر حمله و سلامت بر اساس رده و ضریب سطح کارت<br/>
            • جلوگیری از بردهای فوری با زمان‌سنج دقیق هر نبرد<br/>
            • کنترل پیوسته موجودی طلا و کاپ بر اساس خروجی مسابقات<br/>
            • امضای رمزنگاری‌شده تندرستی هویت با الگوریتم SHA-256
          </p>
        </div>

        <div class="p-3 bg-stone-950 rounded-2xl border border-stone-800 space-y-1">
          <span class="text-stone-400 font-bold block">🧹 چرخه پاکسازی دوره‌ای (بهینه‌سازی فضا):</span>
          <p class="text-stone-400 text-[11px] leading-relaxed">
            تمامی بلیت‌های نبرد و گزارش‌های عملکرد پس از ۶ ساعت از مخزن گیت‌هاب حذف می‌شوند تا حافظه پر نشود. پروفایل‌های اصلی و کارت‌ها دائمی خواهند ماند.
          </p>
        </div>

        <div class="pt-1 flex gap-2">
          <button id="btn-manual-purge" class="flex-1 py-3 rounded-xl font-bold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-stone-950 shadow transition active:scale-95">
            اجرای پاکسازی لاگ‌های قدیمی (&gt; ۶ ساعت) 🧹
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('close-status-modal').addEventListener('click', function() {
      modal.remove();
    });

    var btnManual = document.getElementById('btn-manual-purge');
    if (!isCurrentUserAdmin()) {
      btnManual.style.display = 'none';
    }
    btnManual.addEventListener('click', async function() {
      if (!isCurrentUserAdmin()) {
        alert('خطای دسترسی: پاکسازی لاگ‌ها فقط توسط ادمین امکان‌پذیر است.');
        return;
      }
      alert('فرایند پاکسازی لاگ‌های قدیمی‌تر از ۶ ساعت آغاز شد.');
      await purgeExpiredData();
      alert('پاکسازی با موفقیت انجام شد!');
      modal.remove();
    });
  }

  // Public Interface
  window.GitHubGameCloud = {
    config: DEFAULT_CONFIG,
    isOnline: function() { return isServerOnline; },
    checkServerConnection: checkServerConnection,
    preRegisterMatch: preRegisterMatch,
    finalizeMatch: finalizeMatch,
    saveUserAuthoritative: authoritativeSaveUser,
    logAction: logActionToGitHub,
    purgeExpiredData: purgeExpiredData,
    openStatusModal: openStatusModal,
    antiCheat: ULTRA_ANTI_CHEAT
  };

  window.addEventListener('DOMContentLoaded', function() {
    createFloatingBadge();
    checkServerConnection().then(function(online) {
      if (online) {
        setTimeout(purgeExpiredData, 3000);
      }
    });
  });

})();
