# ระบบงานหน่วยพัฒนาสื่อมัลติมีเดีย (PSU Dentistry)

เว็บแอปส่วนตัวสำหรับจัดการงานสื่อมัลติมีเดียครบวงจร:
- 📋 คำขอใช้บริการ + นำเข้าจากชีทหลัก
- 🕒 บันทึกงานย้อนหลัง
- 🔧 ครุภัณฑ์ + ยืม-คืน + ประวัติสถานะ
- 🎬 คลังผลงานวิดีโอ
- 📅 Dashboard พร้อมปฏิทินและแจ้งเตือนอัตโนมัติ
- 🔐 Login + RBAC (admin/user) + Audit Log
- ☁️ Sync กับ Filen Cloud (E2EE)

## พัฒนา
npm install
npm run dev

## Deploy GitHub Pages
1. push ขึ้น repo สาธารณะ
2. Settings > Pages > Source: GitHub Actions
3. เปิด URL ที่ได้
4. สร้างแอดมินคนแรก หรือเชื่อม Filen ดึงข้อมูลเดิม

## เทคโนโลยี
- React 18 + TypeScript + Vite
- @filen/sdk (E2EE cloud storage)
- LocalStorage + IndexedDB