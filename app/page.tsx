'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { exportRecordsToPDF } from '@/lib/pdfExport';
import {
  Users,
  ShieldCheck,
  Send,
  Download,
  Search,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  FileSpreadsheet,
  Terminal,
  Database,
  Copy,
  Check,
  Clock,
  XCircle,
  FileText,
  Bell,
  Printer,
  Trash2,
  X,
  MessageSquare,
  AlertTriangle,
  History,
  Info,
} from 'lucide-react';

interface MemberRecord {
  id: string;
  fullName: string;
  phoneNumber: string;
  livingPlace: string;
  occupation: string;
  interestConfirmation: string;
  telegramUserId: string;
  telegramUsername?: string;
  isProxyRegistration?: boolean;
  registeredByTelegramId?: string;
  registeredByTelegramUsername?: string;
  registeredByName?: string;
  registrationDate: string;
  verificationStatus: 'Pending Approval' | 'Approved' | 'Rejected';
  approvedBy?: string;
}

interface WebhookData {
  url?: string;
  has_custom_certificate?: boolean;
  pending_update_count?: number;
  last_error_message?: string;
  last_error_date?: number;
}

interface NotificationLog {
  id: string;
  message: string;
  target: 'APPROVED' | 'ALL';
  sentCount: number;
  failedCount: number;
  totalTargeted: number;
  sentAt: string;
  sentBy?: string;
}

