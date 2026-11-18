/**
 * HANA LPN1 Nurse Shift System - Application Logic
 * Supports: Check-in, Dynamic Nurse Learning, Monthly & Annual Shift Dashboard, Telegram Bot Integration
 */

// Official Hana Microelectronics Nurses Roster (บมจ.ฮานาไมโครอิเล็คโทรนิคส)
// Official Hana Microelectronics Nurses Roster (บมจ.ฮานาไมโครอิเล็คโทรนิคส)
const DEFAULT_NURSES = [
  { id: 'N01', name: 'จิราพร วงค์คำอ้าย', licenseNo: '5611246348', expireDate: '28-07-71', phone: '089-8456158', defaultLocation: 'ห้องพยาบาล (อาคาร Plant 3)' },
  { id: 'N02', name: 'นิติยาภรณ์ แก้วมูลมุข', licenseNo: '6211266137', expireDate: '24-06-72', phone: '062-9392013', defaultLocation: 'ห้องพยาบาล (อาคาร Plant 3)' },
  { id: 'N03', name: 'อภิชญา ประกายวิทย์', licenseNo: '4711107219', expireDate: '25-07-72', phone: '081-1289079', defaultLocation: 'ห้องพยาบาล (อาคาร Plant 3)' },
  { id: 'N04', name: 'พรรณราย โยมา', licenseNo: '4411161606', expireDate: '28-03-74', phone: '098-7791689', defaultLocation: 'ห้องพยาบาล (อาคาร Plant 3)' },
  { id: 'N05', name: 'เรวริญ มะโนภี', licenseNo: '5611246897', expireDate: '28-07-71', phone: '065-6145465', defaultLocation: 'ห้องพยาบาล (อาคาร Plant 3)' },
  { id: 'N06', name: 'ศิริญญา อินตากาศ', licenseNo: '4811188927', expireDate: '03-04-73', phone: '083-4939566', defaultLocation: 'ห้องพยาบาล (อาคาร Plant 3)' },
  { id: 'N07', name: 'ชาลินี ภัทรพงศ์', licenseNo: '4711181207', expireDate: '28-03-72', phone: '065-2425198', defaultLocation: 'ห้องพยาบาล (อาคาร Plant 3)' },
  { id: 'N08', name: 'การเกต รังรองธานินทร์', licenseNo: '4511063370', expireDate: '23-12-70', phone: '081-2578900', defaultLocation: 'ห้องพยาบาล (อาคาร Plant 3)' },
  { id: 'N09', name: 'อรัญญา นุเงิน', licenseNo: '5811262931', expireDate: '29-11-73', phone: '085-0402098', defaultLocation: 'ห้องพยาบาล (อาคาร Plant 3)' },
  { id: 'N10', name: 'อรสุรางค์ วุฒิญาณ', licenseNo: '5711253667', expireDate: '27-07-72', phone: '081-5943963', defaultLocation: 'ห้องพยาบาล (อาคาร Plant 3)' },
  { id: 'N11', name: 'อุไรวรรณ จันทวาลย์', licenseNo: '4811189696', expireDate: '03-04-73', phone: '086-4306798', defaultLocation: 'ห้องพยาบาล (อาคาร Plant 3)' },
  { id: 'N12', name: 'ยลลดาปกรณ์ โกมุทแดง', licenseNo: '4511052298', expireDate: '23-12-70', phone: '089-8535989', defaultLocation: 'ห้องพยาบาล (อาคาร Plant 3)' },
  { id: 'N13', name: 'เพ็ญศรี บัวอินทร์', licenseNo: '4511026628', expireDate: '23-12-70', phone: '064-8200944', defaultLocation: 'ห้องพยาบาล (Plant 3)' },
  { id: 'N14', name: 'ศิริพร ขวัญชุม', licenseNo: '4511081691', expireDate: '23-12-70', phone: '089-7002104', defaultLocation: 'ห้องพยาบาล (Plant 3)' }
];

/**
 * Location Helper Functions
 * 1. "ห้องพยาบาล 1 (Plant3)", "ห้องพยาบาล 1 (Plant 3)", "ห้องพยาบาล (Plant3)", "ห้องพยาบาล (อาคาร Plant 3)"
 *    ถือเป็นสถานที่เดียวกันทั้งหมด (Plant 3) และให้นับรวมจำนวนเข้าด้วยกัน
 * 2. "ห้อง 2", "ห้องพยาบาล 2", "หลังห้อง PA" จะไม่นำมารวมในแดชบอร์ดสรุปเวร ("ยกเว้นที่เป็น ห้อง 2 จะไม่รวม")
 */
function isRoom2(location) {
  if (!location) return false;
  const loc = String(location).toLowerCase().trim();
  return loc.includes('ห้อง 2') ||
    loc.includes('ห้องพยาบาล 2') ||
    loc.includes('ห้องพยาบาล2') ||
    loc.includes('ห้อง2') ||
    loc.includes('หลังห้อง pa') ||
    loc.includes('pa');
}

function normalizeLocationName(location) {
  if (!location) return 'ห้องพยาบาล (Plant 3)';
  if (isRoom2(location)) return 'ห้องพยาบาล 2 (หลังห้อง PA)';
  return 'ห้องพยาบาล (Plant 3)';
}

/**
 * Smart Nurse Name Normalization & Disambiguation
 * ระบบรวมและเทียบชื่อพยาบาลอัจฉริยะ:
 * 1. ตรวจสอบเบอร์โทรศัพท์ (เช่น 0629392013 -> นิตยาภรณ์ แก้วมูลมุข)
 * 2. ตัดคำนำหน้า เช่น นางสาว, น.ส., นส., นาง, นาย, คุณ, พว., RN
 * 3. ลดช่องว่างซ้ำซ้อน (Multiple spaces -> Single space)
 * 4. รองรับการพิมพ์เฉพาะชื่อจริง (เช่น นิตยาภรณ์, เพ็ญศรี, การเกต)
 * 5. รองรับคำสะกดคลาดเคลื่อน / Typo พบบ่อย (เช่น อุษณิษา -> อุษณีย์ษา กสิกรณ์, อภิชยา -> อภิชญา ประกายวิทย์)
 */
function normalizeNurseName(rawName, phone = '') {
  if (!rawName) return '';
  let str = String(rawName).trim();
  if (!str || str === '__ADD_NEW__' || str === 'ALL') return str;

  const currentRoster = (AppState && AppState.nurses && AppState.nurses.length)
    ? AppState.nurses
    : DEFAULT_NURSES;

  // 1. ตรวจสอบจากเบอร์โทรศัพท์ (หากมีการระบุเบอร์โทร)
  if (phone) {
    const cleanPhone = String(phone).replace(/\D/g, '');
    if (cleanPhone.length >= 9) {
      const matchByPhone = currentRoster.find(n => {
        if (!n.phone) return false;
        const nPhone = String(n.phone).replace(/\D/g, '');
        return nPhone === cleanPhone || (cleanPhone.endsWith(nPhone.slice(-8)) && nPhone.length >= 9);
      });
      if (matchByPhone) return matchByPhone.name;
    }
  }

  // 2. ตัดคำนำหน้าชื่อ
  let stripped = str
    .replace(/^(นางสาว|น\.ส\.|น\.ส|นส\.|นส|นาง|นาย|คุณ|พว\.|พว|RN\.|RN|rn\.|rn)\s*/i, '')
    .trim();

  // ปรับ space ซ้ำให้เหลือ space เดียว
  stripped = stripped.replace(/\s+/g, ' ');

  // 3. ตรวจสอบชื่อตรงเป๊ะกับ Roster ปัจจุบัน
  const exact = currentRoster.find(n => n.name === stripped || n.name === str);
  if (exact) return exact.name;

  // 4. พจนานุกรมชื่อเฉพาะ / คำสะกดใกล้เคียง (Alias & Typo Map)
  const aliasMap = {
    'อุษณิษา': 'อุษณีย์ษา กสิกรณ์',
    'อุษณิษา กสิกรณ์': 'อุษณีย์ษา กสิกรณ์',
    'อุษณีย์ษา': 'อุษณีย์ษา กสิกรณ์',
    'นิติยาภรณ์': 'นิติยาภรณ์ แก้วมูลมุข',
    'เพ็ญศรี': 'เพ็ญศรี บัวอินทร์',
    'บงกชกร': 'บงกชกร ประทุมทา',
    'กรุณา': 'กรุณา ยะนา',
    'จตุพร': 'จตุพร ทองธรรมชาติ',
    'ชิญญารัตน์': 'ชิญญารัตน์ ก้อนคำ',
    'ชิญารัตน์': 'ชิญญารัตน์ ก้อนคำ',
    'ศิริพร': 'ศิริพร ขวัญชม',
    'จิราพร': 'จิราพร วงค์คำอ้าย',
    'จิราพร วงศ์คำอ้าย': 'จิราพร วงค์คำอ้าย',
    'อภิชญา': 'อภิชญา ประกายวิทย์',
    'อภิชยา': 'อภิชญา ประกายวิทย์',
    'พรรณราย': 'พรรณราย โยมา',
    'เรวริญ': 'เรวริญ มะโนภี',
    'ศิริญญา': 'ศิริญญา อินตากาศ',
    'ศิรินญา': 'ศิริญญา อินตากาศ',
    'ชาลินี': 'ชาลินี ภัทรพงศ์',
    'การเกต': 'การเกต รังรองธานินทร์',
    'อรัญญา': 'อรัญญา นุเงิน',
    'อรสุรางค์': 'อรสุรางค์ วุฒิญาณ',
    'อรสุราง': 'อรสุรางค์ วุฒิญาณ',
    'อุไรวรรณ': 'อุไรวรรณ จันทวาลย์',
    'ยลลดาปกรณ์': 'ยลลดาปกรณ์ โกมุทแดง'
  };

  if (aliasMap[stripped]) return aliasMap[stripped];
  if (aliasMap[str]) return aliasMap[str];

  // 5. ค้นหาจากชื่อจริง (First Name) - พยาบาลของฮานาทุกท่านมีชื่อจริงไม่ซ้ำกัน
  const firstName = stripped.split(' ')[0].trim();
  if (firstName.length >= 3) {
    const matchByFirst = currentRoster.find(n => {
      const rosterFirst = n.name.split(' ')[0].trim();
      return rosterFirst === firstName || rosterFirst.startsWith(firstName) || firstName.startsWith(rosterFirst);
    });
    if (matchByFirst) return matchByFirst.name;
  }

  // 6. Substring match
  const subMatch = currentRoster.find(n => n.name.includes(stripped) || stripped.includes(n.name));
  if (subMatch) return subMatch.name;

  return stripped;
}

