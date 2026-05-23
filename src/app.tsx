/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from "react";
import { 
  Plus, 
  RefreshCw, 
  Sparkles, 
  HelpCircle, 
  ShieldAlert, 
  CheckCircle, 
  AlertTriangle, 
  SlidersHorizontal, 
  Info, 
  Lightbulb, 
  Search,
  ExternalLink,
  Coins
} from "lucide-react";
import Logo from "./components/Logo";
import JSONPasteModal from "./components/JSONPasteModal";
import { SalaryAnalysis, DashboardStats } from "./data/types";

export default function App() {
  const [submissions, setSubmissions] = useState<SalaryAnalysis[]>([]);
  const [selectedAnalysis, setSelectedAnalysis] = useState<SalaryAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRisk, setFilterRisk] = useState<string>("ALL");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [explaining, setExplaining] = useState(false);
  const [explanationMap, setExplanationMap] = useState<Record<string, string>>({});
  const [notification, setNotification] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [apiKeyMissing, setApiKeyMissing] = useState(false);

  // Stats calculation
  const [stats, setStats] = useState<DashboardStats>({
    totalEntries: 0,
    flaggedEntries: 0,
    averageTrustScore: 0
  });

  // Load submissions from backed server
  const loadSubmissions = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await fetch("/api/submissions");
      if (response.ok) {
        const data: SalaryAnalysis[] = await response.json();
        setSubmissions(data);

        // Recalculate stats
        if (data.length > 0) {
          const total = data.length;
          const flagged = data.filter(item => item.analysis.riskLabel !== "Low Risk").length;
          const totalScore = data.reduce((sum, item) => sum + item.analysis.trustScore, 0);
          setStats({
            totalEntries: total,
            flaggedEntries: flagged,
            averageTrustScore: Math.round(totalScore / total)
          });
        } else {
          setStats({ totalEntries: 0, flaggedEntries: 0, averageTrustScore: 0 });
        }

        // Set initial selected row if nothing is selected or previous selection got removed
        if (data.length > 0) {
          setSelectedAnalysis((prev) => {
            if (prev) {
              const stillExists = data.find(item => item.entry.uuid === prev.entry.uuid);
              if (stillExists) return stillExists;
            }
            return data[0];
          });
        } else {
          setSelectedAnalysis(null);
        }
      } else {
        showFeedback("error", "Failed to retrieve verified submission logs from back-end server.");
      }
    } catch (err) {
      console.error(err);
      showFeedback("error", "Error connecting to the NoiseCut Express agent service.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSubmissions();
  }, [loadSubmissions]);

  // Handle flash feedback notifications
  const showFeedback = (type: "success" | "error", text: string) => {
    setNotification({ type, text });
    setTimeout(() => setNotification(null), 5000);
  };

  // Run or refresh Gemini anomaly summary explanation
  const generateExplanation = async (analysisItem: SalaryAnalysis | null, forceRefresh = false) => {
    if (!analysisItem) return;
    const uuid = analysisItem.entry.uuid;

    // Use cached if already exists and we are not forcing a refresh
    if (!forceRefresh && explanationMap[uuid]) {
      return;
    }

    if (apiKeyMissing && !forceRefresh) {
      return;
    }

    setExplaining(true);
    setApiKeyMissing(false);
    try {
      const response = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entry: analysisItem.entry,
          analysis: analysisItem.analysis
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setExplanationMap(prev => ({
          ...prev,
          [uuid]: result.explanation
        }));
      } else {
        const errorData = await response.json().catch(() => ({}));
        const message = errorData.error || "Internal evaluation error.";
        
        if (message.includes("GEMINI_API_KEY")) {
          setApiKeyMissing(true);
          return;
        }
        showFeedback("error", message);
      }
    } catch (err) {
      console.error("Gemini request failure:", err);
      showFeedback("error", "Could not reach Gemini API services. Please confirm your secret keys.");
    } finally {
      setExplaining(false);
    }
  };

  // Automatically fetch explanation when a row selection changes
  useEffect(() => {
    if (selectedAnalysis) {
      generateExplanation(selectedAnalysis);
    }
  }, [selectedAnalysis]);

  // Handle dynamic json load success from modal
  const handleImportSuccess = (count: number) => {
    showFeedback("success", `Detected and imported ${count} fresh crowdsourced records.`);
    loadSubmissions(true);
  };

  // Clear or reset sample data
  const handleResetDb = async () => {
    if (!confirm("Are you sure you want to completely clear the data store and erase all processed entries?")) return;
    try {
      setLoading(true);
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: [], reset: true }),
      });

      if (response.ok) {
        showFeedback("success", "All data successfully wiped. Table is now empty.");
        setSubmissions([]);
        setSelectedAnalysis(null);
        setSearchQuery("");
        setFilterRisk("ALL");
        setExplanationMap({});
        setStats({ totalEntries: 0, flaggedEntries: 0, averageTrustScore: 0 });
      } else {
        showFeedback("error", "Could not clear audit database.");
      }
    } catch (error) {
      showFeedback("error", "Error resetting submissions.");
    } finally {
      setLoading(false);
    }
  };

  // Filter & Search entries locally
  const filteredSubmissions = submissions.filter((item) => {
    const query = searchQuery.toLowerCase();
    const companyMatch = item.entry.company?.toLowerCase().includes(query);
    const titleMatch = item.entry.title?.toLowerCase().includes(query) || item.entry.jobFamily?.toLowerCase().includes(query);
    const locationMatch = item.entry.location?.toLowerCase().includes(query);
    const textMatches = companyMatch || titleMatch || locationMatch;

    if (filterRisk === "ALL") return textMatches;
    return textMatches && item.analysis.riskLabel.toUpperCase().replace(" ", "_") === filterRisk;
  });

  return (
    <div className="flex h-screen w-full bg-[#0B0F17] text-[#E2E8F0] font-sans overflow-hidden">
      
      {/* Sidebar - Levels.fyi/NoiseCut themed */}
      <aside className="w-64 border-r border-[#1e293b]/50 flex flex-col shrink-0 bg-[#0E141E] select-none">
        
        {/* Brand Logo and Title */}
        <div className="p-5 border-b border-[#1e293b]/40 flex items-center justify-between">
          <Logo />
        </div>

        {/* Navigation - Sidebar layout */}
        <nav className="flex-1 py-5 space-y-7">
          <div className="space-y-1.5">
            <div className="px-5 text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Moderation Hub</div>
            <a 
              href="#dashboard" 
              className="flex items-center gap-3 px-5 py-3 bg-[#3B82F6]/10 text-[#3B82F6] border-r-2 border-[#3B82F6] font-medium text-xs leading-none transition-all"
            >
              <SlidersHorizontal className="w-4.5 h-4.5" />
              <span>Trust Dashboard</span>
            </a>
          </div>

          <div className="px-5 space-y-3">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Quick Actions</div>
            <button
              onClick={() => setIsModalOpen(true)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-[#3B82F6] hover:bg-[#2563EB] text-white rounded-lg text-xs font-semibold cursor-pointer active:scale-97 transition-all border border-sky-600 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Import JSON Data</span>
            </button>

            <button
              onClick={handleResetDb}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg text-xs font-medium border border-slate-800 cursor-pointer active:scale-97 transition-all"
              title="Reset submission database"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reset Data Store</span>
            </button>
          </div>
        </nav>

      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden bg-[#070A10]">
        
        {/* Top Header of the trust dashboard */}
        <header className="h-16 border-b border-[#1e293b]/30 flex items-center justify-between px-8 shrink-0 bg-[#0B0F17]/40">
          <div className="flex items-center gap-2.5">
            <h1 className="text-base font-bold tracking-tight text-white">Signal-Over-Noise Trust Control</h1>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-full text-xs font-semibold border border-emerald-500/20 shadow-sm">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
              <span>Audit Engine Live</span>
            </div>
          </div>
        </header>

        {/* Scrollable Panel Grid Area */}
        <div className="flex-1 p-8 overflow-y-auto space-y-6">
          
          {/* Flash Feedback Banner */}
          {notification && (
            <div 
              className={`p-4 rounded-xl border flex items-center gap-3 transition-all duration-300 ${
                notification.type === "success" 
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
                  : "bg-rose-500/10 border-rose-500/20 text-rose-400"
              }`}
            >
              {notification.type === "success" ? <CheckCircle className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
              <span className="text-xs font-medium leading-relaxed">{notification.text}</span>
            </div>
          )}

          {/* Top Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Stats Card 1: Total submissions */}
            <div className="bg-[#0F1626] p-5 rounded-xl border border-white/5 shadow-sm relative overflow-hidden group">
              <p className="text-gray-400 text-[10px] font-semibold uppercase tracking-wider mb-2">Total Submissions</p>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-bold text-white tracking-tight">{stats.totalEntries}</span>
                <span className="text-xs text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded font-mono font-medium">
                  Verified Count
                </span>
              </div>
              <div className="absolute bottom-0 left-0 h-0.5 bg-blue-500 transition-all w-8 group-hover:w-full" />
            </div>

            {/* Stats Card 2: Flagged Entries */}
            <div className="bg-[#0F1626] p-5 rounded-xl border border-white/5 shadow-sm relative overflow-hidden group">
              <p className="text-gray-400 text-[10px] font-semibold uppercase tracking-wider mb-2">Flagged Anomalies</p>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-bold text-white tracking-tight">{stats.flaggedEntries}</span>
                <span className={`text-xs px-2 py-0.5 rounded font-mono font-medium ${
                  stats.flaggedEntries > 0 ? "text-rose-400 bg-rose-500/10" : "text-emerald-400 bg-emerald-500/10"
                }`}>
                  {stats.totalEntries > 0 
                    ? `${((stats.flaggedEntries / stats.totalEntries) * 100).toFixed(0)}% Flag Rate`
                    : "0% Rate"}
                </span>
              </div>
              <div className="absolute bottom-0 left-0 h-0.5 bg-rose-500 transition-all w-8 group-hover:w-full" />
            </div>

            {/* Stats Card 3: Avg Trust Score */}
            <div className="bg-[#0F1626] p-5 rounded-xl border border-white/5 shadow-sm relative overflow-hidden group">
              <p className="text-gray-400 text-[10px] font-semibold uppercase tracking-wider mb-2">Avg Trust Index</p>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-bold text-white tracking-tight">
                  {stats.totalEntries > 0 ? `${stats.averageTrustScore}/100` : "0.0"}
                </span>
                <span className="text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded font-mono font-medium">
                  {stats.averageTrustScore >= 80 ? "High Credibility" : stats.averageTrustScore >= 50 ? "Moderate" : "Fragile"}
                </span>
              </div>
              <div className="absolute bottom-0 left-0 h-0.5 bg-emerald-500 transition-all w-8 group-hover:w-full" />
            </div>

          </div>

          {/* Quick interactive search/filter control row */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#0F1626]/60 p-4 rounded-xl border border-white/5">
            
            {/* Search Input */}
            <div className="relative w-full sm:max-w-xs">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by role, company or city..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#070A10] border border-slate-800/80 focus:border-slate-700 rounded-lg py-2 pl-10 pr-4 text-xs text-slate-200 outline-none leading-relaxed placeholder-slate-500"
              />
            </div>

            {/* Risk filter selector */}
            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
              <span className="text-xs text-gray-400 font-medium">Risk Filter:</span>
              <div className="flex items-center gap-1 rounded-lg bg-[#070A10] p-1 border border-slate-800/80">
                {["ALL", "LOW_RISK", "MEDIUM_RISK", "HIGH_RISK"].map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setFilterRisk(filter)}
                    className={`px-2.5 py-1 rounded text-[10px] uppercase font-bold tracking-wider cursor-pointer transition-all ${
                      filterRisk === filter 
                        ? "bg-[#1A253C] text-white border border-slate-700" 
                        : "text-slate-400 hover:text-white border border-transparent"
                    }`}
                  >
                    {filter.replace("_", " ")}
                  </button>
                ))}
              </div>
            </div>

          </div>

          {/* Main Dashboard Layout Split Block */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Left Hand: Main Compensation Table */}
            <div className="lg:col-span-8 bg-[#0F1626] rounded-xl border border-white/5 shadow-md flex flex-col overflow-hidden min-h-[420px]">
              
              {/* Header Titles */}
              <div className="grid grid-cols-7 gap-3 px-6 py-4 bg-white/5 text-[10px] uppercase font-bold tracking-wider text-slate-400 border-b border-white/5 border-l-4 border-l-transparent">
                <div className="col-span-2">Company / Role</div>
                <div className="text-center">YOE</div>
                <div>Location</div>
                <div>Total Comp</div>
                <div className="text-center">Trust</div>
                <div>Risk Status</div>
              </div>

              {/* Table Body rows */}
              <div className="flex-1 overflow-y-auto max-h-[500px] divide-y divide-white/5">
                {loading ? (
                  <div className="p-12 text-center text-slate-500 text-xs">
                    <RefreshCw className="w-5 h-5 mx-auto mb-2.5 animate-spin text-slate-400" />
                    <span>Analyzing submission database anomalies...</span>
                  </div>
                ) : filteredSubmissions.length === 0 ? (
                  <div className="p-16 text-center text-slate-500 text-xs space-y-3">
                    <Info className="w-8 h-8 mx-auto text-slate-600 stroke-1" />
                    <div className="space-y-1">
                      <p className="font-semibold text-slate-400 text-sm">No dataset loaded</p>
                      <p className="text-slate-500 max-w-sm mx-auto">
                        Paste or upload crowdsourced raw compensation JSON data at the sidebar to analyze trust and query anomaly patterns.
                      </p>
                    </div>
                  </div>
                ) : (
                  filteredSubmissions.map((item) => {
                    const isSelected = selectedAnalysis?.entry.uuid === item.entry.uuid;
                    const anomaliesCount = item.analysis.anomalies?.length || 0;

                    let riskBadgeColor = "";
                    if (item.analysis.riskLabel === "Low Risk") {
                      riskBadgeColor = "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
                    } else if (item.analysis.riskLabel === "Medium Risk") {
                      riskBadgeColor = "text-amber-500 bg-amber-500/10 border-amber-500/20";
                    } else {
                      riskBadgeColor = "text-rose-500 bg-rose-500/10 border-rose-500/20";
                    }

                    return (
                      <div
                        id={`row-${item.entry.uuid}`}
                        key={item.entry.uuid}
                        onClick={() => setSelectedAnalysis(item)}
                        className={`grid grid-cols-7 gap-3 px-6 py-4.5 items-center text-xs transition-all cursor-pointer ${
                          isSelected 
                            ? "bg-[#3B82F6]/5 border-l-4 border-[#3B82F6]" 
                            : "hover:bg-white/2 border-l-4 border-l-transparent"
                        }`}
                      >
                        {/* Company / Title */}
                        <div className="col-span-2 flex items-center gap-2.5 min-w-0 pr-2">
                          {/* Company icon or logo.dev preview */}
                          {item.entry.companyInfo?.icon ? (
                            <div className="w-7 h-7 rounded bg-white flex items-center justify-center shrink-0 border border-slate-700 p-0.5 overflow-hidden">
                              <img 
                                src={item.entry.companyInfo.icon} 
                                alt="" 
                                onError={(e) => {
                                  // fallback standard initials
                                  (e.target as HTMLImageElement).style.display = "none";
                                }}
                                className="w-full h-full object-contain"
                              />
                            </div>
                          ) : (
                            <div className="w-7 h-7 rounded bg-blue-900/40 text-blue-300 font-bold border border-blue-800 flex items-center justify-center shrink-0 uppercase text-[10px]">
                              {item.entry.company?.substring(0, 2) || "CO"}
                            </div>
                          )}
                          <div className="truncate">
                            <div className="font-semibold text-white truncate">{item.entry.company}</div>
                            <div className="text-gray-400 text-[11px] truncate">{item.entry.title} <span className="text-slate-500">({item.entry.level})</span></div>
                          </div>
                        </div>

                        {/* YOE */}
                        <div className="text-center font-medium text-slate-200">
                          {item.entry.yearsOfExperience}
                          <span className="text-[10px] text-gray-500 block">YOE</span>
                        </div>

                        {/* Location */}
                        <div className="text-gray-300 truncate font-sans text-[11px]" title={item.entry.location}>
                          {item.entry.location}
                        </div>

                        {/* Total Comp */}
                        <div className="font-mono text-white text-xs font-semibold">
                          ${item.entry.totalCompensation?.toLocaleString()}
                          <span className="text-[10px] text-slate-500 block uppercase font-sans font-normal tracking-wide">annual USD</span>
                        </div>

                        {/* Score */}
                        <div className="text-center">
                          <span className={`font-mono font-bold text-xs ${
                            item.analysis.trustScore >= 80 ? "text-emerald-400" : item.analysis.trustScore >= 50 ? "text-amber-500" : "text-rose-500"
                          }`}>
                            {item.analysis.trustScore}
                          </span>
                        </div>

                        {/* Risk / Notification icon badge */}
                        <div className="flex items-center justify-start gap-1.5 min-w-0">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold border uppercase tracking-wider shrink-0 ${riskBadgeColor}`}>
                            {item.analysis.riskLabel}
                          </span>
                          
                          {anomaliesCount > 0 && (
                            <div className="p-1 rounded bg-slate-900 border border-slate-800 shrink-0" title={`${anomaliesCount} warning flags found`}>
                              <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                            </div>
                          )}
                        </div>

                      </div>
                    );
                  })
                )}
              </div>

              {/* Reset Database / Status Hint */}
              <div className="px-6 py-3 border-t border-white/5 bg-[#0E1420] text-slate-500 text-[11px] flex items-center justify-between">
                <span>Accepting raw user-pasted structured JSON payloads.</span>
                <span>Active Database Total: {submissions.length} Record(s)</span>
              </div>

            </div>

            {/* Right Hand: AI Side Explanation Panel */}
            <div className="lg:col-span-4 bg-[#0F1626] rounded-xl border border-white/5 p-5 flex flex-col shadow-md space-y-4">
              
              {/* Header Title inside Side Panel */}
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-400 shrink-0" />
                <h3 className="font-semibold text-sm text-white">Gemini Trust Explanation</h3>
              </div>

              {selectedAnalysis ? (
                <div className="space-y-4 max-h-[750px] overflow-y-auto pr-1">
                  
                  {/* Quick Card Details on selection */}
                  <div className="bg-[#070A10] rounded-lg p-3.5 border border-white/5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Target Candidate</span>
                      <span className="text-slate-400 text-[10px] font-mono select-all">UUID: #{selectedAnalysis.entry.uuid.substring(0, 8)}</span>
                    </div>

                    <p className="text-xs font-semibold text-white leading-relaxed">
                      {selectedAnalysis.entry.company} &mdash; {selectedAnalysis.entry.title} ({selectedAnalysis.entry.level})
                    </p>
                    <p className="text-[11px] text-gray-400 mt-1">
                      Located in {selectedAnalysis.entry.location} with {selectedAnalysis.entry.yearsOfExperience} YOE.
                    </p>
                  </div>

                  {/* Compensation Component Breakdown */}
                  <div className="bg-[#070A10] rounded-lg p-3.5 border border-white/5 space-y-2.5">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block pb-1 border-b border-white/5">Compensation Details</span>
                    
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-500 block">Total Compensation</span>
                        <span className="font-mono font-bold text-white text-xs">
                          ${selectedAnalysis.entry.totalCompensation?.toLocaleString() || "0"}
                          <span className="text-[9px] text-slate-400 font-normal ml-1">USD</span>
                        </span>
                      </div>
                      
                      <div>
                        <span className="text-[10px] text-slate-500 block">Base Salary</span>
                        <span className="font-mono font-semibold text-slate-200 block">
                          {selectedAnalysis.entry.baseSalaryCurrency || "USD"} {selectedAnalysis.entry.baseSalary?.toLocaleString() || "0"}
                        </span>
                        {selectedAnalysis.entry.baseSalaryCurrency !== "USD" && selectedAnalysis.entry.exchangeRate && (
                          <span className="text-[9px] text-slate-500 font-mono">
                            (Rate: {selectedAnalysis.entry.exchangeRate})
                          </span>
                        )}
                      </div>

                      <div>
                        <span className="text-[10px] text-slate-500 block">Stock Details</span>
                        <div className="space-y-0.5">
                          <span className="font-mono text-slate-300 block">
                            Avg Annual: ${selectedAnalysis.entry.avgAnnualStockGrantValue?.toLocaleString() || "0"}
                          </span>
                          {selectedAnalysis.entry.firstYearStockGrantValue !== undefined && selectedAnalysis.entry.firstYearStockGrantValue > 0 && (
                            <span className="text-[9px] text-slate-500 block font-mono">
                              1st Year: ${selectedAnalysis.entry.firstYearStockGrantValue?.toLocaleString()}
                            </span>
                          )}
                          {selectedAnalysis.entry.totalStockGrantValue !== undefined && selectedAnalysis.entry.totalStockGrantValue > 0 && (
                            <span className="text-[9px] text-slate-500 block font-mono">
                              Total Grant: ${selectedAnalysis.entry.totalStockGrantValue?.toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>

                      <div>
                        <span className="text-[10px] text-slate-500 block">Bonus Details</span>
                        <div className="space-y-0.5">
                          <span className="font-mono text-slate-300 block">
                            Avg Annual: {selectedAnalysis.entry.baseSalaryCurrency || "USD"} {selectedAnalysis.entry.avgAnnualBonusValue?.toLocaleString() || "0"}
                          </span>
                          {selectedAnalysis.entry.firstYearBonusValue !== undefined && selectedAnalysis.entry.firstYearBonusValue > 0 && (
                            <span className="text-[9px] text-slate-500 block font-mono">
                              1st Year: {selectedAnalysis.entry.baseSalaryCurrency || "USD"} {selectedAnalysis.entry.firstYearBonusValue?.toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Attributes and Employer Signals */}
                  <div className="bg-[#070A10] rounded-lg p-3.5 border border-white/5 space-y-2.5">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block pb-1 border-b border-white/5">Tenure & Attributes</span>
                    
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-500 block">Level & Experience</span>
                        <span className="font-medium text-slate-200">
                          {selectedAnalysis.entry.level || "N/A"} &bull; {selectedAnalysis.entry.yearsOfExperience} YOE
                        </span>
                        {selectedAnalysis.entry.yearsAtCompany !== undefined && (
                          <span className="text-[10px] text-slate-500 block mt-0.5">
                            Tenure: {selectedAnalysis.entry.yearsAtCompany} Year(s)
                          </span>
                        )}
                      </div>
                      
                      <div>
                        <span className="text-[10px] text-slate-500 block">Work Arrangement</span>
                        <span className="inline-block px-1.5 py-0.5 rounded bg-slate-800 text-slate-350 border border-slate-700/50 font-medium text-[10px] capitalize mt-1">
                          {selectedAnalysis.entry.workArrangement || "not specified"}
                        </span>
                      </div>

                      <div className="col-span-2">
                        <span className="text-[10px] text-slate-500 block mb-1">Company Verification Signals</span>
                        <div>
                          {selectedAnalysis.entry.companyInfo?.registered ? (
                            <span className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold text-[9px] tracking-wide inline-flex items-center gap-1.5 leading-none">
                              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                              PARTNER EMPLOYER &bull; RECORD VERIFIED
                            </span>
                          ) : (
                            <span className="px-2 py-1 rounded bg-slate-800/40 text-slate-400 border border-slate-700/50 font-medium text-[9px] tracking-wide inline-flex items-center gap-1.5 leading-none">
                              <span className="w-1.5 h-1.5 bg-slate-500 rounded-full"></span>
                              CROWDSOURCED ENTRY
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Trust Score circular gauge or numeric index info */}
                  <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800/60 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Deduction Score</span>
                      <div className="flex items-baseline gap-1 mt-0.5">
                        <span className={`text-xl font-mono font-bold ${
                          selectedAnalysis.analysis.trustScore >= 80 ? "text-emerald-400" : selectedAnalysis.analysis.trustScore >= 50 ? "text-amber-500" : "text-rose-500"
                        }`}>
                          {selectedAnalysis.analysis.trustScore}/100
                        </span>
                        <span className="text-[11px] text-slate-500">Trust Factor</span>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Risk Label</span>
                      <p className="text-xs font-bold font-sans text-slate-200 mt-0.5">
                        {selectedAnalysis.analysis.riskLabel}
                      </p>
                    </div>
                  </div>

                  {/* Engine Warnings */}
                  <div className="space-y-2">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">Deterministic Flag Reasons:</span>
                    {selectedAnalysis.analysis.anomalies && selectedAnalysis.analysis.anomalies.length > 0 ? (
                      <ul className="space-y-1 bg-[#1E1118]/45 p-3 rounded-lg border border-rose-500/10">
                        {selectedAnalysis.analysis.anomalies.map((anomaly, i) => (
                          <li key={i} className="flex items-start gap-2 text-[11px] text-[#FDA4AF] leading-relaxed">
                            <span className="text-rose-400 font-semibold mt-0.5">&bull;</span>
                            <span>{anomaly}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="p-3 rounded-md bg-emerald-500/5 border border-emerald-500/10 text-emerald-400 text-[11px] flex gap-2 items-center">
                        <CheckCircle className="w-4 h-4 shrink-0 text-emerald-500" />
                        <span>Highly consistent. No validation warnings caught.</span>
                      </div>
                    )}
                  </div>

                  {/* Gemini Generated explanation block */}
                  <div className="space-y-2 pt-2 border-t border-slate-800">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">AI Logic Output:</span>
                      
                      {explanationMap[selectedAnalysis.entry.uuid] && (
                        <button
                          onClick={() => generateExplanation(selectedAnalysis, true)}
                          disabled={explaining}
                          className="flex items-center gap-1 text-[10px] text-blue-400 hover:text-white cursor-pointer active:scale-95 disabled:opacity-50"
                        >
                          <RefreshCw className={`w-3 h-3 ${explaining ? "animate-spin" : ""}`} />
                          <span>Regen AI</span>
                        </button>
                      )}
                    </div>

                    <div className="bg-[#070B14] rounded-lg p-4 border border-white/5 relative">
                      {explaining ? (
                        <div className="py-4 text-center space-y-2 text-slate-500">
                          <RefreshCw className="w-4 h-4 animate-spin mx-auto text-blue-400" />
                          <p className="text-[11px]">Asking Gemini standard audit model...</p>
                        </div>
                      ) : apiKeyMissing ? (
                        <div className="space-y-2.5">
                          <div className="flex items-start gap-2 text-[11px] text-amber-500 leading-relaxed">
                            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                            <span>
                              <strong>GEMINI_API_KEY Unavailable.</strong> Make sure to supply your key in AI Studio.
                            </span>
                          </div>
                          
                          {/* Fallback deterministic guidance when API is unconfigured */}
                          <div className="pt-2 border-t border-slate-800/50">
                            <span className="text-[9px] uppercase font-mono tracking-widest text-[#3B82F6] block mb-1">Local Mod Guide</span>
                            <p className="text-slate-300 text-xs italic leading-relaxed">
                              {selectedAnalysis.analysis.anomalies.length > 0 
                                ? `Evaluate: entry has a score of ${selectedAnalysis.analysis.trustScore}/100 with flagged differences: ${selectedAnalysis.analysis.anomalies[0]}`
                                : `Recommendation: This crowdsourced submission for ${selectedAnalysis.entry.company} contains consistent levels and standard compensation components.`}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <p className="text-xs text-slate-200 leading-relaxed italic">
                            &ldquo;{explanationMap[selectedAnalysis.entry.uuid] || "Click the button below to synthesize explanation."}&rdquo;
                          </p>

                          {!explanationMap[selectedAnalysis.entry.uuid] && (
                            <button
                               onClick={() => generateExplanation(selectedAnalysis, false)}
                               className="mt-3.5 w-full flex items-center justify-center gap-1.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold rounded cursor-pointer transition-colors active:scale-97"
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                              <span>Request Custom AI Summary</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              ) : (
                <div className="text-center py-12 text-slate-500 text-xs">
                  <span className="block mb-2 text-slate-600">No submission selected</span>
                  <p>Click a table row to generate a custom Gemini validation narrative.</p>
                </div>
              )}

            </div>

          </div>

          {/* Quick instructions/guide on the bottom */}
          <div className="bg-[#0F1626]/40 p-5 rounded-xl border border-white/5 items-center flex gap-4 text-xs font-sans text-slate-400 leading-relaxed">
            <div className="p-3 bg-blue-500/10 rounded-full text-[#3B82F6] shrink-0">
              <Coins className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <span className="text-white font-medium text-xs block">Signal Validation Guidelines:</span>
              <p>
                This MVP platform correlates baseline salary parameters (e.g. Pune standard INR conversion of ~83.94) against average regional indicators. 
                Any component mismatch or extreme deviation prompts deterministic deductions while utilizing <span className="text-blue-400">Gemini 3.5</span> to summarize findings for moderators.
              </p>
            </div>
          </div>

        </div>

      </main>

      {/* Structured JSON Paste Modal */}
      <JSONPasteModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onImportSuccess={handleImportSuccess}
      />

    </div>
  );
}
