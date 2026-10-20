import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const htmlContent = `
<!DOCTYPE html>
<html lang="am">
<head>
<meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Ethiopic:wght@400;500;600;700&display=swap');
  
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    font-family: 'Noto Sans Ethiopic', 'Segoe UI', Arial, sans-serif;
  }
  
  body {
    background: #ffffff;
    padding: 24px 30px;
    width: 1060px;
    color: #1e293b;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 8px;
  }

  .title-am {
    font-size: 26px;
    font-weight: 700;
    color: #0f172a;
    letter-spacing: -0.3px;
    margin-bottom: 4px;
  }

  .title-en {
    font-size: 19px;
    font-weight: 700;
    color: #0284c7;
    margin-bottom: 12px;
  }

  .accent-line {
    height: 3px;
    background: #0ea5e9;
    width: 100%;
    margin-bottom: 20px;
  }

  .date-box {
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    padding: 8px 16px;
    text-align: right;
    font-size: 14px;
    color: #334155;
    background: #f8fafc;
  }

  .date-box b {
    color: #0f172a;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 16px;
    margin-bottom: 22px;
  }

  .stat-card {
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 12px 18px;
    background: #ffffff;
  }

  .stat-card.blue {
    border-left: 5px solid #0284c7;
  }
  .stat-card.green {
    border-left: 5px solid #16a34a;
  }
  .stat-card.amber {
    border-left: 5px solid #f59e0b;
  }

  .stat-label {
    font-size: 12px;
    font-weight: 600;
    color: #64748b;
    text-transform: uppercase;
    margin-bottom: 4px;
  }

  .stat-val {
    font-size: 26px;
    font-weight: 800;
    color: #0f172a;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13.5px;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    overflow: hidden;
  }

  thead {
    background: #0b192c;
    color: #ffffff;
  }

  th {
    padding: 11px 12px;
    text-align: left;
    font-weight: 600;
    font-size: 13px;
    border-right: 1px solid #1e293b;
  }

  th:last-child {
    border-right: none;
  }

  tbody tr {
    border-bottom: 1px solid #e2e8f0;
  }

  tbody tr:nth-child(even) {
    background: #f8fafc;
  }

  td {
    padding: 9.5px 12px;
    vertical-align: middle;
    border-right: 1px solid #e2e8f0;
    color: #1e293b;
  }

  td:last-child {
    border-right: none;
  }

  .col-num {
    font-weight: 700;
    text-align: center;
    width: 40px;
    color: #0f172a;
  }

  .col-name {
    font-weight: 600;
    color: #0f172a;
  }

  .col-phone {
    font-family: 'Segoe UI', monospace;
    font-weight: 500;
    color: #334155;
  }

  .badge-proxy {
    display: inline-block;
    padding: 2px 10px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 600;
    background: #f1f5f9;
    color: #475569;
    border: 1px solid #cbd5e1;
  }

  .badge-direct {
    display: inline-block;
    padding: 2px 10px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 600;
    background: #f0f9ff;
    color: #0284c7;
    border: 1px solid #bae6fd;
  }

  .badge-approved {
    display: inline-block;
    padding: 2px 10px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 700;
    background: #f0fdf4;
    color: #16a34a;
    border: 1px solid #bbf7d0;
  }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="title-am">የሳንኮራ ከተማ የመኖሪያ ቤት መሬት ምዝገባ</div>
      <div class="title-en">Sankora Town Residential Land Registration - Official Members List</div>
    </div>
    <div class="date-box">
      <div><b>ቀን (Date):</b> 19/10/2026</div>
      <div style="font-size: 12px; color: #64748b; margin-top: 2px;"><b>ሁኔታ:</b> የተሻሻለ (Updated)</div>
    </div>
  </div>

  <div class="accent-line"></div>

  <div class="stats-grid">
    <div class="stat-card blue">
      <div class="stat-label">ጠቅላላ አባላት (TOTAL)</div>
      <div class="stat-val">16</div>
    </div>
    <div class="stat-card green">
      <div class="stat-label">የጸደቁ (APPROVED)</div>
      <div class="stat-val">16</div>
    </div>
    <div class="stat-card amber">
      <div class="stat-label">በመጠባበቅ ላይ (PENDING)</div>
      <div class="stat-val">0</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 36px; text-align: center;">#</th>
        <th>ሙሉ ስም (Full Name)</th>
        <th>ስልክ ቁጥር (Phone)</th>
        <th>የመኖሪያ ቦታ (Location)</th>
        <th>የስራ ዘርፍ / ሙያ (Occupation)</th>
        <th style="width: 75px; text-align: center;">ዓይነት</th>
        <th style="width: 85px; text-align: center;">ሁኔታ</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="col-num">1</td>
        <td class="col-name">Melese Hora</td>
        <td class="col-phone">0945747650</td>
        <td>Asossa</td>
        <td>የመንግስት ሰራተኛ</td>
        <td style="text-align: center;"><span class="badge-proxy">Proxy</span></td>
        <td style="text-align: center;"><span class="badge-approved">የጸደቀ</span></td>
      </tr>
      <tr>
        <td class="col-num">2</td>
        <td class="col-name">Yeshiwas Tefera</td>
        <td class="col-phone">+251941372261</td>
        <td>G/beles</td>
        <td>PIANG</td>
        <td style="text-align: center;"><span class="badge-proxy">Proxy</span></td>
        <td style="text-align: center;"><span class="badge-approved">የጸደቀ</span></td>
      </tr>
      <tr>
        <td class="col-num">3</td>
        <td class="col-name">Teshal Girma Ejita</td>
        <td class="col-phone">+251930921986</td>
        <td>Adis Ababa</td>
        <td>የመንግስት ሰራተኛ</td>
        <td style="text-align: center;"><span class="badge-proxy">Proxy</span></td>
        <td style="text-align: center;"><span class="badge-approved">የጸደቀ</span></td>
      </tr>
      <tr>
        <td class="col-num">4</td>
        <td class="col-name">ቃበኛ ግርማው ያደታ</td>
        <td class="col-phone">+251919239810</td>
        <td>አዲስ አበባ ለሚ 02</td>
        <td>የመንግስት ሰራተኛ</td>
        <td style="text-align: center;"><span class="badge-direct">Direct</span></td>
        <td style="text-align: center;"><span class="badge-approved">የጸደቀ</span></td>
      </tr>
      <tr>
        <td class="col-num">5</td>
        <td class="col-name">ጉድና ብሩ ዳኖ</td>
        <td class="col-phone">0937697249</td>
        <td>ደብረ ገራቻ</td>
        <td>የግል ድርጅት ተቀጣሪ</td>
        <td style="text-align: center;"><span class="badge-proxy">Proxy</span></td>
        <td style="text-align: center;"><span class="badge-approved">የጸደቀ</span></td>
      </tr>
      <tr>
        <td class="col-num">6</td>
        <td class="col-name">Adissu Hika Jaleta</td>
        <td class="col-phone">+251902788557</td>
        <td>AA</td>
        <td>የግል ድርጅት ተቀጣሪ</td>
        <td style="text-align: center;"><span class="badge-direct">Direct</span></td>
        <td style="text-align: center;"><span class="badge-approved">የጸደቀ</span></td>
      </tr>
      <tr>
        <td class="col-num">7</td>
        <td class="col-name">Bejidhu Chaka Merdasa</td>
        <td class="col-phone">+251919108191</td>
        <td>Asossa</td>
        <td>የመንግስት ሰራተኛ</td>
        <td style="text-align: center;"><span class="badge-proxy">Proxy</span></td>
        <td style="text-align: center;"><span class="badge-approved">የጸደቀ</span></td>
      </tr>
      <tr>
        <td class="col-num">8</td>
        <td class="col-name">Ayane Chaka Merdasa</td>
        <td class="col-phone">+251926532821</td>
        <td>Asossa</td>
        <td>የመንግስት ሰራተኛ</td>
        <td style="text-align: center;"><span class="badge-proxy">Proxy</span></td>
        <td style="text-align: center;"><span class="badge-approved">የጸደቀ</span></td>
      </tr>
      <tr>
        <td class="col-num">9</td>
        <td class="col-name">Teshal Girma Ejita</td>
        <td class="col-phone">+251930921986</td>
        <td>Sheger City, Mizan</td>
        <td>የመንግስት ሰራተኛ</td>
        <td style="text-align: center;"><span class="badge-proxy">Proxy</span></td>
        <td style="text-align: center;"><span class="badge-approved">የጸደቀ</span></td>
      </tr>
      <tr>
        <td class="col-num">10</td>
        <td class="col-name">አዓይኑኝ አበበ ብርሃኑ</td>
        <td class="col-phone">+251921985213</td>
        <td>ወልቂጤ ከተማ</td>
        <td>የመንግስት ሰራተኛ</td>
        <td style="text-align: center;"><span class="badge-proxy">Proxy</span></td>
        <td style="text-align: center;"><span class="badge-approved">የጸደቀ</span></td>
      </tr>
      <tr>
        <td class="col-num">11</td>
        <td class="col-name">ብርቱካን ግርማ አብርሃኑ</td>
        <td class="col-phone">+251918690481</td>
        <td>አዲስ አበባ, ለሚ ኩራ</td>
        <td>የመንግስት ሰራተኛ</td>
        <td style="text-align: center;"><span class="badge-proxy">Proxy</span></td>
        <td style="text-align: center;"><span class="badge-approved">የጸደቀ</span></td>
      </tr>
      <tr>
        <td class="col-num">12</td>
        <td class="col-name">ለማ ዋጅራ እንሴኔ</td>
        <td class="col-phone">+251978023425</td>
        <td>አዲስ አበባ ለሚ ኩራ 14</td>
        <td>የመንግስት ሰራተኛ</td>
        <td style="text-align: center;"><span class="badge-direct">Direct</span></td>
        <td style="text-align: center;"><span class="badge-approved">የጸደቀ</span></td>
      </tr>
      <tr>
        <td class="col-num">13</td>
        <td class="col-name">እፍሬም ግርማ አብርሃኑ</td>
        <td class="col-phone">+251937001239</td>
        <td>አዲስ አበባ, ለሚ ኩራ</td>
        <td>ተማሪ</td>
        <td style="text-align: center;"><span class="badge-direct">Direct</span></td>
        <td style="text-align: center;"><span class="badge-approved">የጸደቀ</span></td>
      </tr>
      <tr>
        <td class="col-num">14</td>
        <td class="col-name">Ambisa Girma Ejita</td>
        <td class="col-phone">+251919110619</td>
        <td>S.W. Shawa/Soddo</td>
        <td>Bank</td>
        <td style="text-align: center;"><span class="badge-direct">Direct</span></td>
        <td style="text-align: center;"><span class="badge-approved">የጸደቀ</span></td>
      </tr>
      <tr>
        <td class="col-num">15</td>
        <td class="col-name">ዳዊት ብሩ ፍቃዱ</td>
        <td class="col-phone">+251919241249</td>
        <td>አዲስ አበባ</td>
        <td>የመንግስት ሰራተኛ</td>
        <td style="text-align: center;"><span class="badge-proxy">Proxy</span></td>
        <td style="text-align: center;"><span class="badge-approved">የጸደቀ</span></td>
      </tr>
      <tr>
        <td class="col-num">16</td>
        <td class="col-name">አዱኛ ግርማው ያደታ</td>
        <td class="col-phone">+251903137319</td>
        <td>አዲስ አበባ ጉለሌ 08</td>
        <td>የመንግስት ሰራተኛ</td>
        <td style="text-align: center;"><span class="badge-direct">Direct</span></td>
        <td style="text-align: center;"><span class="badge-approved">የጸደቀ</span></td>
      </tr>
    </tbody>
  </table>
</body>
</html>
`;

async function generate() {
  const publicDir = path.join(process.cwd(), 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1060, height: 1180 } });

  await page.setContent(htmlContent, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  const outputPath = path.join(publicDir, 'official_approved_members_list.png');
  await page.screenshot({ path: outputPath, fullPage: true });

  await browser.close();
  console.log('Generated approved list image at:', outputPath);
}

generate().catch(err => {
  console.error('Failed to generate image:', err);
  process.exit(1);
});