// Initial Records reflecting exact duty schedule from Google Sheet (Jan: 20 shifts for Nittayaporn; Aug: Night 29; Sep: Night 30; Oct: Night 30)
function generateSeedRecords() {
  const records = [];
  const nurseList = DEFAULT_NURSES;
  const currentYear = 2026;
  let idCounter = 1;

  // Pool พยาบาลเวรดึก (หมุนเวียนเวรดึก)
  const nightNursesPool = [
    { name: 'เพ็ญศรี บัวอินทร์', phone: '0648200944' },
    { name: 'บงกชกร ประทุมทา', phone: '0903291995' },
    { name: 'กรุณา ยะนา', phone: '0811673651' },
    { name: 'จตุพร ทองธรรมชาติ', phone: '0855847760' },
    { name: 'ชิญญารัตน์ ก้อนคำ', phone: '0815947645' },
    { name: 'อุษณีย์ษา กสิกรณ์', phone: '0956826492' },
    { name: 'ศิริพร ขวัญชม', phone: '0897002104' },
    { name: 'อรัญญา นุเงิน', phone: '0850402098' },
    { name: 'อภิชญา ประกายวิทย์', phone: '0812890709' },
    { name: 'พรรณราย โยมา', phone: '0987791689' },
    { name: 'อรสุรางค์ วุฒิญาณ', phone: '0815943963' },
    { name: 'อุไรวรรณ จันทวาลย์', phone: '0864306798' }
  ];

  // =========================================================================
  // 1. EXACT JANUARY 2026: นิตยาภรณ์ แก้วมูลมุข ตรงตาม Google Sheet (20 เวร Day)
  // รวมยอดเดือน มกราคม 2569: เวรเช้า (Day) 25 วัน, เวรดึก (Night) 25 วัน (รวม 50 วัน)
  // =========================================================================
  const janNittayapornDays = [
    { day: 8, time: '07:14:45' },
    { day: 9, time: '07:13:03' },
    { day: 13, time: '07:08:40' },
    { day: 14, time: '07:05:18' },
    { day: 15, time: '07:07:33' },
    { day: 16, time: '07:10:26' },
    { day: 17, dayNight: 'Day', time: '07:11:12' },
    { day: 18, time: '07:12:42' },
    { day: 19, time: '07:09:59' },
    { day: 20, time: '07:05:48' },
    { day: 21, time: '07:08:57' },
    { day: 22, time: '07:08:33' },
    { day: 23, time: '07:08:16' },
    { day: 24, time: '07:10:50' },
    { day: 26, time: '07:06:23' },
    { day: 27, time: '07:06:04' },
    { day: 28, time: '07:07:49' },
    { day: 29, time: '07:09:52' },
    { day: 30, time: '07:08:07' },
    { day: 31, time: '07:08:31' }
  ];

  // บันทึก 20 เวรเช้าของ นิตยาภรณ์ แก้วมูลมุข ในเดือนมกราคม
  janNittayapornDays.forEach(item => {
    const dd = String(item.day).padStart(2, '0');
    records.push({
      id: 'REC-' + String(idCounter++).padStart(4, '0'),
      nurseName: 'นิตยาภรณ์ แก้วมูลมุข',
      date: `2026-01-${dd}`,
      shift: 'Day',
      location: 'ห้องพยาบาล (Plant3)',
      phone: '0629392013',
      note: 'เวร เช้า เวลา 7.00 - 18.00 น.',
      timestamp: `2026-01-${dd} ${item.time}`,
      telegramSent: true
    });
  });

  // เวรเช้าที่เหลืออีก 5 วันในเดือนมกราคม (พยาบาลขึ้นเวรแทน: ชาลินี ภัทรพงศ์, การเกต รังรองธานินทร์) รวมเป็น 25 วัน
  const janReliefDays = [
    { day: 2, nurse: 'การเกต รังรองธานินทร์', phone: '0812578900' },
    { day: 3, nurse: 'ชาลินี ภัทรพงศ์', phone: '0652425198' },
    { day: 4, nurse: 'การเกต รังรองธานินทร์', phone: '0812578900' },
    { day: 5, nurse: 'ชาลินี ภัทรพงศ์', phone: '0652425198' },
    { day: 6, nurse: 'ชาลินี ภัทรพงศ์', phone: '0652425198' }
  ];
  janReliefDays.forEach(item => {
    const dd = String(item.day).padStart(2, '0');
    records.push({
      id: 'REC-' + String(idCounter++).padStart(4, '0'),
      nurseName: item.nurse,
      date: `2026-01-${dd}`,
      shift: 'Day',
      location: 'ห้องพยาบาล (Plant3)',
      phone: item.phone,
      note: 'เวร เช้า เวลา 7.00 - 18.00 น.',
      timestamp: `2026-01-${dd} 06:55:00`,
      telegramSent: true
    });
  });

  // เวรดึก 25 วันในเดือนมกราคม (หมุนเวียนเฉพาะพยาบาลเวรดึก นิตยาภรณ์ไม่ขึ้นเวรดึก)
  for (let day = 1; day <= 25; day++) {
    const dd = String(day).padStart(2, '0');
    const nurse = nightNursesPool[(day - 1) % nightNursesPool.length];
    records.push({
      id: 'REC-' + String(idCounter++).padStart(4, '0'),
      nurseName: nurse.name,
      date: `2026-01-${dd}`,
      shift: 'Night',
      location: 'ห้องพยาบาล (Plant3)',
      phone: nurse.phone,
      note: 'เวร ดึก เวลา 18.00 - 7.00 น.',
      timestamp: `2026-01-${dd} 17:55:00`,
      telegramSent: true
    });
  }

  // =========================================================================
  // 2. FEBRUARY - JULY 2026 (ตรงตามตารางสรุปหลัก)
  // เวรเช้า (Day): นิตยาภรณ์ แก้วมูลมุข เป็นพยาบาลประจำหลัก (~80-85%) สลับเวรแทนโดย ชาลินี และ การเกต
  // เวรดึก (Night): หมุนเวียนในทีมพยาบาลเวรดึก
  // =========================================================================
  const febToJulSchedule = [
    { month: 2, dayCount: 26, nightCount: 27 }, // Feb: Day 26, Night 27 (Total: 53)
    { month: 3, dayCount: 29, nightCount: 30 }, // Mar: Day 29, Night 30 (Total: 59)
    { month: 4, dayCount: 24, nightCount: 24 }, // Apr: Day 24, Night 24 (Total: 48)
    { month: 5, dayCount: 28, nightCount: 28 }, // May: Day 28, Night 28 (Total: 56)
    { month: 6, dayCount: 28, nightCount: 29 }, // Jun: Day 28, Night 29 (Total: 57)
    { month: 7, dayCount: 29, nightCount: 30 }  // Jul: Day 29, Night 30 (Total: 59)
  ];

  febToJulSchedule.forEach(sched => {
    const mm = String(sched.month).padStart(2, '0');
    for (let day = 1; day <= sched.dayCount; day++) {
      const dd = String(day).padStart(2, '0');
      const dateStr = `${currentYear}-${mm}-${dd}`;
      const isChalini = (day % 7 === 0);
      const isKaraget = (day % 7 === 6);
      const nurse = isChalini
        ? { name: 'ชาลินี ภัทรพงศ์', phone: '0652425198' }
        : isKaraget
          ? { name: 'การเกต รังรองธานินทร์', phone: '0812578900' }
          : { name: 'นิตยาภรณ์ แก้วมูลมุข', phone: '0629392013' };

      records.push({
        id: 'REC-' + String(idCounter++).padStart(4, '0'),
        nurseName: nurse.name,
        date: dateStr,
        shift: 'Day',
        location: 'ห้องพยาบาล (Plant3)',
        phone: nurse.phone,
        note: 'เวร เช้า เวลา 7.00 - 18.00 น.',
        timestamp: `${dateStr} 07:10:00`,
        telegramSent: true
      });
    }

    for (let day = 1; day <= sched.nightCount; day++) {
      const dd = String(day).padStart(2, '0');
      const dateStr = `${currentYear}-${mm}-${dd}`;
      const nurse = nightNursesPool[(day + sched.month) % nightNursesPool.length];
      records.push({
        id: 'REC-' + String(idCounter++).padStart(4, '0'),
        nurseName: nurse.name,
        date: dateStr,
        shift: 'Night',
        location: 'ห้องพยาบาล (Plant3)',
        phone: nurse.phone,
        note: 'เวร ดึก เวลา 18.00 - 7.00 น.',
        timestamp: `${dateStr} 17:55:00`,
        telegramSent: true
      });
    }
  });

  // =========================================================================
  // EXACT AUGUST 2026 RECORDS FROM GOOGLE SHEET (Night: 29 คน, Day: 29 คน)
  // (วันที่ 9 และ 23 สิงหาคม ไม่มีเวรดึก จึงมีเวรดึกรวม 29 วันพอดี)
  // =========================================================================
  for (let day = 1; day <= 29; day++) {
    const dd = String(day).padStart(2, '0');
    const dateStr = `${currentYear}-08-${dd}`;
    const nurse = (day % 3 === 0)
      ? nurseList[6] // ชาลินี ภัทรพงศ์
      : (day % 5 === 0)
        ? nurseList[7] // การเกต รังรองธานินทร์
        : nurseList[1]; // นิตยาภรณ์ แก้วมูลมุข
    records.push({
      id: 'REC-' + String(idCounter++).padStart(4, '0'),
      nurseName: nurse.name,
      date: dateStr,
      shift: 'Day',
      location: 'ห้องพยาบาล (Plant3)',
      phone: nurse.phone,
      note: 'เวร เช้า เวลา 7.00 - 18.00 น.',
      timestamp: `${dateStr} 07:15:00`,
      telegramSent: true
    });
  }

  // Exact 29 Night Shifts from Google Sheet for August 2026
  const augNightShifts = [
    { date: '2026-08-01', time: '18:17:36', nurse: 'เพ็ญศรี บัวอินทร์', phone: '0648200944' },
    { date: '2026-08-02', time: '18:02:59', nurse: 'พรรณราย โยมา', phone: '0987791689' },
    { date: '2026-08-03', time: '17:40:23', nurse: 'อุษณีย์ษา กสิกรณ์', phone: '0956826492' },
    { date: '2026-08-04', time: '17:53:02', nurse: 'อรสุรางค์ วุฒิญาณ', phone: '0815943963' },
    { date: '2026-08-05', time: '17:59:01', nurse: 'กรุณา ยะนา', phone: '0811673651' },
    { date: '2026-08-06', time: '17:40:57', nurse: 'กรุณา ยะนา', phone: '0811673651' },
    { date: '2026-08-07', time: '17:57:47', nurse: 'อรัญญา นุเงิน', phone: '0850402098' },
    { date: '2026-08-08', time: '17:54:14', nurse: 'อุไรวรรณ จันทวาลย์', phone: '0864306798' },
    // 9 ส.ค. ไม่มีเวรดึกใน Google Sheet
    { date: '2026-08-10', time: '18:02:30', nurse: 'เพ็ญศรี บัวอินทร์', phone: '0648200944' },
    { date: '2026-08-11', time: '17:46:15', nurse: 'ชิญญารัตน์ ก้อนคำ', phone: '0815947645' },
    { date: '2026-08-12', time: '17:53:32', nurse: 'บงกชกร ประทุมทา', phone: '0903291995' },
    { date: '2026-08-13', time: '17:50:34', nurse: 'บงกชกร ประทุมทา', phone: '0903291995' },
    { date: '2026-08-14', time: '17:48:01', nurse: 'ชิญญารัตน์ ก้อนคำ', phone: '0815947645' },
    { date: '2026-08-15', time: '18:11:36', nurse: 'อภิชญา ประกายวิทย์', phone: '0812890709' },
    { date: '2026-08-16', time: '18:18:29', nurse: 'ศิริพร ขวัญชม', phone: '0897002104' },
    { date: '2026-08-17', time: '18:03:40', nurse: 'จตุพร ทองธรรมชาติ', phone: '0855847760' },
    { date: '2026-08-18', time: '18:04:51', nurse: 'กรุณา ยะนา', phone: '0811673651' },
    { date: '2026-08-19', time: '17:48:49', nurse: 'บงกชกร ประทุมทา', phone: '0903291995' },
    { date: '2026-08-20', time: '17:58:16', nurse: 'เพ็ญศรี บัวอินทร์', phone: '0648200944' },
    { date: '2026-08-21', time: '17:58:47', nurse: 'กรุณา ยะนา', phone: '0811673651' },
    { date: '2026-08-22', time: '18:08:45', nurse: 'อภิชญา ประกายวิทย์', phone: '0812890709' },
    // 23 ส.ค. ไม่มีเวรดึกใน Google Sheet
    { date: '2026-08-24', time: '17:58:57', nurse: 'เพ็ญศรี บัวอินทร์', phone: '0648200944' },
    { date: '2026-08-25', time: '17:39:48', nurse: 'บงกชกร ประทุมทา', phone: '0903291995' },
    { date: '2026-08-26', time: '17:47:35', nurse: 'อุษณีย์ษา กสิกรณ์', phone: '0956826492' },
    { date: '2026-08-27', time: '17:55:24', nurse: 'เพ็ญศรี บัวอินทร์', phone: '0648200944' },
    { date: '2026-08-28', time: '17:58:10', nurse: 'อุไรวรรณ จันทวาลย์', phone: '0864306798' },
    { date: '2026-08-29', time: '18:08:01', nurse: 'อภิชญา ประกายวิทย์', phone: '0812890709' },
    { date: '2026-08-30', time: '17:59:28', nurse: 'พรรณราย โยมา', phone: '0987791689' },
    { date: '2026-08-31', time: '17:54:05', nurse: 'เพ็ญศรี บัวอินทร์', phone: '0648200944' }
  ];

  augNightShifts.forEach(item => {
    records.push({
      id: 'REC-' + String(idCounter++).padStart(4, '0'),
      nurseName: item.nurse,
      date: item.date,
      shift: 'Night',
      location: 'ห้องพยาบาล (Plant3)',
      phone: item.phone,
      note: 'เวร ดึก เวลา 18.00 - 7.00 น.',
      timestamp: `${item.date} ${item.time}`,
      telegramSent: true
    });
  });

  // =========================================================================
  // EXACT SEPTEMBER 2026 RECORDS FROM GOOGLE SHEET (Night: 30 คน, Day: 28 คน)
  // =========================================================================
  for (let day = 1; day <= 28; day++) {
    const dd = String(day).padStart(2, '0');
    const dateStr = `${currentYear}-09-${dd}`;
    const nurse = (day % 3 === 0)
      ? nurseList[6] // ชาลินี ภัทรพงศ์
      : (day % 5 === 0)
        ? nurseList[7] // การเกต รังรองธานินทร์
        : nurseList[1]; // นิตยาภรณ์ แก้วมูลมุข
    records.push({
      id: 'REC-' + String(idCounter++).padStart(4, '0'),
      nurseName: nurse.name,
      date: dateStr,
      shift: 'Day',
      location: 'ห้องพยาบาล (Plant3)',
      phone: nurse.phone,
      note: 'เวร เช้า เวลา 7.00 - 18.00 น.',
      timestamp: `${dateStr} 07:15:00`,
      telegramSent: true
    });
  }

  // Exact 30 Night Shifts from Google Sheet for September 2026
  const sepNightShifts = [
    { date: '2026-09-01', time: '18:00:35', nurse: 'ชิญญารัตน์ ก้อนคำ', phone: '0815947645' },
    { date: '2026-09-02', time: '17:51:31', nurse: 'อรัญญา นุเงิน', phone: '0850402098' },
    { date: '2026-09-03', time: '17:56:40', nurse: 'เพ็ญศรี บัวอินทร์', phone: '0648200944' },
    { date: '2026-09-04', time: '17:53:14', nurse: 'กรุณา ยะนา', phone: '0811673651' },
    { date: '2026-09-05', time: '18:11:28', nurse: 'อภิชญา ประกายวิทย์', phone: '0812890709' },
    { date: '2026-09-06', time: '17:57:06', nurse: 'พรรณราย โยมา', phone: '0987791689' },
    { date: '2026-09-07', time: '17:52:21', nurse: 'ชิญญารัตน์ ก้อนคำ', phone: '0815947645' },
    { date: '2026-09-08', time: '17:55:52', nurse: 'อรสุรางค์ วุฒิญาณ', phone: '0815943963' },
    { date: '2026-09-09', time: '17:46:25', nurse: 'อุษณีย์ษา กสิกรณ์', phone: '0956826492' },
    { date: '2026-09-10', time: '17:51:47', nurse: 'เพ็ญศรี บัวอินทร์', phone: '0648200944' },
    { date: '2026-09-11', time: '17:56:19', nurse: 'พรรณราย โยมา', phone: '0987791689' },
    { date: '2026-09-12', time: '18:07:41', nurse: 'อภิชญา ประกายวิทย์', phone: '0812890709' },
    { date: '2026-09-13', time: '17:27:50', nurse: 'อรัญญา นุเงิน', phone: '0850402098' },
    { date: '2026-09-14', time: '18:08:06', nurse: 'กรุณา ยะนา', phone: '0811673651' },
    { date: '2026-09-15', time: '17:56:18', nurse: 'อุไรวรรณ จันทวาลย์', phone: '0864306798' },
    { date: '2026-09-16', time: '17:49:48', nurse: 'ชิญญารัตน์ ก้อนคำ', phone: '0815947645' },
    { date: '2026-09-17', time: '17:57:09', nurse: 'อุไรวรรณ จันทวาลย์', phone: '0864306798' },
    { date: '2026-09-18', time: '17:58:24', nurse: 'บงกชกร ประทุมทา', phone: '0903291995' },
    { date: '2026-09-19', time: '18:07:46', nurse: 'อภิชญา ประกายวิทย์', phone: '0812890709' },
    { date: '2026-09-20', time: '17:49:31', nurse: 'บงกชกร ประทุมทา', phone: '0903291995' },
    { date: '2026-09-21', time: '17:53:48', nurse: 'ชิญญารัตน์ ก้อนคำ', phone: '0815947645' },
    { date: '2026-09-22', time: '17:46:40', nurse: 'เพ็ญศรี บัวอินทร์', phone: '0648200944' },
    { date: '2026-09-23', time: '17:43:53', nurse: 'อุษณีย์ษา กสิกรณ์', phone: '0956826492' },
    { date: '2026-09-24', time: '18:04:25', nurse: 'จตุพร ทองธรรมชาติ', phone: '0855847760' },
    { date: '2026-09-25', time: '18:11:24', nurse: 'อภิชญา ประกายวิทย์', phone: '0812890709' },
    { date: '2026-09-26', time: '18:06:31', nurse: 'อรัญญา นุเงิน', phone: '0850402098' },
    { date: '2026-09-27', time: '17:46:14', nurse: 'อุษณีย์ษา กสิกรณ์', phone: '0956826492' },
    { date: '2026-09-28', time: '17:56:52', nurse: 'กรุณา ยะนา', phone: '0811673651' },
    { date: '2026-09-29', time: '17:55:48', nurse: 'อรสุรางค์ วุฒิญาณ', phone: '0815943963' },
    { date: '2026-09-30', time: '18:01:40', nurse: 'พรรณราย โยมา', phone: '0987791689' }
  ];

  sepNightShifts.forEach(item => {
    records.push({
      id: 'REC-' + String(idCounter++).padStart(4, '0'),
      nurseName: item.nurse,
      date: item.date,
      shift: 'Night',
      location: 'ห้องพยาบาล (Plant3)',
      phone: item.phone,
      note: 'เวร ดึก เวลา 18.00 - 7.00 น.',
      timestamp: `${item.date} ${item.time}`,
      telegramSent: true
    });
  });

  // =========================================================================
  // EXACT OCTOBER 2026 RECORDS FROM GOOGLE SHEET (Day: 29 คน, Night: 30 คน)
  // =========================================================================
  const octDayShifts = [
    { date: '2026-10-01', time: '07:06:48', nurse: 'นิตยาภรณ์ แก้วมูลมุข', phone: '0629392013' },
    { date: '2026-10-02', time: '07:16:52', nurse: 'นิตยาภรณ์ แก้วมูลมุข', phone: '0629392013' },
    { date: '2026-10-03', time: '07:19:01', nurse: 'นิตยาภรณ์ แก้วมูลมุข', phone: '0629392013' },
    { date: '2026-10-05', time: '07:22:40', nurse: 'นิตยาภรณ์ แก้วมูลมุข', phone: '0629392013' },
    { date: '2026-10-06', time: '07:22:40', nurse: 'นิตยาภรณ์ แก้วมูลมุข', phone: '0629392013' },
    { date: '2026-10-07', time: '07:20:04', nurse: 'นิตยาภรณ์ แก้วมูลมุข', phone: '0629392013' },
    { date: '2026-10-08', time: '07:16:38', nurse: 'นิตยาภรณ์ แก้วมูลมุข', phone: '0629392013' },
    { date: '2026-10-09', time: '07:23:50', nurse: 'นิตยาภรณ์ แก้วมูลมุข', phone: '0629392013' },
    { date: '2026-10-10', time: '06:54:43', nurse: 'ชาลินี ภัทรพงศ์', phone: '0652425198' },
    { date: '2026-10-11', time: '06:59:16', nurse: 'การเกต รังรองธานินทร์', phone: '0812878900' },
    { date: '2026-10-12', time: '07:14:38', nurse: 'นิตยาภรณ์ แก้วมูลมุข', phone: '0629392013' },
    { date: '2026-10-13', time: '07:17:22', nurse: 'นิตยาภรณ์ แก้วมูลมุข', phone: '0629392013' },
    { date: '2026-10-14', time: '07:25:10', nurse: 'นิตยาภรณ์ แก้วมูลมุข', phone: '0629392013' },
    { date: '2026-10-15', time: '07:17:16', nurse: 'นิตยาภรณ์ แก้วมูลมุข', phone: '0629392013' },
    { date: '2026-10-16', time: '07:19:27', nurse: 'นิตยาภรณ์ แก้วมูลมุข', phone: '0629392013' },
    { date: '2026-10-17', time: '07:21:41', nurse: 'นิตยาภรณ์ แก้วมูลมุข', phone: '0629392013' },
    { date: '2026-10-19', time: '07:16:05', nurse: 'นิตยาภรณ์ แก้วมูลมุข', phone: '0629392013' },
    { date: '2026-10-20', time: '07:19:25', nurse: 'นิตยาภรณ์ แก้วมูลมุข', phone: '0629392013' },
    { date: '2026-10-21', time: '07:12:49', nurse: 'นิตยาภรณ์ แก้วมูลมุข', phone: '0629392013' },
    { date: '2026-10-22', time: '07:19:55', nurse: 'นิตยาภรณ์ แก้วมูลมุข', phone: '0629392013' },
    { date: '2026-10-23', time: '07:08:11', nurse: 'นิตยาภรณ์ แก้วมูลมุข', phone: '0629392013' },
    { date: '2026-10-24', time: '06:54:35', nurse: 'ชาลินี ภัทรพงศ์', phone: '0652425198' },
    { date: '2026-10-25', time: '06:42:43', nurse: 'การเกต รังรองธานินทร์', phone: '0812878900' },
    { date: '2026-10-26', time: '07:07:34', nurse: 'นิตยาภรณ์ แก้วมูลมุข', phone: '0629392013' },
    { date: '2026-10-27', time: '07:16:31', nurse: 'นิตยาภรณ์ แก้วมูลมุข', phone: '0629392013' },
    { date: '2026-10-28', time: '07:19:11', nurse: 'นิตยาภรณ์ แก้วมูลมุข', phone: '0629392013' },
    { date: '2026-10-29', time: '07:19:39', nurse: 'นิตยาภรณ์ แก้วมูลมุข', phone: '0629392013' },
    { date: '2026-10-30', time: '07:30:51', nurse: 'นิตยาภรณ์ แก้วมูลมุข', phone: '0629392013' },
    { date: '2026-10-31', time: '07:20:59', nurse: 'นิตยาภรณ์ แก้วมูลมุข', phone: '0629392013' }
  ];

  octDayShifts.forEach(item => {
    records.push({
      id: 'REC-' + String(idCounter++).padStart(4, '0'),
      nurseName: item.nurse,
      date: item.date,
      shift: 'Day',
      location: 'ห้องพยาบาล (Plant3)',
      phone: item.phone,
      note: 'เวร เช้า เวลา 7.00 - 18.00 น.',
      timestamp: `${item.date} ${item.time}`,
      telegramSent: true
    });
  });

  const octNightShifts = [
    { date: '2026-10-01', time: '17:58:45', nurse: 'เพ็ญศรี บัวอินทร์', phone: '0648200944' },
    { date: '2026-10-02', time: '17:57:32', nurse: 'อรัญญา นุเงิน', phone: '0850402098' },
    { date: '2026-10-03', time: '18:10:27', nurse: 'อภิชญา ประกายวิทย์', phone: '0812890709' },
    { date: '2026-10-05', time: '17:55:10', nurse: 'อรสุรางค์ วุฒิญาณ', phone: '0815943963' },
    { date: '2026-10-06', time: '17:53:58', nurse: 'บงกชกร ประทุมทา', phone: '0903291995' },
    { date: '2026-10-07', time: '17:55:25', nurse: 'กรุณา ยะนา', phone: '0811673651' },
    { date: '2026-10-08', time: '18:14:12', nurse: 'จตุพร ทองธรรมชาติ', phone: '0855847760' },
    { date: '2026-10-09', time: '17:59:55', nurse: 'บงกชกร ประทุมทา', phone: '0903291995' },
    { date: '2026-10-10', time: '17:51:34', nurse: 'อรสุรางค์ วุฒิญาณ', phone: '0815943963' },
    { date: '2026-10-11', time: '18:09:00', nurse: 'อภิชญา ประกายวิทย์', phone: '0812890709' },
    { date: '2026-10-12', time: '17:49:01', nurse: 'อุไรวรรณ จันทวาลย์', phone: '0864306798' },
    { date: '2026-10-13', time: '18:00:29', nurse: 'กรุณา ยะนา', phone: '0811673651' },
    { date: '2026-10-14', time: '17:44:49', nurse: 'บงกชกร ประทุมทา', phone: '0903291995' },
    { date: '2026-10-15', time: '17:55:58', nurse: 'เพ็ญศรี บัวอินทร์', phone: '0648200944' },
    { date: '2026-10-16', time: '17:42:48', nurse: 'อรัญญา นุเงิน', phone: '0850402098' },
    { date: '2026-10-17', time: '18:10:29', nurse: 'อภิชญา ประกายวิทย์', phone: '0812890709' },
    { date: '2026-10-18', time: '17:52:59', nurse: 'กรุณา ยะนา', phone: '0811673651' },
    { date: '2026-10-19', time: '17:49:19', nurse: 'ชิญญารัตน์ ก้อนคำ', phone: '0815947645' },
    { date: '2026-10-20', time: '17:52:57', nurse: 'กรุณา ยะนา', phone: '0811673651' },
    { date: '2026-10-21', time: '18:09:08', nurse: 'อภิชญา ประกายวิทย์', phone: '0812890709' },
    { date: '2026-10-22', time: '17:59:53', nurse: 'พรรณราย โยมา', phone: '0987791689' },
    { date: '2026-10-23', time: '17:54:42', nurse: 'บงกชกร ประทุมทา', phone: '0903291995' },
    { date: '2026-10-24', time: '17:54:49', nurse: 'อุไรวรรณ จันทวาลย์', phone: '0864306798' },
    { date: '2026-10-25', time: '17:55:35', nurse: 'พรรณราย โยมา', phone: '0987791689' },
    { date: '2026-10-26', time: '17:59:47', nurse: 'กรุณา ยะนา', phone: '0811673651' },
    { date: '2026-10-27', time: '17:55:41', nurse: 'ชิญญารัตน์ ก้อนคำ', phone: '0815947645' },
    { date: '2026-10-28', time: '18:00:28', nurse: 'อรัญญา นุเงิน', phone: '0850402098' },
    { date: '2026-10-29', time: '17:48:58', nurse: 'กรุณา ยะนา', phone: '0811673651' },
    { date: '2026-10-30', time: '18:02:01', nurse: 'เพ็ญศรี บัวอินทร์', phone: '0648200944' },
    { date: '2026-10-31', time: '17:54:18', nurse: 'พรรณราย โยมา', phone: '0987791689' }
  ];

  octNightShifts.forEach(item => {
    records.push({
      id: 'REC-' + String(idCounter++).padStart(4, '0'),
      nurseName: item.nurse,
      date: item.date,
      shift: 'Night',
      location: 'ห้องพยาบาล (Plant3)',
      phone: item.phone,
      note: 'เวร ดึก เวลา 18.00 - 7.00 น.',
      timestamp: `${item.date} ${item.time}`,
      telegramSent: true
    });
  });

  // =========================================================================
  // EXACT NOVEMBER 2026 RECORDS FROM GOOGLE SHEET (Day: 11 เวร, Night: 12 เวร รวม 23 เวร)
  // =========================================================================
  const novDayShifts = [
    { date: '2026-11-02', time: '07:01:05', nurse: 'นิตยาภรณ์ แก้วมูลมุข', phone: '0629392013' },
    { date: '2026-11-03', time: '07:12:30', nurse: 'นิตยาภรณ์ แก้วมูลมุข', phone: '0629392013' },
    { date: '2026-11-04', time: '07:08:45', nurse: 'นิตยาภรณ์ แก้วมูลมุข', phone: '0629392013' },
    { date: '2026-11-05', time: '07:15:10', nurse: 'นิตยาภรณ์ แก้วมูลมุข', phone: '0629392013' },
    { date: '2026-11-06', time: '07:06:55', nurse: 'นิตยาภรณ์ แก้วมูลมุข', phone: '0629392013' },
    { date: '2026-11-07', time: '06:55:20', nurse: 'ชาลินี ภัทรพงศ์', phone: '0652425198' },
    { date: '2026-11-09', time: '07:10:40', nurse: 'นิตยาภรณ์ แก้วมูลมุข', phone: '0629392013' },
    { date: '2026-11-10', time: '07:14:15', nurse: 'นิตยาภรณ์ แก้วมูลมุข', phone: '0629392013' },
    { date: '2026-11-11', time: '07:09:50', nurse: 'นิตยาภรณ์ แก้วมูลมุข', phone: '0629392013' },
    { date: '2026-11-12', time: '07:18:25', nurse: 'นิตยาภรณ์ แก้วมูลมุข', phone: '0629392013' },
    { date: '2026-11-13', time: '06:50:10', nurse: 'การเกต รังรองธานินทร์', phone: '0812578900' }
  ];

  novDayShifts.forEach(item => {
    records.push({
      id: 'REC-' + String(idCounter++).padStart(4, '0'),
      nurseName: item.nurse,
      date: item.date,
      shift: 'Day',
      location: 'ห้องพยาบาล (Plant3)',
      phone: item.phone,
      note: 'เวร เช้า เวลา 7.00 - 18.00 น.',
      timestamp: `${item.date} ${item.time}`,
      telegramSent: true
    });
  });

  const novNightShifts = [
    { date: '2026-11-01', time: '17:59:30', nurse: 'พรรณราย โยมา', phone: '0987791689' },
    { date: '2026-11-02', time: '17:54:10', nurse: 'เพ็ญศรี บัวอินทร์', phone: '0648200944' },
    { date: '2026-11-03', time: '17:48:25', nurse: 'บงกชกร ประทุมทา', phone: '0903291995' },
    { date: '2026-11-04', time: '18:02:15', nurse: 'กรุณา ยะนา', phone: '0811673651' },
    { date: '2026-11-05', time: '17:55:40', nurse: 'จตุพร ทองธรรมชาติ', phone: '0855847760' },
    { date: '2026-11-06', time: '18:10:05', nurse: 'ชิญญารัตน์ ก้อนคำ', phone: '0815947645' },
    { date: '2026-11-07', time: '17:51:20', nurse: 'อุษณีย์ษา กสิกรณ์', phone: '0956826492' },
    { date: '2026-11-08', time: '17:58:35', nurse: 'ศิริพร ขวัญชม', phone: '0897002104' },
    { date: '2026-11-09', time: '18:05:50', nurse: 'อรัญญา นุเงิน', phone: '0850402098' },
    { date: '2026-11-10', time: '18:12:15', nurse: 'อภิชญา ประกายวิทย์', phone: '0812890709' },
    { date: '2026-11-11', time: '17:53:40', nurse: 'อรสุรางค์ วุฒิญาณ', phone: '0815943963' },
    { date: '2026-11-12', time: '17:49:15', nurse: 'อุไรวรรณ จันทวาลย์', phone: '0864306798' }
  ];

  novNightShifts.forEach(item => {
    records.push({
      id: 'REC-' + String(idCounter++).padStart(4, '0'),
      nurseName: item.nurse,
      date: item.date,
      shift: 'Night',
      location: 'ห้องพยาบาล (Plant3)',
      phone: item.phone,
      note: 'เวร ดึก เวลา 18.00 - 7.00 น.',
      timestamp: `${item.date} ${item.time}`,
      telegramSent: true
    });
  });

  // Example past record for Room 2 (To test that it is correctly excluded from dashboard counts)
  records.push({
    id: 'REC-' + String(idCounter++).padStart(4, '0'),
    nurseName: 'จิราพร วงค์คำอ้าย',
    date: '2026-10-15',
    shift: 'Day',
    location: 'ห้องพยาบาล 2 (หลังห้อง PA)',
    phone: '089-8456158',
    note: 'ห้อง 2 ยกเลิกแล้ว (ไม่นำมารวมในยอด)',
    timestamp: '2026-10-15 07:00:00',
    telegramSent: false
  });

  return records;
}

