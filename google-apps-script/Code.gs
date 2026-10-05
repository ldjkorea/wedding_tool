/**
 * Wedding booking backend. Deploy only to a dedicated GAS project.
 * Required Script Properties: GAS_SHARED_SECRET, CONTRACTS_FOLDER_ID.
 * Partner discount codes are private data in studio settings revisions.
 * No runtime fallback, sample seeding, or anonymous side-effecting GET.
 */
function setting(name) {
  const value = PropertiesService.getScriptProperties().getProperty(name);
  if (!value || !value.trim()) throw new Error("Configuration missing: " + name);
  return value.trim();
}
function hex(bytes) {
  return bytes.map(function(b) { return ("0" + ((b + 256) % 256).toString(16)).slice(-2); }).join("");
}
function digest(text) {
  return hex(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8));
}
function authenticate(request) {
  const secret = setting("GAS_SHARED_SECRET");
  if (secret.length < 32 || /^(replace-|your-|change-)/i.test(secret)) throw new Error("Configuration invalid: GAS_SHARED_SECRET");
  if (!Number.isFinite(request.timestamp) || Math.abs(Date.now() - request.timestamp) > 180000 ||
      typeof request.nonce !== "string" || !/^[a-f0-9-]{36}$/.test(request.nonce) ||
      typeof request.action !== "string" || typeof request.payloadJson !== "string" ||
      typeof request.signature !== "string") throw new Error("Unauthorized");
  const message = request.timestamp + "\n" + request.nonce + "\n" + request.action + "\n" + request.payloadJson;
  const expected = hex(Utilities.computeHmacSha256Signature(message, secret, Utilities.Charset.UTF_8));
  let different = expected.length ^ request.signature.length;
  for (let i = 0; i < expected.length; i++) different |= expected.charCodeAt(i) ^ (request.signature.charCodeAt(i) || 0);
  if (different) throw new Error("Unauthorized");
  const props = PropertiesService.getScriptProperties();
  const nonceKey = "nonce_" + request.nonce;
  if (props.getProperty(nonceKey)) throw new Error("Replay");
  const all = props.getProperties();
  Object.keys(all).forEach(function(key) {
    if (key.indexOf("nonce_") === 0 && Number(all[key]) < Date.now() - 180000) props.deleteProperty(key);
  });
  props.setProperty(nonceKey, String(request.timestamp));
}
function doPost(e) {
  const lock = LockService.getScriptLock();
  let acquired = false;
  try {
    const request = JSON.parse(e.postData.contents);
    acquired = lock.tryLock(10000);
    if (!acquired) throw new Error("Busy");
    authenticate(request);
    const payload = JSON.parse(request.payloadJson);
    if (!payload || typeof payload.studioId !== "string" || !payload.studioId.trim()) throw new Error("Missing studio scope");
    let result;
    if (/^calendar_/.test(request.action)) {
      lock.releaseLock(); acquired = false;
      result = calendarAdminAction(request.action, payload);
    }
    else if (/^sheet_/.test(request.action)) {
      lock.releaseLock(); acquired = false;
      result = sheetAdminAction(request.action, payload);
    }
    else if (request.action === "owner_bookings") result = ownerBookings(payload);
    else if (/^(admin_|settings_|owner_)/.test(request.action)) result = settingsAction(request.action, payload);
    else if (request.action === "validate_partner_code") { assertSettingsCurrent(payload); result = validatePartner(payload); }
    else if (request.action === "find_contract") {
      const stored = readRecord(payload.contractId);
      if (stored) assertStudio(stored.value, payload);
      result = { success: true, record: stored ? { accepted: true, contractId: stored.value.contractId, studioId: stored.value.studio.studioId, configurationHash: stored.value.configurationHash, status: stored.value.status, tokenExpiresAt: stored.value.tokenExpiresAt } : null };
    } else if (request.action === "submit_contract") result = submitContract(payload);
    else if (request.action === "review_contract") {
      const record = authorizedRecord(payload).value;
      result = { success: true, record: { studioId: record.studio.studioId, configurationHash: record.configurationHash, formData: record.formData, pricing: record.pricing, contractNumber: record.contractNumber, snapshot: record.snapshot, status: record.status, sentAt: record.sentAt, documentStored: !!record.pdfFileId, revision: record.revision } };
    } else if (request.action === "prepare_contract") result = prepareContract(payload);
    else if (request.action === "approve_and_send") result = approveAndSend(payload);
    else throw new Error("Unknown action");
    return jsonResponse(result);
  } catch (error) {
    // Never expose customer values, bearer tokens, or raw provider diagnostics.
    const message = error && error.message;
    const configurationError = /^Configuration (missing|invalid): (GAS_SHARED_SECRET|CONTRACTS_FOLDER_ID|STUDIO_SETTINGS_FOLDER_ID)$/.test(message);
    const code = message === "Unauthorized admin" ? "ADMIN_UNAUTHORIZED" : message === "Too many attempts" ? "ADMIN_RATE_LIMIT" : message === "Settings revision conflict" ? "SETTINGS_CONFLICT" : undefined;
    return jsonResponse({ success: false, code: code, error: configurationError ? message : "Request rejected or incomplete. Inspect stored contract state before retrying." });
  } finally {
    if (acquired) lock.releaseLock();
  }
}
function doGet() {
  return jsonResponse({ success: false, error: "Signed POST required" });
}
function recordsFolder() { return DriveApp.getFolderById(setting("CONTRACTS_FOLDER_ID")); }
function recordName(id) {
  if (typeof id !== "string" || !/^cnt_[a-zA-Z0-9_-]+$/.test(id)) throw new Error("Invalid contract");
  return id + ".json";
}
function readRecord(id) {
  const iterator = recordsFolder().getFilesByName(recordName(id));
  if (!iterator.hasNext()) return null;
  const file = iterator.next();
  if (iterator.hasNext()) throw new Error("Duplicate record");
  return { file: file, value: JSON.parse(file.getBlob().getDataAsString("UTF-8")) };
}
function saveRecord(stored) {
  const text = JSON.stringify(stored.value);
  stored.file.setContent(text);
  // Read-after-write: side effects must not run until durable state is confirmed.
  if (stored.file.getBlob().getDataAsString("UTF-8") !== text) throw new Error("Record write failed");
}
function authorizedRecord(payload) {
  const stored = readRecord(payload.contractId);
  if (payload.ownerSessionId) {
    requireAdminSession({ studioId: payload.studioId, sessionId: payload.ownerSessionId }, "owner");
    if (!stored) throw new Error("Unauthorized");
    assertStudio(stored.value, payload);
    return stored;
  }
  if (!stored || stored.value.tokenHash !== payload.tokenHash ||
      !Number.isFinite(stored.value.tokenExpiresAt) || Date.now() >= stored.value.tokenExpiresAt) throw new Error("Unauthorized");
  assertStudio(stored.value, payload);
  return stored;
}
function assertStudio(record, payload) {
  if (!record.studio || record.studio.studioId !== payload.studioId ||
      (record.snapshot && record.snapshot.studio && record.snapshot.studio.studioId !== payload.studioId)) throw new Error("Studio mismatch");
}
function submitContract(payload) {
  assertSettingsCurrent(payload);
  if (!payload.formData || !payload.pricing || !/^[a-f0-9]{64}$/.test(payload.tokenHash) ||
      !Number.isFinite(payload.tokenExpiresAt) || payload.tokenExpiresAt <= Date.now() ||
      !/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(payload.repEmail) || !payload.notification ||
      !payload.studio || payload.studio.studioId !== payload.studioId) throw new Error("Invalid submission");
  assertPartnerPayload(payload.formData, payload.pricing, payload.studioId);
  let stored = readRecord(payload.contractId);
  if (stored) {
    assertStudio(stored.value, payload);
    if (JSON.stringify(stored.value.formData) !== JSON.stringify(payload.formData)) throw new Error("Conflicting submission");
    return { success: true, accepted: true, contractId: payload.contractId, representativeEmailSent: stored.value.notificationState === "sent" };
  }
  const record = {
    contractId: payload.contractId, contractNumber: payload.contractNumber,
    formData: payload.formData, pricing: payload.pricing, tokenHash: payload.tokenHash,
    tokenExpiresAt: payload.tokenExpiresAt, repEmail: payload.repEmail,
    studio: payload.studio || null, configurationHash: payload.configurationHash,
    notification: payload.notification, notificationState: "pending",
    customerState: "pending", representativeState: "pending", status: "submitted", revision: 1, submittedAt: new Date().toISOString()
  };
  queueContractSheet(record);
  const file = recordsFolder().createFile(recordName(payload.contractId), JSON.stringify(record), MimeType.PLAIN_TEXT);
  stored = { file: file, value: record };
  saveRecord(stored);
  // Receipt is durable before notification. Unknown delivery must never be resent automatically.
  try {
    record.notificationState = "sending";
    saveRecord(stored);
    GmailApp.sendEmail(record.repEmail, record.notification.subject, "", { htmlBody: record.notification.html, name: record.snapshot && record.snapshot.studio ? record.snapshot.studio.emailSenderName : record.studio ? record.studio.emailSenderName : "Wedding Booking" });
    record.notificationState = "sent";
    saveRecord(stored);
  } catch (error) {
    record.notificationState = "unknown";
    saveRecord(stored);
  }
  return { success: true, accepted: true, contractId: record.contractId, representativeEmailSent: record.notificationState === "sent" };
}
function prepareContract(payload) {
  assertSettingsCurrent(payload);
  const stored = authorizedRecord(payload);
  const record = stored.value;
  if (record.status === "sent") throw new Error("Already committed");
  const snapshot = payload.snapshot;
  if (!snapshot || snapshot.id !== record.contractId || snapshot.contractNumber !== record.contractNumber ||
      !snapshot.terms || !snapshot.product || !snapshot.studio || snapshot.studio.studioId !== payload.studioId || snapshot.status !== "approved" || !/^[a-f0-9]{64}$/.test(payload.snapshotHash)) throw new Error("Invalid snapshot");
  assertPartnerPayload(snapshot.data, snapshot.pricing, payload.studioId);
  if (record.snapshot && JSON.stringify(record.snapshot.data) === JSON.stringify(snapshot.data) &&
      JSON.stringify(record.snapshot.pricing) === JSON.stringify(snapshot.pricing) &&
      JSON.stringify(record.snapshot.terms) === JSON.stringify(snapshot.terms) &&
      JSON.stringify(record.snapshot.product) === JSON.stringify(snapshot.product) &&
      JSON.stringify(record.snapshot.formSchema) === JSON.stringify(snapshot.formSchema) &&
      JSON.stringify(record.snapshot.studio) === JSON.stringify(snapshot.studio) &&
      JSON.stringify(record.snapshot.content) === JSON.stringify(snapshot.content) &&
      JSON.stringify(record.snapshot.discounts) === JSON.stringify(snapshot.discounts)) {
    return { success: true, snapshot: record.snapshot, snapshotHash: record.snapshotHash, documentStored: !!record.pdfFileId, revision: record.revision };
  }
  if (payload.expectedRevision !== record.revision) throw new Error("Stale review revision");
  if (record.pdfHash || record.customerState !== "pending" || record.representativeState !== "pending") throw new Error("Already committed");
  record.snapshot = snapshot;
  record.snapshotHash = payload.snapshotHash;
  record.status = "approved";
  record.revision++;
  queueContractCalendar(record, true);
  queueContractSheet(record);
  saveRecord(stored);
  return { success: true, snapshot: record.snapshot, snapshotHash: record.snapshotHash, documentStored: false, revision: record.revision };
}
function approveAndSend(payload) {
  assertSettingsCurrent(payload);
  const stored = authorizedRecord(payload);
  const record = stored.value;
  if (record.status === "sent") throw new Error("Already sent");
  if (!record.snapshot || record.snapshotHash !== payload.snapshotHash || !payload.customerMail || !payload.representativeMail) throw new Error("Stale snapshot");
  const raw = payload.pdfBase64;
  if (!record.pdfFileId && (typeof raw !== "string" || raw.length > 14000000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(raw))) throw new Error("Missing PDF");
  const bytes = record.pdfFileId ? DriveApp.getFileById(record.pdfFileId).getBlob().getBytes() : Utilities.base64Decode(raw);
  const pdfText = bytes.slice(0, 5).map(function(b) { return String.fromCharCode((b + 256) % 256); }).join("");
  if (pdfText !== "%PDF-") throw new Error("Invalid PDF");
  const pdfHash = hex(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytes));
  if (record.pdfHash && record.pdfHash !== pdfHash) throw new Error("Document changed");
  let pdfFile;
  if (!record.pdfFileId) {
    const fileName = record.contractId + "_" + record.contractNumber + ".pdf";
    const files = recordsFolder().getFilesByName(fileName);
    // Recover a previous file write that completed before the record update.
    if (files.hasNext()) {
      pdfFile = files.next();
      if (files.hasNext() || hex(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, pdfFile.getBlob().getBytes())) !== pdfHash) throw new Error("PDF storage conflict");
    } else {
      pdfFile = recordsFolder().createFile(Utilities.newBlob(bytes, "application/pdf", fileName));
    }
    record.pdfHash = pdfHash;
    record.pdfFileId = pdfFile.getId();
    record.customerMail = payload.customerMail;
    record.representativeMail = payload.representativeMail;
    saveRecord(stored);
  } else pdfFile = DriveApp.getFileById(record.pdfFileId);
  const attachment = pdfFile.getBlob();
  if (hex(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, attachment.getBytes())) !== record.pdfHash) throw new Error("PDF storage integrity failure");
  sendOnce(stored, "customerState", record.snapshot.data.email, record.customerMail, attachment);
  sendOnce(stored, "representativeState", record.repEmail, record.representativeMail, attachment);
  record.status = "sent";
  record.sentAt = new Date().toISOString();
  record.snapshot.status = "sent";
  record.snapshot.sentAt = record.sentAt;
  queueContractCalendar(record, false);
  queueContractSheet(record);
  saveRecord(stored);
  return { success: true, contractNumber: record.contractNumber, snapshot: record.snapshot, customerEmailSent: true, representativeEmailSent: true, driveSaved: true, driveFolderUrl: recordsFolder().getUrl() };
}
function sendOnce(stored, field, recipient, mail, attachment) {
  const record = stored.value;
  if (record[field] === "sent") return;
  if (record[field] !== "pending") throw new Error("Delivery uncertain; operator reconciliation required");
  record[field] = "sending";
  saveRecord(stored);
  try {
    GmailApp.sendEmail(recipient, mail.subject, "", { htmlBody: mail.html, attachments: [attachment], name: record.snapshot && record.snapshot.studio ? record.snapshot.studio.emailSenderName : record.studio ? record.studio.emailSenderName : "Wedding Booking" });
  } catch (error) {
    record[field] = "unknown";
    queueContractCalendar(record, false);
    queueContractSheet(record);
    saveRecord(stored);
    throw new Error("Delivery uncertain");
  }
  record[field] = "sent";
  saveRecord(stored);
}
function validatePartner(payload) {
  const code = typeof payload.code === "string" ? payload.code.trim().normalize("NFC").toUpperCase() : "";
  if (!/^[\p{L}\p{N}_-]{2,64}$/u.test(code)) return { success: true, valid: false, code: code, discountAmount: 0 };
  const pointer = settingsPointer(payload);
  if (!pointer.revision) return { success: true, valid: false, code: code, discountAmount: 0 };
  const settings = readSettingsEntry(payload, pointer).settings;
  const rule = settings.discountsConfig.find(function(item) { return item.eligibility.kind === "partner"; });
  const match = (settings.partnerCodes || []).find(function(item) { return item.active && item.code === code; });
  const valid = !!(rule && rule.active && rule.type === "immediate" && match && Number.isSafeInteger(match.amount) && match.amount > 0);
  return { success: true, valid: valid, code: code, discountAmount: valid ? match.amount : 0 };
}
function assertPartnerPayload(data, pricing, studioId) {
  if (!data.partnerDiscount) return;
  const result = validatePartner({ studioId: studioId, code: data.partnerName });
  if (!result.valid || data.partnerName !== result.code || data.partnerDiscountAmount !== result.discountAmount) throw new Error("Invalid partner discount");
  const settings = readSettingsEntry({ studioId: studioId }, settingsPointer({ studioId: studioId })).settings;
  const rule = settings.discountsConfig.find(function(item) { return item.eligibility.kind === "partner"; });
  const line = pricing.breakdown.find(function(item) { return item.policyId === rule.id; });
  if (!line || line.category !== "immediate_discount" || line.amount !== -result.discountAmount) throw new Error("Invalid partner price");
}
function jsonResponse(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}

