/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Terminal, Copy, ClipboardCheck, AlertTriangle, CheckCircle, Sparkles } from "lucide-react";

interface JSONPasteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: (count: number) => void;
}

const SAMPLE_JSON = `{
  "uuid": "8199449f-7a0d-4f83-9427-bdaeae2d507a",
  "company": "ServiceNow",
  "title": "Software Engineer",
  "jobFamily": "Software Engineer",
  "jobFamilySlug": "software-engineer",
  "level": "IC1",
  "focusTag": "Software Engineer",
  "yearsOfExperience": 1,
  "yearsAtCompany": 0,
  "location": "Pune, MH, India",
  "exchangeRate": 83.94,
  "baseSalary": 19000,
  "baseSalaryCurrency": "INR",
  "totalCompensation": 27600,
  "avgAnnualStockGrantValue": 5000,
  "avgAnnualBonusValue": 3500,
  "otherDetails": "Pasted sample illustrating currency mismatch base vs TC.",
  "companyInfo": {
    "registered": true,
    "icon": "https://img.logo.dev/servicenow.com?token=",
    "name": "ServiceNow"
  }
}`;

export default function JSONPasteModal({ isOpen, onClose, onImportSuccess }: JSONPasteModalProps) {
  const [inputText, setInputText] = useState("");
  const [errorCheck, setErrorCheck] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleCopySample = () => {
    navigator.clipboard.writeText(SAMPLE_JSON);
    setCopied(true);
    setInputText(SAMPLE_JSON);
    setErrorCheck(null);
    setSuccessMsg("Sample dataset successfully loaded into textarea.");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleValidateAndSubmit = async () => {
    if (!inputText.trim()) {
      setErrorCheck("Please input some JSON content first.");
      return;
    }

    setIsSubmitting(true);
    setErrorCheck(null);
    setSuccessMsg(null);

    try {
      let parsed: any;
      try {
        parsed = JSON.parse(inputText);
      } catch (err: any) {
        throw new Error(`JSON format syntax error: ${err.message}`);
      }

      // Standardize to array
      const entries = Array.isArray(parsed) ? parsed : [parsed];

      // Quick validation check
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        if (!entry.company) {
          throw new Error(`Element [${i}] is missing the mandatory 'company' field string.`);
        }
        if (!entry.title) {
          throw new Error(`Element [${i}] is missing the mandatory 'title' field string.`);
        }
        if (entry.totalCompensation === undefined) {
          throw new Error(`Element [${i}] is missing the 'totalCompensation' numeric parameter.`);
        }
      }

      // Submit to server endpoint
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries, reset: true }),
      });

      if (!response.ok) {
        const errVal = await response.json();
        throw new Error(errVal.error || "Failed database import.");
      }

      setSuccessMsg(`Successfully evaluated and imported ${entries.length} crowdsourced entry(s).`);
      setTimeout(() => {
        onImportSuccess(entries.length);
        setInputText("");
        onClose();
        setSuccessMsg(null);
      }, 1000);

    } catch (err: any) {
      setErrorCheck(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div id="json-paste-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs font-sans">
      <div 
        id="modal-card" 
        className="w-full max-w-2xl bg-[#0F1626] border border-slate-800 rounded-xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]"
      >
        {/* Header */}
        <div className="px-5 py-4 bg-[#162035] border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-[#3B82F6]" />
            <span className="text-sm font-semibold tracking-wide text-white">Import Crowdsourced JSON Submission</span>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white text-xs px-2.5 py-1 rounded bg-slate-900 border border-slate-800 cursor-pointer"
          >
            Esc Close
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          <p className="text-xs text-gray-400 leading-relaxed">
            Paste raw JSON from crowdsourced forms or the internal submissions bucket. 
            The system applies deterministic audit rules on base salaries, exchange rates, and tenure metrics.
          </p>

          {/* Quick template load banner */}
          <div className="p-3.5 bg-slate-900/60 rounded-lg border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <span className="text-[#3B82F6] text-xs font-mono font-medium flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#10B981]" /> Demo ServiceNow Record
              </span>
              <p className="text-[11px] text-gray-400">
                Pune, India engineer entry showcasing direct currency anomalies.
              </p>
            </div>
            <button
              id="copy-sample-btn"
              type="button"
              onClick={handleCopySample}
              className="flex items-center gap-1.5 text-xs bg-[#1A253C] hover:bg-[#253554] border border-slate-700 hover:border-slate-600 text-white font-medium px-3 py-1.5 rounded-md transition-all active:scale-95 cursor-pointer"
            >
              {copied ? <ClipboardCheck className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Loaded!" : "Load Sample Schema"}
            </button>
          </div>

          {/* Text Area */}
          <div className="flex flex-col space-y-1.5">
            <label className="text-xs font-mono text-gray-400">Submit pasted JSON object:</label>
            <textarea
              id="json-textarea"
              rows={11}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder='{\n  "company": "Google",\n  "title": "Software Engineer",\n  "level": "L3",\n  "yearsOfExperience": 2,\n  "totalCompensation": 185000,\n  ...\n}'
              className="w-full bg-[#070B14] border border-slate-800 focus:border-slate-700 rounded-lg text-xs font-mono p-3.5 text-slate-300 outline-none leading-relaxed transition-all focus:ring-1 focus:ring-slate-800"
            />
          </div>

          {/* Messages */}
          {errorCheck && (
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs leading-relaxed">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorCheck}</span>
            </div>
          )}

          {successMsg && (
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs leading-relaxed">
              <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-5 py-4 bg-[#162035] border-t border-slate-800 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-gray-400 hover:text-white rounded-md bg-slate-900 border border-slate-800 transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleValidateAndSubmit}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-medium bg-[#3B82F6] hover:bg-[#2563EB] text-white rounded-md border border-sky-600 transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none cursor-pointer flex items-center gap-1.5"
          >
            {isSubmitting ? "Auditing Entry..." : "Validate & Import"}
          </button>
        </div>
      </div>
    </div>
  );
}