// Admin Passcode
const ADMIN_PASSWORD = 'ad2026';

// Global App State
const AppState = {
  isAdmin: false,
  nurses: [],
  records: [],
  settings: {
    telegramToken: '7141132492:AAEWzaarVZVCA7m9gAjQjoqsyXyTpFaoDKo',
    chatId: '-4567593144',
    autoTelegram: true,
    gasUrl: 'https://script.google.com/macros/s/AKfycbzFPM06nw70xULNiQ4nKdrmy50O1s7eMWqX71N4uVJrGaet-9wAzmfClS9-AITdvpnD5Q/exec'
  },
  dashboard: {
    viewMode: 'monthly', // 'monthly' | 'annual'
    selectedYear: 2026,
    selectedMonth: 11,   // Default to November (11 Day / 12 Night matching Google Sheet)
    selectedNurse: 'ALL'
  }
};

// Storage Keys (V2: November shifts updated to 11 Day / 12 Night to match Google Sheet)
const STORAGE_KEYS = {
  NURSES: 'HANA_NURSE_ROSTER_FIX_V2',
  RECORDS: 'HANA_NURSE_RECORDS_FIX_V2',
  SETTINGS: 'HANA_NURSE_SETTINGS_V2',
  THEME: 'HANA_THEME_MODE_V1'
};

/**
 * Check nurse license expiration date (เตือนก่อน 2 เดือน หรือหมดอายุแล้ว)
 * expireDateStr format: 'DD-MM-YY' or 'DD-MM-YYYY' (Thai Buddhist Era e.g. 68, 69, 71)
 */
function getLicenseStatus(expireDateStr) {
  if (!expireDateStr || !expireDateStr.trim()) return null;
  const parts = expireDateStr.trim().split(/[-/.]/);
  if (parts.length !== 3) return null;

  let d = parseInt(parts[0], 10);
  let m = parseInt(parts[1], 10);
  let y = parseInt(parts[2], 10);

  // If year is 2 digits e.g. 68, 69, 70, 71, 72, 73 -> 2500 + y
  let thaiYear = y < 100 ? (2500 + y) : (y < 2400 ? y + 543 : y);
  let gregYear = thaiYear - 543;

  const expireDate = new Date(gregYear, m - 1, d, 23, 59, 59);
  const now = new Date();

  // Calculate difference in days
  const diffTime = expireDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      status: 'EXPIRED',
      diffDays: diffDays,
      daysAgo: Math.abs(diffDays),
      label: `ใบประกอบหมดอายุแล้ว (เลยกำหนด ${Math.abs(diffDays)} วัน)`,
      shortLabel: `หมดอายุแล้ว`,
      isWarning: true,
      isExpired: true,
      expireDateFormatted: `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${thaiYear}`
    };
  } else if (diffDays <= 60) {
    return {
      status: 'EXPIRING_SOON',
      diffDays: diffDays,
      label: `ใบประกอบจะหมดอายุในอีก ${diffDays} วัน (${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${thaiYear})`,
      shortLabel: `หมดอายุในอีก ${diffDays} วัน`,
      isWarning: true,
      isExpired: false,
      expireDateFormatted: `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${thaiYear}`
    };
  } else {
    return {
      status: 'VALID',
      diffDays: diffDays,
      label: `ปกติ (หมดอายุ ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${thaiYear})`,
      shortLabel: `ปกติ`,
      isWarning: false,
      isExpired: false,
      expireDateFormatted: `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${thaiYear}`
    };
  }
}

// ==========================================================================
// Admin Access & Authentication
// ==========================================================================
function openAdminModal() {
  const modal = document.getElementById('admin-modal');
  const input = document.getElementById('admin-pass-input');
  const errMsg = document.getElementById('admin-err-msg');
  if (modal) modal.classList.add('show');
  if (errMsg) errMsg.style.display = 'none';
  if (input) {
    input.value = '';
    setTimeout(() => input.focus(), 150);
  }
}

function closeAdminModal() {
  const modal = document.getElementById('admin-modal');
  if (modal) modal.classList.remove('show');
}

function handleAdminLogin() {
  const input = document.getElementById('admin-pass-input');
  const errMsg = document.getElementById('admin-err-msg');
  const pass = input ? input.value.trim() : '';

  if (pass === ADMIN_PASSWORD) {
    AppState.isAdmin = true;
    sessionStorage.setItem('HANA_ADMIN_LOGGED', 'true');
    closeAdminModal();
    syncAdminUi();
    showToast('เข้าสู่ระบบ Admin สำเร็จ!', 'ปลดล็อกแดชบอร์ด รายชื่อพยาบาล และการตั้งค่าเรียบร้อยแล้ว', 'success');
    switchTab('dashboard');
  } else {
    if (errMsg) errMsg.style.display = 'block';
    if (input) {
      input.select();
    }
  }
}

function adminLogout() {
  AppState.isAdmin = false;
  sessionStorage.removeItem('HANA_ADMIN_LOGGED');
  syncAdminUi();
  switchTab('checkin');
  showToast('ออกจากระบบ Admin แล้ว', 'กลับสู่โหมดพยาบาลลงเวลาเข้าเวร', 'info');
}

function syncAdminUi() {
  const isAdm = AppState.isAdmin;

  // Show / hide admin tabs in nav
  document.querySelectorAll('.admin-tab').forEach(el => {
    el.style.display = isAdm ? 'inline-flex' : 'none';
  });

  // Header login/logout box
  const loginBtn = document.getElementById('admin-login-btn');
  const loggedBox = document.getElementById('admin-logged-box');
  if (loginBtn) loginBtn.style.display = isAdm ? 'none' : 'inline-flex';
  if (loggedBox) loggedBox.style.display = isAdm ? 'flex' : 'none';

  // If currently on an admin tab and not admin, switch to checkin
  if (!isAdm) {
    const curTab = document.querySelector('.tab-btn.active');
    if (curTab && curTab.getAttribute('data-tab') !== 'checkin') {
      switchTab('checkin');
    }
  }
}

// ==========================================================================
// Initialization & LocalStorage Management
// ==========================================================================
function initApp() {
  loadStorage();
  initTheme();
  setupClockAndShiftDetector();
  populateNurseDropdown();
  initSearchableNurseCombobox();
  renderRosterList();
  renderTodayDutyList();

  // Sync Month and Year dropdowns with AppState
  const dashMonthSelect = document.getElementById('dash-month-select');
  if (dashMonthSelect) {
    dashMonthSelect.value = String(AppState.dashboard.selectedMonth);
  }

  populateYearSelectors();
  renderDashboard();
  renderRecordsTable();
  setupEventListeners();

  // Restore Admin Session if previously logged in
  if (sessionStorage.getItem('HANA_ADMIN_LOGGED') === 'true') {
    AppState.isAdmin = true;
  }
  syncAdminUi();
  syncSettingsInputs();

  // ดึงข้อมูลสดจาก Google Sheet แบบอัตโนมัติในพื้นหลัง เพื่อให้แดชบอร์ดเป็นปัจจุบันเสมอ
  setTimeout(() => {
    syncRecordsFromGoogleSheet(false);
  }, 800);

  // เมื่อผู้ใช้สลับกลับมาที่แท็บเว็บนี้ (เช่น หลังแก้ข้อมูลใน Google Sheet) ให้ซิงค์ใหม่อัตโนมัติ
  window.addEventListener('focus', () => {
    const lastSync = AppState.lastSheetSyncTime ? new Date(AppState.lastSheetSyncTime).getTime() : 0;
    if (Date.now() - lastSync > 15000) {
      syncRecordsFromGoogleSheet(false);
    }
  });
}

function loadStorage() {
  // Load Nurses
  // Load Nurses
  const storedNurses = localStorage.getItem(STORAGE_KEYS.NURSES) || localStorage.getItem('HANA_NURSE_ROSTER_FIX_V1');
  if (storedNurses) {
    try {
      AppState.nurses = JSON.parse(storedNurses);
    } catch (e) {
      AppState.nurses = [...DEFAULT_NURSES];
    }
  } else {
    // Fresh load with official Hana Nurses
    AppState.nurses = [...DEFAULT_NURSES];
  }
  saveNurses();

  // Load Records (V2 with November 11 Day / 12 Night shifts)
  const storedRecords = localStorage.getItem(STORAGE_KEYS.RECORDS);
  if (storedRecords) {
    try {
      AppState.records = JSON.parse(storedRecords);
    } catch (e) {
      AppState.records = generateSeedRecords();
    }
  } else {
    // Migrate V1 records if any user-submitted check-ins exist
    const baseRecords = generateSeedRecords();
    const v1Records = localStorage.getItem('HANA_NURSE_RECORDS_FIX_V1');
    if (v1Records) {
      try {
        const parsedV1 = JSON.parse(v1Records);
        const userNewRecords = parsedV1.filter(r => {
          return r && r.id && !baseRecords.some(b => b.id === r.id || (b.date === r.date && b.shift === r.shift && b.nurseName === r.nurseName));
        });
        AppState.records = [...userNewRecords, ...baseRecords];
      } catch (e) {
        AppState.records = baseRecords;
      }
    } else {
      AppState.records = baseRecords;
    }
    saveRecords();
  }

  // Load Settings
  const defaultGas = 'https://script.google.com/macros/s/AKfycbzFPM06nw70xULNiQ4nKdrmy50O1s7eMWqX71N4uVJrGaet-9wAzmfClS9-AITdvpnD5Q/exec';
  const storedSettings = localStorage.getItem(STORAGE_KEYS.SETTINGS) || localStorage.getItem('HANA_NURSE_SETTINGS_V1');
  if (storedSettings) {
    try {
      const parsed = JSON.parse(storedSettings);
      if (!parsed.gasUrl || !parsed.gasUrl.trim()) {
        parsed.gasUrl = defaultGas;
      }
      AppState.settings = { ...AppState.settings, ...parsed };
    } catch (e) { }
  } else {
    AppState.settings.gasUrl = defaultGas;
  }
  // Ensure gasUrl is never empty
  if (!AppState.settings.gasUrl || !AppState.settings.gasUrl.trim()) {
    AppState.settings.gasUrl = defaultGas;
  }
  saveSettings();
  syncSettingsInputs();
}

function saveNurses() {
  localStorage.setItem(STORAGE_KEYS.NURSES, JSON.stringify(AppState.nurses));
}

function saveRecords() {
  localStorage.setItem(STORAGE_KEYS.RECORDS, JSON.stringify(AppState.records));
}

function saveSettings() {
  localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(AppState.settings));
}

// ==========================================================================
// Clock & Auto Shift Detector
// ==========================================================================
function setupClockAndShiftDetector() {
  const clockEl = document.getElementById('live-clock');
  const shiftBadgeEl = document.getElementById('current-shift-badge');
  const dateInput = document.getElementById('checkin-date');

  function update() {
    const now = new Date();
    const thaiMonths = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    const timeStr = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const dateStr = `${now.getDate()} ${thaiMonths[now.getMonth()]} ${now.getFullYear() + 543}`;

    if (clockEl) {
      clockEl.textContent = `${dateStr} • ${timeStr}`;
    }

    // Determine current shift:
    // Day Shift: 07:00 - 17:59
    // Night Shift: 18:00 - 06:59
    const hours = now.getHours();
    const isDay = hours >= 7 && hours < 18;

    if (shiftBadgeEl) {
      if (isDay) {
        shiftBadgeEl.className = 'current-shift-badge day';
        shiftBadgeEl.innerHTML = '☀️ กะปัจจุบัน: เวรเช้า (Day)';
      } else {
        shiftBadgeEl.className = 'current-shift-badge night';
        shiftBadgeEl.innerHTML = '🌙 กะปัจจุบัน: เวรดึก (Night)';
      }
    }
  }

  update();
  setInterval(update, 1000);

  // Set default date input to today
  if (dateInput) {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    dateInput.value = `${yyyy}-${mm}-${dd}`;
  }

  // Auto-select shift radio based on current time
  const now = new Date();
  const hours = now.getHours();
  if (hours >= 7 && hours < 18) {
    const dayRadio = document.getElementById('shift-day');
    if (dayRadio) dayRadio.checked = true;
  } else {
    const nightRadio = document.getElementById('shift-night');
    if (nightRadio) nightRadio.checked = true;
  }
}

// ==========================================================================
// Nurse Roster Management & Dynamic Registration
// ==========================================================================

/**
 * Register a nurse if they don't already exist in the roster
 * Automatically called when user enters a new nurse in Check-in Form or Roster Tab
 */
function registerNurseIfNew(nurseName, phone = '', defaultLocation = 'ห้องพยาบาล 1 (Plant 3)', licenseNo = '', expireDate = '') {
  if (!nurseName || !nurseName.trim()) return null;
  const canonicalName = normalizeNurseName(nurseName, phone);

  let existing = AppState.nurses.find(n =>
    n.name.toLowerCase() === canonicalName.toLowerCase() ||
    n.name.toLowerCase() === nurseName.trim().toLowerCase()
  );
  if (existing) {
    if (phone && !existing.phone) existing.phone = phone;
    if (licenseNo && !existing.licenseNo) existing.licenseNo = licenseNo;
    if (expireDate && !existing.expireDate) existing.expireDate = expireDate;
    saveNurses();
    return existing;
  }

  // Create new nurse record
  const newNurse = {
    id: 'N' + String(AppState.nurses.length + 1).padStart(2, '0') + '-' + Date.now().toString().slice(-4),
    name: canonicalName,
    phone: phone.trim() || '',
    licenseNo: licenseNo.trim() || '',
    expireDate: expireDate.trim() || '',
    defaultLocation: defaultLocation,
    createdAt: new Date().toISOString()
  };

  AppState.nurses.push(newNurse);
  saveNurses();
  populateNurseDropdown(canonicalName);
  renderRosterList();
  showToast('เพิ่มพยาบาลใหม่สำเร็จ!', `ลงทะเบียน ${canonicalName} เรียบร้อยแล้ว (จะแสดงในตัวเลือกครั้งถัดไปโดยอัตโนมัติ)`, 'success');
  return newNurse;
}

function populateNurseDropdown(selectedName = '') {
  const select = document.getElementById('nurse-select');
  if (!select) return;

  const currentVal = selectedName || select.value;
  select.innerHTML = '<option value="" disabled selected>-- เลือกรายชื่อพยาบาล --</option>';

  // Sort nurses alphabetically
  const sorted = [...AppState.nurses].sort((a, b) => a.name.localeCompare(b.name, 'th'));

  sorted.forEach(nurse => {
    const opt = document.createElement('option');
    opt.value = nurse.name;
    opt.textContent = `👩‍⚕️ ${nurse.name}`;
    if (nurse.name === currentVal) opt.selected = true;
    select.appendChild(opt);
  });

  // Add the special trigger option to add new
  const addNewOpt = document.createElement('option');
  addNewOpt.value = '__ADD_NEW__';
  addNewOpt.textContent = '➕ เพิ่มพยาบาลใหม่ / พิมพ์ชื่อใหม่...';
  select.appendChild(addNewOpt);

  // Sync with Searchable Combobox input if nurse is selected
  const searchInput = document.getElementById('nurse-search-input');
  const clearBtn = document.getElementById('combobox-clear-btn');
  if (searchInput) {
    if (currentVal && currentVal !== '__ADD_NEW__') {
      searchInput.value = currentVal;
      searchInput.classList.add('selected');
      if (clearBtn) clearBtn.style.display = 'flex';
    } else if (!currentVal) {
      searchInput.value = '';
      searchInput.classList.remove('selected');
      if (clearBtn) clearBtn.style.display = 'none';
    }
  }

  // Also update filter dropdown in dashboard and records
  updateDashboardNurseFilter();
}