// Settings and sessions use the existing authenticated POST + ScriptLock boundary.
// Immutable JSON revisions live in a SEPARATE private folder, never in contract records.
function settingsKey(payload) {
  if (!/^[a-z0-9][a-z0-9_-]{0,79}$/.test(payload.studioId)) throw new Error("Invalid studio");
  return "studio_settings_" + payload.studioId;
}
function settingsPointer(payload) {
  const raw = PropertiesService.getScriptProperties().getProperty(settingsKey(payload));
  if (!raw) return { revision: 0, history: [] };
  const pointer = JSON.parse(raw);
  if (!Number.isSafeInteger(pointer.revision) || pointer.revision < 1 || !Array.isArray(pointer.history)) throw new Error("Settings pointer corrupt");
  return pointer;
}
function settingsFolder() {
  const id = setting("STUDIO_SETTINGS_FOLDER_ID");
  if (id === setting("CONTRACTS_FOLDER_ID")) throw new Error("Configuration invalid: STUDIO_SETTINGS_FOLDER_ID");
  return DriveApp.getFolderById(id);
}
function readSettingsEntry(payload, entry) {
  if (!entry || !entry.fileId) throw new Error("Unknown revision");
  const file = DriveApp.getFileById(entry.fileId);
  const value = JSON.parse(file.getBlob().getDataAsString("UTF-8"));
  if (value.schemaVersion !== 1 || value.studioId !== payload.studioId || value.revision !== entry.revision ||
      value.hash !== entry.hash || digest(JSON.stringify(value.settings)) !== entry.hash ||
      !value.settings || !value.settings.studioConfig || value.settings.studioConfig.studioId !== payload.studioId) throw new Error("Settings integrity failure");
  return value;
}
function publicSettingsHistory(pointer) {
  return pointer.history.map(function(entry) { return { revision: entry.revision, hash: entry.hash, updatedAt: entry.updatedAt, actor: entry.actor || "legacy" }; });
}
function assertSettingsCurrent(payload) {
  const pointer = settingsPointer(payload);
  // Existing v1 requests remain compatible until settings is explicitly activated.
  if (pointer.revision === 0 && payload.settingsRevision === undefined) return;
  if ((payload.settingsRevision || 0) !== pointer.revision || (payload.settingsHash || "") !== (pointer.hash || "")) throw new Error("Settings changed; reload required");
}
function adminKey(payload) { return settingsKey(payload) + "_auth"; }
function ownerCredentialKey(payload) { return settingsKey(payload) + "_owner_credential"; }
function readOwnerCredentialState(payload) {
  const raw = PropertiesService.getScriptProperties().getProperty(ownerCredentialKey(payload));
  if (!raw) return { hash: null, revision: 0 };
  const value = JSON.parse(raw);
  if (!value || !/^scrypt\$16384\$8\$1\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(value.hash || "") || !Number.isSafeInteger(value.revision) || value.revision < 1) throw new Error("Invalid credential state");
  return value;
}
function readAdminState(payload) {
  const raw = PropertiesService.getScriptProperties().getProperty(adminKey(payload));
  const state = raw ? JSON.parse(raw) : { attempts: [], sessions: {} };
  const now = Date.now();
  state.attempts = state.attempts.filter(function(time) { return time > now - 900000; });
  Object.keys(state.sessions).forEach(function(id) {
    if (state.sessions[id].lastSeen + 1800000 <= now || state.sessions[id].createdAt + 28800000 <= now) delete state.sessions[id];
  });
  return state;
}
function writeAdminState(payload, state) {
  const props = PropertiesService.getScriptProperties(), key = adminKey(payload), raw = JSON.stringify(state);
  props.setProperty(key, raw);
  if (props.getProperty(key) !== raw) throw new Error("Session persistence failure");
}
function requireAdminSession(payload, requiredRole) {
  const state = readAdminState(payload);
  if (!/^[a-f0-9]{64}$/.test(payload.sessionId || "") || !state.sessions[payload.sessionId]) throw new Error("Unauthorized admin");
  const role = state.sessions[payload.sessionId].role || "master";
  if ((requiredRole && role !== requiredRole) || (payload.role && payload.role !== role)) throw new Error("Unauthorized admin");
  state.sessions[payload.sessionId].lastSeen = Date.now();
  writeAdminState(payload, state);
  return role;
}
function ownerComparable(value) {
  if (Array.isArray(value)) return value.map(ownerComparable);
  if (value && typeof value === "object") {
    const sorted = {}; Object.keys(value).sort().forEach(function(key) { sorted[key] = ownerComparable(value[key]); }); return sorted;
  }
  return value;
}
function enforceOwnerSettings(previous, next) {
  if (!previous || !next) throw new Error("Unauthorized admin");
  const fields = {
    productsConfig: ["name","price","description","subtitle","includedItems","retouchedCount","additionalRetouchedCount","originalCount","albumSpec","coupleAlbumSummary","parentAlbumSummary","active","displayOrder"],
    optionsConfig: ["name","price","description","active","displayOrder"],
    discountsConfig: ["name","amount","description","active"],
    partnerCodes: ["code","amount","active"]
  };
  Object.keys(previous).concat(Object.keys(next)).forEach(function(key) {
    if (!fields[key] && JSON.stringify(previous[key]) !== JSON.stringify(next[key])) throw new Error("Unauthorized admin");
  });
  Object.keys(fields).forEach(function(key) {
    const old = previous[key] || [], incoming = next[key] || [], seen = {};
    if (!Array.isArray(incoming)) throw new Error("Unauthorized admin");
    incoming.forEach(function(item) {
      if (!item || typeof item.id !== "string" || seen[item.id]) throw new Error("Unauthorized admin");
      seen[item.id] = true;
      const before = old.find(function(entry) { return entry.id === item.id; });
      if (!before) {
        if (key === "discountsConfig" || Object.keys(item).some(function(field) { return field !== "id" && fields[key].indexOf(field) < 0; })) throw new Error("Unauthorized admin");
        return;
      }
      const expected = JSON.parse(JSON.stringify(before));
      fields[key].forEach(function(field) { if (Object.prototype.hasOwnProperty.call(item, field)) expected[field] = item[field]; });
      if (key !== "partnerCodes" && item.name !== before.name) {
        if (key === "discountsConfig") {
          expected.pricingName = item.name; expected.labels = {};
          ["form","review","pdf","summary","catalog","email"].forEach(function(channel) { expected.labels[channel] = item.name; });
        } else expected.shortName = item.name;
      }
      if (key === "discountsConfig" && item.description !== before.description) expected.pricingDescription = item.description;
      if (JSON.stringify(ownerComparable(expected)) !== JSON.stringify(ownerComparable(item))) throw new Error("Unauthorized admin");
    });
    if (old.some(function(item) { return !seen[item.id]; })) throw new Error("Unauthorized admin");
  });
}
function settingsAction(action, payload) {
  settingsKey(payload);
  // Require deployment configuration even at bootstrap; no unexpected contract-folder fallback.
  settingsFolder();
  // HMAC-authenticated server only. Never included in runtime/business revisions.
  if (action === "admin_owner_credential_read") {
    if (Object.keys(payload).some(function(key) { return key !== "studioId"; })) throw new Error("Unauthorized admin");
    const value = readOwnerCredentialState(payload);
    return { success: true, hash: value.hash, revision: value.revision };
  }
  if (action === "admin_owner_credential_set") {
    requireAdminSession(payload, "master");
    if (Object.keys(payload).some(function(key) { return ["studioId", "sessionId", "hash", "expectedRevision"].indexOf(key) < 0; }) ||
        !/^scrypt\$16384\$8\$1\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(payload.hash || "")) throw new Error("Unauthorized admin");
    const previous = readOwnerCredentialState(payload);
    if (!Number.isSafeInteger(payload.expectedRevision) || previous.revision !== payload.expectedRevision) throw new Error("Settings revision conflict");
    const next = { hash: payload.hash, revision: previous.revision + 1, updatedAt: new Date().toISOString(), actor: "master" };
    const props = PropertiesService.getScriptProperties(), key = ownerCredentialKey(payload), raw = JSON.stringify(next);
    props.setProperty(key, raw);
    if (props.getProperty(key) !== raw) throw new Error("Credential persistence failure");
    const state = readAdminState(payload);
    Object.keys(state.sessions).forEach(function(id) { if (state.sessions[id].role === "owner") delete state.sessions[id]; });
    writeAdminState(payload, state);
    return { success: true, revision: next.revision };
  }
  if (action === "admin_attempt") {
    const state = readAdminState(payload);
    if (state.attempts.length >= 10) throw new Error("Too many attempts");
    state.attempts.push(Date.now()); writeAdminState(payload, state);
    return { success: true };
  }
  if (action === "admin_login") {
    const state = readAdminState(payload);
    if (!/^[a-f0-9]{64}$/.test(payload.sessionId || "")) throw new Error("Invalid session");
    const ids = Object.keys(state.sessions).sort(function(a, b) { return state.sessions[a].createdAt - state.sessions[b].createdAt; });
    while (ids.length >= 5) delete state.sessions[ids.shift()];
    const role = payload.role || "master";
    if (role !== "owner" && role !== "master") throw new Error("Unauthorized admin");
    if (role === "owner" && (payload.credentialRevision || 0) !== readOwnerCredentialState(payload).revision) throw new Error("Unauthorized admin");
    state.sessions[payload.sessionId] = { createdAt: Date.now(), lastSeen: Date.now(), role: role };
    // Attempts remain counted, including successes, to bound total password work.
    writeAdminState(payload, state); return { success: true };
  }
  let actor = null;
  if (action !== "settings_runtime") actor = requireAdminSession(payload, action.indexOf("owner_") === 0 ? "owner" : action.indexOf("settings_") === 0 ? "master" : undefined);
  if (action === "admin_session") return { success: true };
  if (action === "admin_logout") {
    const state = readAdminState(payload); delete state.sessions[payload.sessionId];
    writeAdminState(payload, state); return { success: true };
  }
  const pointer = settingsPointer(payload);
  if (action === "settings_runtime") {
    if (!pointer.revision) return { success: true, current: null };
    const stored = readSettingsEntry(payload, pointer), settings = {};
    ["studioConfig", "productsConfig", "optionsConfig", "discountsConfig", "contractPolicy", "formSchema", "content"].forEach(function(key) { settings[key] = stored.settings[key]; });
    // Strip private codes BEFORE serializing the HTTP response, also protecting dev IO traces.
    return { success: true, current: Object.assign({}, stored, { settings: settings, publicHash: digest(JSON.stringify(settings)) }) };
  }
  if (action === "settings_read" || action === "owner_read") {
    let current = null, recoveryRequired = false;
    if (pointer.revision) {
      try { current = readSettingsEntry(payload, pointer); } catch (error) { recoveryRequired = true; }
    }
    return { success: true, current: current, revision: pointer.revision, history: publicSettingsHistory(pointer), recoveryRequired: recoveryRequired };
  }
  if (action === "settings_revision") {
    const entry = pointer.history.find(function(item) { return item.revision === payload.revision; });
    return { success: true, current: readSettingsEntry(payload, entry) };
  }
  if (action !== "settings_save" && action !== "settings_restore" && action !== "owner_save") throw new Error("Unknown settings action");
  if (payload.expectedRevision !== pointer.revision) throw new Error("Settings revision conflict");
  if (!payload.settings || !payload.settings.studioConfig || payload.settings.studioConfig.studioId !== payload.studioId ||
      !/^[a-f0-9]{64}$/.test(payload.hash || "") || digest(JSON.stringify(payload.settings)) !== payload.hash) throw new Error("Invalid settings");
  const allowed = ["studioConfig", "productsConfig", "optionsConfig", "discountsConfig", "contractPolicy", "formSchema", "content", "partnerCodes"];
  if (Object.keys(payload.settings).some(function(key) { return allowed.indexOf(key) < 0; }) || allowed.filter(function(key) { return key !== "partnerCodes"; }).some(function(key) { return payload.settings[key] === undefined; })) throw new Error("Invalid settings fields");
  if (action === "settings_restore") {
    const entry = pointer.history.find(function(item) { return item.revision === payload.revision; });
    if (readSettingsEntry(payload, entry).hash !== (payload.sourceHash || payload.hash)) throw new Error("Invalid restoration");
  } else if (pointer.revision) readSettingsEntry(payload, pointer);
  if (action === "owner_save") enforceOwnerSettings(pointer.revision ? readSettingsEntry(payload, pointer).settings : payload.bootstrap, payload.settings);
  const revision = pointer.revision + 1, updatedAt = new Date().toISOString();
  const current = { schemaVersion: 1, studioId: payload.studioId, revision: revision, updatedAt: updatedAt, hash: payload.hash, actor: actor, settings: payload.settings };
  const text = JSON.stringify(current);
  if (text.length > 2000000) throw new Error("Settings too large");
  const file = settingsFolder().createFile(payload.studioId + "_settings_" + revision + "_" + Utilities.getUuid() + ".json", text, MimeType.PLAIN_TEXT);
  if (file.getBlob().getDataAsString("UTF-8") !== text) throw new Error("Settings write failed");
  const entry = { fileId: file.getId(), revision: revision, hash: payload.hash, updatedAt: updatedAt, actor: actor };
  const next = Object.assign({}, entry, { history: pointer.history.concat([entry]).slice(-20) });
  const props = PropertiesService.getScriptProperties(), key = settingsKey(payload), raw = JSON.stringify(next);
  // A single atomic pointer publish happens AFTER immutable data is durable and verified.
  props.setProperty(key, raw);
  if (props.getProperty(key) !== raw) throw new Error("Settings publication uncertain");
  return { success: true, current: readSettingsEntry(payload, next) };
}

