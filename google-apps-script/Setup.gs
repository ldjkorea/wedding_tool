/** Run once from the editor to grant service permissions. Does not send mail or create resources. */
function authorizeWeddingIntegrations() {
  DriveApp.getFolderById(setting("CONTRACTS_FOLDER_ID")).getName();
  DriveApp.getFolderById(setting("STUDIO_SETTINGS_FOLDER_ID")).getName();
  GmailApp.getAliases();
  CalendarApp.getAllCalendars();
  ScriptApp.getProjectTriggers();
  console.log("Wedding Tool service authorization completed. No mail sent or calendar created.");
}