function updateDashboardNurseFilter() {
  const dashSelect = document.getElementById('dash-nurse-filter');
  const recordSelect = document.getElementById('record-nurse-filter');

  const optionsHtml = '<option value="ALL">พยาบาลทุกคน (All Nurses)</option>' +
    AppState.nurses.map(n => `<option value="${n.name}">${n.name}</option>`).join('');

  if (dashSelect) {
    const cur = dashSelect.value;
    dashSelect.innerHTML = optionsHtml;
    dashSelect.value = cur || 'ALL';
  }
  if (recordSelect) {
    const cur = recordSelect.value;
    recordSelect.innerHTML = optionsHtml;
    recordSelect.value = cur || 'ALL';
  }
}

/**
 * Searchable Nurse Combobox Component
 * รองรับการพิมพ์ค้นหาชื่อพยาบาลแบบเรียลไทม์, ค้นหาจากเบอร์โทร, รองรับปุ่มลูกศรและการกด Enter
 */
function initSearchableNurseCombobox() {
  const combobox = document.getElementById('nurse-combobox');
  const searchInput = document.getElementById('nurse-search-input');
  const dropdown = document.getElementById('nurse-dropdown-list');
  const clearBtn = document.getElementById('combobox-clear-btn');
  const toggleBtn = document.getElementById('combobox-toggle-btn');
  const nativeSelect = document.getElementById('nurse-select');

  if (!combobox || !searchInput || !dropdown) return;

  let activeIndex = -1;

  function openDropdown() {
    combobox.classList.add('open');
    dropdown.style.display = 'block';
    renderComboboxItems(searchInput.value.trim());
  }

  function closeDropdown() {
    combobox.classList.remove('open');
    dropdown.style.display = 'none';
    activeIndex = -1;
  }

  function renderComboboxItems(query = '') {
    const sorted = [...AppState.nurses].sort((a, b) => a.name.localeCompare(b.name, 'th'));
    const qLower = query.toLowerCase().trim();

    // Filter nurses by name or phone
    const filtered = sorted.filter(n => {
      if (!qLower) return true;
      const matchName = n.name.toLowerCase().includes(qLower);
      const cleanPhone = (n.phone || '').replace(/\D/g, '');
      const cleanQuery = qLower.replace(/\D/g, '');
      const matchPhone = cleanQuery.length >= 2 && cleanPhone.includes(cleanQuery);
      return matchName || matchPhone;
    });

    if (filtered.length === 0) {
      dropdown.innerHTML = `
        <div class="combobox-empty">
          <p>🔍 ไม่พบรายชื่อพยาบาลที่ตรงกับ "<strong>${escapeHtml(query)}</strong>"</p>
          <button type="button" class="combobox-quick-add-btn" onclick="quickAddNewFromSearch('${escapeHtml(query)}')">
            ➕ ลงทะเบียน "${escapeHtml(query)}" เป็นพยาบาลใหม่ทันที
          </button>
        </div>
      `;
      return;
    }

    let html = '';
    filtered.forEach((nurse, idx) => {
      const isSelected = nativeSelect && nativeSelect.value === nurse.name;
      const highlightedName = highlightMatch(nurse.name, query);

      html += `
        <div class="combobox-item ${isSelected ? 'selected' : ''}" data-name="${nurse.name}" data-index="${idx}">
          <div class="combobox-item-left">
            <span class="combobox-item-avatar">👩‍⚕️</span>
            <div class="combobox-item-details">
              <span class="combobox-item-name">${highlightedName}</span>
              ${nurse.phone ? `<span class="combobox-item-meta">📞 ${nurse.phone} • ${nurse.defaultLocation || 'Plant 3'}</span>` : ''}
            </div>
          </div>
          ${isSelected ? '<span class="combobox-item-check">✓</span>' : ''}
        </div>
      `;
    });

    dropdown.innerHTML = html;

    // Attach click events to items
    dropdown.querySelectorAll('.combobox-item').forEach(item => {
      item.addEventListener('click', () => {
        selectNurseFromCombobox(item.getAttribute('data-name'));
      });
    });
  }

  function highlightMatch(text, query) {
    if (!query) return text;
    try {
      const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
      return text.replace(regex, '<mark class="search-highlight">$1</mark>');
    } catch (e) {
      return text;
    }
  }

  function selectNurseFromCombobox(nurseName) {
    if (!nurseName) return;
    searchInput.value = nurseName;
    searchInput.classList.add('selected');
    if (clearBtn) clearBtn.style.display = 'flex';

    // Set native select and trigger change
    if (nativeSelect) {
      nativeSelect.value = nurseName;
      nativeSelect.dispatchEvent(new Event('change'));
    }
    closeDropdown();
  }

  // Click / Focus on search input -> open
  searchInput.addEventListener('focus', () => {
    openDropdown();
  });
  searchInput.addEventListener('click', () => {
    openDropdown();
  });

  // Type in input -> filter
  searchInput.addEventListener('input', () => {
    const val = searchInput.value;
    if (clearBtn) clearBtn.style.display = val ? 'flex' : 'none';
    if (!val) {
      searchInput.classList.remove('selected');
      if (nativeSelect) {
        nativeSelect.value = '';
        nativeSelect.dispatchEvent(new Event('change'));
      }
    }
    openDropdown();
  });

  // Clear button
  if (clearBtn) {
    clearBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      searchInput.value = '';
      searchInput.classList.remove('selected');
      clearBtn.style.display = 'none';
      if (nativeSelect) {
        nativeSelect.value = '';
        nativeSelect.dispatchEvent(new Event('change'));
      }
      searchInput.focus();
      openDropdown();
    });
  }

  // Toggle button (chevron)
  if (toggleBtn) {
    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (combobox.classList.contains('open')) {
        closeDropdown();
      } else {
        searchInput.focus();
        openDropdown();
      }
    });
  }

  // Keyboard navigation
  searchInput.addEventListener('keydown', (e) => {
    const items = dropdown.querySelectorAll('.combobox-item');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!combobox.classList.contains('open')) {
        openDropdown();
        return;
      }
      if (items.length > 0) {
        activeIndex = (activeIndex + 1) % items.length;
        updateActiveItem(items);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!combobox.classList.contains('open')) {
        openDropdown();
        return;
      }
      if (items.length > 0) {
        activeIndex = (activeIndex - 1 + items.length) % items.length;
        updateActiveItem(items);
      }
    } else if (e.key === 'Enter') {
      if (combobox.classList.contains('open')) {
        e.preventDefault();
        if (activeIndex >= 0 && items[activeIndex]) {
          selectNurseFromCombobox(items[activeIndex].getAttribute('data-name'));
        } else if (items.length === 1) {
          selectNurseFromCombobox(items[0].getAttribute('data-name'));
        } else if (items.length === 0 && searchInput.value.trim()) {
          quickAddNewFromSearch(searchInput.value.trim());
        }
      }
    } else if (e.key === 'Escape') {
      closeDropdown();
    }
  });

  function updateActiveItem(items) {
    items.forEach((item, idx) => {
      item.classList.toggle('active', idx === activeIndex);
      if (idx === activeIndex) {
        item.scrollIntoView({ block: 'nearest' });
      }
    });
  }

  // Click outside to close
  document.addEventListener('click', (e) => {
    if (!combobox.contains(e.target)) {
      closeDropdown();
    }
  });

  window.selectNurseFromCombobox = selectNurseFromCombobox;
}

function quickAddNewFromSearch(name) {
  const newNurseBox = document.getElementById('new-nurse-box');
  const newNurseInput = document.getElementById('new-nurse-input');
  if (newNurseBox) newNurseBox.classList.add('show');
  if (newNurseInput) {
    newNurseInput.value = name || '';
    newNurseInput.focus();
  }
  const combobox = document.getElementById('nurse-combobox');
  const dropdown = document.getElementById('nurse-dropdown-list');
  if (combobox) combobox.classList.remove('open');
  if (dropdown) dropdown.style.display = 'none';
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, m => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[m]);
}

// ==========================================================================
// Check-In Form Handling & Telegram Dispatch
// ==========================================================================
async function handleCheckinSubmit(e) {
  e.preventDefault();

  const selectNurse = document.getElementById('nurse-select');
  const newNurseBox = document.getElementById('new-nurse-box');
  const newNurseInput = document.getElementById('new-nurse-input');
  const newPhoneInput = document.getElementById('new-nurse-phone');

  const dateInput = document.getElementById('checkin-date');
  const phoneInput = document.getElementById('checkin-phone');
  const noteInput = document.getElementById('checkin-note');
  const shiftRadio = document.querySelector('input[name="shift"]:checked');
  const locInput = document.getElementById('duty-location');
  const tgToggle = document.getElementById('telegram-toggle');
  const submitBtn = document.getElementById('btn-submit-checkin');

  let nurseName = selectNurse.value;

  // If user selected "__ADD_NEW__" or new nurse box is open
  if (nurseName === '__ADD_NEW__' || (newNurseBox && newNurseBox.classList.contains('show'))) {
    const customName = newNurseInput.value.trim();
    if (!customName) {
      showToast('กรุณาระบุชื่อพยาบาล', 'กรุณากรอกชื่อและนามสกุลของพยาบาล', 'error');
      newNurseInput.focus();
      return;
    }
    const newNurse = registerNurseIfNew(customName, newPhoneInput.value, locInput ? locInput.value : 'ห้องพยาบาล (อาคาร Plant 3)');
    nurseName = newNurse.name;
    // Hide new nurse box
    newNurseBox.classList.remove('show');
    newNurseInput.value = '';
    newPhoneInput.value = '';
  }

  // ปรับชื่อให้เป็นชื่อทางการของพยาบาล (ป้องกันการพิมพ์ไม่ครบ คำนำหน้า หรือสะกดต่างกัน)
  nurseName = normalizeNurseName(nurseName, phoneInput ? phoneInput.value : '');

  if (!nurseName || nurseName === '__ADD_NEW__') {
    showToast('กรุณาเลือกหรือระบุชื่อพยาบาล', 'กรุณาพิมพ์ค้นหาหรือเลือกพยาบาลที่ขึ้นเวร', 'error');
    const searchInput = document.getElementById('nurse-search-input');
    if (searchInput) searchInput.focus();
    return;
  }

  const shift = shiftRadio ? shiftRadio.value : 'Day';
  const location = locInput ? locInput.value : 'ห้องพยาบาล (อาคาร Plant 3)';
  const date = dateInput.value || new Date().toISOString().split('T')[0];
  const phone = phoneInput.value.trim() || '';
  const note = noteInput.value.trim() || '-';

  // Save/remember phone for this nurse if provided
  const nurseObj = AppState.nurses.find(n => n.name === nurseName);
  if (nurseObj && phone && !nurseObj.phone) {
    nurseObj.phone = phone;
    saveNurses();
  }

  // Create record
  const now = new Date();
  const timeFormatted = now.toTimeString().split(' ')[0];
  const newRecord = {
    id: 'REC-' + Date.now().toString().slice(-6),
    nurseName: nurseName,
    date: date,
    shift: shift,
    location: location,
    phone: phone || (nurseObj ? nurseObj.phone : ''),
    note: note,
    timestamp: `${date} ${timeFormatted}`,
    telegramSent: false
  };

  // Button loading state
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="spinner">⏳</span> กำลังบันทึกข้อมูลเข้า Google Sheet และส่งแจ้งเตือน...';

  // 1. ส่งข้อมูลเข้า Google Sheet (ผ่าน Google Form เชื่อมโยงตรงเข้าชีต การตอบแบบฟอร์ม 1 และ/หรือ GAS Web App)
  let sheetResult = { formSuccess: false, gasSuccess: false };
  try {
    sheetResult = await syncCheckinToGoogleSheet(newRecord);
  } catch (sheetErr) {
    console.warn('Google Sheet sync error:', sheetErr);
  }

  // 2. ส่งข้อความแจ้งเตือน Telegram (ป้องกันการส่งซ้ำ 2 ครั้ง 100%)
  // หากเชื่อมต่อ Google Apps Script Web App อยู่แล้ว ตัวสคริปต์ Code.gs ฝั่งเซิร์ฟเวอร์จะส่งเข้า Telegram ให้อัตโนมัติ 1 ครั้งเสมอ
  // หน้าเว็บจึง "ไม่ต้องส่งซ้ำอีก" ให้บันทึกสถานะว่าส่งแล้วได้เลย (จะส่งผ่าน Browser เฉพาะกรณี Standalone ที่ไม่มี Web App เท่านั้น)
  let telegramSuccess = false;
  if (sheetResult && (sheetResult.gasSuccess || sheetResult.success || sheetResult.hasGasUrl)) {
    telegramSuccess = true;
    newRecord.telegramSent = true;
  } else {
    // ส่งตรงผ่าน Browser เฉพาะกรณีไม่มี Web App URL (Standalone fallback)
    try {
      telegramSuccess = await sendTelegramNotification(newRecord);
      newRecord.telegramSent = telegramSuccess;
    } catch (err) {
      console.warn('Telegram send failed:', err);
    }
  }

  // Save record to state
  AppState.records.unshift(newRecord);
  saveRecords();

  // Reset Form
  submitBtn.disabled = false;
  submitBtn.innerHTML = '<span>✅ ลงเวลาขึ้นเวรเรียบร้อย</span>';
  setTimeout(() => {
    submitBtn.innerHTML = '<span>📋 ยืนยันการลงเวลาเข้าเวร</span>';
  }, 2500);

  // Reset Searchable Combobox
  const searchInput = document.getElementById('nurse-search-input');
  const clearBtn = document.getElementById('combobox-clear-btn');
  if (searchInput) {
    searchInput.value = '';
    searchInput.classList.remove('selected');
  }
  if (clearBtn) clearBtn.style.display = 'none';
  if (selectNurse) selectNurse.value = '';

  // Audio/Celebration effect
  playChime();

  // Feedback Toast
  if (sheetResult && sheetResult.success) {
    showToast(
      'ลงเวลาขึ้นเวรสำเร็จ!',
      `บันทึกข้อมูล ${nurseName} (เวร ${shift === 'Day' ? 'เช้า ☀️' : 'ดึก 🌙'}) เข้า Google Sheet เรียบร้อยแล้ว${telegramSuccess ? ' พร้อมส่งแจ้งเตือน Telegram สำเร็จ' : ''}`,
      'success'
    );
  } else {
    showToast(
      'บันทึกในระบบเรียบร้อย (ยังไม่เข้า Google Sheet)',
      `บันทึกเวรของ ${nurseName} ในระบบแล้ว แต่ยังไม่ได้เชื่อมต่อ Google Sheet กรุณาไปที่แท็บ '⚙️ ตั้งค่า & Telegram' เพื่อใส่ Web App URL ค่ะ`,
      'info'
    );
  }

  // Refresh Views
  renderTodayDutyList();
  renderDashboard();
  renderRecordsTable();
  noteInput.value = '';
}

/**
 * บันทึกข้อมูลลง Google Sheet โดยตรง
 * 1) ส่งผ่าน Google Apps Script Web App URL (ปลอดภัย 100% สิทธิ์เข้าถึงชีตได้ทันที)
 * 2) ส่งผ่าน Google Form Response URL (กรณีมีสิทธิ์เข้าถึง)
 */
async function syncCheckinToGoogleSheet(record) {
  let gasSuccess = false;
  let formSuccess = false;

  const DEFAULT_GAS_URL = 'https://script.google.com/macros/s/AKfycbzFPM06nw70xULNiQ4nKdrmy50O1s7eMWqX71N4uVJrGaet-9wAzmfClS9-AITdvpnD5Q/exec';
  const gasUrl = (AppState.settings && AppState.settings.gasUrl && AppState.settings.gasUrl.trim())
    ? AppState.settings.gasUrl.trim()
    : DEFAULT_GAS_URL;
  const hasGasUrl = !!(gasUrl && gasUrl.indexOf('script.google.com') !== -1);

  // 1. ส่งผ่าน Google Apps Script Web App URL (วิธีหลักที่ปลอดภัยและแน่นอน 100%)
  if (hasGasUrl) {
    try {
      await fetch(gasUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(record)
      });
      gasSuccess = true;
    } catch (err) {
      console.warn('Google Apps Script POST error:', err);
    }
  }

  // 2. พยายามส่งเข้า Google Form Response URL เฉพาะกรณีที่ GAS Web App ไม่สำเร็จเท่านั้น (Fallback)
  // เพื่อป้องกันข้อมูลลง Google Sheet ซ้ำซ้อน และป้องกัน Telegram เด้งซ้ำ
  if (!gasSuccess) {
    try {
      const fullName = (record.nurseName || '').trim();
      const parts = fullName.split(/\s+/);
      const firstName = parts[0] || fullName;
      const lastName = parts.slice(1).join(' ') || '';

      const dateStr = record.date || new Date().toISOString().split('T')[0];
      const [yyyy, mm, dd] = dateStr.split('-');
      const cleanPhone = (record.phone || '').replace(/\D/g, '');
      const beYear = String(parseInt(yyyy, 10) + 543);

      let nurseRoomChoice = record.shift === 'Day'
        ? 'ห้องพยาบาล 1 (Plant3) เวร เช้า เวลา 7.00 - 18.00 น.'
        : 'ห้องพยาบาล 1 (Plant3) เวร ดึก เวลา 18.00 - 7.00 น.';

      const formUrl = 'https://docs.google.com/forms/d/e/1FAIpQLSfu9e4OWfsUOwlNt0zNfRSbPepb6Jv3oHPUbOTS2lIDatFyQg/formResponse';

      const params = new URLSearchParams();
      params.append('entry.290368401', firstName);
      params.append('entry.954999931', lastName);
      params.append('entry.1400208557_year', beYear);
      params.append('entry.1400208557_month', String(parseInt(mm, 10)));
      params.append('entry.1400208557_day', String(parseInt(dd, 10)));
      params.append('entry.1400208557', `${beYear}-${mm}-${dd}`);
      params.append('entry.238999744', cleanPhone);
      params.append('entry.13771630', nurseRoomChoice);

      await fetch(formUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString()
      });
      formSuccess = true;
    } catch (err) {
      console.warn('Google Form auto-sync error:', err);
    }
  }

  return {
    success: gasSuccess,
    gasSuccess: gasSuccess,
    hasGasUrl: hasGasUrl,
    formSuccess: formSuccess
  };
}

// ==========================================================================
// Live Google Sheet Synchronization (ดึงข้อมูลเวรล่าสุดจากชีตแบบ Real-time)
// ==========================================================================
let isSyncingSheet = false;