// Optional operational mirror. No SpreadsheetApp call occurs in a customer request.
// Queue state is committed with the existing record; a separate trigger owns Sheet I/O.
function sheetConfigKey(studioId) { return settingsKey({ studioId: studioId }) + "_sheet"; }
function readSheetConfig(studioId) {
  const raw = PropertiesService.getScriptProperties().getProperty(sheetConfigKey(studioId));
  if (!raw) return { schemaVersion: 1, studioId: studioId, revision: 0, enabled: false };
  const config = JSON.parse(raw);
  if (config.schemaVersion !== 1 || config.studioId !== studioId || typeof config.enabled !== "boolean" || !Number.isSafeInteger(config.revision)) throw new Error("Invalid integration configuration");
  return config;
}
function writeSheetConfig(config) {
  const props = PropertiesService.getScriptProperties(), key = sheetConfigKey(config.studioId), raw = JSON.stringify(config);
  props.setProperty(key, raw);
  if (props.getProperty(key) !== raw) throw new Error("Integration save uncertain");
}
function queueContractSheet(record) {
  try {
    if (!readSheetConfig(record.studio.studioId).enabled && !record.sheetSync) return;
    record.sheetSync = { status: "pending", generation: Utilities.getUuid(), queuedAt: new Date().toISOString(), attempts: 0 };
  } catch (error) {
    // Preserve a recoverable marker without changing the acceptance/delivery decision.
    record.sheetSync = { status: "unknown", errorCode: "CONFIGURATION_UNAVAILABLE", attempts: 0 };
  }
}
const CONTRACT_SHEET_HEADERS = ["계약번호", "접수일시", "예식일", "예식시간", "예식장", "홀", "신랑 이름", "신부 이름", "대표 연락처", "수신 이메일", "상품", "옵션", "즉시할인 / 조정", "할인코드", "계약금액", "계약금", "잔금", "추후 캐시백", "계약 상태", "대표 확인 상태", "계약서 발송 상태", "승인일시", "발송일시", "시스템 계약ID"];
function contractSheetValues(record) {
  const snapshot = record.snapshot, data = snapshot ? snapshot.data : record.formData, price = snapshot ? snapshot.pricing : record.pricing;
  if (!data || !price || (snapshot && (snapshot.id !== record.contractId || snapshot.contractNumber !== record.contractNumber || snapshot.studio.studioId !== record.studio.studioId))) throw new Error("Invalid mirror source");
  const lines = price.breakdown;
  const product = snapshot && snapshot.product ? snapshot.product.name : (lines.find(function(line) { return line.category === "base"; }) || {}).name;
  const options = snapshot && snapshot.options ? snapshot.options.map(function(item) { return item.name; }) : lines.filter(function(line) { return line.category === "option"; }).map(function(line) { return line.name; });
  const stage = record.status === "sent" ? "계약 완료" : snapshot ? "대표 확인 완료" : "접수";
  const mail = record.customerState === "sent" && record.representativeState === "sent" ? "발송 완료" : [record.customerState, record.representativeState].some(function(state) { return state === "sending" || state === "unknown"; }) ? "일부 발송 / 확인 필요" : "발송 전";
  return [record.contractNumber, new Date(record.submittedAt), data.weddingDate, data.weddingTime, data.weddingVenue, data.weddingHall,
    data.groomName, data.brideName, data.groomPhone || data.bridePhone, data.email, product || "", options.join(", "),
    lines.filter(function(line) { return line.category === "immediate_discount" || line.category === "manual_adjustment"; }).map(function(line) { return line.name + " " + line.amount.toLocaleString("ko-KR") + "원"; }).join(", "),
    data.partnerDiscount ? data.partnerName : "", price.contractTotal, price.depositAmount, price.balanceAmount, price.futureCashbackTotal,
    stage, snapshot ? "확인 완료" : "확인 전", mail, snapshot && snapshot.approvedAt ? new Date(snapshot.approvedAt) : "", record.sentAt ? new Date(record.sentAt) : "", record.contractId];
}
function ensureContractSheetWorker() {
  const triggers = ScriptApp.getProjectTriggers().filter(function(trigger) { return trigger.getHandlerFunction() === "contractSheetWorker"; });
  if (!triggers.length) ScriptApp.newTrigger("contractSheetWorker").timeBased().everyMinutes(1).create();
}
function openContractSheet(config) {
  if (!config.sheetId || !Number.isSafeInteger(config.tabId)) throw new Error("CONNECTION_MISSING");
  const file = DriveApp.getFileById(config.sheetId);
  if (file.isTrashed() || file.getSharingAccess() !== DriveApp.Access.PRIVATE) throw new Error("PRIVATE_ACCESS_REQUIRED");
  const spreadsheet = SpreadsheetApp.openById(config.sheetId), tab = spreadsheet.getSheetById(config.tabId);
  if (!tab || JSON.stringify(tab.getRange(1, 1, 1, CONTRACT_SHEET_HEADERS.length).getValues()[0]) !== JSON.stringify(CONTRACT_SHEET_HEADERS)) throw new Error("SCHEMA_CHANGED");
  return { spreadsheet: spreadsheet, tab: tab };
}
function initializeContractSheet(config) {
  const spreadsheet = SpreadsheetApp.openById(config.sheetId), tab = spreadsheet.getSheets()[0];
  const file = DriveApp.getFileById(config.sheetId);
  file.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
  const existing = tab.getRange(1, 1, 1, CONTRACT_SHEET_HEADERS.length).getValues()[0];
  if (existing.some(function(value) { return value !== ""; }) && JSON.stringify(existing) !== JSON.stringify(CONTRACT_SHEET_HEADERS)) throw new Error("SCHEMA_CHANGED");
  spreadsheet.setSpreadsheetTimeZone("Asia/Seoul");
  tab.getRange(1, 1, 1, CONTRACT_SHEET_HEADERS.length).setValues([CONTRACT_SHEET_HEADERS]).setFontWeight("bold");
  tab.setFrozenRows(1); tab.setColumnWidths(1, CONTRACT_SHEET_HEADERS.length, 140); tab.setColumnWidth(5, 220);
  if (!tab.getFilter()) tab.getRange(1, 1, tab.getMaxRows(), CONTRACT_SHEET_HEADERS.length).createFilter();
  tab.hideColumns(CONTRACT_SHEET_HEADERS.length);
  config.tabId = tab.getSheetId(); config.createdAt = config.createdAt || new Date().toISOString();
  config.creationState = "ready"; config.name = config.displayName + " 계약관리";
  file.setName(config.name); openContractSheet(config);
}
function sheetStateTransaction(task) {
  const lock = LockService.getScriptLock(); if (!lock.tryLock(1000)) throw new Error("Busy");
  try { return task(); } finally { lock.releaseLock(); }
}
function sheetAdminAction(action, payload) {
  let config = sheetStateTransaction(function() { requireAdminSession(payload); return readSheetConfig(payload.studioId); });
  if (action === "sheet_toggle") {
    if (payload.enabled) ensureContractSheetWorker();
    config = sheetStateTransaction(function() {
      requireAdminSession(payload); const latest = readSheetConfig(payload.studioId);
      if (typeof payload.enabled !== "boolean" || payload.expectedRevision !== latest.revision) throw new Error("Settings revision conflict");
      latest.enabled = payload.enabled; latest.revision++; writeSheetConfig(latest); return latest;
    });
  } else if (action === "sheet_create") {
    return createContractSheet(payload);
  } else if (action === "sheet_retry") {
    if (!config.enabled) throw new Error("Integration disabled");
    openContractSheet(config); ensureContractSheetWorker();
    sheetStateTransaction(function() {
      requireAdminSession(payload); if (!readSheetConfig(payload.studioId).enabled) throw new Error("Integration disabled");
      const stored = readRecord(payload.contractId); if (!stored) throw new Error("Unknown contract"); assertStudio(stored.value, payload);
      if (!stored.value.sheetSync || stored.value.sheetSync.status === "synced") throw new Error("No pending mirror job");
      queueContractSheet(stored.value); saveRecord(stored);
    });
  } else if (action !== "sheet_status") throw new Error("Unknown integration action");
  return contractSheetStatus(config, payload.cursor);
}
function createContractSheet(payload) {
  let fresh = false, owned = false;
  let config = sheetStateTransaction(function() {
    requireAdminSession(payload); const current = readSheetConfig(payload.studioId);
    if (!current.enabled) throw new Error("Integration disabled");
    if (current.creationState === "ready" || current.creationLeaseUntil > Date.now()) return current;
    if (!current.creationState) {
      if (payload.expectedRevision !== current.revision) throw new Error("Settings revision conflict");
      const pointer = settingsPointer(payload);
      current.displayName = pointer.revision ? readSettingsEntry(payload, pointer).settings.studioConfig.displayName : payload.displayName;
      if (typeof current.displayName !== "string" || !current.displayName.trim() || current.displayName.length > 100) throw new Error("Invalid studio name");
      current.creationName = current.displayName + " 계약관리 [" + Utilities.getUuid() + "]";
      current.creationState = "pending"; current.revision++; fresh = true;
    }
    current.creationLeaseUntil = Date.now() + 420000; writeSheetConfig(current); owned = true; return current;
  });
  if (!owned) return contractSheetStatus(config);
  try {
    if (!config.sheetId) {
      if (fresh) config.sheetId = SpreadsheetApp.create(config.creationName).getId();
      else {
        const found = DriveApp.getFilesByName(config.creationName);
        if (!found.hasNext()) throw new Error("Creation uncertain; operator reconciliation required");
        const file = found.next(); if (found.hasNext()) throw new Error("Duplicate integration file"); config.sheetId = file.getId();
      }
      sheetStateTransaction(function() { const current = readSheetConfig(payload.studioId); current.sheetId = config.sheetId; writeSheetConfig(current); });
    }
    initializeContractSheet(config);
    config = sheetStateTransaction(function() {
      const current = readSheetConfig(payload.studioId);
      Object.assign(current, { sheetId: config.sheetId, tabId: config.tabId, name: config.name, createdAt: config.createdAt, creationState: "ready", creationLeaseUntil: 0 });
      writeSheetConfig(current); return current;
    });
    ensureContractSheetWorker();
    return contractSheetStatus(config);
  } catch (error) {
    sheetStateTransaction(function() { const current = readSheetConfig(payload.studioId); current.creationLeaseUntil = 0; writeSheetConfig(current); });
    throw error;
  }
}
function contractRecordPage(cursor, maximum) {
  let iterator;
  if (cursor) iterator = DriveApp.continueFileIterator(cursor); else iterator = recordsFolder().getFiles();
  const records = []; let inspected = 0;
  while (iterator.hasNext() && inspected++ < maximum) {
    const file = iterator.next(), name = file.getName();
    if (!/^cnt_[a-zA-Z0-9_-]+\.json$/.test(name)) continue;
    records.push({ file: file, value: JSON.parse(file.getBlob().getDataAsString("UTF-8")) });
  }
  return { records: records, nextCursor: iterator.hasNext() ? iterator.getContinuationToken() : null };
}
function contractSheetStatus(config, cursor) {
  let connection = config.enabled ? "disconnected" : "disabled", name = config.name || "", errorCode = "";
  if (config.enabled && config.creationState === "pending" && !config.sheetId) { connection = "error"; errorCode = "CREATION_UNCERTAIN"; }
  if (config.enabled && config.sheetId && config.creationState === "ready") {
    try { name = openContractSheet(config).spreadsheet.getName(); connection = "connected"; }
    catch (error) { connection = "error"; errorCode = ["PRIVATE_ACCESS_REQUIRED", "SCHEMA_CHANGED"].indexOf(error.message) >= 0 ? error.message : "CONNECTION_UNAVAILABLE"; }
  }
  const page = contractRecordPage(cursor, 30), counts = { pending: 0, failed: 0, unknown: 0, synced: 0 }, jobs = [];
  page.records.forEach(function(stored) {
    const record = stored.value, job = record.sheetSync;
    if (!record.studio || record.studio.studioId !== config.studioId || !job) return;
    const status = job.status === "working" ? "unknown" : job.status;
    if (counts[status] === undefined) throw new Error("Invalid sync status");
    counts[status]++;
    if (status !== "synced") jobs.push({ contractId: record.contractId, contractNumber: record.contractNumber, status: status, errorCode: job.errorCode || "", queuedAt: job.queuedAt || "", lastAttemptAt: job.lastAttemptAt || "" });
  });
  if (connection === "connected" && (counts.failed || counts.unknown)) connection = "error";
  return { success: true, integration: { revision: config.revision, enabled: config.enabled, connection: connection, name: name,
    url: config.sheetId ? "https://docs.google.com/spreadsheets/d/" + config.sheetId + "/edit" : "",
    createdAt: config.createdAt || "", errorCode: errorCode, counts: counts, jobs: jobs, nextCursor: page.nextCursor,
    demo: false, workerReady: ScriptApp.getProjectTriggers().some(function(trigger) { return trigger.getHandlerFunction() === "contractSheetWorker"; }) } };
}
function writeContractSheet(record, config) {
  let writeStarted = false;
  try {
    const tab = openContractSheet(config).tab, values = contractSheetValues(record), idColumn = CONTRACT_SHEET_HEADERS.length;
    const metadata = tab.createDeveloperMetadataFinder().withKey("wedding_contract_id").withValue(record.contractId).find();
    if (metadata.length > 1) throw new Error("DUPLICATE_ROW");
    const identifiers = tab.getLastRow() > 1 ? tab.getRange(2, idColumn, tab.getLastRow() - 1, 1).getValues() : [];
    const matching = identifiers.map(function(row, index) { return row[0] === record.contractId ? index + 2 : 0; }).filter(Boolean);
    if (matching.length > 1) throw new Error("DUPLICATE_ROW");
    const metadataRow = metadata.length ? metadata[0].getLocation().getRow().getRow() : 0;
    if (metadataRow && matching.length && metadataRow !== matching[0]) throw new Error("DUPLICATE_ROW");
    const row = metadataRow || matching[0] || Math.max(2, tab.getLastRow() + 1);
    if (row > tab.getMaxRows()) tab.insertRowsAfter(tab.getMaxRows(), row - tab.getMaxRows());
    // Reserve identity BEFORE metadata/remaining values, so retries find uncertain writes.
    writeStarted = true; tab.getRange(row, idColumn).setValue(record.contractId); SpreadsheetApp.flush();
    if (!metadata.length) tab.getRange(row, 1, 1, tab.getMaxColumns()).addDeveloperMetadata("wedding_contract_id", record.contractId);
    const range = tab.getRange(row, 1, 1, values.length); range.setNumberFormat("@");
    tab.getRange(row, 15, 1, 4).setNumberFormat('#,##0"원"');
    [2, 22, 23].forEach(function(column) { tab.getRange(row, column).setNumberFormat("yyyy-mm-dd hh:mm:ss"); });
    const safe = values.map(function(value) { return typeof value === "string" && /^[=+\-@\t\r\n]/.test(value) ? "'" + value : value; });
    range.setValues([safe]); SpreadsheetApp.flush();
    const actual = range.getValues()[0];
    const same = actual.every(function(value, index) { const expected = values[index]; return expected instanceof Date ? new Date(value).getTime() === expected.getTime() : value === expected || value === safe[index]; });
    if (!same || range.getFormulas()[0].some(Boolean)) throw new Error("WRITE_UNCERTAIN");
    return { status: "synced", syncedAt: new Date().toISOString() };
  } catch (error) {
    return { status: writeStarted ? "unknown" : "failed", errorCode: ["CONNECTION_MISSING", "PRIVATE_ACCESS_REQUIRED", "SCHEMA_CHANGED", "DUPLICATE_ROW", "WRITE_UNCERTAIN"].indexOf(error.message) >= 0 ? error.message : "SYNC_UNAVAILABLE" };
  }
}
function contractSheetWorker() {
  const props = PropertiesService.getScriptProperties(), cursorKey = "contract_sheet_scan_cursor", leaseKey = "contract_sheet_worker_lease", owner = Utilities.getUuid();
  let owned = false;
  try {
    owned = sheetStateTransaction(function() {
      const previous = JSON.parse(props.getProperty(leaseKey) || "null"); if (previous && previous.until > Date.now()) return false;
      const enabled = Object.keys(props.getProperties()).some(function(key) { if (!/^studio_settings_.*_sheet$/.test(key)) return false; try { return JSON.parse(props.getProperty(key)).enabled === true; } catch (error) { return false; } });
      if (!enabled) return false;
      props.setProperty(leaseKey, JSON.stringify({ owner: owner, until: Date.now() + 420000 })); return true;
    });
    if (!owned) return;
    let page;
    try { page = contractRecordPage(props.getProperty(cursorKey), 15); }
    catch (error) { props.deleteProperty(cursorKey); return; }
    let attempted = 0;
    for (let index = 0; index < page.records.length; index++) {
      const stored = page.records[index], record = stored.value;
      if (!record.sheetSync || !["pending", "working"].includes(record.sheetSync.status) || !record.studio) continue;
      if (attempted >= 3) continue;
      try {
        const claim = sheetStateTransaction(function() {
          const config = readSheetConfig(record.studio.studioId); if (!config.enabled) return null;
          const current = readRecord(record.contractId); if (!current || current.file.getId() !== stored.file.getId() || !current.value.sheetSync || !["pending", "working"].includes(current.value.sheetSync.status)) return null;
          current.value.sheetSync = Object.assign({}, current.value.sheetSync, { status: "working", lastAttemptAt: new Date().toISOString(), attempts: (current.value.sheetSync.attempts || 0) + 1 });
          saveRecord(current); return { record: current.value, config: config };
        });
        if (!claim) continue; attempted++;
        const result = writeContractSheet(claim.record, claim.config);
        sheetStateTransaction(function() {
          const current = readRecord(record.contractId);
          if (!current || current.value.sheetSync.generation !== claim.record.sheetSync.generation) return;
          current.value.sheetSync = Object.assign({}, current.value.sheetSync, result);
          if (result.status === "synced") delete current.value.sheetSync.errorCode;
          saveRecord(current);
        });
      } catch (error) { /* Durable working/pending state stays visible for reconciliation. */ }
    }
    if (page.nextCursor) props.setProperty(cursorKey, page.nextCursor); else props.deleteProperty(cursorKey);
  } catch (error) { /* No customer operation depends on this optional worker. */ }
  finally { if (owned) sheetStateTransaction(function() { const lease = JSON.parse(props.getProperty(leaseKey) || "null"); if (lease && lease.owner === owner) props.deleteProperty(leaseKey); }); }
}

