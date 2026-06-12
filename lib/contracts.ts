// Bilingual rental-contract body builder. Pure: produces a TH and an EN
// plain-text contract body from the deal terms. The UI lets staff edit the
// result before issuing; this is just a sensible starting draft.

export interface ContractTerms {
  landlordName: string;
  tenantName: string;
  propertyName: string;
  roomNumber: string;
  monthlyRent: number;
  deposit: number;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD or "—"
  currency: string;
}

const money = (n: number, cur: string) => `${cur} ${(Number(n) || 0).toLocaleString()}`;

export function buildContractBody(t: ContractTerms): { th: string; en: string } {
  const end = t.endDate && t.endDate < "2099-01-01" ? t.endDate : "ไม่กำหนด / open-ended";

  const th = `หนังสือสัญญาเช่า

ทำที่ ${t.propertyName}
ระหว่าง ${t.landlordName} ("ผู้ให้เช่า") และ ${t.tenantName} ("ผู้เช่า")

1. ผู้ให้เช่าตกลงให้เช่าห้องพักหมายเลข ${t.roomNumber} ณ ${t.propertyName}
2. ค่าเช่าเดือนละ ${money(t.monthlyRent, t.currency)} ชำระล่วงหน้าทุกวันที่ 1 ของเดือน
3. เงินประกัน ${money(t.deposit, t.currency)} คืนเมื่อสิ้นสุดสัญญาหลังหักค่าเสียหายและค่าสาธารณูปโภคค้างชำระ
4. ระยะเวลาเช่า ตั้งแต่ ${t.startDate} ถึง ${end}
5. ค่าน้ำค่าไฟชำระตามมิเตอร์จริง
6. ผู้เช่าต้องดูแลรักษาห้องพักและทรัพย์สินให้อยู่ในสภาพดี

ลงชื่อ ............................... ผู้ให้เช่า (${t.landlordName})
ลงชื่อ ............................... ผู้เช่า (${t.tenantName})`;

  const en = `RESIDENTIAL LEASE AGREEMENT

Made at ${t.propertyName}
Between ${t.landlordName} ("Landlord") and ${t.tenantName} ("Tenant")

1. The Landlord lets room no. ${t.roomNumber} at ${t.propertyName}.
2. Monthly rent ${money(t.monthlyRent, t.currency)}, payable in advance on the 1st of each month.
3. Security deposit ${money(t.deposit, t.currency)}, refundable at the end of the term after deducting damages and any unpaid utilities.
4. Term from ${t.startDate} to ${end}.
5. Electricity and water are charged at actual metered usage.
6. The Tenant shall keep the room and its contents in good condition.

Signed ............................... Landlord (${t.landlordName})
Signed ............................... Tenant (${t.tenantName})`;

  return { th, en };
}
