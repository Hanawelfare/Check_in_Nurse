/**
 * ============================================================================
 * HANA LPN1 Nurse Shift System - Google Apps Script Backend (Code.gs)
 * ============================================================================
 * ใช้สำหรับผู้ใช้ที่ต้องการนำระบบไปติดตั้งเป็น Web App บน Google Apps Script 
 * หรือบันทึกข้อมูลลง Google Sheet ควบคู่กับการส่ง Telegram Bot
 */

var TELEGRAM_TOKEN = "7141132492:AAEWzaarVZVCA7m9gAjQjoqsyXyTpFaoDKo";
var CHAT_ID = "-4567593144";

/**
 * เสิร์ฟหน้าเว็บแอป (Web App doGet)
 */
function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('ระบบแจ้งเวรเข้าทำงานห้องพยาบาล HANA LPN1')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * รับคำขอ POST สำหรับบันทึกเวรและส่ง Telegram
 */
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    
    // 1. บันทึกข้อมูลลง Google Sheet (ถ้ามีชีตเปิดอยู่)
    try {
      var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
      if (sheet) {
        if (sheet.getLastRow() === 0) {
          sheet.appendRow(["วันที่และเวลาบันทึก", "วันที่ขึ้นเวร", "ชื่อพยาบาล", "กะ/เวร", "จุดประจำการ", "เบอร์โทร", "หมายเหตุ"]);
        }
        sheet.appendRow([
          new Date(),
          data.date || "",
          data.nurseName || "",
          data.shift === "Day" ? "เวรเช้า (Day)" : "เวรดึก (Night)",
          data.location || "",
          data.phone || "",
          data.note || ""
        ]);
      }
    } catch (sheetErr) {
      Logger.log("Sheet record skipped: " + sheetErr.message);
    }

    // 2. ส่งข้อความแจ้งเตือนเข้า Telegram
    var tgSuccess = sendTelegramNotification(data);

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      telegramSent: tgSuccess,
      message: "บันทึกข้อมูลสำเร็จ"
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: err.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * ฟังก์ชันส่งข้อความเข้า Telegram Bot
 */
function sendTelegramNotification(data) {
  var shiftThai = data.shift === "Day" 
    ? "☀️ เวรเช้า (Day) 07:00 - 18:00 น." 
    : "🌙 เวรดึก (Night) 18:00 - 07:00 น.";

  var message = 
    "🔔 <b>แจ้งเวรเข้าทำงานห้องพยาบาล HANA LPN1</b>\n" +
    "━━━━━━━━━━━━━━━━━━━━\n" +
    "👩‍⚕️ <b>พยาบาล:</b> " + (data.nurseName || "-") + "\n" +
    "📅 <b>วันที่:</b> " + (data.date || "-") + "\n" +
    "⏰ <b>เวร:</b> " + shiftThai + "\n" +
    "🏥 <b>จุดประจำการ:</b> " + (data.location || "-") + "\n" +
    "📞 <b>เบอร์ติดต่อ:</b> " + (data.phone || "-") + "\n" +
    "📝 <b>หมายเหตุ:</b> " + (data.note || "-") + "\n" +
    "⏱ <b>เวลาบันทึก:</b> " + Utilities.formatDate(new Date(), "Asia/Bangkok", "HH:mm:ss") + " น.\n" +
    "━━━━━━━━━━━━━━━━━━━━\n" +
    "<i>(ส่งจากระบบ Nurse Shift Check-In Web App)</i>";

  var url = "https://api.telegram.org/bot" + TELEGRAM_TOKEN + "/sendMessage";
  var payload = {
    method: "POST",
    contentType: "application/json",
    payload: JSON.stringify({
      chat_id: CHAT_ID,
      text: message,
      parse_mode: "HTML"
    }),
    muteHttpExceptions: true
  };

  try {
    var response = UrlFetchApp.fetch(url, payload);
    var resJson = JSON.parse(response.getContentText());
    return resJson.ok;
  } catch (e) {
    Logger.log("Telegram Error: " + e.message);
    return false;
  }
}
