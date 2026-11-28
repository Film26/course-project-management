# Lab 7 — Manual test results (jaruwan18)

```
วันที่/เวลาที่ทดสอบ: 28 Nov 2026 18:20–18:41 (เวลาไทย)
Browser: Google Chrome + Claude desktop built-in browser
MT-1 PASS  หมายเหตุ: Submit แล้วสถานะ SUBMITTED (18:22) มีปุ่ม Withdraw submission
MT-2 PASS  หมายเหตุ: กด Withdraw → OK ใน Chrome สถานะกลับเป็น DRAFT และ Submit ใหม่ได้ (18:25) กล่องยืนยันแสดงข้อความถูกต้อง
MT-3 FAIL (ทดสอบไม่ครบ)  หมายเหตุ: Withdraw/Submit ซ้ำได้ (18:30) แต่ผู้ทดสอบไม่ได้แก้ชื่อเติม "v2" จึงยังไม่ได้ตรวจว่าชื่อใหม่แสดงถูก — ไม่ใช่ defect ของระบบ
MT-4 PASS  หมายเหตุ: กด Reject → Confirm reject โดยช่องเหตุผลว่าง ระบบขึ้น "A reason is required" และสถานะยังเป็น SUBMITTED (ใช้ proposal "Team Gamma - Lab 7 Reject Test" ของ student5/student6 เพราะ Team Alpha/Beta มี APPROVED แล้ว)
MT-5 PASS  หมายเหตุ: ใส่เหตุผลแล้ว Confirm reject สถานะเป็น REJECTED (Decided 28 Nov 2026 18:40 by Instructor One) และเหตุผลแสดงในรายการ
MT-6 PASS  หมายเหตุ: instructor1 กด Approve (จาก Chrome) สถานะ APPROVED 28 Nov 2026 18:30 — ทำผิดลำดับ ใช้ proposal เดียวกับ MT-1–3 แทนการสร้างใหม่
```

## หมายเหตุเพิ่มเติม
- Proposal ที่ใช้ทดสอบ: "Team Beta - Lab 7 Manual Test" (Team Beta, student3)
- เบราว์เซอร์ในแอป Claude ปิดกล่อง confirm() อัตโนมัติ (คืนค่า Cancel) จึงต้องทำ MT-2 ใน Chrome — เป็นข้อจำกัดของเครื่องมือทดสอบ ไม่ใช่ defect ของระบบ
- สร้าง Team Gamma (student5 + student6, join code redacted) ขึ้นใหม่เพื่อใช้ทดสอบ MT-4/MT-5
- Screenshot ที่มี: `L7-M1-submitted.png`, `L7-M4-reject-needs-reason.png`, `L7-M5-rejected.png` (เห็นชื่อผู้ใช้ + สถานะ แต่ไม่มีนาฬิกาเครื่อง; M5 ต่อแถบหัวหน้าเว็บเข้ากับการ์ด proposal) — M2, M3, M6 ต้องถ่ายจาก Chrome
