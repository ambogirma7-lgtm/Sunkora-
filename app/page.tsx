'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
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
    } catch {
      // Graceful fallback for iframe reloads
    } finally {
      setLoading(false);
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
        body: JSON.stringify({ id, status: newStatus, adminName: 'Admin Portal' }),
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

  const handleDeleteMember = async (id: string, name: string) => {
    if (!window.confirm(`⚠️ እርግጠኛ ነዎት የ ${name}ን መረጃ ከዳታቤዝ ውስጥ በቋሚነት መሰረዝ ይፈልጋሉ?`)) {
      return;
    }
    setUpdatingId(id);
    try {
      const res = await fetch('/api/admin/approval', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        await loadData();
      }
    } catch (err) {
      console.error('Error deleting member:', err);
    } finally {
      setUpdatingId(null);
    }
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.text('Sankora Land Registration Member List', 14, 15);
    
    // Normalize Amharic text to ASCII (transliteration or replacement) for PDF compatibility
    const normalizeText = (text: string) => text.replace(/[^\x00-\x7F]/g, '?');

    autoTable(doc, {
      head: [['Full Name', 'Phone', 'Living Place', 'Occupation', 'Status']],
      body: filteredRecords.map((r) => [
        normalizeText(r.fullName), 
        r.phoneNumber, 
        normalizeText(r.livingPlace), 
        normalizeText(r.occupation), 
        r.verificationStatus
      ]),
      startY: 20,
    });
    doc.save(`Sankora_Members_${new Date().toISOString().slice(0, 10)}.pdf`);
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <header className="border-b border-slate-800 pb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Live Bot &amp; Admin Approval Active
              </span>
              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/30">
                Sankora Town
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
              የሳንኮራ የመኖሪያ ቤት መሬት ምዝገባ ቦት
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Sankora Land Registration Bot &amp; Management Portal • Respectful, Fair &amp; Transparent
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href="https://t.me/Sankora_RL_Membersbot"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-medium text-sm transition shadow-lg shadow-sky-600/20"
            >
              <Send className="w-4 h-4" />
              Open Telegram Bot (@Sankora_RL_Membersbot)
              <ExternalLink className="w-3.5 h-3.5 opacity-70" />
            </a>

            <a
              href="/api/admin/export"
              download
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm transition shadow-lg shadow-emerald-600/20"
            >
              <Download className="w-4 h-4" />
              CSV
            </a>
            <button
              onClick={exportToPDF}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-medium text-sm transition shadow-lg shadow-rose-600/20"
            >
              <FileText className="w-4 h-4" />
              PDF
            </button>
          </div>
        </header>

        {/* Telegram Connection & Database Status Panel */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Telegram Status */}
          <div className="md:col-span-2 p-5 rounded-xl bg-slate-900/80 border border-slate-800 shadow-sm flex flex-col justify-between">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  <h3 className="font-semibold text-slate-200 text-sm">Telegram Bot &amp; Admin Approval Status</h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    Live Polling Active
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1 font-mono">
                  When members register, instant alert with Approve/Reject buttons is sent to @Natananor.
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

            <div className="mt-4 pt-3 border-t border-slate-800/80 text-xs text-slate-400 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-blue-400" />
              <span>Firebase Firestore: Active</span>
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
                            onClick={() => handleDeleteMember(r.id, r.fullName)}
                            disabled={updatingId === r.id}
                            className="px-2 py-1 rounded bg-rose-600/80 hover:bg-rose-600 text-white text-[11px] font-medium transition disabled:opacity-50"
                            title="Delete permanently from secure database"
                          >
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
                <span className="font-mono text-amber-400 font-bold">/admin</span> — ለአስተዳዳሪ ብቻ (Admin Menu: @Natananor)
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
                Spreadsheet Columns:
              </p>
              <p>1. Full Name (ሙሉ ስም)</p>
              <p>2. Phone Number (ስልክ ቁጥር)</p>
              <p>3. Current Living Place (የመኖሪያ ቦታ)</p>
              <p>4. Occupation (የስራ ዘርፍ / ሙያ)</p>
              <p>5. Interest Confirmation</p>
              <p>6. Registration Type (Direct vs On Behalf of Friend)</p>
              <p>7. Registered By (የመዘገበው ሰው)</p>
              <p>8. Telegram Username</p>
              <p>9. Registration Date</p>
              <p>10. Approval Status (Pending / Approved / Rejected)</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
