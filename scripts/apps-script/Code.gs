// Code.gs — SHEVET submission endpoint.
// Container-bound Apps Script: appends one validated row to the DB tab.
// Deploy as Web app: Execute as Me, Who has access: Anyone. See README "Submissions".

const TAB = "DB";
const MAX_LEN = 500;

function doPost(e) {
  let data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return respond({ ok: false, error: "bad json" });
  }
  const clean = (v) => String(v == null ? "" : v).trim().slice(0, MAX_LEN);

  // honeypot filled -> pretend success, write nothing
  if (clean(data.website)) return respond({ ok: true });

  const category = clean(data.category);
  const name = clean(data.name);
  if (!name || !category) return respond({ ok: false, error: "missing fields" });

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    SpreadsheetApp.getActiveSpreadsheet()
      .getSheetByName(TAB)
      .appendRow([category, name, clean(data.description), clean(data.link), ""]);
  } finally {
    lock.releaseLock();
  }
  return respond({ ok: true });
}

function respond(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