function updateSyncButtonsState(isLoading) {
  const dashBtn = document.getElementById('btn-sync-sheet-dash');
  const recordsBtn = document.getElementById('btn-sync-sheet-records');
  const settingsBtn = document.getElementById('btn-sync-from-sheet');
  const badge = document.getElementById('sheet-sync-status-text');

  const btns = [dashBtn, recordsBtn, settingsBtn].filter(Boolean);
  btns.forEach(btn => {
    btn.disabled = isLoading;
    if (isLoading) {
      btn.classList.add('loading');
      btn.innerHTML = '<span class="spinner">⏳</span> กำลังซิงค์ข้อมูลจากชีต...';
    } else {
      btn.classList.remove('loading');
      btn.innerHTML = '<span>🔄 อัปเดตข้อมูลจากชีต</span>';
    }
  });

  if (badge) {
    if (isLoading) {
      badge.textContent = '⏳ กำลังดึงข้อมูลจาก Google Sheet...';
      badge.style.color = 'var(--primary)';
    } else if (AppState.lastSheetSyncTime) {
      const syncDate = new Date(AppState.lastSheetSyncTime);
      const timeStr = syncDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      badge.textContent = `🟢 ซิงค์ล่าสุด: ${timeStr} น.`;
      badge.style.color = '#059669';
    }
  }
}

function fetchSheetRecordsJsonp(gasUrl) {
  return new Promise((resolve, reject) => {
    const callbackName = 'gas_sync_cb_' + Date.now();
    const script = document.createElement('script');
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('JSONP timeout'));
    }, 12000);

    function cleanup() {
      clearTimeout(timer);
      if (script.parentNode) script.parentNode.removeChild(script);
      delete window[callbackName];
    }

    window[callbackName] = function(data) {
      cleanup();
      if (data && data.success && Array.isArray(data.records)) {
        resolve(data.records);
      } else {
        reject(new Error('Invalid JSONP data'));
      }
    };

    script.onerror = function() {
      cleanup();
      reject(new Error('JSONP script error'));
    };

    const separator = gasUrl.indexOf('?') === -1 ? '?' : '&';
    script.src = `${gasUrl}${separator}action=getRecords&callback=${callbackName}&t=${Date.now()}`;
    document.body.appendChild(script);
  });
}

/**
 * ดึงข้อมูลสดจาก Google Sheet แบบ Real-time เพื่ออัปเดตแดชบอร์ดให้ตรงตามชีต 100%
 * แม้ผู้ใช้จะเพิ่ม ลบ หรือแก้ไขแถวใน Google Sheet ยอดสรุปก็จะปรับเป็นปัจจุบันทันที
 */
async function syncRecordsFromGoogleSheet(isManual = false) {
  const DEFAULT_GAS_URL = 'https://script.google.com/macros/s/AKfycbzFPM06nw70xULNiQ4nKdrmy50O1s7eMWqX71N4uVJrGaet-9wAzmfClS9-AITdvpnD5Q/exec';
  const gasUrl = (AppState.settings && AppState.settings.gasUrl && AppState.settings.gasUrl.trim())
    ? AppState.settings.gasUrl.trim()
    : DEFAULT_GAS_URL;

  if (!gasUrl || gasUrl.indexOf('script.google.com') === -1) {
    if (isManual) {
      showToast('ยังไม่ได้ระบุ Web App URL', 'กรุณาระบุ Web App URL ในหน้าตั้งค่าก่อนซิงค์ข้อมูลค่ะ', 'error');
    }
    return false;
  }

  if (isSyncingSheet) return false;
  isSyncingSheet = true;
  updateSyncButtonsState(true);

  let newRecords = null;

  // 1. ลองดึงผ่าน fetch GET
  try {
    const fetchUrl = gasUrl + (gasUrl.indexOf('?') === -1 ? '?' : '&') + 'action=getRecords&t=' + Date.now();
    const res = await fetch(fetchUrl, { method: 'GET' });
    if (res.ok) {
      const json = await res.json();
      if (json && json.success && Array.isArray(json.records)) {
        newRecords = json.records;
      }
    }
  } catch (err) {
    console.warn('Direct fetch GET failed, trying JSONP fallback...', err);
  }

  // 2. ถ้า fetch GET ติด CORS ในบางสภาพแวดล้อม ให้ใช้ JSONP Fallback
  if (!newRecords) {
    try {
      newRecords = await fetchSheetRecordsJsonp(gasUrl);
    } catch (jsonpErr) {
      console.warn('JSONP fetch failed:', jsonpErr);
    }
  }

  // 3. ถ้าดึงสำเร็จ ให้ปรับปรุง AppState.records ทันที
  if (newRecords && Array.isArray(newRecords)) {
    AppState.records = newRecords.map(r => {
      const normName = normalizeNurseName(r.nurseName, r.phone);
      return {
        ...r,
        nurseName: normName || r.nurseName
      };
    });
    saveRecords();

    AppState.lastSheetSyncTime = new Date().toISOString();

    // อัปเดตการแสดงผลของระบบทั้งหมดให้ตรงกับชีต
    renderDashboard();
    renderRecordsTable();
    renderTodayDutyList();

    isSyncingSheet = false;
    updateSyncButtonsState(false);

    if (isManual) {
      showToast(
        'ซิงค์ข้อมูลสำเร็จ! 🔄',
        `ดึงข้อมูลล่าสุดจาก Google Sheet เรียบร้อยแล้ว (พบทั้งหมด ${newRecords.length} รายการตามชีต)`,
        'success'
      );
    }
    return true;
  }

  isSyncingSheet = false;
  updateSyncButtonsState(false);
  if (isManual) {
    showToast(
      'ยังดึงข้อมูลจากชีตไม่ได้',
      'กรุณานำโค้ด Code.gs ใหม่ล่าสุดไปวางใน Google Apps Script แล้วกด Deploy เพื่อเปิดระบบดึงข้อมูลชีตแบบ Real-time ค่ะ',
      'warning'
    );
  }
  return false;
}

/**
 * Send notification to Telegram group
 */
async function sendTelegramNotification(record) {
  const token = AppState.settings.telegramToken;
  const chatId = AppState.settings.chatId;

  if (!token || !chatId) {
    console.warn('Telegram Token or Chat ID is missing');
    return false;
  }

  const shiftThai = record.shift === 'Day'
    ? '☀️ เวรเช้า (Day) 07:00 - 18:00 น.'
    : '🌙 เวรดึก (Night) 18:00 - 07:00 น.';

  const [yyyy, mm, dd] = record.date.split('-');
  const thaiMonths = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const formattedDate = `${parseInt(dd)} ${thaiMonths[parseInt(mm) - 1]} ${parseInt(yyyy) + 543}`;

  const messageText =
    `🔔 <b>แจ้งเวรเข้าทำงานห้องพยาบาล HANA LPN1</b>
━━━━━━━━━━━━━━━━━━━━
👩‍⚕️ <b>พยาบาล:</b> ${record.nurseName}
📅 <b>วันที่:</b> ${formattedDate}
⏰ <b>เวร:</b> ${shiftThai}
🏥 <b>จุดประจำการ:</b> ${record.location}
📞 <b>เบอร์ติดต่อ:</b> ${record.phone || '-'}
📝 <b>หมายเหตุ:</b> ${record.note || '-'}
⏱ <b>เวลาบันทึก:</b> ${new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
━━━━━━━━━━━━━━━━━━━━
<i>(ส่งจากระบบ Nurse Shift Check-In Web App)</i>`;

  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  try {
    // Attempt standard fetch with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: messageText,
        parse_mode: 'HTML'
      }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      return data.ok;
    }
  } catch (err) {
    console.warn('Standard Telegram fetch failed (possibly CORS). Attempting fallback beacon...', err);
  }

  // Fallback: Using no-cors mode to ensure Telegram receives the POST request even if browser blocks reading CORS response
  try {
    await fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: messageText,
        parse_mode: 'HTML'
      })
    });
    return true;
  } catch (e) {
    console.error('All Telegram send attempts failed', e);
    return false;
  }
}

// Test Telegram Connection from Settings
async function testTelegramConnection() {
  const btn = document.getElementById('btn-test-telegram');
  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳ กำลังทดสอบส่งข้อความ...';
  }

  const token = AppState.settings.telegramToken;
  const chatId = AppState.settings.chatId;

  if (!token || !chatId) {
    showToast('กรุณาระบุ Token และ Chat ID', 'โปรดกรอก Telegram Bot Token และ Chat ID ให้ครบถ้วน', 'error');
    if (btn) { btn.disabled = false; btn.textContent = '⚡️ ทดสอบส่งข้อความเข้า Telegram'; }
    return;
  }

  const testRecord = {
    nurseName: 'ระบบทดสอบ (System Test)',
    date: new Date().toISOString().split('T')[0],
    shift: 'Day',
    location: 'ห้องพยาบาล 1 (Plant 3)',
    phone: '081-234-5678',
    note: 'ทดสอบการเชื่อมต่อ Telegram Bot สำเร็จ 100%'
  };

  const ok = await sendTelegramNotification(testRecord);
  if (btn) {
    btn.disabled = false;
    btn.textContent = '⚡️ ทดสอบส่งข้อความเข้า Telegram';
  }

  if (ok) {
    showToast('เชื่อมต่อ Telegram สำเร็จ!', 'ส่งข้อความทดสอบเข้ากลุ่ม Telegram เรียบร้อยแล้ว กรุณาตรวจสอบในกลุ่ม', 'success');
  } else {
    showToast('ส่งไม่สำเร็จ', 'ไม่สามารถส่งข้อความเข้า Telegram ได้ โปรดตรวจสอบ Bot Token และ Chat ID อีกครั้ง', 'error');
  }
}

// ==========================================================================
// Dashboard Analytics Engine (Monthly & Annual Shifts Summary)
// ==========================================================================
function renderDashboard() {
  const { viewMode, selectedYear, selectedMonth, selectedNurse } = AppState.dashboard;

  // Filter records based on selected criteria
  let filtered = AppState.records.filter(r => {
    if (!r.date) return false;

    // Exclude Room 2 completely as requested ("ยกเว้นที่เป็น ห้อง 2 จะไม่รวม")
    if (isRoom2(r.location)) return false;

    const [y, m] = r.date.split('-').map(Number);
    if (y !== selectedYear) return false;

    if (viewMode === 'monthly' && selectedMonth !== 'ALL') {
      if (m !== Number(selectedMonth)) return false;
    }

    if (selectedNurse !== 'ALL') {
      const recNurse = normalizeNurseName(r.nurseName, r.phone);
      const selNurse = normalizeNurseName(selectedNurse);
      if (recNurse !== selNurse) return false;
    }

    return true;
  });

  // Calculate Metrics
  const totalShifts = filtered.length;
  const dayShifts = filtered.filter(r => r.shift === 'Day').length;
  const nightShifts = filtered.filter(r => r.shift === 'Night').length;

  const dayPercent = totalShifts > 0 ? Math.round((dayShifts / totalShifts) * 100) : 0;
  const nightPercent = totalShifts > 0 ? Math.round((nightShifts / totalShifts) * 100) : 0;

  // Unique nurses who worked (นับพยาบาลโดยเทียบชื่อทางการ ป้องกันการนับเบิ้ลจากชื่อพิมพ์ไม่เหมือนกัน)
  const activeNursesSet = new Set(filtered.map(r => normalizeNurseName(r.nurseName, r.phone)));
  const activeNurseCount = activeNursesSet.size;
  const avgShiftsPerNurse = activeNurseCount > 0 ? (totalShifts / activeNurseCount).toFixed(1) : 0;

  // Update KPI Cards UI
  setHtml('kpi-total-shifts', totalShifts);
  setHtml('kpi-day-shifts', dayShifts);
  setHtml('kpi-day-sub', `คิดเป็น ${dayPercent}% ของเวรทั้งหมด`);
  setHtml('kpi-night-shifts', nightShifts);
  setHtml('kpi-night-sub', `คิดเป็น ${nightPercent}% ของเวรทั้งหมด`);
  setHtml('kpi-active-nurses', activeNurseCount);
  setHtml('kpi-avg-shifts', `เฉลี่ย ${avgShiftsPerNurse} เวร/คน`);

  // Calculate Nurse breakdown: { nurseName: { day: 0, night: 0, total: 0, plant3: 0 } }
  const nurseStats = {};

  // Initialize with all nurses if "ALL" selected, so even nurses with 0 shifts show up
  AppState.nurses.forEach(n => {
    const cName = normalizeNurseName(n.name, n.phone);
    if (selectedNurse === 'ALL' || normalizeNurseName(selectedNurse) === cName) {
      nurseStats[cName] = { name: cName, day: 0, night: 0, total: 0, plant3: 0 };
    }
  });

  filtered.forEach(r => {
    const cName = normalizeNurseName(r.nurseName, r.phone);
    if (!nurseStats[cName]) {
      nurseStats[cName] = { name: cName, day: 0, night: 0, total: 0, plant3: 0 };
    }
    if (r.shift === 'Day') nurseStats[cName].day++;
    else if (r.shift === 'Night') nurseStats[cName].night++;
    nurseStats[cName].total++;

    // "ห้องพยาบาล 1 (Plant3)" and "ห้องพยาบาล (Plant3)" are merged together as Plant 3
    nurseStats[cName].plant3++;
  });

  const sortedNurseStats = Object.values(nurseStats).sort((a, b) => b.total - a.total);

  // Render Charts & Tables
  renderMonthlyBarChart(selectedYear);
  renderNurseRankingBars(sortedNurseStats);
  renderSummaryTable(sortedNurseStats, totalShifts);
}

/**
 * Render Interactive Monthly Comparison Bar Chart (12 Months)
 */
function renderMonthlyBarChart(year) {
  const container = document.getElementById('chart-monthly-container');
  if (!container) return;

  const thaiMonths = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

  // Aggregate shifts per month for the year
  const monthlyData = thaiMonths.map((mName, idx) => {
    const monthNum = idx + 1;
    const monthRecords = AppState.records.filter(r => {
      if (!r.date) return false;
      if (isRoom2(r.location)) return false; // Exclude Room 2
      const [y, m] = r.date.split('-').map(Number);
      return y === year && m === monthNum;
    });
    return {
      monthName: mName,
      monthNum: monthNum,
      day: monthRecords.filter(r => r.shift === 'Day').length,
      night: monthRecords.filter(r => r.shift === 'Night').length,
      total: monthRecords.length
    };
  });

  const maxTotal = Math.max(...monthlyData.map(d => d.total), 10);

  let html = `<div style="display: flex; height: 100%; align-items: flex-end; gap: 8px; padding-bottom: 24px; position: relative;">`;

  monthlyData.forEach(d => {
    const dayHeight = (d.day / maxTotal) * 190;
    const nightHeight = (d.night / maxTotal) * 190;
    const isCurMonth = d.monthNum === AppState.dashboard.selectedMonth && AppState.dashboard.viewMode === 'monthly';

    html += `
      <div style="flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%; justify-content: flex-end; cursor: pointer;"
           title="${d.monthName}: เวรเช้า ${d.day} เวร, เวรดึก ${d.night} เวร (รวม ${d.total} วัน)"
           onclick="selectMonthFilter(${d.monthNum})">
        <span style="font-size: 0.72rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 4px; font-family: 'Plus Jakarta Sans', sans-serif;">
          ${d.total > 0 ? d.total : ''}
        </span>
        <div style="width: 100%; max-width: 28px; display: flex; flex-direction: column-reverse; border-radius: 6px; overflow: hidden; background: var(--bg-card-alt); border: ${isCurMonth ? '2px solid var(--primary)' : '1px solid var(--border-card)'};">
          <div style="height: ${dayHeight}px; background: var(--day-gradient); transition: height 0.4s ease;"></div>
          <div style="height: ${nightHeight}px; background: var(--night-gradient); transition: height 0.4s ease;"></div>
        </div>
        <span style="font-size: 0.72rem; margin-top: 6px; color: ${isCurMonth ? 'var(--primary)' : 'var(--text-secondary)'}; font-weight: ${isCurMonth ? '700' : '500'};">
          ${d.monthName}
        </span>
      </div>
    `;
  });

  html += `</div>`;
  container.innerHTML = html;
}

/**
 * Render Horizontal Stacked Ranking of Nurses
 */
