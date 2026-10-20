import type { RegistrationRecordPure } from './registrationUtils';

interface MemberForPDF {
  id: string;
  fullName: string;
  phoneNumber: string;
  livingPlace: string;
  occupation: string;
  verificationStatus: string;
  isProxyRegistration?: boolean;
  registeredByName?: string;
}

export async function exportRecordsToPDF(
  records: MemberForPDF[],
  options?: {
    filename?: string;
    title?: string;
  }
): Promise<void> {
  if (typeof window === 'undefined') return;

  const { jsPDF } = await import('jspdf');

  const itemsPerPage = 14;
  const totalPages = Math.ceil(records.length / itemsPerPage) || 1;
  const doc = new jsPDF('l', 'mm', 'a4'); // Landscape A4: 297mm x 210mm

  // Ensure font is ready
  if (document.fonts) {
    try {
      await document.fonts.ready;
    } catch {}
  }

  // Canvas resolution for crisp 200+ DPI print output
  const canvasWidth = 2376; // ~297mm at 200 DPI
  const canvasHeight = 1680; // ~210mm at 200 DPI

  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context not available');
  }

  const dateStr = new Date().toLocaleDateString('am-ET');
  const approvedCount = records.filter((r) => r.verificationStatus === 'Approved').length;
  const pendingCount = records.filter(
    (r) => r.verificationStatus === 'Pending Approval' || r.verificationStatus === 'Pending'
  ).length;

  for (let page = 0; page < totalPages; page++) {
    // Clear canvas
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Top decorative bar
    const grad = ctx.createLinearGradient(0, 0, canvasWidth, 0);
    grad.addColorStop(0, '#059669');
    grad.addColorStop(0.5, '#0284c7');
    grad.addColorStop(1, '#4f46e5');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvasWidth, 18);

    // Header Background Card
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(60, 40, canvasWidth - 120, 150);
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 2;
    ctx.strokeRect(60, 40, canvasWidth - 120, 150);

    // Title & Emblems
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 38px "Noto Sans Ethiopic", "Segoe UI", sans-serif';
    ctx.fillText('የሳንኮራ ከተማ የመኖሪያ ቤት መሬት ምዝገባ', 90, 95);

    ctx.fillStyle = '#475569';
    ctx.font = '22px "Noto Sans Ethiopic", "Segoe UI", sans-serif';
    ctx.fillText('Sankora Town Residential Land Registration • የተመዘገቡ አባላት ይፋዊ ማውጫ', 90, 130);

    // Metadata Badges (Right side)
    ctx.fillStyle = '#334155';
    ctx.font = 'bold 20px "Noto Sans Ethiopic", "Segoe UI", sans-serif';
    ctx.fillText(`ቀን፦ ${dateStr}`, canvasWidth - 450, 85);
    ctx.fillText(`ጠቅላላ አባላት፦ ${records.length}`, canvasWidth - 450, 115);
    ctx.font = '18px "Noto Sans Ethiopic", "Segoe UI", sans-serif';
    ctx.fillText(`✅ የጸደቁ፦ ${approvedCount}  |  ⏳ በመጠባበቅ ላይ፦ ${pendingCount}`, canvasWidth - 450, 145);

    // Table Header
    const tableTop = 220;
    const rowHeight = 75;
    const colX = [60, 140, 560, 900, 1340, 1720, 1980, canvasWidth - 60];
    // Columns:
    // 0: # (60-140)
    // 1: Full Name (140-560)
    // 2: Phone Number (560-900)
    // 3: Living Place (900-1340)
    // 4: Occupation (1340-1720)
    // 5: Type (1720-1980)
    // 6: Status (1980 to canvasWidth - 60)

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(60, tableTop, canvasWidth - 120, 55);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px "Noto Sans Ethiopic", "Segoe UI", sans-serif';
    ctx.fillText('#', colX[0] + 25, tableTop + 36);
    ctx.fillText('ሙሉ ስም (Full Name)', colX[1] + 20, tableTop + 36);
    ctx.fillText('ስልክ ቁጥር (Phone)', colX[2] + 20, tableTop + 36);
    ctx.fillText('የመኖሪያ ቦታ (Location)', colX[3] + 20, tableTop + 36);
    ctx.fillText('የስራ ዘርፍ / ሙያ (Occupation)', colX[4] + 20, tableTop + 36);
    ctx.fillText('ዓይነት (Type)', colX[5] + 15, tableTop + 36);
    ctx.fillText('ሁኔታ (Status)', colX[6] + 25, tableTop + 36);

    // Rows
    const pageRecords = records.slice(page * itemsPerPage, (page + 1) * itemsPerPage);
    let currentY = tableTop + 55;

    pageRecords.forEach((r, idx) => {
      const globalIdx = page * itemsPerPage + idx + 1;
      const isEven = idx % 2 === 0;

      // Row background
      ctx.fillStyle = isEven ? '#ffffff' : '#f8fafc';
      ctx.fillRect(60, currentY, canvasWidth - 120, rowHeight);

      // Bottom border
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(60, currentY + rowHeight);
      ctx.lineTo(canvasWidth - 60, currentY + rowHeight);
      ctx.stroke();

      // Row Text
      ctx.fillStyle = '#64748b';
      ctx.font = '18px "Noto Sans Ethiopic", "Segoe UI", sans-serif';
      ctx.fillText(String(globalIdx), colX[0] + 25, currentY + 45);

      // Full Name
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 20px "Noto Sans Ethiopic", "Segoe UI", sans-serif';
      const nameText = r.fullName || '—';
      ctx.fillText(nameText.length > 25 ? nameText.slice(0, 24) + '...' : nameText, colX[1] + 20, currentY + 45);

      // Phone
      ctx.fillStyle = '#334155';
      ctx.font = '19px "Noto Sans Ethiopic", "Segoe UI", monospace';
      ctx.fillText(r.phoneNumber || '—', colX[2] + 20, currentY + 45);

      // Living Place
      ctx.fillStyle = '#1e293b';
      ctx.font = '19px "Noto Sans Ethiopic", "Segoe UI", sans-serif';
      const placeText = r.livingPlace || '—';
      ctx.fillText(placeText.length > 26 ? placeText.slice(0, 25) + '...' : placeText, colX[3] + 20, currentY + 45);

      // Occupation
      ctx.fillStyle = '#334155';
      const occText = r.occupation || '—';
      ctx.fillText(occText.length > 24 ? occText.slice(0, 23) + '...' : occText, colX[4] + 20, currentY + 45);

      // Type Badge
      if (r.isProxyRegistration) {
        ctx.fillStyle = '#fef3c7';
        ctx.fillRect(colX[5] + 10, currentY + 18, 180, 38);
        ctx.fillStyle = '#92400e';
        ctx.font = 'bold 16px "Noto Sans Ethiopic", "Segoe UI", sans-serif';
        ctx.fillText('በጓደኛ (Proxy)', colX[5] + 28, currentY + 43);
      } else {
        ctx.fillStyle = '#e0f2fe';
        ctx.fillRect(colX[5] + 10, currentY + 18, 160, 38);
        ctx.fillStyle = '#0369a1';
        ctx.font = 'bold 16px "Noto Sans Ethiopic", "Segoe UI", sans-serif';
        ctx.fillText('በራሱ (Direct)', colX[5] + 25, currentY + 43);
      }

      // Status Pill
      const isApproved = r.verificationStatus === 'Approved';
      const isRejected = r.verificationStatus === 'Rejected';
      const statusBg = isApproved ? '#dcfce7' : isRejected ? '#ffe4e6' : '#fef3c7';
      const statusText = isApproved ? '✅ የጸደቀ' : isRejected ? '❌ ውድቅ' : '⏳ በመጠባበቅ';
      const statusColor = isApproved ? '#15803d' : isRejected ? '#b91c1c' : '#b45309';

      ctx.fillStyle = statusBg;
      ctx.fillRect(colX[6] + 15, currentY + 18, 180, 38);
      ctx.fillStyle = statusColor;
      ctx.font = 'bold 17px "Noto Sans Ethiopic", "Segoe UI", sans-serif';
      ctx.fillText(statusText, colX[6] + 30, currentY + 43);

      currentY += rowHeight;
    });

    // Outer table border
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(60, tableTop, canvasWidth - 120, 55 + pageRecords.length * rowHeight);

    // Footer
    const footerY = canvasHeight - 50;
    ctx.fillStyle = '#64748b';
    ctx.font = '16px "Noto Sans Ethiopic", "Segoe UI", sans-serif';
    ctx.fillText(
      'ይህ ሰነድ ከሳንኮራ የመኖሪያ ቤት መሬት ምዝገባ አስተዳደር (@Natananor) የተወሰደ ይፋዊ ሪፖርት ነው።',
      90,
      footerY
    );
    ctx.fillText(`ገጽ ${page + 1} ከ ${totalPages}`, canvasWidth - 220, footerY);

    // Add page to PDF
    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    if (page > 0) {
      doc.addPage();
    }
    doc.addImage(imgData, 'JPEG', 0, 0, 297, 210);
  }

  const filename =
    options?.filename || `Sankora_Land_Members_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}