export default function HomePage() {
  const [records, setRecords] = useState<MemberRecord[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    direct: 0,
    proxy: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [webhookInfo, setWebhookInfo] = useState<WebhookData | null>(null);
  const [syncingWebhook, setSyncingWebhook] = useState(false);
  const [webhookMessage, setWebhookMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // PDF & Print States
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);

  // Notification Broadcast States
  const [showNotifyModal, setShowNotifyModal] = useState(false);
  const [notifyMessage, setNotifyMessage] = useState('');
  const [notifyTarget, setNotifyTarget] = useState<'APPROVED' | 'ALL'>('APPROVED');
  const [sendWithImage, setSendWithImage] = useState(false);
  const [sendingNotification, setSendingNotification] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [notificationLogs, setNotificationLogs] = useState<NotificationLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Registration Open/Closed (Time is Up) State
  const [registrationOpen, setRegistrationOpen] = useState(false);
  const [togglingRegistration, setTogglingRegistration] = useState(false);

  // Permanent Delete Modal State (avoids window.confirm in iframe)
  const [memberToDelete, setMemberToDelete] = useState<MemberRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Load records and webhook info safely
  const loadData = useCallback(async () => {
    try {
      const results = await Promise.allSettled([
        fetch('/api/admin/registrations', {
          cache: 'no-store',
          headers: { Accept: 'application/json' },
        }),
        fetch('/api/admin/webhook', {
          cache: 'no-store',
          headers: { Accept: 'application/json' },
        }),
        fetch('/api/admin/registration-status', {
          cache: 'no-store',
          headers: { Accept: 'application/json' },
        }),
      ]);

      if (results[0].status === 'fulfilled' && results[0].value.ok) {
        const regData = await results[0].value.json().catch(() => null);
        if (regData?.success) {
          setRecords(regData.records || []);
          setStats(
            regData.stats || {
              total: 0,
              pending: 0,
              approved: 0,
              rejected: 0,
              direct: 0,
              proxy: 0,
            }
          );
        }
      }

      if (results[1].status === 'fulfilled' && results[1].value.ok) {
        const whData = await results[1].value.json().catch(() => null);
        if (whData?.success) {
          setWebhookInfo(whData.webhookInfo);
        }
      }

      if (results[2].status === 'fulfilled' && results[2].value.ok) {
        const stData = await results[2].value.json().catch(() => null);
        if (typeof stData?.isOpen === 'boolean') {
          setRegistrationOpen(stData.isOpen);
        }
      }
    } catch {
      // Graceful fallback for iframe reloads
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleRegistrationStatus = async (newVal: boolean) => {
    setTogglingRegistration(true);
    try {
      const res = await fetch('/api/admin/registration-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isOpen: newVal }),
      });
      if (res.ok) {
        const data = await res.json();
        setRegistrationOpen(data.isOpen);
      }
    } catch (err) {
      console.error('Failed to toggle registration status:', err);
    } finally {
      setTogglingRegistration(false);
    }
  };

  const loadNotificationLogs = useCallback(async () => {
    setLoadingLogs(true);
    try {
      const res = await fetch('/api/admin/notify', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setNotificationLogs(data.logs || []);
        }
      }
    } catch (err) {
      console.warn('Error loading notification logs:', err);
    } finally {
      setLoadingLogs(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 100);
    const interval = setInterval(loadData, 30000); // 30s auto-refresh
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [loadData]);

  const handleStatusChange = async (id: string, newStatus: 'Approved' | 'Rejected') => {
    setUpdatingId(id);
    try {
      const res = await fetch('/api/admin/approval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus, adminName: 'Natananor' }),
      });
      if (res.ok) {
        await loadData();
      }
    } catch (err) {
      console.error('Error updating status:', err);
    } finally {
      setUpdatingId(null);
    }
  };

  const confirmPermanentDelete = async () => {
    if (!memberToDelete) return;
    setDeleting(true);
    try {
      const res = await fetch('/api/admin/approval', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: memberToDelete.id }),
      });
      if (res.ok) {
        setMemberToDelete(null);
        await loadData();
      }
    } catch (err) {
      console.error('Error deleting member:', err);
    } finally {
      setDeleting(false);
    }
  };

  // Direct High-Resolution Canvas PDF Export (preserves Ethiopic Unicode 100%)
  const handleExportPDF = async () => {
    try {
      setIsExportingPDF(true);
      await exportRecordsToPDF(filteredRecords, {
        filename: `Sankora_Land_Members_${new Date().toISOString().slice(0, 10)}.pdf`,
      });
    } catch (err) {
      console.error('Error generating PDF:', err);
      // Fallback to printable modal
      setShowPrintModal(true);
    } finally {
      setIsExportingPDF(false);
    }
  };

  // Send Broadcast Notification to Members
  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notifyMessage.trim()) return;

    setSendingNotification(true);
    setNotificationStatus(null);

    try {
      const res = await fetch('/api/admin/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: notifyMessage.trim(),
          target: notifyTarget,
          withImage: sendWithImage,
          adminName: 'Natananor',
        }),
      });

      const data = await res.json();
      if (data.success) {
        setNotificationStatus({
          type: 'success',
          text: `✅ ማሳወቂያው ለ ${data.sentCount} አባላት በተሳካ ሁኔታ ተልኳል${data.withImage ? ' (ከይፋዊ ሪፖርት ምስል ጋር)' : ''}! (የከሸፈ፦ ${data.failedCount || 0})`,
        });
        setNotifyMessage('');
        loadNotificationLogs();
      } else {
        setNotificationStatus({
          type: 'error',
          text: `❌ መልእክቱን መላክ አልተቻለም፦ ${data.error || 'ያልታወቀ ስህተት'}`,
        });
      }
    } catch (err: any) {
      setNotificationStatus({
        type: 'error',
        text: `❌ ስህተት ተከስቷል፦ ${err?.message || 'ኔትወርክ አላገናኝም'}`,
      });
    } finally {
      setSendingNotification(false);
    }
  };

  const handleReconnectWebhook = async () => {
    setSyncingWebhook(true);
    setWebhookMessage(null);
    try {
      const res = await fetch('/api/admin/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.success) {
          setWebhookMessage('✅ Webhook successfully connected to Telegram!');
          await loadData();
        } else {
          setWebhookMessage(`❌ Failed: ${data.error || 'Check bot token'}`);
        }
      } else {
        setWebhookMessage('❌ Failed to reach webhook endpoint.');
      }
    } catch (err: any) {
      setWebhookMessage(`❌ Error: ${err?.message || 'Network request failed'}`);
    } finally {
      setSyncingWebhook(false);
    }
  };

  const filteredRecords = records.filter((r) => {
    const matchesSearch =
      !searchQuery ||
      r.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.phoneNumber.includes(searchQuery) ||
      r.livingPlace.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.occupation.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.registeredByName && r.registeredByName.toLowerCase().includes(searchQuery.toLowerCase()));

    const isPending =
      r.verificationStatus === 'Pending Approval' ||
      (r.verificationStatus as string) === 'Pending';

    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'PENDING' && isPending) ||
      (statusFilter === 'APPROVED' && r.verificationStatus === 'Approved') ||
      (statusFilter === 'REJECTED' && r.verificationStatus === 'Rejected') ||
      (statusFilter === 'PROXY' && r.isProxyRegistration);

    return matchesSearch && matchesStatus;
  });

  const copyGoogleSheetsHeader = () => {
    const text =
      'Full Name\tPhone Number\tCurrent Living Place\tOccupation\tInterest Confirmation\tRegistration Type\tRegistered By (Telegram ID / Name)\tTelegram Username\tRegistration Date\tApproval Status';
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Notification presets in respectful Amharic
  const notificationPresets = [
    {
      title: '🆔 የቀበሌ መታወቂያ ማሳሰቢያ (Kebele ID Notice - Image)',
      text: 'You are member for sankora land registration please next You should have kebele id up to 15/2/2019 E.C\n\nየሳንኮራ መሬት ምዝገባ አባል ነዎት። ቀጣይ ማስታወሻ፦ እስከ 15/2/2019 ዓ.ም ድረስ የታደሰ የቀበሌ መታወቂያ ሊኖርዎት ይገባል።',
      withImage: true,
      target: 'APPROVED' as const,
    },
    {
      title: '⏰ የምዝገባ ጊዜው ተጠናቋል (Time is Up - Image)',
      text: 'የምዝገባ ጊዜው ተጠናቋል! በሳንኮራ የመኖሪያ ቤት መሬት ምዝገባ ላይ ስለተሳተፉ ከልብ እናመሰግናለን። የተመዘገቡ አባላት ዝርዝርና ይፋዊ ሪፖርት ከላይ በምስሉ ቀርቧል። የእርስዎንና የጓደኞችዎን ሁኔታ ለማየት በቦቱ ውስጥ /status ብለው ይላኩ።\n\nRegistration is finished thank for your interest to be with us.',
      withImage: true,
      target: 'ALL' as const,
    },
    {
      title: '📢 ጠቅላላ ስብሰባ ጥሪ',
      text: 'ሰላም የተከበራችሁ የሳንኮራ የመኖሪያ ቤት መሬት ፈላጊዎች አባላት፣ በመጪው እሁድ ጠቃሚ የጋራ ስብሰባ ስለተዘጋጀ በሰዓቱ እንድትገኙ በአክብሮት እናሳስባለን።',
      withImage: false,
      target: 'APPROVED' as const,
    },
    {
      title: '📄 ሰነድ / ማስረጃ ማቅረቢያ',
      text: 'ሰላም የተከበራችሁ አባላት፣ የምዝገባ ሂደቱን ለማጠናቀቅ የሚያስፈልጉ ተጨማሪ መረጃዎችን ወይም ሰነዶችን እንድታዘጋጁ በትህትና እናሳውቃለን።',
      withImage: false,
      target: 'APPROVED' as const,
    },
    {
      title: '⚖️ የሂደት እና የቦታ መረጃ',
      text: 'ሰላም የተከበራችሁ አባላት፣ የመኖሪያ መሬት አሰጣጥ ቅደም ተከተልና የጣቢያ መረጃ ዝግጅት በጥሩ ሁኔታ እየተከናወነ ይገኛል። ዝርዝሩን በቅርቡ እናሳውቃለን።',
      withImage: false,
      target: 'APPROVED' as const,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <header className="border-b border-slate-800 pb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Live Bot &amp; Admin Active
              </span>
              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/30">
                Sankora Town
              </span>
              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/30">
                Ethiopic Unicode UTF-8
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
              የሳንኮራ የመኖሪያ ቤት መሬት ምዝገባ ቦት
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Sankora Land Registration Bot &amp; Management Portal • Respectful, Fair &amp; Transparent
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Send Notification Button */}
            <button
              onClick={() => {
                setShowNotifyModal(true);
                loadNotificationLogs();
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium text-sm transition shadow-lg shadow-amber-600/20"
            >
              <Bell className="w-4 h-4" />
              ማሳወቂያ ላክ (Send Notification)
            </button>

            {/* Telegram Bot Direct Link */}
            <a
              href="https://t.me/Sankora_RL_Membersbot"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-medium text-sm transition shadow-lg shadow-sky-600/20"
            >
              <Send className="w-4 h-4" />
              @Sankora_RL_Membersbot
              <ExternalLink className="w-3.5 h-3.5 opacity-70" />
            </a>

            {/* CSV Export */}
            <a
              href="/api/admin/export"
              download
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm transition shadow-lg shadow-emerald-600/20"
              title="Download UTF-8 CSV with Amharic Unicode Support"
            >
              <Download className="w-4 h-4" />
              CSV
            </a>

            {/* PDF Direct Export */}
            <button
              onClick={handleExportPDF}
              disabled={isExportingPDF}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-medium text-sm transition shadow-lg shadow-rose-600/20 disabled:opacity-50"
              title="Download Pure Amharic PDF"
            >
              {isExportingPDF ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <FileText className="w-4 h-4" />
              )}
              {isExportingPDF ? 'በማዘጋጀት ላይ...' : 'PDF'}
            </button>

            {/* Official Print View */}
            <button
              onClick={() => setShowPrintModal(true)}
              className="inline-flex items-center gap-2 px-3 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium text-sm transition"
              title="Printable Report View"
            >
              <Printer className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Registration Status Banner & Controls */}
        <div
          className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 transition ${
            !registrationOpen
              ? 'bg-amber-950/30 border-amber-500/40 text-amber-200'
              : 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
          }`}
        >
          <div className="flex items-center gap-3.5">
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                !registrationOpen
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              }`}
            >
              {!registrationOpen ? <Clock className="w-6 h-6" /> : <CheckCircle2 className="w-6 h-6" />}
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <span className="font-bold text-base text-white">
                  {!registrationOpen
                    ? '⏰ የምዝገባ ጊዜው ተጠናቋል (Registration Closed - Time is Up)'
                    : '🟢 የምዝገባ ጊዜው ክፍት ነው (Registration is Open)'}
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${
                    !registrationOpen
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  }`}
                >
                  {!registrationOpen ? 'CLOSED' : 'OPEN'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {!registrationOpen
                  ? 'አዳዲስ አባላት ሲገቡ "Registration is finished thank for your interest to be with us" የሚል ምላሽ ይሰጣል። የተመዘገቡ አባላት /status ሲሉ ሁኔታቸውንና የጸደቁትን ዝርዝር በምስል ያያሉ።'
                  : 'ማንኛውም ሰው በቴሌግራም ቦቱ /start በማለት እራሱንና ጓደኞቹን መመዝገብ ይችላል።'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => toggleRegistrationStatus(!registrationOpen)}
              disabled={togglingRegistration}
              className={`px-3.5 py-2 rounded-lg font-medium text-xs transition border flex items-center gap-1.5 ${
                !registrationOpen
                  ? 'bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border-emerald-500/40'
                  : 'bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border-amber-500/40'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${togglingRegistration ? 'animate-spin' : ''}`} />
              {!registrationOpen ? 'ምዝገባን ክፈት (Open Registration)' : 'ምዝገባውን ዝጋ (Close / Time is Up)'}
            </button>

            {!registrationOpen && (
              <button
                onClick={() => {
                  setNotifyMessage(
                    'የምዝገባ ጊዜው ተጠናቋል! በሳንኮራ የመኖሪያ ቤት መሬት ምዝገባ ላይ ስለተሳተፉ ከልብ እናመሰግናለን። የተመዘገቡ አባላት ዝርዝርና ይፋዊ ሪፖርት ከላይ በምስሉ ቀርቧል። የእርስዎንና የጓደኞችዎን ሁኔታ ለማየት በቦቱ ውስጥ /status ብለው ይላኩ።\n\nRegistration is finished thank for your interest to be with us.'
                  );
                  setSendWithImage(true);
                  setNotifyTarget('ALL');
                  setShowNotifyModal(true);
                  loadNotificationLogs();
                }}
                className="px-3.5 py-2 rounded-lg font-medium text-xs bg-amber-600 hover:bg-amber-500 text-white transition shadow flex items-center gap-1.5"
              >
                <Bell className="w-3.5 h-3.5" />
                &apos;ጊዜው ተጠናቋል&apos; ማሳወቂያ ላክ (Broadcast)
              </button>
            )}
          </div>
        </div>

        {/* Telegram Connection & Database Status Panel */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Telegram Status */}
          <div className="md:col-span-2 p-5 rounded-xl bg-slate-900/80 border border-slate-800 shadow-sm flex flex-col justify-between">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  <h3 className="font-semibold text-slate-200 text-sm">Telegram Bot &amp; Admin Broadcast Status</h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    Live Polling Active
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1 font-mono">
                  When members register, instant alert with Approve/Reject/Delete is sent to @Natananor.
                </p>
              </div>

              <button
                onClick={handleReconnectWebhook}
                disabled={syncingWebhook}
                className="px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 flex items-center gap-1.5 transition disabled:opacity-50 shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncingWebhook ? 'animate-spin' : ''}`} />
                {syncingWebhook ? 'Checking...' : 'Refresh Status'}
              </button>
            </div>

            {webhookMessage && (
              <div className="text-xs mb-2 p-2 rounded bg-slate-800/60 border border-slate-700 text-slate-200">
                {webhookMessage}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 border-t border-slate-800/80 pt-3 mt-2">
              <span className="flex items-center gap-1 text-emerald-400 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Bot Online &amp; Alerting Admin
              </span>
              <span>Pending Updates: {webhookInfo?.pending_update_count ?? 0}</span>
              <span className="text-slate-400">
                Bot Username: <b className="text-sky-400">@Sankora_RL_Membersbot</b>
              </span>
            </div>
          </div>

          {/* Administrator Guard Card */}
          <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-amber-400 mb-1.5">
                <ShieldCheck className="w-4 h-4" />
                <h3 className="font-semibold text-sm">Authorized Administrator</h3>
              </div>
              <p className="text-xs text-slate-300">
                Telegram User ID: <span className="font-mono font-bold text-amber-300">7703225687</span>
              </p>
              <p className="text-xs text-slate-400 mt-0.5">Username: @Natananor</p>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800/80 text-xs text-slate-400 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-blue-400" />
                <span>Firestore: Protected</span>
              </div>
              <span className="text-[11px] text-emerald-400 font-medium">Admin Delete Active</span>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">ጠቅላላ አባላት</p>
              <Users className="w-4 h-4 text-slate-400" />
            </div>
            <p className="text-3xl font-bold text-white mt-2">{stats.total}</p>
            <p className="text-xs text-slate-500 mt-0.5">Total Registered</p>
          </div>

          <div className="p-5 rounded-xl bg-slate-900/60 border border-amber-900/40 bg-amber-950/10">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-amber-400 uppercase tracking-wider">ማረጋገጫ የሚጠብቁ</p>
              <Clock className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-3xl font-bold text-amber-400 mt-2">{stats.pending}</p>
            <p className="text-xs text-amber-500/70 mt-0.5">Pending Admin Approval</p>
          </div>

          <div className="p-5 rounded-xl bg-slate-900/60 border border-emerald-900/40 bg-emerald-950/10">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-emerald-400 uppercase tracking-wider">የጸደቁ አባላት</p>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-3xl font-bold text-emerald-400 mt-2">{stats.approved}</p>
            <p className="text-xs text-emerald-500/70 mt-0.5">Approved Members</p>
          </div>

          <div className="p-5 rounded-xl bg-slate-900/60 border border-rose-900/40 bg-rose-950/10">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-rose-400 uppercase tracking-wider">ውድቅ የተደረጉ</p>
              <XCircle className="w-4 h-4 text-rose-400" />
            </div>
            <p className="text-3xl font-bold text-rose-400 mt-2">{stats.rejected}</p>
            <p className="text-xs text-rose-500/70 mt-0.5">Rejected</p>
          </div>
        </div>

        {/* Member Directory */}
        <div className="rounded-xl bg-slate-900/70 border border-slate-800 overflow-hidden shadow-lg">
          <div className="p-5 border-b border-slate-800 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-400" />
                የተመዘገቡ አባላት ዝርዝር (Interested Members)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Saved in Firebase and formatted for Google Sheet &quot;Sankora Land Interested Members&quot;
              </p>
            </div>

            {/* Controls */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Search */}
              <div className="relative min-w-[220px]">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="ስም ወይም ስልክ ፈልግ..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-800/80 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="ALL">ሁሉም ሁኔታዎች (All Status)</option>
                <option value="PENDING">⏳ ማረጋገጫ የሚጠብቁ (Pending)</option>
                <option value="APPROVED">✅ የጸደቁ (Approved)</option>
                <option value="REJECTED">❌ ውድቅ የተደረጉ (Rejected)</option>
                <option value="PROXY">🤝 በጓደኛ የተመዘገቡ (Proxy)</option>
              </select>

              {/* Copy Google Sheet Header */}
              <button
                onClick={copyGoogleSheetsHeader}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 border border-slate-700 flex items-center gap-1.5 transition"
                title="Copy headers to paste in Google Sheets"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied Headers!' : 'Sheet Columns'}
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-12 text-center text-slate-400 text-sm">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-500" />
                መረጃዎችን በማምጣት ላይ... (Loading registrations...)
              </div>
            ) : filteredRecords.length === 0 ? (
              <div className="p-12 text-center">
                <Users className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                <p className="text-slate-300 font-medium text-sm">ምንም የተመዘገበ አባል አልተገኘም</p>
                <p className="text-slate-500 text-xs mt-1">
                  በቴሌግራም ቦቱ @Sankora_RL_Membersbot በኩል /start ብለው በመጀመር ይመዝገቡ።
                </p>
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/60 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">#</th>
                    <th className="py-3 px-4">ሙሉ ስም (Full Name)</th>
                    <th className="py-3 px-4">ስልክ (Phone)</th>
                    <th className="py-3 px-4">የመኖሪያ ቦታ (Location)</th>
                    <th className="py-3 px-4">ሙያ (Occupation)</th>
                    <th className="py-3 px-4">የምዝገባ ዓይነት</th>
                    <th className="py-3 px-4">የመዘገበው ሰው</th>
                    <th className="py-3 px-4">ሁኔታ (Status)</th>
                    <th className="py-3 px-4 text-right">የአስተዳዳሪ ውሳኔ (Action)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredRecords.map((r, idx) => (
                    <tr key={r.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 font-mono text-slate-500">{idx + 1}</td>
                      <td className="py-3 px-4 font-medium text-slate-100">
                        {r.fullName}
                        {r.telegramUsername && (
                          <span className="block text-[11px] text-sky-400/80 font-normal">
                            {r.telegramUsername}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-300 font-mono">{r.phoneNumber}</td>
                      <td className="py-3 px-4 text-slate-300">{r.livingPlace}</td>
                      <td className="py-3 px-4 text-slate-300">{r.occupation}</td>
                      <td className="py-3 px-4">
                        {r.isProxyRegistration ? (
                          <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            በጓደኛ
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-sky-500/10 text-sky-400 border border-sky-500/20">
                            በራሱ
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-400 text-[11px]">
                        {r.isProxyRegistration ? (
                          <span className="text-amber-300">{r.registeredByName || 'የቴሌግራም አባል'}</span>
                        ) : (
                          <span className="text-slate-500">ቀጥታ (ራስ)</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {r.verificationStatus === 'Approved' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            ✅ የጸደቀ (Approved)
                          </span>
                        ) : r.verificationStatus === 'Rejected' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                            ❌ ውድቅ (Rejected)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                            ⏳ ማረጋገጫ የሚጠብቅ
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {r.verificationStatus !== 'Approved' && (
                            <button
                              onClick={() => handleStatusChange(r.id, 'Approved')}
                              disabled={updatingId === r.id}
                              className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-medium transition disabled:opacity-50"
                              title="Approve registration"
                            >
                              አጽድቅ
                            </button>
                          )}
                          {r.verificationStatus !== 'Rejected' && (
                            <button
                              onClick={() => handleStatusChange(r.id, 'Rejected')}
                              disabled={updatingId === r.id}
                              className="px-2 py-1 rounded bg-amber-600/80 hover:bg-amber-600 text-white text-[11px] font-medium transition disabled:opacity-50"
                              title="Reject registration"
                            >
                              ውድቅ
                            </button>
                          )}
                          <button
                            onClick={() => setMemberToDelete(r)}
                            disabled={updatingId === r.id}
                            className="px-2 py-1 rounded bg-rose-600/80 hover:bg-rose-600 text-white text-[11px] font-medium transition disabled:opacity-50 flex items-center gap-1"
                            title="Delete permanently from database"
                          >
                            <Trash2 className="w-3 h-3" />
                            ሰርዝ
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Telegram Bot Commands & Google Sheet Guide */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Telegram Bot Commands */}
          <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800">
            <h3 className="text-base font-bold text-white mb-3 flex items-center gap-2">
              <Terminal className="w-4 h-4 text-sky-400" />
              የቦቱ ትዕዛዞች (Bot Commands Reference)
            </h3>
            <div className="space-y-2.5 text-xs text-slate-300">
              <div className="p-2.5 rounded bg-slate-950/60 border border-slate-800/80">
                <span className="font-mono text-sky-400 font-bold">/start</span> — አዲስ ምዝገባ ለመጀመር ወይም ያለዎትን የምዝገባ ሁኔታ ለማየት
              </div>
              <div className="p-2.5 rounded bg-slate-950/60 border border-slate-800/80">
                <span className="font-mono text-sky-400 font-bold">/status</span> — የተመዘገቡትን መረጃ ዝርዝርና የማረጋገጫ ሁኔታ ለማየት
              </div>
              <div className="p-2.5 rounded bg-slate-950/60 border border-slate-800/80">
                <span className="font-mono text-emerald-400 font-bold">/add_friend</span> — ቴሌግራም የሌለውን ሌላ ፍላጎት ያለው ሰው ለመመዝገብ
              </div>
              <div className="p-2.5 rounded bg-slate-950/60 border border-slate-800/80">
                <span className="font-mono text-amber-400 font-bold">/pending</span> — ለአስተዳዳሪ ብቻ፦ ማረጋገጫ የሚጠብቁትን ለማየትና ለማጽደቅ
              </div>
              <div className="p-2.5 rounded bg-slate-950/60 border border-slate-800/80">
                <span className="font-mono text-amber-400 font-bold">/notify &lt;መልእክት&gt;</span> — በቴሌግራም ለጸደቁ አባላት ማሳወቂያ መላኪያ
              </div>
              <div className="p-2.5 rounded bg-slate-950/60 border border-slate-800/80">
                <span className="font-mono text-amber-400 font-bold">/delete &lt;ስም/ስልክ&gt;</span> — አባልን ከዳታቤዝ በቋሚነት ለመሰረዝ
              </div>
              <div className="p-2.5 rounded bg-slate-950/60 border border-slate-800/80">
                <span className="font-mono text-amber-400 font-bold">/count</span> — የተመዘገቡ አባላት ጠቅላላ ቁጥርና ስታትስቲክስ
              </div>
              <div className="p-2.5 rounded bg-slate-950/60 border border-slate-800/80">
                <span className="font-mono text-amber-400 font-bold">/export</span> — መረጃዎችን በCSV ፋይል በቀጥታ ወደ ቴሌግራም ለማውረድ
              </div>
            </div>
          </div>

          {/* Google Sheet Sync Information */}
          <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800">
            <h3 className="text-base font-bold text-white mb-3 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              Google Sheet &quot;Sankora Land Interested Members&quot;
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              ሁሉም የተረጋገጡ ምዝገባዎች በFirebase Firestore ውስጥ ተቀምጠዋል። ወደ እርስዎ የግል Google Sheet ለመውሰድ ከላይ ያለውን{' '}
              <b className="text-emerald-400">&quot;Export to CSV&quot;</b> ቁልፍ በመጫን ወይም በቴሌግራም ውስጥ{' '}
              <b className="text-amber-400">/export</b> በማለት በቀጥታ ወደ Excel/Google Sheets ማስገባት ይችላሉ።
            </p>

            <div className="text-xs text-slate-400 bg-slate-950/80 p-3.5 rounded-lg border border-slate-800 font-mono space-y-1">
              <p className="text-slate-300 font-bold text-[11px] uppercase tracking-wider mb-2">
                Spreadsheet Columns (UTF-8 Unicode):
              </p>
              <p>1. Full Name (ሙሉ ስም)</p>
              <p>2. Phone Number (ስልክ ቁጥር)</p>
              <p>3. Current Living Place (የመኖሪያ ቦታ)</p>
              <p>4. Occupation (የስራ ዘርፍ / ሙያ)</p>
              <p>5. Interest Confirmation</p>
              <p>6. Registration Type (Direct vs Proxy)</p>
              <p>7. Registered By (የመዘገበው ሰው)</p>
              <p>8. Telegram Username</p>
              <p>9. Registration Date</p>
              <p>10. Approval Status (Pending / Approved / Rejected)</p>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* ADMIN NOTIFICATION BROADCAST MODAL */}
      {/* ============================================================== */}
      {showNotifyModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-white">የአስተዳዳሪ ማሳወቂያ መላኪያ (Send Notification)</h3>
                  <p className="text-xs text-slate-400">
                    Send real-time updates directly to members via the Telegram bot
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowNotifyModal(false);
                  setNotificationStatus(null);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Notification Form */}
            <form onSubmit={handleSendNotification} className="space-y-4">
              {/* Target Audience */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  የተቀባዮች ቡድን (Target Audience)
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setNotifyTarget('APPROVED')}
                    className={`p-3 rounded-xl border text-left transition flex items-center gap-3 ${
                      notifyTarget === 'APPROVED'
                        ? 'border-emerald-500/60 bg-emerald-500/10 text-white'
                        : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:bg-slate-800/40'
                    }`}
                  >
                    <CheckCircle2
                      className={`w-5 h-5 ${
                        notifyTarget === 'APPROVED' ? 'text-emerald-400' : 'text-slate-600'
                      }`}
                    />
                    <div>
                      <p className="text-xs font-bold">የጸደቁ አባላት ብቻ (Approved)</p>
                      <p className="text-[11px] text-slate-400">{stats.approved} አባላት ተመርጠዋል</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNotifyTarget('ALL')}
                    className={`p-3 rounded-xl border text-left transition flex items-center gap-3 ${
                      notifyTarget === 'ALL'
                        ? 'border-sky-500/60 bg-sky-500/10 text-white'
                        : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:bg-slate-800/40'
                    }`}
                  >
                    <Users
                      className={`w-5 h-5 ${
                        notifyTarget === 'ALL' ? 'text-sky-400' : 'text-slate-600'
                      }`}
                    />
                    <div>
                      <p className="text-xs font-bold">ሁሉም የተመዘገቡ አባላት (All)</p>
                      <p className="text-[11px] text-slate-400">{stats.total} አባላት ተመርጠዋል</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Quick Preset Templates */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                  ፈጣን ቅጾች (Quick Message Templates)
                </label>
                <div className="flex flex-wrap gap-2">
                  {notificationPresets.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setNotifyMessage(preset.text);
                        if (preset.withImage !== undefined) setSendWithImage(preset.withImage);
                        if (preset.target) setNotifyTarget(preset.target);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 border border-slate-700 transition"
                    >
                      {preset.title}
                    </button>
                  ))}
                </div>
              </div>

              {/* Attach Image Option */}
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <input
                  type="checkbox"
                  id="sendWithImage"
                  checked={sendWithImage}
                  onChange={(e) => setSendWithImage(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-500 cursor-pointer"
                />
                <label htmlFor="sendWithImage" className="text-xs text-slate-300 font-medium cursor-pointer select-none">
                  📸 ይፋዊ የጸደቁ አባላት ሪፖርት ምስል አብረህ ላክ (Attach Official Report Image)
                </label>
              </div>

              {/* Message Input */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    የመልእክቱ ይዘት (Amharic Message Content)
                  </label>
                  <span className="text-[11px] text-slate-500">{notifyMessage.length} ፊደላት</span>
                </div>
                <textarea
                  rows={4}
                  required
                  value={notifyMessage}
                  onChange={(e) => setNotifyMessage(e.target.value)}
                  placeholder="ለአባላት የሚላከውን መልእክት በአማርኛ እዚህ ይጻፉ... (ምሳሌ፦ በመጪው እሁድ ጠቃሚ ስብሰባ አለ...)"
                  className="w-full bg-slate-950/80 border border-slate-700 rounded-xl p-3.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500 leading-relaxed font-sans"
                />
              </div>

              {/* Telegram Preview */}
              {notifyMessage.trim() && (
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                  <p className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-sky-400" />
                    በቴሌግራም የሚታይበት ቅርጽ (Telegram Preview)
                  </p>
                  <div className="bg-sky-950/30 border border-sky-800/40 rounded-lg p-3 text-xs text-sky-100 font-sans leading-relaxed whitespace-pre-wrap">
                    <p className="font-bold text-sky-300 mb-1">
                      📢 አዲስ ማሳወቂያ ከሳንኮራ የመኖሪያ ቤት መሬት ምዝገባ አስተዳደር፦
                    </p>
                    <p>{notifyMessage}</p>
                    <p className="text-[11px] text-sky-400/70 mt-2 italic">
                      📅 {new Date().toLocaleDateString('am-ET')} • አስተዳዳሪ @Natananor
                    </p>
                  </div>
                </div>
              )}

              {/* Status Message */}
              {notificationStatus && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                    notificationStatus.type === 'success'
                      ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                      : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
                  }`}
                >
                  {notificationStatus.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                  )}
                  <span>{notificationStatus.text}</span>
                </div>
              )}

              {/* Buttons */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setShowHistory(!showHistory)}
                  className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1.5"
                >
                  <History className="w-3.5 h-3.5" />
                  {showHistory ? 'ታሪክን ደብቅ (Hide History)' : 'ያለፉ ማሳወቂያዎች (Past Notifications)'}
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowNotifyModal(false);
                      setNotificationStatus(null);
                    }}
                    className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 transition"
                  >
                    ተመለስ
                  </button>
                  <button
                    type="submit"
                    disabled={sendingNotification || !notifyMessage.trim()}
                    className="px-5 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium text-xs flex items-center gap-2 transition disabled:opacity-50 shadow-lg shadow-amber-600/20"
                  >
                    {sendingNotification ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    {sendingNotification ? 'በመላክ ላይ...' : 'ማሳወቂያውን ላክ (Broadcast)'}
                  </button>
                </div>
              </div>
            </form>

            {/* History Section */}
            {showHistory && (
              <div className="border-t border-slate-800 pt-4 space-y-3">
                <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-amber-400" />
                  የተላኩ ማሳወቂያዎች ታሪክ (Sent Notifications Log)
                </h4>
                {loadingLogs ? (
                  <p className="text-xs text-slate-500">በማምጣት ላይ...</p>
                ) : notificationLogs.length === 0 ? (
                  <p className="text-xs text-slate-500">እስካሁን የተላከ ማሳወቂያ የለም።</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {notificationLogs.map((log) => (
                      <div
                        key={log.id}
                        className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                          <span className="font-semibold text-amber-300">
                            ዒላማ፦ {log.target === 'APPROVED' ? 'የጸደቁ አባላት' : 'ሁሉም አባላት'}
                          </span>
                          <span>{new Date(log.sentAt).toLocaleString('am-ET')}</span>
                        </div>
                        <p className="text-slate-200 line-clamp-2">{log.message}</p>
                        <div className="text-[10px] text-emerald-400 flex items-center gap-2 pt-1 border-t border-slate-800/60">
                          <span>✅ የተላከላቸው፦ {log.sentCount}</span>
                          {log.failedCount > 0 && <span className="text-rose-400">❌ የከሸፈ፦ {log.failedCount}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* PERMANENT DELETE CONFIRMATION MODAL */}
      {/* ============================================================== */}
      {memberToDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-rose-900/40 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-white">አባልን ከዳታቤዝ በቋሚነት መሰረዝ</h3>
                <p className="text-xs text-rose-300 mt-0.5">Permanent Member Deletion (Cannot be undone)</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">ሙሉ ስም፦</span>
                <span className="font-bold text-white">{memberToDelete.fullName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">ስልክ ቁጥር፦</span>
                <span className="font-mono text-slate-200">{memberToDelete.phoneNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">የመኖሪያ ቦታ፦</span>
                <span className="text-slate-200">{memberToDelete.livingPlace}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">ሁኔታ፦</span>
                <span className="font-medium text-amber-400">{memberToDelete.verificationStatus}</span>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              ⚠️ ይህን አባል ከደህንነት ዳታቤዝ ውስጥ <b>በቋሚነት</b> ለመሰረዝ እርግጠኛ ነዎት? የተሰረዘው መረጃ መልሶ ሊገኝ አይችልም።
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setMemberToDelete(null)}
                disabled={deleting}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 transition"
              >
                ተመለስ (Cancel)
              </button>
              <button
                type="button"
                onClick={confirmPermanentDelete}
                disabled={deleting}
                className="px-5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs flex items-center gap-1.5 transition disabled:opacity-50 shadow-lg shadow-rose-600/20"
              >
                {deleting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                {deleting ? 'በመሰረዝ ላይ...' : 'አዎ፣ በቋሚነት ሰርዝ (Delete)'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* OFFICIAL PRINTABLE REPORT MODAL */}
      {/* ============================================================== */}
      {showPrintModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto shadow-2xl p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-lg text-white">ይፋዊ የአባላት ዝርዝር ሪፖርት (Official Print View)</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs flex items-center gap-1.5 transition"
                >
                  <Printer className="w-3.5 h-3.5" />
                  አትም / በPDF አስቀምጥ (Print / PDF)
                </button>
                <button
                  onClick={() => setShowPrintModal(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Paper Canvas Sheet */}
            <div className="bg-white text-slate-900 p-8 rounded-xl shadow-lg font-sans space-y-6">
              {/* Report Header */}
              <div className="border-b-2 border-slate-800 pb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-slate-950">
                    የሳንኮራ ከተማ የመኖሪያ ቤት መሬት ምዝገባ
                  </h2>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Sankora Town Residential Land Registration • የተመዘገቡ አባላት ይፋዊ ሪፖርት
                  </p>
                </div>
                <div className="text-right text-xs text-slate-600">
                  <p className="font-bold text-slate-900">ቀን፦ {new Date().toLocaleDateString('am-ET')}</p>
                  <p>ጠቅላላ አባላት፦ {filteredRecords.length}</p>
                </div>
              </div>

              {/* Table */}
              <table className="w-full text-left text-xs border border-slate-300 divide-y divide-slate-300">
                <thead className="bg-slate-100 font-bold text-slate-800">
                  <tr>
                    <th className="p-2 border-r border-slate-300">#</th>
                    <th className="p-2 border-r border-slate-300">ሙሉ ስም</th>
                    <th className="p-2 border-r border-slate-300">ስልክ ቁጥር</th>
                    <th className="p-2 border-r border-slate-300">የመኖሪያ ቦታ</th>
                    <th className="p-2 border-r border-slate-300">ሙያ / የስራ ዘርፍ</th>
                    <th className="p-2 border-r border-slate-300">ዓይነት</th>
                    <th className="p-2">ሁኔታ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredRecords.map((r, i) => (
                    <tr key={r.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                      <td className="p-2 border-r border-slate-200 font-mono">{i + 1}</td>
                      <td className="p-2 border-r border-slate-200 font-semibold">{r.fullName}</td>
                      <td className="p-2 border-r border-slate-200 font-mono">{r.phoneNumber}</td>
                      <td className="p-2 border-r border-slate-200">{r.livingPlace}</td>
                      <td className="p-2 border-r border-slate-200">{r.occupation}</td>
                      <td className="p-2 border-r border-slate-200">
                        {r.isProxyRegistration ? 'በጓደኛ' : 'በራሱ'}
                      </td>
                      <td className="p-2 font-medium">
                        {r.verificationStatus === 'Approved'
                          ? '✅ የጸደቀ'
                          : r.verificationStatus === 'Rejected'
                          ? '❌ ውድቅ'
                          : '⏳ በመጠባበቅ'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Footer */}
              <div className="pt-4 border-t border-slate-200 flex justify-between text-[11px] text-slate-500">
                <span>ይህ ሰነድ ከሳንኮራ የመኖሪያ ቤት መሬት ምዝገባ አስተዳደር የተወሰደ ይፋዊ ሪፖርት ነው።</span>
                <span>ገጽ 1 / 1</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