// Optional Calendar mirror. Only this worker performs event I/O; contract requests queue locally.
function calendarConfigKey(studioId) { return settingsKey({ studioId: studioId }) + "_calendar"; }
function readCalendarConfig(studioId) {
  const raw = PropertiesService.getScriptProperties().getProperty(calendarConfigKey(studioId));
  const value = raw ? JSON.parse(raw) : { schemaVersion: 1, studioId: studioId, revision: 0, enabled: false, durationMinutes: 180, timezone: "Asia/Seoul", cycle: 0 };
  if (value.schemaVersion !== 1 || value.studioId !== studioId || typeof value.enabled !== "boolean" || !Number.isSafeInteger(value.revision) || ![60,120,180,240,360,480].includes(value.durationMinutes) || value.timezone !== "Asia/Seoul" || !Number.isSafeInteger(value.cycle)) throw new Error("CONFIGURATION_UNAVAILABLE");
  return value;
}
function ownerBookings(payload) {
  requireAdminSession(payload, "owner");
  if (Object.keys(payload).some(function(key) { return ["studioId","sessionId","cursor"].indexOf(key) < 0; }) ||
      (payload.cursor && (typeof payload.cursor !== "string" || payload.cursor.length > 2000))) throw new Error("Invalid booking request");
  const page = contractRecordPage(payload.cursor, 30);
  const bookings = page.records.filter(function(stored) { return stored.value.studio && stored.value.studio.studioId === payload.studioId; }).map(function(stored) {
    const record = stored.value; assertStudio(record, payload);
    const data = record.snapshot ? record.snapshot.data : record.formData;
    const pricing = record.snapshot ? record.snapshot.pricing : record.pricing;
    return { contractId: record.contractId, contractNumber: record.contractNumber, weddingDate: data.weddingDate, weddingTime: data.weddingTime,
      weddingVenue: data.weddingVenue, weddingHall: data.weddingHall, groomName: data.groomName, brideName: data.brideName,
      productName: record.snapshot && record.snapshot.product ? record.snapshot.product.name : ((pricing.breakdown || []).find(function(line) { return line.category === "base"; }) || {}).name || "",
      contractTotal: pricing.contractTotal, status: record.status, calendarStatus: record.calendarSync ? record.calendarSync.status : "disabled" };
  });
  return { success: true, bookings: bookings, nextCursor: page.nextCursor };
}
function writeCalendarConfig(config) {
  const props = PropertiesService.getScriptProperties(), key = calendarConfigKey(config.studioId), raw = JSON.stringify(config);
  props.setProperty(key, raw); if (props.getProperty(key) !== raw) throw new Error("CONFIGURATION_UNAVAILABLE");
}
function queueContractCalendar(record, approval) {
  try {
    const config = readCalendarConfig(record.studio.studioId), old = record.calendarSync;
    if (!record.snapshot || (!old && (!approval || !config.enabled))) return;
    // Existing jobs keep their original operational duration and connection, even on review edits.
    record.calendarSync = Object.assign({ durationMinutes: config.durationMinutes, timezone: config.timezone, cycle: config.cycle, calendarId: config.calendarId || "", attempts: 0 }, old || {},
      { status: "pending", generation: Utilities.getUuid(), queuedAt: new Date().toISOString() });
  } catch (error) { record.calendarSync = Object.assign({}, record.calendarSync || {}, { status: "unknown", errorCode: "CONFIGURATION_UNAVAILABLE" }); }
}
function ensureContractCalendarWorker() {
  if (!ScriptApp.getProjectTriggers().some(function(trigger) { return trigger.getHandlerFunction() === "contractCalendarWorker"; })) ScriptApp.newTrigger("contractCalendarWorker").timeBased().everyMinutes(1).create();
}
function calendarRequest(method, path, body) {
  const options = { method: method, headers: { Authorization: "Bearer " + ScriptApp.getOAuthToken() }, muteHttpExceptions: true };
  if (body !== undefined) { options.contentType = "application/json"; options.payload = JSON.stringify(body); }
  let response;
  try { response = UrlFetchApp.fetch("https://www.googleapis.com/calendar/v3/" + path, options); }
  catch (error) { throw new Error("PROVIDER_UNCERTAIN"); }
  const code = response.getResponseCode();
  if (code === 404 || code === 410) return null;
  if (code === 409) throw new Error("PROVIDER_CONFLICT");
  if (code < 200 || code >= 300) throw new Error(code === 401 || code === 403 ? "ACCESS_DENIED" : "PROVIDER_UNCERTAIN");
  try { const value = JSON.parse(response.getContentText()); if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(); return value; }
  catch (error) { throw new Error("PROVIDER_UNCERTAIN"); }
}
function calendarPath(config) { if (!config.calendarId) throw new Error("CONNECTION_MISSING"); return "calendars/" + encodeURIComponent(config.calendarId); }
function openContractCalendar(config) {
  const path = calendarPath(config), calendar = calendarRequest("get", path);
  if (!calendar) throw new Error("CALENDAR_MISSING");
  if (calendar.id !== config.calendarId || calendar.timeZone !== "Asia/Seoul") throw new Error("TIMEZONE_CHANGED");
  const acl = calendarRequest("get", path + "/acl?maxResults=250");
  if (!acl || !Array.isArray(acl.items) || acl.nextPageToken || acl.items.some(function(rule) { return rule.role !== "none" && rule.scope && ["default", "domain"].includes(rule.scope.type); })) throw new Error("PRIVATE_ACCESS_REQUIRED");
  return calendar;
}
function calendarError(error) {
  const allowed = ["CONNECTION_MISSING","CALENDAR_MISSING","TIMEZONE_CHANGED","PRIVATE_ACCESS_REQUIRED","ACCESS_DENIED","PROVIDER_UNCERTAIN","PROVIDER_CONFLICT","CREATION_UNCERTAIN","DUPLICATE_EVENT","EVENT_MISSING","EVENT_IDENTITY_CHANGED","CONNECTION_CHANGED","INVALID_SNAPSHOT","CONFIGURATION_UNAVAILABLE"];
  return allowed.includes(error && error.message) ? error.message : "SYNC_UNAVAILABLE";
}
function calendarAdminAction(action, payload) {
  const extra = action === "calendar_toggle" ? ["enabled","durationMinutes","expectedRevision"] : action === "calendar_create" ? ["expectedRevision","displayName"] : action === "calendar_retry" ? ["contractId"] : action === "calendar_status" ? ["cursor"] : null;
  if (!extra || Object.keys(payload).some(function(key) { return !["studioId","sessionId"].concat(extra).includes(key); })) throw new Error("Invalid integration input");
  const auth = sheetStateTransaction(function() { return requireAdminSession(payload); });
  let config = readCalendarConfig(payload.studioId);
  if (action === "calendar_toggle") {
    if (typeof payload.enabled !== "boolean" || ![60,120,180,240,360,480].includes(payload.durationMinutes)) throw new Error("Invalid integration input");
    if (payload.enabled) ensureContractCalendarWorker();
    config = sheetStateTransaction(function() {
      requireAdminSession(payload); const current = readCalendarConfig(payload.studioId);
      if (payload.expectedRevision !== current.revision) throw new Error("Settings revision conflict");
      if (payload.enabled && !current.enabled) current.cycle++;
      current.enabled = payload.enabled; current.durationMinutes = payload.durationMinutes; current.revision++; writeCalendarConfig(current); return current;
    });
  } else if (action === "calendar_create") { config = createContractCalendar(payload); }
  else if (action === "calendar_retry") {
    if (!config.enabled) throw new Error("Integration disabled");
    openContractCalendar(config); ensureContractCalendarWorker();
    sheetStateTransaction(function() {
      requireAdminSession(payload); const current = readCalendarConfig(payload.studioId), stored = readRecord(payload.contractId);
      if (!current.enabled || !stored) throw new Error("No retryable calendar job"); assertStudio(stored.value, payload);
      const job = stored.value.calendarSync;
      if (!job || !stored.value.snapshot || job.status === "synced" || (job.calendarId && job.calendarId !== current.calendarId) || !job.durationMinutes) throw new Error("No retryable calendar job");
      job.cycle = current.cycle; job.status = "pending"; job.generation = Utilities.getUuid(); delete job.errorCode; saveRecord(stored);
    });
  }
  return contractCalendarStatus(config, payload.cursor, auth);
}
function createContractCalendar(payload) {
  const initial = readCalendarConfig(payload.studioId);
  if (!initial.enabled) throw new Error("Integration disabled");
  let missing = false;
  if (initial.calendarId && initial.creationState === "ready") {
    try { openContractCalendar(initial); return initial; }
    catch (error) { if (error.message !== "CALENDAR_MISSING") throw error; missing = true; }
  }
  let fresh = false, owned = false;
  let config = sheetStateTransaction(function() {
    requireAdminSession(payload); const current = readCalendarConfig(payload.studioId);
    if (!current.enabled) throw new Error("Integration disabled");
    if (current.creationLeaseUntil > Date.now()) return current;
    if (current.revision !== payload.expectedRevision) throw new Error("Settings revision conflict");
    if (!current.creationState || (missing && current.calendarId === initial.calendarId && current.creationState === "ready")) {
      const pointer = settingsPointer(payload), name = pointer.revision ? readSettingsEntry(payload, pointer).settings.studioConfig.displayName : payload.displayName;
      if (typeof name !== "string" || !name.trim() || name.length > 160) throw new Error("Invalid studio name");
      current.name = name + " 촬영 일정"; current.creationMarker = "WB-STUDIO:" + current.studioId + ":" + Utilities.getUuid();
      current.previousCalendarId = current.calendarId || ""; current.calendarId = ""; current.creationState = "pending"; current.revision++; fresh = true;
    }
    current.creationLeaseUntil = Date.now() + 420000; writeCalendarConfig(current); owned = true; return current;
  });
  if (!owned) return config;
  try {
    let calendar;
    if (fresh) calendar = calendarRequest("post", "calendars", { summary: config.name, description: config.creationMarker, timeZone: config.timezone });
    else {
      const matches = []; let cursor = "";
      for (let page = 0; page < 20; page++) {
        const list = calendarRequest("get", "users/me/calendarList?maxResults=250" + (cursor ? "&pageToken=" + encodeURIComponent(cursor) : ""));
        if (!list || !Array.isArray(list.items)) throw new Error("CREATION_UNCERTAIN");
        list.items.forEach(function(item) { if (item.description === config.creationMarker && item.accessRole === "owner") matches.push(item); });
        cursor = list.nextPageToken || ""; if (!cursor) break;
      }
      if (cursor || matches.length !== 1) throw new Error("CREATION_UNCERTAIN"); calendar = matches[0];
    }
    if (!calendar || typeof calendar.id !== "string" || !calendar.id) throw new Error("CREATION_UNCERTAIN");
    config.calendarId = calendar.id; openContractCalendar(config);
    config = sheetStateTransaction(function() {
      const current = readCalendarConfig(payload.studioId);
      if (current.creationMarker !== config.creationMarker) throw new Error("Settings revision conflict");
      current.calendarId = config.calendarId; current.creationState = "ready"; current.creationLeaseUntil = 0; current.createdAt = new Date().toISOString(); writeCalendarConfig(current); return current;
    });
    ensureContractCalendarWorker(); return config;
  } catch (error) {
    sheetStateTransaction(function() { const current = readCalendarConfig(payload.studioId); if (current.creationMarker === config.creationMarker) { current.creationLeaseUntil = 0; writeCalendarConfig(current); } });
    throw error;
  }
}
function contractCalendarStatus(config, cursor, role) {
  let connection = config.enabled ? "disconnected" : "disabled", name = config.name || "", errorCode = "";
  if (config.enabled && config.creationState === "pending") { connection = "error"; errorCode = "CREATION_UNCERTAIN"; }
  if (config.enabled && config.calendarId && config.creationState === "ready") {
    try { name = openContractCalendar(config).summary || name; connection = "connected"; }
    catch (error) { errorCode = calendarError(error); connection = errorCode === "CALENDAR_MISSING" ? "missing" : "error"; }
  }
  const page = contractRecordPage(cursor, 30), counts = { pending: 0, failed: 0, unknown: 0, synced: 0 }, jobs = [];
  page.records.forEach(function(stored) {
    const record = stored.value, job = record.calendarSync;
    if (!record.studio || record.studio.studioId !== config.studioId || !job) return;
    const status = job.status === "working" ? "unknown" : job.status;
    if (counts[status] === undefined) throw new Error("Invalid sync state"); counts[status]++;
    if (status !== "synced") jobs.push({ contractId: record.contractId, contractNumber: record.contractNumber, status: status, errorCode: job.errorCode || "", queuedAt: job.queuedAt || "", lastAttemptAt: job.lastAttemptAt || "" });
  });
  const value = { revision: config.revision, enabled: config.enabled, durationMinutes: config.durationMinutes, timezone: config.timezone, connection: connection, name: name,
    url: config.calendarId ? "https://calendar.google.com/calendar/u/0/r?cid=" + encodeURIComponent(config.calendarId) : "", createdAt: config.createdAt || "", errorCode: errorCode, counts: counts, jobs: jobs, nextCursor: page.nextCursor, demo: false,
    workerReady: ScriptApp.getProjectTriggers().some(function(trigger) { return trigger.getHandlerFunction() === "contractCalendarWorker"; }) };
  if (role === "master") value.diagnostics = { calendarIdHint: config.calendarId ? config.calendarId.slice(0, 6) + "…" + config.calendarId.slice(-6) : "", cycle: config.cycle, creationState: config.creationState || "none" };
  return { success: true, integration: value };
}
function calendarEventProjection(record) {
  const snapshot = record.snapshot, job = record.calendarSync;
  if (!snapshot || snapshot.id !== record.contractId || snapshot.contractNumber !== record.contractNumber || !snapshot.studio || snapshot.studio.studioId !== record.studio.studioId || !["approved","sent"].includes(snapshot.status) || !snapshot.product || !snapshot.pricing || !Number.isSafeInteger(snapshot.pricing.contractTotal) || !job || job.timezone !== "Asia/Seoul" || ![60,120,180,240,360,480].includes(job.durationMinutes)) throw new Error("INVALID_SNAPSHOT");
  const data = snapshot.data, date = data.weddingDate, time = data.weddingTime;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error("INVALID_SNAPSHOT");
  const start = date + "T" + time + ":00+09:00", instant = new Date(start);
  if (!Number.isFinite(instant.getTime()) || new Date(instant.getTime() + 9 * 3600000).toISOString().slice(0,16) !== date + "T" + time) throw new Error("INVALID_SNAPSHOT");
  const safe = function(value) { return String(value || "").replace(/[&<>"']/g, function(c) { return { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]; }); };
  const marker = record.studio.studioId + ":" + record.contractId;
  return { summary: "[계약확정] " + data.groomName + " · " + data.brideName + " — " + data.weddingVenue,
    location: [data.weddingVenue, data.weddingHall].filter(Boolean).join(" "), visibility: "private",
    start: { dateTime: start, timeZone: "Asia/Seoul" }, end: { dateTime: new Date(instant.getTime() + job.durationMinutes * 60000).toISOString(), timeZone: "Asia/Seoul" },
    description: ["계약번호: " + safe(record.contractNumber), "상품: " + safe(snapshot.product.name), "옵션: " + (snapshot.options || []).map(function(item) { return safe(item.name); }).join(", "),
      "최종 계약금액: " + snapshot.pricing.contractTotal.toLocaleString("ko-KR") + "원", "계약상태: " + (record.status === "sent" ? "계약 완료" : "대표 승인 완료"),
      "계약서 발송: " + (record.customerState === "sent" && record.representativeState === "sent" ? "발송 완료" : [record.customerState, record.representativeState].some(function(state) { return ["sending","unknown"].includes(state); }) ? "발송 확인 필요" : "발송 전"),
      "WB-CONTRACT: " + record.contractId].join("\n"), extendedProperties: { private: { wbContract: marker } } };
}
function writeContractCalendar(record, config) {
  let writing = false;
  try {
    if (record.calendarSync.calendarId && record.calendarSync.calendarId !== config.calendarId) throw new Error("CONNECTION_CHANGED");
    openContractCalendar(config);
    const path = calendarPath(config) + "/events", body = calendarEventProjection(record), marker = body.extendedProperties.private.wbContract;
    const id = record.calendarSync.eventId || digest("calendar-v1\n" + record.studio.studioId + "\n" + record.contractId);
    let event = calendarRequest("get", path + "/" + encodeURIComponent(id));
    if (event && event.status === "cancelled") throw new Error("EVENT_MISSING");
    const found = calendarRequest("get", path + "?maxResults=3&showDeleted=false&privateExtendedProperty=" + encodeURIComponent("wbContract=" + marker));
    if (!found || (found.items !== undefined && !Array.isArray(found.items))) throw new Error("PROVIDER_UNCERTAIN");
    found.items = found.items || [];
    if (found.nextPageToken || found.items.length > 1 || (event && found.items.length && found.items[0].id !== event.id)) throw new Error("DUPLICATE_EVENT");
    if (event && (!event.extendedProperties || !event.extendedProperties.private || event.extendedProperties.private.wbContract !== marker)) throw new Error("EVENT_IDENTITY_CHANGED");
    if (!event && found.items.length) event = found.items[0];
    if (!event && record.calendarSync.eventId) throw new Error("EVENT_MISSING");
    writing = true;
    if (event) event = calendarRequest("patch", path + "/" + encodeURIComponent(event.id) + "?sendUpdates=none", body);
    else {
      try { event = calendarRequest("post", path + "?sendUpdates=none", Object.assign({ id: id }, body)); }
      catch (error) { if (error.message !== "PROVIDER_CONFLICT") throw error; event = calendarRequest("get", path + "/" + id); }
    }
    if (!event || !event.id || !event.extendedProperties || !event.extendedProperties.private || event.extendedProperties.private.wbContract !== marker) throw new Error("EVENT_IDENTITY_CHANGED");
    // Confirm exactly the data written; a 409 recovered event is retried before acknowledging stale content.
    if (event.summary !== body.summary || event.description !== body.description || event.location !== body.location || Date.parse(event.start.dateTime) !== Date.parse(body.start.dateTime) || Date.parse(event.end.dateTime) !== Date.parse(body.end.dateTime)) throw new Error("PROVIDER_UNCERTAIN");
    return { status: "synced", calendarId: config.calendarId, eventId: event.id, lastSuccessAt: new Date().toISOString() };
  } catch (error) { return { status: writing ? "unknown" : "failed", errorCode: calendarError(error) }; }
}
function contractCalendarWorker() {
  const props = PropertiesService.getScriptProperties(), leaseKey = "contract_calendar_worker_lease", cursorKey = "contract_calendar_scan_cursor", owner = Utilities.getUuid(); let owned = false;
  try {
    owned = sheetStateTransaction(function() {
      const previous = JSON.parse(props.getProperty(leaseKey) || "null"); if (previous && previous.until > Date.now()) return false;
      const enabled = Object.keys(props.getProperties()).some(function(key) { if (!/^studio_settings_.*_calendar$/.test(key)) return false; try { return JSON.parse(props.getProperty(key)).enabled === true; } catch (error) { return false; } });
      if (!enabled) return false; props.setProperty(leaseKey, JSON.stringify({ owner: owner, until: Date.now() + 420000 })); return true;
    });
    if (!owned) return;
    let page; try { page = contractRecordPage(props.getProperty(cursorKey), 15); } catch (error) { props.deleteProperty(cursorKey); return; }
    let attempts = 0;
    page.records.forEach(function(stored) {
      if (attempts >= 3 || !stored.value.calendarSync || !["pending","working"].includes(stored.value.calendarSync.status)) return;
      try {
        const claim = sheetStateTransaction(function() {
          const current = readRecord(stored.value.contractId); if (!current || current.file.getId() !== stored.file.getId()) return null;
          const record = current.value, config = readCalendarConfig(record.studio.studioId), job = record.calendarSync;
          if (!config.enabled || !job || !["pending","working"].includes(job.status) || job.cycle !== config.cycle) return null;
          job.status = "working"; job.lastAttemptAt = new Date().toISOString(); job.attempts = (job.attempts || 0) + 1;
          job.calendarId = job.calendarId || config.calendarId || ""; saveRecord(current); return { record: record, config: config };
        });
        if (!claim) return; attempts++; const result = writeContractCalendar(claim.record, claim.config);
        sheetStateTransaction(function() {
          const current = readRecord(stored.value.contractId); if (!current || !current.value.calendarSync || current.value.calendarSync.generation !== claim.record.calendarSync.generation) return;
          Object.assign(current.value.calendarSync, result); if (result.status === "synced") delete current.value.calendarSync.errorCode; saveRecord(current);
        });
      } catch (error) { /* Durable working state remains recoverable. No Core rollback. */ }
    });
    if (page.nextCursor) props.setProperty(cursorKey, page.nextCursor); else props.deleteProperty(cursorKey);
  } catch (error) { /* Independent optional worker. */ }
  finally { if (owned) { try { sheetStateTransaction(function() { const lease = JSON.parse(props.getProperty(leaseKey) || "null"); if (lease && lease.owner === owner) props.deleteProperty(leaseKey); }); } catch (error) { /* Lease expires safely. */ } } }
}