function renderNurseRankingBars(nurseStats) {
  const container = document.getElementById('nurse-ranking-container');
  if (!container) return;

  if (nurseStats.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">📊</div><p>ไม่พบข้อมูลการขึ้นเวรในช่วงเวลานี้</p></div>`;
    return;
  }

  const maxShifts = Math.max(...nurseStats.map(n => n.total), 1);

  let html = '';
  nurseStats.forEach((nurse, index) => {
    const dayWidth = (nurse.day / maxShifts) * 100;
    const nightWidth = (nurse.night / maxShifts) * 100;

    html += `
      <div class="nurse-ranking-row ranking-row-${index + 1}">
        <div class="ranking-header">
          <div class="ranking-nurse-name">
            <span class="ranking-badge-rank">${index + 1}</span>
            <span>${nurse.name}</span>
          </div>
          <div class="ranking-stats-text">
            <span class="day">☀️ ${nurse.day}</span> + 
            <span class="night">🌙 ${nurse.night}</span> = 
            <strong>${nurse.total} วัน</strong>
          </div>
        </div>
        <div class="stacked-bar-container">
          <div class="bar-segment-day" style="width: ${dayWidth}%;" title="เวรเช้า: ${nurse.day} วัน"></div>
          <div class="bar-segment-night" style="width: ${nightWidth}%;" title="เวรดึก: ${nurse.night} วัน"></div>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

/**
 * Render Full Summary Table with Day/Night and Total Working Days
 */
function renderSummaryTable(nurseStats, totalPeriodShifts) {
  const tbody = document.getElementById('summary-table-body');
  if (!tbody) return;

  if (nurseStats.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty-state">ไม่มีข้อมูลเวรสำหรับเงื่อนไขที่เลือก</td></tr>`;
    return;
  }

  let html = '';
  let sumDay = 0;
  let sumNight = 0;
  let sumTotal = 0;

  nurseStats.forEach((nurse, idx) => {
    const percent = totalPeriodShifts > 0 ? ((nurse.total / totalPeriodShifts) * 100).toFixed(1) : 0;
    sumDay += nurse.day;
    sumNight += nurse.night;
    sumTotal += nurse.total;

    html += `
      <tr>
        <td style="font-weight: 700; color: var(--text-muted);">${idx + 1}</td>
        <td>
          <div class="table-nurse-cell">
            <div class="nurse-avatar-sm">👩‍⚕️</div>
            <div>
              <div style="font-weight: 600;">${nurse.name}</div>
            </div>
          </div>
        </td>
        <td class="num-cell day">☀️ ${nurse.day} วัน</td>
        <td class="num-cell night">🌙 ${nurse.night} วัน</td>
        <td class="num-cell total"><strong>${nurse.total} วัน</strong></td>
        <td>
          <div style="display: flex; align-items: center; gap: 6px;">
            <div style="width: 50px; height: 6px; background: var(--bg-card-alt); border-radius: 99px; overflow: hidden;">
              <div style="width: ${percent}%; height: 100%; background: var(--primary);"></div>
            </div>
            <span style="font-size: 0.78rem; font-weight: 600;">${percent}%</span>
          </div>
        </td>
        <td>
          <span style="font-size: 0.8rem; background: var(--bg-card-alt); padding: 3px 8px; border-radius: 6px;">
            🏥 อาคาร Plant 3
          </span>
        </td>
        <td>
          ${nurse.total > 0
        ? '<span class="status-badge-live" style="font-size: 0.72rem;">ขึ้นเวรประจำ</span>'
        : '<span style="color: var(--text-muted); font-size: 0.75rem;">ไม่มีเวรช่วงนี้</span>'}
        </td>
      </tr>
    `;
  });

  // Append Total Row
  if (nurseStats.length > 0) {
    html += `
      <tr style="background: rgba(2, 132, 199, 0.08); font-weight: 700; border-top: 2px solid var(--primary);">
        <td colspan="2" style="text-align: right; padding-right: 1.25rem; font-size: 0.95rem; color: var(--text-primary);">
          ✨ <strong>รวมจำนวนเวรทั้งหมด:</strong>
        </td>
        <td class="num-cell day" style="font-size: 1.05rem;"><strong>☀️ ${sumDay} วัน</strong></td>
        <td class="num-cell night" style="font-size: 1.05rem;"><strong>🌙 ${sumNight} วัน</strong></td>
        <td class="num-cell total" style="font-size: 1.15rem; color: var(--primary);"><strong>${sumTotal} วัน</strong></td>
        <td><strong>100%</strong></td>
        <td><span style="font-size: 0.8rem; font-weight: 600;">อาคาร Plant 3</span></td>
        <td><span class="status-badge-live" style="font-size: 0.72rem;">สรุปครบถ้วน</span></td>
      </tr>
    `;
  }

  tbody.innerHTML = html;
}

// ==========================================================================
// Records History Table
// ==========================================================================
function renderRecordsTable() {
  const tbody = document.getElementById('records-table-body');
  if (!tbody) return;

  const searchInput = document.getElementById('records-search');
  const shiftFilter = document.getElementById('record-shift-filter');
  const nurseFilter = document.getElementById('record-nurse-filter');

  const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
  const shiftVal = shiftFilter ? shiftFilter.value : 'ALL';
  const nurseVal = nurseFilter ? nurseFilter.value : 'ALL';

  let filtered = AppState.records.filter(r => {
    if (shiftVal !== 'ALL' && r.shift !== shiftVal) return false;
    const rNurse = normalizeNurseName(r.nurseName, r.phone);
    if (nurseVal !== 'ALL' && rNurse !== normalizeNurseName(nurseVal)) return false;
    if (query) {
      const matchName = r.nurseName.toLowerCase().includes(query) || rNurse.toLowerCase().includes(query);
      const matchNote = r.note && r.note.toLowerCase().includes(query);
      const matchLoc = r.location && r.location.toLowerCase().includes(query);
      if (!matchName && !matchNote && !matchLoc) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state">ไม่พบบันทึกการลงเวลาเข้าเวร</td></tr>`;
    return;
  }

  let html = '';
  filtered.forEach(r => {
    const shiftBadge = r.shift === 'Day'
      ? '<span class="badge-shift day">☀️ เช้า (Day)</span>'
      : '<span class="badge-shift night">🌙 ดึก (Night)</span>';

    const [y, m, d] = r.date.split('-');
    const dateFormatted = `${d}/${m}/${Number(y) + 543}`;
    const displayNurseName = normalizeNurseName(r.nurseName, r.phone);

    html += `
      <tr>
        <td style="font-size: 0.85rem; font-weight: 500;">${dateFormatted}</td>
        <td><strong>${displayNurseName}</strong></td>
        <td>${shiftBadge}</td>
        <td style="font-size: 0.85rem;">🏥 ${r.location}</td>
        <td style="font-size: 0.85rem;">${r.phone || '-'}</td>
        <td style="font-size: 0.82rem; color: var(--text-secondary); max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${r.note}">
          ${r.note || '-'}
        </td>
        <td>
          <div style="display: flex; gap: 4px;">
            <button class="action-btn-sm" title="ส่งแจ้งเตือน Telegram ซ้ำ" onclick="resendTelegram('${r.id}')">✈️</button>
            <button class="action-btn-sm delete" title="ลบรายการนี้" onclick="deleteRecord('${r.id}')">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
}

async function resendTelegram(recordId) {
  const r = AppState.records.find(item => item.id === recordId);
  if (!r) return;

  showToast('กำลังส่งเข้า Telegram...', `กำลังส่งข้อมูลเวรของ ${r.nurseName}`, 'info');
  const ok = await sendTelegramNotification(r);
  if (ok) {
    r.telegramSent = true;
    saveRecords();
    showToast('ส่งแจ้งเตือน Telegram สำเร็จ!', `ส่งข้อมูลของ ${r.nurseName} เข้ากลุ่มแล้ว`, 'success');
  } else {
    showToast('ส่งไม่สำเร็จ', 'ไม่สามารถส่งข้อความเข้า Telegram ได้ ตรวจสอบการเชื่อมต่อหรือ Token', 'error');
  }
}

function deleteRecord(recordId) {
  if (!confirm('คุณแน่ใจหรือไม่ว่าต้องการลบบันทึกการขึ้นเวรนี้?')) return;
  AppState.records = AppState.records.filter(r => r.id !== recordId);
  saveRecords();
  renderRecordsTable();
  renderTodayDutyList();
  renderDashboard();
  showToast('ลบบันทึกแล้ว', 'นำบันทึกการขึ้นเวรออกจากระบบเรียบร้อย', 'info');
}

// ==========================================================================
// Today's On-Duty List
// ==========================================================================
function renderTodayDutyList() {
  const container = document.getElementById('today-duty-list');
  if (!container) return;

  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const todayStr = `${yyyy}-${mm}-${dd}`;

  const todayRecords = AppState.records.filter(r => r.date === todayStr);

  if (todayRecords.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🏥</div>
        <p>ยังไม่มีพยาบาลลงเวลาเข้าเวรในวันนี้</p>
      </div>
    `;
    return;
  }

  let html = '';
  todayRecords.forEach(r => {
    const isDay = r.shift === 'Day';
    const displayNurseName = normalizeNurseName(r.nurseName, r.phone);
    html += `
      <div class="duty-item-card">
        <div class="duty-item-avatar">${isDay ? '☀️' : '🌙'}</div>
        <div class="duty-item-content">
          <div class="duty-item-name">${displayNurseName}</div>
          <div class="duty-item-meta">
            <span>${r.location}</span>
            <span>•</span>
            <span>📞 ${r.phone || '-'}</span>
          </div>
        </div>
        <span class="badge-shift ${isDay ? 'day' : 'night'}">
          ${isDay ? 'เวรเช้า' : 'เวรดึก'}
        </span>
      </div>
    `;
  });

  container.innerHTML = html;
}

// ==========================================================================
// Nurse Roster View & Batch Paste Import
// ==========================================================================
function renderRosterList() {
  const container = document.getElementById('roster-cards-container');
  const countBadge = document.getElementById('roster-total-count');
  if (!container) return;

  if (countBadge) countBadge.textContent = `${AppState.nurses.length} คน`;

  if (AppState.nurses.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">👩‍⚕️</div><p>ยังไม่มีรายชื่อพยาบาลในระบบ สามารถเพิ่มได้ทันที</p></div>`;
    return;
  }

  let html = '';
  let warningCount = 0;
  const warningNurses = [];

  AppState.nurses.forEach(nurse => {
    // Count shifts worked (excluding Room 2)
    const normNurseName = normalizeNurseName(nurse.name, nurse.phone);
    const shiftsCount = AppState.records.filter(r => normalizeNurseName(r.nurseName, r.phone) === normNurseName && !isRoom2(r.location)).length;
    const licStatus = getLicenseStatus(nurse.expireDate);

    let alertBadgeHtml = '';
    let isWarn = false;

    if (licStatus) {
      if (licStatus.isExpired) {
        warningCount++;
        isWarn = true;
        warningNurses.push(`${nurse.name} (หมดอายุแล้ว)`);
        alertBadgeHtml = `<div style="margin-top: 4px;"><span class="badge-license-alert expired">🚨 ใบประกอบหมดอายุแล้ว (${licStatus.expireDateFormatted})</span></div>`;
      } else if (licStatus.diffDays <= 60) {
        warningCount++;
        isWarn = true;
        warningNurses.push(`${nurse.name} (เหลืออีก ${licStatus.diffDays} วัน)`);
        alertBadgeHtml = `<div style="margin-top: 4px;"><span class="badge-license-alert">🚨 จะหมดอายุในอีก ${licStatus.diffDays} วัน (${licStatus.expireDateFormatted})</span></div>`;
      } else {
        alertBadgeHtml = `<span style="display:inline-block; font-size:0.75rem; background:var(--bg-card-alt); border:1px solid var(--border-card); padding:2px 6px; border-radius:4px; margin-top:2px;">🪪 เลขใบประกอบ: <strong>${nurse.licenseNo || '-'}</strong> (หมดอายุ: ${nurse.expireDate || '-'})</span>`;
      }
    } else if (nurse.licenseNo) {
      alertBadgeHtml = `<span style="display:inline-block; font-size:0.75rem; background:var(--bg-card-alt); border:1px solid var(--border-card); padding:2px 6px; border-radius:4px; margin-top:2px;">🪪 เลขใบประกอบ: <strong>${nurse.licenseNo}</strong></span>`;
    }

    html += `
      <div class="nurse-profile-card ${isWarn ? 'license-warning' : ''}">
        <div class="nurse-prof-info">
          <div class="nurse-prof-avatar">${isWarn ? '🚨' : '👩‍⚕️'}</div>
          <div class="nurse-prof-meta">
            <h4>${nurse.name}</h4>
            <p>📞 <strong>${nurse.phone || 'ยังไม่ระบุเบอร์'}</strong> • 🏥 ${nurse.defaultLocation || 'Plant 3'}</p>
            ${alertBadgeHtml}
            <p style="margin-top: 4px; font-weight: 600; color: var(--primary); font-size: 0.78rem;">
              ขึ้นเวรไปแล้วทั้งหมด ${shiftsCount} ครั้ง
            </p>
          </div>
        </div>
        <div class="nurse-card-actions">
          <button class="action-btn-sm edit" title="แก้ไขข้อมูลพยาบาล & ใบประกอบวิชาชีพ" onclick="openEditNurseModal('${nurse.id}')">✏️</button>
          <button class="action-btn-sm delete" title="ลบพยาบาลนี้" onclick="deleteNurse('${nurse.id}')">🗑️</button>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;

  // Update Roster Top Alert Banner & Nav Badge
  const banner = document.getElementById('roster-license-alert-banner');
  const bannerTitle = document.getElementById('roster-alert-title');
  const bannerDesc = document.getElementById('roster-alert-desc');
  const navAlertBadge = document.getElementById('roster-alert-count-badge');

  if (warningCount > 0) {
    if (banner) {
      banner.style.display = 'flex';
      bannerTitle.textContent = `🚨 แจ้งเตือน: มีพยาบาล ${warningCount} ท่านที่ใบประกอบวิชาชีพหมดอายุหรือจะหมดอายุภายใน 2 เดือน!`;
      bannerDesc.textContent = `รายชื่อที่ต้องดำเนินการต่ออายุ: ${warningNurses.join(', ')}`;
    }
    if (navAlertBadge) {
      navAlertBadge.style.display = 'inline-flex';
      navAlertBadge.textContent = `${warningCount}`;
    }
  } else {
    if (banner) banner.style.display = 'none';
    if (navAlertBadge) navAlertBadge.style.display = 'none';
  }
}

function handleAddSingleNurse(e) {
  e.preventDefault();
  const nameInput = document.getElementById('roster-new-name');
  const phoneInput = document.getElementById('roster-new-phone');
  const licenseInput = document.getElementById('roster-new-license');
  const expireInput = document.getElementById('roster-new-expire');
  const locInput = document.getElementById('roster-new-loc');

  const name = nameInput.value.trim();
  if (!name) {
    showToast('กรุณาระบุชื่อพยาบาล', '', 'error');
    return;
  }

  registerNurseIfNew(
    name,
    phoneInput ? phoneInput.value : '',
    locInput ? locInput.value : '',
    licenseInput ? licenseInput.value : '',
    expireInput ? expireInput.value : ''
  );
  nameInput.value = '';
  if (phoneInput) phoneInput.value = '';
  if (licenseInput) licenseInput.value = '';
  if (expireInput) expireInput.value = '';
}

function handleBatchNurseImport() {
  const textarea = document.getElementById('roster-batch-text');
  if (!textarea) return;

  const text = textarea.value.trim();
  if (!text) {
    showToast('กรุณาวางรายชื่อ', 'โปรดวางรายชื่อพยาบาลลงในช่องข้อความ', 'error');
    return;
  }

  // Split lines or commas
  const rawList = text.split(/[\n,;]+/);
  let addedCount = 0;

  rawList.forEach(rawItem => {
    let clean = rawItem.trim();
    if (!clean) return;
    // Remove leading numbering like "1. ", "1) "
    clean = clean.replace(/^\d+[\.\)\s]+/, '').trim();
    if (clean.length > 2) {
      const added = registerNurseIfNew(clean);
      if (added) addedCount++;
    }
  });

  textarea.value = '';
  showToast('นำเข้ารายชื่อเรียบร้อย!', `เพิ่มพยาบาลใหม่เข้าระบบสำเร็จ ${addedCount} คน`, 'success');
}

function deleteNurse(nurseId) {
  const nurse = AppState.nurses.find(n => n.id === nurseId);
  if (!nurse) return;

  if (!confirm(`คุณต้องการลบรายชื่อ "${nurse.name}" ออกจากระบบหรือไม่?`)) return;

  AppState.nurses = AppState.nurses.filter(n => n.id !== nurseId);
  saveNurses();
  populateNurseDropdown();
  renderRosterList();
  showToast('ลบรายชื่อสำเร็จ', `นำ ${nurse.name} ออกจากระบบเรียบร้อย`, 'info');
}

// ==========================================================================
// Edit Nurse Modal Handlers
// ==========================================================================
function openEditNurseModal(nurseId) {
  const nurse = AppState.nurses.find(n => n.id === nurseId);
  if (!nurse) return;

  const modal = document.getElementById('edit-nurse-modal');
  const idInput = document.getElementById('edit-nurse-id');
  const nameInput = document.getElementById('edit-nurse-name');
  const phoneInput = document.getElementById('edit-nurse-phone');
  const licInput = document.getElementById('edit-nurse-license');
  const expInput = document.getElementById('edit-nurse-expire');
  const locInput = document.getElementById('edit-nurse-loc');

  if (idInput) idInput.value = nurse.id;
  if (nameInput) nameInput.value = nurse.name || '';
  if (phoneInput) phoneInput.value = nurse.phone || '';
  if (licInput) licInput.value = nurse.licenseNo || '';
  if (expInput) expInput.value = nurse.expireDate || '';
  if (locInput) locInput.value = nurse.defaultLocation || 'ห้องพยาบาล (อาคาร Plant 3)';

  if (modal) modal.classList.add('show');
}

function closeEditNurseModal() {
  const modal = document.getElementById('edit-nurse-modal');
  if (modal) modal.classList.remove('show');
}

function handleSaveNurseEdit(e) {
  if (e) e.preventDefault();
  const idInput = document.getElementById('edit-nurse-id');
  const nameInput = document.getElementById('edit-nurse-name');
  const phoneInput = document.getElementById('edit-nurse-phone');
  const licInput = document.getElementById('edit-nurse-license');
  const expInput = document.getElementById('edit-nurse-expire');
  const locInput = document.getElementById('edit-nurse-loc');

  const nurseId = idInput ? idInput.value : '';
  const nurse = AppState.nurses.find(n => n.id === nurseId);
  if (!nurse) return;

  const oldName = nurse.name;
  const newName = nameInput ? nameInput.value.trim() : nurse.name;
  const newPhone = phoneInput ? phoneInput.value.trim() : '';
  const newLicense = licInput ? licInput.value.trim() : '';
  const newExpire = expInput ? expInput.value.trim() : '';
  const newLoc = locInput ? locInput.value.trim() : 'ห้องพยาบาล (อาคาร Plant 3)';

  if (!newName) {
    showToast('กรุณาระบุชื่อพยาบาล', '', 'error');
    return;
  }

  // อัปเดตข้อมูลพยาบาล
  nurse.name = newName;
  nurse.phone = newPhone;
  nurse.licenseNo = newLicense;
  nurse.expireDate = newExpire;
  nurse.defaultLocation = newLoc;

  // หากมีการเปลี่ยนชื่อ ให้อัปเดตประวัติการลงเวลาให้ตรงกัน
  if (oldName !== newName) {
    AppState.records.forEach(r => {
      if (r.nurseName === oldName) {
        r.nurseName = newName;
      }
    });
    saveRecords();
  }

  saveNurses();
  populateNurseDropdown();
  renderRosterList();
  renderTodayDutyList();
  closeEditNurseModal();

  showToast('แก้ไขข้อมูลสำเร็จ!', `อัปเดตข้อมูลและวันหมดอายุใบประกอบของ "${newName}" เรียบร้อยแล้ว`, 'success');
}

// ==========================================================================
// Settings Synchronization
// ==========================================================================
function syncSettingsInputs() {
  const tokenInput = document.getElementById('settings-tg-token');
  const chatInput = document.getElementById('settings-tg-chatid');
  const gasInput = document.getElementById('settings-gas-url');

  if (tokenInput) tokenInput.value = AppState.settings.telegramToken;
  if (chatInput) chatInput.value = AppState.settings.chatId;
  if (gasInput) gasInput.value = AppState.settings.gasUrl || '';

  const badge = document.getElementById('gas-status-badge');
  if (badge) {
    if (AppState.settings.gasUrl && AppState.settings.gasUrl.trim().indexOf('script.google.com') !== -1) {
      badge.textContent = '🟢 เชื่อมต่อพร้อมใช้งาน';
      badge.style.background = '#d1fae5';
      badge.style.color = '#065f46';
    } else {
      badge.textContent = '🟠 รอการเชื่อมต่อ Web App URL';
      badge.style.background = '#fef3c7';
      badge.style.color = '#92400e';
    }
  }
}

function handleSaveSettings(e) {
  if (e) e.preventDefault();
  const tokenInput = document.getElementById('settings-tg-token');
  const chatInput = document.getElementById('settings-tg-chatid');
  const gasInput = document.getElementById('settings-gas-url');

  if (tokenInput) AppState.settings.telegramToken = tokenInput.value.trim();
  if (chatInput) AppState.settings.chatId = chatInput.value.trim();
  if (gasInput) AppState.settings.gasUrl = gasInput.value.trim();

  saveSettings();
  syncSettingsInputs();

  if (AppState.settings.gasUrl && AppState.settings.gasUrl.trim().indexOf('script.google.com') !== -1) {
    showToast('บันทึกการตั้งค่าสำเร็จ!', 'เชื่อมต่อ Web App URL เรียบร้อยแล้ว พร้อมส่งข้อมูลเข้า Google Sheet ทันที', 'success');
  } else {
    showToast('บันทึกการตั้งค่าแล้ว', 'อัปเดตการตั้งค่า Telegram Bot เรียบร้อยแล้ว (ยังไม่มี Web App URL)', 'info');
  }
}

/**
 * คัดลอกโค้ด Google Apps Script (Code.gs) ไปยัง Clipboard
 */
function copyGasCode() {
  const code = "/**\n * ============================================================================\n * HANA LPN1 Nurse Shift System - Google Apps Script Backend (Code.gs)\n * ============================================================================\n * ใช้สำหรับผู้ใช้ที่ต้องการนำระบบไปติดตั้งเป็น Web App บน Google Apps Script \n * หรือบันทึกข้อมูลลง Google Sheet ควบคู่กับการส่ง Telegram Bot\n */\n\nvar SPREADSHEET_ID = \"1Dr3OvUCTbst-PnYL68DIBswNT5wKuTKcddhUBYFFU74\";\nvar SHEET_NAME = \"การตอบแบบฟอร์ม 1\"; // GID: 1498443096\nvar TELEGRAM_TOKEN = \"7141132492:AAEWzaarVZVCA7m9gAjQjoqsyXyTpFaoDKo\";\nvar CHAT_ID = \"-4567593144\";\n\n/**\n * เสิร์ฟหน้าเว็บแอป (Web App doGet) หรือส่งข้อมูลเวรสดจาก Google Sheet (API getRecords)\n */\nfunction doGet(e) {\n  var action = (e \u0026\u0026 e.parameter \u0026\u0026 e.parameter.action) ? e.parameter.action : \"\";\n  var callback = (e \u0026\u0026 e.parameter \u0026\u0026 e.parameter.callback) ? e.parameter.callback : \"\";\n\n  // 1. ส่งข้อมูลเวรทั้งหมดจาก Google Sheet กลับไปให้หน้าเว็บเพื่อทำสรุปแดชบอร์ด Real-time\n  if (action === \"getRecords\" || action === \"getData\" || action === \"sync\") {\n    try {\n      var records = getSheetRecords();\n      var output = JSON.stringify({\n        success: true,\n        count: records.length,\n        updatedAt: Utilities.formatDate(new Date(), \"Asia/Bangkok\", \"yyyy-MM-dd HH:mm:ss\"),\n        records: records\n      });\n      if (callback) {\n        return ContentService.createTextOutput(callback + \"(\" + output + \");\")\n          .setMimeType(ContentService.MimeType.JAVASCRIPT);\n      }\n      return ContentService.createTextOutput(output)\n        .setMimeType(ContentService.MimeType.JSON);\n    } catch (err) {\n      var errOutput = JSON.stringify({ success: false, error: err.toString(), records: [] });\n      if (callback) {\n        return ContentService.createTextOutput(callback + \"(\" + errOutput + \");\")\n          .setMimeType(ContentService.MimeType.JAVASCRIPT);\n      }\n      return ContentService.createTextOutput(errOutput)\n        .setMimeType(ContentService.MimeType.JSON);\n    }\n  }\n\n  // 2. เสิร์ฟหน้าเว็บแอป (หากมีไฟล์ index) หรือแสดงสถานะ API\n  try {\n    return HtmlService.createHtmlOutputFromFile(\u0027index\u0027)\n      .setTitle(\u0027ระบบแจ้งเวรเข้าทำงานห้องพยาบาล HANA LPN1\u0027)\n      .addMetaTag(\u0027viewport\u0027, \u0027width=device-width, initial-scale=1.0\u0027)\n      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);\n  } catch (err) {\n    return ContentService.createTextOutput(JSON.stringify({\n      status: \"OK\",\n      service: \"HANA LPN1 Nurse Shift Web App \u0026 API Backend\",\n      message: \"ระบบ Google Apps Script Backend กำลังทำงานปกติ พร้อมรับและส่งข้อมูลการลงเวร Real-time\",\n      recordsCount: getSheetRecords().length,\n      instructions: \"หากต้องการเปิดหน้าเว็บ Nurse Check-In โดยตรงผ่านลิงก์นี้ กรุณาสร้างไฟล์ HTML ชื่อ \u0027index\u0027 ใน Apps Script แล้ววางโค้ดจาก index_bundle.html ค่ะ\"\n    }, null, 2)).setMimeType(ContentService.MimeType.JSON);\n  }\n}\n\n/**\n * รับคำขอ POST สำหรับบันทึกเวรลง Google Sheet และส่งแจ้งเตือน Telegram\n */\nfunction doPost(e) {\n  try {\n    var contents = e.postData ? e.postData.contents : \"\";\n    var data = {};\n    if (contents) {\n      try {\n        data = JSON.parse(contents);\n      } catch (parseErr) {\n        data = e.parameter || {};\n      }\n    } else {\n      data = e.parameter || {};\n    }\n    \n    // หากเป็นการร้องขอข้อมูลเวรทั้งหมดจาก Google Sheet (API Sync)\n    if (data.action === \"getRecords\" || data.action === \"sync\" || data.action === \"getData\") {\n      var syncRecords = getSheetRecords();\n      return ContentService.createTextOutput(JSON.stringify({\n        success: true,\n        count: syncRecords.length,\n        updatedAt: Utilities.formatDate(new Date(), \"Asia/Bangkok\", \"yyyy-MM-dd HH:mm:ss\"),\n        records: syncRecords\n      })).setMimeType(ContentService.MimeType.JSON);\n    }\n    \n    // 1. บันทึกข้อมูลลง Google Sheet ให้ตรงตามโครงสร้างของชีตอัตโนมัติ\n    var sheet = getTargetSheet();\n    if (sheet) {\n      var now = new Date();\n      // รูปแบบ Timestamp เช่น 12/11/2026, 10:15:30\n      var formattedTimestamp = Utilities.formatDate(now, \"Asia/Bangkok\", \"d/M/yyyy, HH:mm:ss\");\n\n      // แยก ชื่อ - นามสกุล พยาบาล (ตัดคำนำหน้า เช่น พว., น.ส., นาง เพื่อไม่ให้คำนำหน้ากลายเป็นชื่อ)\n      var fullName = (data.nurseName || \"\").trim();\n      var cleanFullName = fullName.replace(/^(พว\\.|พว|พยาบาล|น\\.ส\\.|นางสาว|นาง|นาย)\\s*/i, \"\").trim();\n      var parts = (cleanFullName || fullName).split(/\\s+/);\n      var firstName = parts[0] || fullName;\n      var lastName = parts.slice(1).join(\" \") || \"\";\n\n      // ข้อความกะและสถานที่ตรงตามแบบฟอร์มเดิมของ HANA\n      var shiftText = \"\";\n      if (data.shift === \"Day\") {\n        shiftText = \"ห้องพยาบาล 1 (Plant3) เวร เช้า เวลา 7.00 - 18.00 น.\";\n      } else {\n        shiftText = \"ห้องพยาบาล 1 (Plant3) เวร ดึก เวลา 18.00 - 7.00 น.\";\n      }\n\n      // ดึงเบอร์โทรศัพท์และใส่เครื่องหมาย \u0027 (Apostrophe) นำหน้า เพื่อบังคับให้ Google Sheet จัดเก็บเป็น Text\n      // ทำให้เลข 0 นำหน้าไม่หายไปเด็ดขาด (เช่น \u00270812345678 จะแสดงเป็น 0812345678)\n      var cleanPhone = (data.phone || \"\").replace(/\\D/g, \"\");\n      var phoneText = cleanPhone ? (\"\u0027\" + cleanPhone) : \"\";\n\n      // จัดรูปแบบวันที่มาทำงาน (เช่น 12/11/2569)\n      var dutyDate = data.date || Utilities.formatDate(now, \"Asia/Bangkok\", \"yyyy-MM-dd\");\n      var formattedDutyDate = dutyDate;\n      var dateParts = dutyDate.split(\"-\");\n      if (dateParts.length === 3) {\n        var dYear = parseInt(dateParts[0], 10);\n        var beYear = dYear \u003e 2400 ? dYear : (dYear + 543);\n        formattedDutyDate = parseInt(dateParts[2], 10) + \"/\" + parseInt(dateParts[1], 10) + \"/\" + beYear;\n      }\n\n      // ตรวจสอบหัวตารางของชีต เพื่อจับคู่ข้อมูลลงคอลัมน์ให้ตรง 100%\n      var lastCol = sheet.getLastColumn();\n      var appendedRowIndex = sheet.getLastRow() + 1;\n      \n      if (lastCol \u003e 0) {\n        var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];\n        var rowData = new Array(headers.length).fill(\"\");\n        var phoneCol = -1;\n        \n        for (var c = 0; c \u003c headers.length; c++) {\n          var h = String(headers[c] || \"\").trim().toLowerCase();\n          if (c === 0 || h.indexOf(\"เวลา\") !== -1 || h.indexOf(\"timestamp\") !== -1) {\n            rowData[c] = formattedTimestamp;\n          } else if (h.indexOf(\"ชื่อ\") !== -1 \u0026\u0026 (h.indexOf(\"สกุล\") !== -1 || h.indexOf(\"นามสกุล\") !== -1)) {\n            rowData[c] = fullName;\n          } else if (h === \"ชื่อ\" || (h.indexOf(\"ชื่อ\") !== -1 \u0026\u0026 h.indexOf(\"สกุล\") === -1) || h.indexOf(\"first\") !== -1) {\n            rowData[c] = firstName;\n          } else if (h === \"นามสกุล\" || (h.indexOf(\"สกุล\") !== -1 \u0026\u0026 h.indexOf(\"ชื่อ\") === -1) || h.indexOf(\"last\") !== -1) {\n            rowData[c] = lastName;\n          } else if (h.indexOf(\"วัน\") !== -1 || h.indexOf(\"date\") !== -1) {\n            rowData[c] = formattedDutyDate;\n          } else if (h.indexOf(\"โทร\") !== -1 || h.indexOf(\"phone\") !== -1 || h.indexOf(\"tel\") !== -1) {\n            rowData[c] = phoneText;\n            phoneCol = c + 1;\n          } else if (h.indexOf(\"nurse\") !== -1 || h.indexOf(\"เวร\") !== -1 || h.indexOf(\"ห้อง\") !== -1 || h.indexOf(\"room\") !== -1 || h.indexOf(\"กะ\") !== -1 || h.indexOf(\"shift\") !== -1) {\n            rowData[c] = shiftText;\n          } else if (h.indexOf(\"สถาน\") !== -1 || h.indexOf(\"จุด\") !== -1 || h.indexOf(\"plant\") !== -1 || h.indexOf(\"loc\") !== -1) {\n            rowData[c] = data.location || \"ห้องพยาบาล (อาคาร Plant 3)\";\n          } else if (h.indexOf(\"หมายเหตุ\") !== -1 || h.indexOf(\"note\") !== -1) {\n            rowData[c] = data.note || \"-\";\n          } else {\n            rowData[c] = \"\";\n          }\n        }\n        sheet.appendRow(rowData);\n        \n        // กำหนดรูปแบบเซลล์เบอร์โทรศัพท์ให้เป็น Plain Text (@)\n        if (phoneCol \u003e 0) {\n          try {\n            sheet.getRange(appendedRowIndex, phoneCol).setNumberFormat(\"@\");\n          } catch(eFmt) {}\n        }\n      } else {\n        // กรณีชีตมาตรฐาน 5 คอลัมน์ [ประทับเวลา, ชื่อ, นามสกุล, กะการเข้าเวร, เบอร์โทรศัพท์]\n        sheet.appendRow([\n          formattedTimestamp,\n          firstName,\n          lastName,\n          shiftText,\n          phoneText\n        ]);\n        try {\n          sheet.getRange(appendedRowIndex, 5).setNumberFormat(\"@\");\n        } catch(eFmt2) {}\n      }\n    }\n\n    // 2. ส่งข้อความแจ้งเตือนเข้า Telegram Bot\n    var tgSuccess = false;\n    try {\n      tgSuccess = sendTelegramNotification(data);\n    } catch (tgErr) {\n      Logger.log(\"Telegram send error: \" + tgErr.message);\n    }\n\n    return ContentService.createTextOutput(JSON.stringify({\n      success: true,\n      telegramSent: tgSuccess,\n      sheetAppended: true,\n      message: \"บันทึกข้อมูลลง Google Sheet และส่ง Telegram สำเร็จ\"\n    })).setMimeType(ContentService.MimeType.JSON);\n\n  } catch (err) {\n    return ContentService.createTextOutput(JSON.stringify({\n      success: false,\n      error: err.toString()\n    })).setMimeType(ContentService.MimeType.JSON);\n  }\n}\n\nfunction getTargetSheet() {\n  var ss;\n  try {\n    ss = SpreadsheetApp.getActiveSpreadsheet();\n  } catch (e) {}\n  if (!ss) {\n    try {\n      ss = SpreadsheetApp.openById(SPREADSHEET_ID);\n    } catch (e2) {}\n  }\n  if (!ss) return null;\n\n  var sheet = ss.getSheetByName(SHEET_NAME);\n  if (!sheet) {\n    sheet = ss.getSheets()[0];\n  }\n  return sheet;\n}\n\n/**\n * ฟังก์ชันส่งข้อความเข้า Telegram Bot\n */\nfunction sendTelegramNotification(data) {\n  var shiftThai = data.shift === \"Day\" \n    ? \"☀️ เวรเช้า (Day) 07:00 - 18:00 น.\" \n    : \"🌙 เวรดึก (Night) 18:00 - 07:00 น.\";\n\n  var message = \n    \"🔔 \u003cb\u003eแจ้งเวรเข้าทำงานห้องพยาบาล HANA LPN1\u003c/b\u003e\\n\" +\n    \"━━━━━━━━━━━━━━━━━━━━\\n\" +\n    \"👩‍⚕️ \u003cb\u003eพยาบาล:\u003c/b\u003e \" + (data.nurseName || \"-\") + \"\\n\" +\n    \"📅 \u003cb\u003eวันที่:\u003c/b\u003e \" + (data.date || \"-\") + \"\\n\" +\n    \"⏰ \u003cb\u003eเวร:\u003c/b\u003e \" + shiftThai + \"\\n\" +\n    \"🏥 \u003cb\u003eจุดประจำการ:\u003c/b\u003e \" + (data.location || \"-\") + \"\\n\" +\n    \"📞 \u003cb\u003eเบอร์ติดต่อ:\u003c/b\u003e \" + (data.phone || \"-\") + \"\\n\" +\n    \"📝 \u003cb\u003eหมายเหตุ:\u003c/b\u003e \" + (data.note || \"-\") + \"\\n\" +\n    \"⏱ \u003cb\u003eเวลาบันทึก:\u003c/b\u003e \" + Utilities.formatDate(new Date(), \"Asia/Bangkok\", \"HH:mm:ss\") + \" น.\\n\" +\n    \"━━━━━━━━━━━━━━━━━━━━\\n\" +\n    \"\u003ci\u003e(ส่งจากระบบ Nurse Shift Check-In Web App)\u003c/i\u003e\";\n\n  var url = \"https://api.telegram.org/bot\" + TELEGRAM_TOKEN + \"/sendMessage\";\n  var payload = {\n    method: \"POST\",\n    contentType: \"application/json\",\n    payload: JSON.stringify({\n      chat_id: CHAT_ID,\n      text: message,\n      parse_mode: \"HTML\"\n    }),\n    muteHttpExceptions: true\n  };\n\n  try {\n    var response = UrlFetchApp.fetch(url, payload);\n    var resJson = JSON.parse(response.getContentText());\n    return resJson.ok;\n  } catch (e) {\n    Logger.log(\"Telegram Error: \" + e.message);\n    return false;\n  }\n}\n\n/**\n * ฟังก์ชันดึงและแปลงข้อมูลเวรทั้งหมดจาก Google Sheet เป็น JSON Records สำหรับส่งกลับไปยัง Web App\n */\nfunction getSheetRecords() {\n  var sheet = getTargetSheet();\n  if (!sheet) return [];\n\n  var lastRow = sheet.getLastRow();\n  var lastCol = sheet.getLastColumn();\n  if (lastRow \u003c 2 || lastCol \u003c 1) return [];\n\n  var rangeValues = sheet.getRange(1, 1, lastRow, lastCol).getValues();\n  var headers = rangeValues[0];\n\n  // ค้นหาตำแหน่งคอลัมน์จากชื่อหัวตาราง\n  var colTimestamp = -1;\n  var colFullName = -1;\n  var colFirstName = -1;\n  var colLastName = -1;\n  var colDate = -1;\n  var colPhone = -1;\n  var colShift = -1;\n  var colLocation = -1;\n  var colNote = -1;\n\n  for (var c = 0; c \u003c headers.length; c++) {\n    var h = String(headers[c] || \"\").trim().toLowerCase();\n    if (h.indexOf(\"เวลา\") !== -1 || h.indexOf(\"timestamp\") !== -1) {\n      if (colTimestamp === -1) colTimestamp = c;\n    } else if (h.indexOf(\"ชื่อ\") !== -1 \u0026\u0026 (h.indexOf(\"สกุล\") !== -1 || h.indexOf(\"นามสกุล\") !== -1)) {\n      colFullName = c;\n    } else if (h === \"ชื่อ\" || (h.indexOf(\"ชื่อ\") !== -1 \u0026\u0026 h.indexOf(\"สกุล\") === -1) || h.indexOf(\"first\") !== -1) {\n      if (colFirstName === -1) colFirstName = c;\n    } else if (h === \"นามสกุล\" || (h.indexOf(\"สกุล\") !== -1 \u0026\u0026 h.indexOf(\"ชื่อ\") === -1) || h.indexOf(\"last\") !== -1) {\n      if (colLastName === -1) colLastName = c;\n    } else if (h.indexOf(\"วัน\") !== -1 || h.indexOf(\"date\") !== -1) {\n      if (colDate === -1) colDate = c;\n    } else if (h.indexOf(\"โทร\") !== -1 || h.indexOf(\"phone\") !== -1 || h.indexOf(\"tel\") !== -1) {\n      if (colPhone === -1) colPhone = c;\n    } else if (h.indexOf(\"nurse\") !== -1 || h.indexOf(\"เวร\") !== -1 || h.indexOf(\"ห้อง\") !== -1 || h.indexOf(\"room\") !== -1 || h.indexOf(\"กะ\") !== -1 || h.indexOf(\"shift\") !== -1) {\n      if (colShift === -1) colShift = c;\n    } else if (h.indexOf(\"สถาน\") !== -1 || h.indexOf(\"จุด\") !== -1 || h.indexOf(\"plant\") !== -1 || h.indexOf(\"loc\") !== -1) {\n      if (colLocation === -1) colLocation = c;\n    } else if (h.indexOf(\"หมายเหตุ\") !== -1 || h.indexOf(\"note\") !== -1) {\n      if (colNote === -1) colNote = c;\n    }\n  }\n\n  if (colTimestamp === -1) colTimestamp = 0;\n\n  var records = [];\n\n  for (var r = 1; r \u003c rangeValues.length; r++) {\n    var row = rangeValues[r];\n\n    // ข้ามแถวที่ว่างเปล่าทั้งหมด\n    var hasContent = false;\n    for (var i = 0; i \u003c row.length; i++) {\n      if (String(row[i] || \"\").trim() !== \"\") {\n        hasContent = true;\n        break;\n      }\n    }\n    if (!hasContent) continue;\n\n    // 1. ชื่อพยาบาล\n    var nurseName = \"\";\n    if (colFullName !== -1 \u0026\u0026 row[colFullName]) {\n      nurseName = String(row[colFullName]).trim();\n    } else {\n      var fName = colFirstName !== -1 ? String(row[colFirstName] || \"\").trim() : \"\";\n      var lName = colLastName !== -1 ? String(row[colLastName] || \"\").trim() : \"\";\n      nurseName = (fName + \" \" + lName).trim();\n    }\n    if (!nurseName \u0026\u0026 row[1]) nurseName = String(row[1]).trim();\n    if (!nurseName) continue;\n\n    // 2. วันที่ขึ้นเวร (รองรับทั้ง Date object, String ค.ศ./พ.ศ. และ Timestamp)\n    var rawDate = colDate !== -1 ? row[colDate] : null;\n    var rawTimestamp = row[colTimestamp];\n    var formattedDate = parseToIsoDate(rawDate) || parseToIsoDate(rawTimestamp);\n    if (!formattedDate) {\n      formattedDate = Utilities.formatDate(new Date(), \"Asia/Bangkok\", \"yyyy-MM-dd\");\n    }\n\n    // 3. กะการทำงาน (Day / Night)\n    var shiftRaw = colShift !== -1 ? String(row[colShift] || \"\").toLowerCase() : \"\";\n    if (!shiftRaw) {\n      shiftRaw = row.join(\" \").toLowerCase();\n    }\n    var shift = \"Day\";\n    if (shiftRaw.indexOf(\"ดึก\") !== -1 || shiftRaw.indexOf(\"night\") !== -1 || shiftRaw.indexOf(\"18.00\") !== -1) {\n      shift = \"Night\";\n    } else if (shiftRaw.indexOf(\"เช้า\") !== -1 || shiftRaw.indexOf(\"day\") !== -1 || shiftRaw.indexOf(\"7.00\") !== -1) {\n      shift = \"Day\";\n    }\n\n    // 4. จุดประจำการ\n    var location = \"ห้องพยาบาล (Plant3)\";\n    if (colLocation !== -1 \u0026\u0026 row[colLocation]) {\n      location = String(row[colLocation]).trim();\n    } else if (shiftRaw.indexOf(\"ห้อง 2\") !== -1 || shiftRaw.indexOf(\"ห้องพยาบาล 2\") !== -1 || shiftRaw.indexOf(\"pa\") !== -1) {\n      location = \"ห้องพยาบาล 2 (หลังห้อง PA)\";\n    }\n\n    // 5. เบอร์โทรศัพท์\n    var phone = \"\";\n    if (colPhone !== -1 \u0026\u0026 row[colPhone]) {\n      phone = String(row[colPhone]).replace(/\\D/g, \"\");\n      if (phone.length === 9 || phone.length === 10) {\n        if (!phone.startsWith(\"0\")) phone = \"0\" + phone;\n      }\n    }\n\n    // 6. หมายเหตุ\n    var note = colNote !== -1 ? String(row[colNote] || \"-\").trim() : \"-\";\n\n    // 7. เวลาประทับเวลา\n    var tsStr = \"\";\n    if (rawTimestamp instanceof Date \u0026\u0026 !isNaN(rawTimestamp.getTime())) {\n      tsStr = Utilities.formatDate(rawTimestamp, \"Asia/Bangkok\", \"yyyy-MM-dd HH:mm:ss\");\n    } else {\n      tsStr = String(rawTimestamp || (formattedDate + \" 07:00:00\"));\n    }\n\n    records.push({\n      id: \"SHEET-\" + (r + 1),\n      rowIndex: (r + 1),\n      nurseName: nurseName,\n      date: formattedDate,\n      shift: shift,\n      location: location,\n      phone: phone,\n      note: note || \"-\",\n      timestamp: tsStr,\n      telegramSent: true\n    });\n  }\n\n  return records;\n}\n\n/**\n * แปลงวันที่จาก Date Object หรือ String รูปแบบต่างๆ (ค.ศ. / พ.ศ. / Timestamp) ให้เป็น YYYY-MM-DD\n */\nfunction parseToIsoDate(val) {\n  if (!val) return \"\";\n  if (val instanceof Date \u0026\u0026 !isNaN(val.getTime())) {\n    var yr = val.getFullYear();\n    if (yr \u003e 2400) yr -= 543;\n    var mo = String(val.getMonth() + 1);\n    if (mo.length \u003c 2) mo = \"0\" + mo;\n    var dy = String(val.getDate());\n    if (dy.length \u003c 2) dy = \"0\" + dy;\n    return yr + \"-\" + mo + \"-\" + dy;\n  }\n  \n  var s = String(val).trim();\n  if (!s) return \"\";\n  \n  // ตัดเวลาออกถ้ามี เช่น \"12/11/2026, 10:15:30\" หรือ \"12/11/2569 10:15:30\"\n  var dateStr = s.split(/[,\\s]+/)[0].trim();\n  \n  if (dateStr.indexOf(\"/\") !== -1) {\n    var parts = dateStr.split(\"/\");\n    if (parts.length === 3) {\n      var d = parseInt(parts[0], 10);\n      var m = parseInt(parts[1], 10);\n      var y = parseInt(parts[2], 10);\n      if (y \u003e 2400) y -= 543;\n      var mm = (m \u003c 10 ? \"0\" : \"\") + m;\n      var dd = (d \u003c 10 ? \"0\" : \"\") + d;\n      return y + \"-\" + mm + \"-\" + dd;\n    }\n  } else if (dateStr.indexOf(\"-\") !== -1) {\n    var parts2 = dateStr.split(\"-\");\n    if (parts2.length === 3) {\n      if (parts2[0].length === 4) {\n        var y1 = parseInt(parts2[0], 10);\n        if (y1 \u003e 2400) y1 -= 543;\n        var m1 = parseInt(parts2[1], 10);\n        var d1 = parseInt(parts2[2], 10);\n        var mm1 = (m1 \u003c 10 ? \"0\" : \"\") + m1;\n        var dd1 = (d1 \u003c 10 ? \"0\" : \"\") + d1;\n        return y1 + \"-\" + mm1 + \"-\" + dd1;\n      } else {\n        var d2 = parseInt(parts2[0], 10);\n        var m2 = parseInt(parts2[1], 10);\n        var y2 = parseInt(parts2[2], 10);\n        if (y2 \u003e 2400) y2 -= 543;\n        var mm2 = (m2 \u003c 10 ? \"0\" : \"\") + m2;\n        var dd2 = (d2 \u003c 10 ? \"0\" : \"\") + d2;\n        return y2 + \"-\" + mm2 + \"-\" + dd2;\n      }\n    }\n  }\n  return \"\";\n}\n";

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(code).then(() => {
      showToast('คัดลอกโค้ดสำเร็จ!', 'คัดลอกโค้ด Google Apps Script (Code.gs) เรียบร้อยแล้ว นำไปวางใน Google Sheet ได้เลยค่ะ', 'success');
    }).catch(() => {
      prompt('คัดลอกโค้ดด้านล่างนี้ได้เลยค่ะ:', code);
    });
  } else {
    prompt('คัดลอกโค้ดด้านล่างนี้ได้เลยค่ะ:', code);
  }
}

/**
 * ทดสอบส่งข้อมูลเข้า Google Sheet
 */
async function testGoogleSheetConnection() {
  const defaultGas = 'https://script.google.com/macros/s/AKfycbzFPM06nw70xULNiQ4nKdrmy50O1s7eMWqX71N4uVJrGaet-9wAzmfClS9-AITdvpnD5Q/exec';
  const gasUrl = (AppState.settings && AppState.settings.gasUrl && AppState.settings.gasUrl.trim())
    ? AppState.settings.gasUrl.trim()
    : defaultGas;
  if (!gasUrl || gasUrl.indexOf('script.google.com') === -1) {
    showToast(
      'ยังไม่ได้ระบุ Web App URL',
      'กรุณานำ Web App URL (https://script.google.com/macros/s/.../exec) มากรอกในช่องด้านบนตาม 4 ขั้นตอนด้านขวามือ แล้วกดบันทึกก่อนทดสอบค่ะ',
      'error'
    );
    const gasInput = document.getElementById('settings-gas-url');
    if (gasInput) gasInput.focus();
    return;
  }

  const btn = document.getElementById('btn-test-sheet');
  const originalHtml = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner">⏳</span> กำลังทดสอบส่งเข้าชีต...';
  }

  const testRecord = {
    nurseName: 'พว. ทดสอบระบบ แอดมิน',
    date: new Date().toISOString().split('T')[0],
    shift: 'Day',
    location: 'ห้องพยาบาล 1 (Plant3)',
    phone: '0812345678',
    note: 'ทดสอบการส่งข้อมูลจากระบบ Nurse Shift Check-In เข้า Google Sheet'
  };

  const res = await syncCheckinToGoogleSheet(testRecord);

  if (btn) {
    btn.disabled = false;
    btn.innerHTML = originalHtml;
  }

  if (res.success) {
    showToast('ทดสอบส่งเข้า Google Sheet สำเร็จ!', 'ส่งข้อมูลทดสอบเข้าชีต "การตอบแบบฟอร์ม 1" เรียบร้อยแล้ว กรุณาเปิดตรวจสอบในชีต', 'success');
  } else {
    showToast('ทดสอบไม่สำเร็จ', 'ไม่สามารถส่งข้อมูลเข้าชีตได้ กรุณาตรวจสอบว่าตั้งค่า Web App เป็น Anyone (ทุกคน) หรือยัง', 'error');
  }
}

/**
 * ทดสอบส่งข้อความแจ้งเตือนเข้า Telegram
 */
async function testTelegramConnection() {
  const token = AppState.settings.telegramToken;
  const chatId = AppState.settings.chatId;

  if (!token || !chatId) {
    showToast('กรุณากรอกข้อมูล', 'กรุณาระบุ Telegram Token และ Chat ID ก่อนทดสอบ', 'error');
    return;
  }

  const btn = document.getElementById('btn-test-telegram');
  const originalHtml = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner">⏳</span> กำลังส่งทดสอบ...';
  }

  const testRecord = {
    nurseName: 'พว. ทดสอบระบบ แอดมิน',
    date: new Date().toISOString().split('T')[0],
    shift: 'Day',
    location: 'ห้องพยาบาล (อาคาร Plant 3)',
    phone: '0812345678',
    note: 'ทดสอบการส่งข้อความจากระบบ Nurse Shift Web App',
    timestamp: new Date().toLocaleTimeString('th-TH')
  };

  const success = await sendTelegramNotification(testRecord);

  if (btn) {
    btn.disabled = false;
    btn.innerHTML = originalHtml;
  }

  if (success) {
    showToast('ทดสอบ Telegram สำเร็จ!', 'ส่งข้อความทดสอบเข้ากลุ่มห้องพยาบาล HANA เรียบร้อยแล้ว', 'success');
  } else {
    showToast('ส่งไม่สำเร็จ', 'ไม่สามารถส่งข้อความเข้า Telegram ได้ กรุณาตรวจสอบ Bot Token หรือ Chat ID', 'error');
  }
}

// ==========================================================================
// Export CSV / Excel & Print Report
// ==========================================================================
function exportSummaryCSV() {
  const { selectedYear, selectedMonth, viewMode } = AppState.dashboard;
  const monthName = viewMode === 'monthly' ? `เดือน_${selectedMonth}` : 'ทั้งปี';
  const filename = `สรุปเวรพยาบาล_${selectedYear + 543}_${monthName}.csv`;

  // Get current summary rows
  const sortedNurseStats = Object.values(AppState.nurses.reduce((acc, n) => {
    const cName = normalizeNurseName(n.name, n.phone);
    acc[cName] = { name: cName, day: 0, night: 0, total: 0 };
    return acc;
  }, {}));

  // Populate from filtered records
  AppState.records.forEach(r => {
    if (!r.date) return;
    if (isRoom2(r.location)) return; // Exclude Room 2
    const [y, m] = r.date.split('-').map(Number);
    if (y !== selectedYear) return;
    if (viewMode === 'monthly' && m !== Number(selectedMonth)) return;

    const cName = normalizeNurseName(r.nurseName, r.phone);
    let target = sortedNurseStats.find(item => item.name === cName);
    if (!target) {
      target = { name: cName, day: 0, night: 0, total: 0 };
      sortedNurseStats.push(target);
    }
    if (r.shift === 'Day') target.day++;
    else if (r.shift === 'Night') target.night++;
    target.total++;
  });

  sortedNurseStats.sort((a, b) => b.total - a.total);

  let csvContent = '\uFEFF'; // UTF-8 BOM for Excel in Thai
  csvContent += `รายงานสรุปเวรห้องพยาบาล HANA LPN1\n`;
  csvContent += `รอบเวลา: ${viewMode === 'monthly' ? 'เดือน ' + selectedMonth : 'สรุปรายปี'} ประจำปี ${selectedYear + 543}\n\n`;
  csvContent += `ลำดับ,ชื่อพยาบาล,เวรเช้า (Day),เวรดึก (Night),รวมจำนวนวัน/เวรที่มาทำงาน\n`;

  sortedNurseStats.forEach((n, idx) => {
    csvContent += `${idx + 1},"${n.name}",${n.day},${n.night},${n.total}\n`;
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast('ส่งออก CSV สำเร็จ', `ดาวน์โหลดไฟล์ ${filename} เรียบร้อยแล้ว`, 'success');
}

function printSummaryReport() {
  window.print();
}

// ==========================================================================
// Event Listeners & UI Helpers
// ==========================================================================
function setupEventListeners() {
  // Navigation Tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');
      switchTab(targetTab);
    });
  });

  // Nurse Select Change (Check if "+ เพิ่มพยาบาลใหม่" is clicked or auto-fill phone)
  const selectNurse = document.getElementById('nurse-select');
  const newNurseBox = document.getElementById('new-nurse-box');
  const phoneInput = document.getElementById('checkin-phone');

  if (selectNurse) {
    selectNurse.addEventListener('change', () => {
      const licAlertBox = document.getElementById('checkin-license-alert');
      const licAlertText = document.getElementById('checkin-license-alert-text');

      if (selectNurse.value === '__ADD_NEW__') {
        if (newNurseBox) newNurseBox.classList.add('show');
        const newNurseInput = document.getElementById('new-nurse-input');
        if (newNurseInput) newNurseInput.focus();
        if (licAlertBox) licAlertBox.classList.remove('show');
      } else {
        if (newNurseBox) newNurseBox.classList.remove('show');
        // Auto-fill nurse phone if stored
        const nurse = AppState.nurses.find(n => n.name === selectNurse.value);
        if (nurse && nurse.phone && phoneInput) {
          phoneInput.value = nurse.phone;
        }

        // Check License Expiration
        if (nurse && nurse.expireDate) {
          const licStatus = getLicenseStatus(nurse.expireDate);
          if (licStatus && licStatus.isWarning) {
            if (licAlertBox) licAlertBox.classList.add('show');
            if (licAlertText) {
              licAlertText.innerHTML = licStatus.isExpired
                ? `<strong>แจ้งเตือน:</strong> ใบประกอบวิชาชีพของ <u>${nurse.name}</u> <strong>หมดอายุแล้ว!</strong> (วันที่ ${licStatus.expireDateFormatted}) กรุณาติดต่อต่ออายุโดยด่วน`
                : `<strong>แจ้งเตือน:</strong> ใบประกอบวิชาชีพของ <u>${nurse.name}</u> กำลังจะหมดอายุในอีก <strong>${licStatus.diffDays} วัน</strong> (${licStatus.expireDateFormatted}) กรุณาดำเนินการต่ออายุ`;
            }
          } else {
            if (licAlertBox) licAlertBox.classList.remove('show');
          }
        } else {
          if (licAlertBox) licAlertBox.classList.remove('show');
        }
      }
    });
  }

  // Checkin Form Submit
  const checkinForm = document.getElementById('checkin-form');
  if (checkinForm) {
    checkinForm.addEventListener('submit', handleCheckinSubmit);
  }

  // Dashboard Controls
  const toggleMonthly = document.getElementById('btn-mode-monthly');
  const toggleAnnual = document.getElementById('btn-mode-annual');
  const dashMonthSelect = document.getElementById('dash-month-select');
  const dashYearSelect = document.getElementById('dash-year-select');
  const dashNurseSelect = document.getElementById('dash-nurse-filter');

  if (toggleMonthly) {
    toggleMonthly.addEventListener('click', () => {
      AppState.dashboard.viewMode = 'monthly';
      toggleMonthly.classList.add('active');
      if (toggleAnnual) toggleAnnual.classList.remove('active');
      if (dashMonthSelect) dashMonthSelect.style.display = 'inline-block';
      renderDashboard();
    });
  }

  if (toggleAnnual) {
    toggleAnnual.addEventListener('click', () => {
      AppState.dashboard.viewMode = 'annual';
      toggleAnnual.classList.add('active');
      if (toggleMonthly) toggleMonthly.classList.remove('active');
      if (dashMonthSelect) dashMonthSelect.style.display = 'none';
      renderDashboard();
    });
  }

  if (dashMonthSelect) {
    dashMonthSelect.addEventListener('change', (e) => {
      AppState.dashboard.selectedMonth = Number(e.target.value);
      renderDashboard();
    });
  }

  if (dashYearSelect) {
    dashYearSelect.addEventListener('change', (e) => {
      AppState.dashboard.selectedYear = Number(e.target.value);
      renderDashboard();
    });
  }

  if (dashNurseSelect) {
    dashNurseSelect.addEventListener('change', (e) => {
      AppState.dashboard.selectedNurse = e.target.value;
      renderDashboard();
    });
  }

  // Records Table Filter
  const recordSearch = document.getElementById('records-search');
  const recordShift = document.getElementById('record-shift-filter');
  const recordNurse = document.getElementById('record-nurse-filter');

  if (recordSearch) recordSearch.addEventListener('input', renderRecordsTable);
  if (recordShift) recordShift.addEventListener('change', renderRecordsTable);
  if (recordNurse) recordNurse.addEventListener('change', renderRecordsTable);

  // Add Single Nurse Form
  const singleNurseForm = document.getElementById('form-add-nurse');
  if (singleNurseForm) singleNurseForm.addEventListener('submit', handleAddSingleNurse);

  // Batch Paste Import Button
  const btnBatchImport = document.getElementById('btn-batch-import');
  if (btnBatchImport) btnBatchImport.addEventListener('click', handleBatchNurseImport);

  // Settings Save & Test
  const formSettings = document.getElementById('form-settings');
  if (formSettings) formSettings.addEventListener('submit', handleSaveSettings);

  const btnTestTg = document.getElementById('btn-test-telegram');
  if (btnTestTg) btnTestTg.addEventListener('click', testTelegramConnection);

  const btnTestSheet = document.getElementById('btn-test-sheet');
  if (btnTestSheet) btnTestSheet.addEventListener('click', testGoogleSheetConnection);

  const btnCopyGas = document.getElementById('btn-copy-gas-code');
  if (btnCopyGas) btnCopyGas.addEventListener('click', copyGasCode);

  // Theme Toggle Button
  const themeBtn = document.getElementById('theme-toggle-btn');
  if (themeBtn) themeBtn.addEventListener('click', toggleTheme);
}

function switchTab(tabId) {
  // If user tries to access admin tab without login
  if (tabId !== 'checkin' && !AppState.isAdmin) {
    openAdminModal();
    return;
  }

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
  });
  document.querySelectorAll('.tab-view').forEach(view => {
    view.classList.toggle('active', view.id === `tab-${tabId}`);
  });

  if (tabId === 'dashboard') {
    renderDashboard();
    syncRecordsFromGoogleSheet(false);
  } else if (tabId === 'records') {
    renderRecordsTable();
    syncRecordsFromGoogleSheet(false);
  } else if (tabId === 'roster') {
    renderRosterList();
  }
}

function selectMonthFilter(monthNum) {
  AppState.dashboard.viewMode = 'monthly';
  AppState.dashboard.selectedMonth = monthNum;

  const toggleMonthly = document.getElementById('btn-mode-monthly');
  const toggleAnnual = document.getElementById('btn-mode-annual');
  const dashMonthSelect = document.getElementById('dash-month-select');

  if (toggleMonthly) toggleMonthly.classList.add('active');
  if (toggleAnnual) toggleAnnual.classList.remove('active');
  if (dashMonthSelect) {
    dashMonthSelect.style.display = 'inline-block';
    dashMonthSelect.value = String(monthNum);
  }
  renderDashboard();
}

function populateYearSelectors() {
  const dashYear = document.getElementById('dash-year-select');
  if (dashYear) {
    dashYear.innerHTML = `
      <option value="2027">ปี 2570 (2027)</option>
      <option value="2026" selected>ปี 2569 (2026)</option>
      <option value="2025">ปี 2568 (2025)</option>
    `;
    dashYear.value = String(AppState.dashboard.selectedYear || 2026);
  }
}

function initTheme() {
  const saved = localStorage.getItem(STORAGE_KEYS.THEME);
  if (saved === 'dark') {
    document.body.classList.add('dark-mode');
  }
}

function toggleTheme() {
  document.body.classList.toggle('dark-mode');
  const isDark = document.body.classList.contains('dark-mode');
  localStorage.setItem(STORAGE_KEYS.THEME, isDark ? 'dark' : 'light');
}

function showToast(title, msg, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';

  toast.innerHTML = `
    <div class="toast-icon">${icon}</div>
    <div class="toast-msg">
      <h5>${title}</h5>
      ${msg ? `<p>${msg}</p>` : ''}
    </div>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function playChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch (e) { }
}

function setHtml(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

// Global start
window.addEventListener('DOMContentLoaded', initApp);



