/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { TrustScorer } from "../src/backend/scoring.js";
import { CompensationEntry, SalaryAnalysis } from "../src/data/types.js";
import { execSync } from "child_process";

// Safe bridge execution to compute score and anomaly flags in Python
function runPythonScoring(dataset: CompensationEntry[]): SalaryAnalysis[] {
  try {
    const inputPayload = JSON.stringify({ dataset });
    const output = execSync("python3 backend/scoring.py", {
      input: inputPayload,
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024,
    });
    return JSON.parse(output.trim());
  } catch (err: any) {
    console.error("Python Scoring script error. Falling back to TypeScript:", err.message);
    const scorer = new TrustScorer(dataset);
    return dataset.map((e) => ({
      entry: e,
      analysis: scorer.analyzeEntry(e),
    }));
  }
}


// Load environment variables
import dotenv from "dotenv";
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: "15mb" }));

// In-memory session store initialized with user seed data or custom store
let submissionsDb: CompensationEntry[] = [];
const submissionsDbPath = path.join(process.cwd(), "submissions-db.json");
const submissionsSeedPath = path.join(process.cwd(), "src", "data", "submissions.json");

try {
  if (fs.existsSync(submissionsDbPath)) {
    const fileContent = fs.readFileSync(submissionsDbPath, "utf-8");
    submissionsDb = JSON.parse(fileContent);
  } else if (fs.existsSync(submissionsSeedPath)) {
    const fileContent = fs.readFileSync(submissionsSeedPath, "utf-8");
    submissionsDb = JSON.parse(fileContent);
  }
} catch (error) {
  console.error("Failed to load initial dataset:", error);
}

// 1. Initialized Gemini client lazily to prevent crash if key is missing during container boot
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY is not configured in environment variables. Please check Settings > Secrets.");
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// --- API ENDPOINTS ---

/**
 * Health check endpoint
 */
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

/**
 * GET current validated compensation database
 */
app.get("/api/submissions", (req, res) => {
  const analyzed = runPythonScoring(submissionsDb);
  res.json(analyzed);
});

/**
 * POST dynamic submissions to evaluate or reset the database
 */
app.post("/api/analyze", (req, res) => {
  try {
    const { entries, reset } = req.body;

    const rawEntries = Array.isArray(entries) ? entries : (reset ? [] : null);
    if (rawEntries === null) {
        res.status(400).json({ error: "Invalid payload: entries must be an array" });
        return;
    }

    const newEntries: CompensationEntry[] = rawEntries.map((raw: any) => {
      return {
        uuid: raw.uuid || Math.random().toString(36).substring(2, 15),
        company: raw.company || "Unknown",
        title: raw.title || "Software Engineer",
        jobFamily: raw.jobFamily || raw.title || "Software Engineer",
        jobFamilySlug: raw.jobFamilySlug || "software-engineer",
        level: raw.level || "N/A",
        focusTag: raw.focusTag || "",
        yearsOfExperience: typeof raw.yearsOfExperience === "number" ? raw.yearsOfExperience : 0,
        yearsAtCompany: typeof raw.yearsAtCompany === "number" ? raw.yearsAtCompany : 0,
        yearsAtLevel: raw.yearsAtLevel || null,
        location: raw.location || "Unknown",
        exchangeRate: typeof raw.exchangeRate === "number" ? raw.exchangeRate : 1.0,
        baseSalary: typeof raw.baseSalary === "number" ? raw.baseSalary : 0,
        baseSalaryCurrency: raw.baseSalaryCurrency || "USD",
        totalCompensation: typeof raw.totalCompensation === "number" ? raw.totalCompensation : 0,
        avgAnnualStockGrantValue: typeof raw.avgAnnualStockGrantValue === "number" ? raw.avgAnnualStockGrantValue : 0,
        avgAnnualBonusValue: typeof raw.avgAnnualBonusValue === "number" ? raw.avgAnnualBonusValue : 0,
        offerDate: raw.offerDate || new Date().toString(),
        companyInfo: raw.companyInfo || { name: raw.company || "Unknown" },
        education: raw.education || null,
        otherDetails: raw.otherDetails || null,
      };
    });

    if (reset) {
      submissionsDb = [...newEntries];
    } else {
      // Append non-duplicate entries based on uuid
      const existingUuids = new Set(submissionsDb.map(e => e.uuid));
      for (const entry of newEntries) {
        if (!existingUuids.has(entry.uuid)) {
          submissionsDb.push(entry);
        }
      }
    }

    // Persist session if possible (silent fallback on read-only environments)
    try {
      fs.writeFileSync(submissionsDbPath, JSON.stringify(submissionsDb, null, 2), "utf-8");
    } catch (writeError) {
      // Ignore write locks in staging or container sandboxes
    }

    // Return the recalculated dataset analyses
    const analyzed = runPythonScoring(submissionsDb);

    res.json({ success: true, count: submissionsDb.length, data: analyzed });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST explain single entry anomaly/status using Gemini
 */
app.post("/api/explain", async (req, res) => {
  try {
    const { entry, analysis } = req.body as SalaryAnalysis;

    if (!entry || !analysis) {
        res.status(400).json({ error: "Missing entry or analysis parameters" });
        return;
    }

    // Instantiated Gemini client lazily
    const ai = getGeminiClient();

    const systemInstruction = 
      "You are a professional compensation analyst for NoiseCut. " +
      "Your sole role is to review a crowdsourced compensation submission and its evaluation metrics from our deterministic risk engine, " +
      "then write a concise explanation detailing why this submission is trustworthy, a borderline anomaly, or highly suspicious. " +
      "Keep your tone analytical, precise, constructive, and professional. " +
      "Do NOT use dramatic language, system codes, or generic summaries. " +
      "Output in 1 to 2 clear sentences. Direct your explanation to an moderation reviewer.";

    const promptText = `
      Please explain the audit evaluation for this crowdsourced compensation entry:
      
      --- SALARY DATA ---
      Company: ${entry.company}
      Role Title: ${entry.title}
      Reported Level: ${entry.level}
      Years of Experience: ${entry.yearsOfExperience}
      Years at Company: ${entry.yearsAtCompany}
      Location: ${entry.location}
      Reported Total Compensation (TC): USD ${entry.totalCompensation?.toLocaleString()}
      Base Salary: ${entry.baseSalaryCurrency} ${entry.baseSalary?.toLocaleString()} (Exchange Rate: ${entry.exchangeRate})
      Stock Value (Annualized): USD ${entry.avgAnnualStockGrantValue?.toLocaleString()}
      Bonus Value (Annualized): ${entry.baseSalaryCurrency || "USD"} ${entry.avgAnnualBonusValue?.toLocaleString()}
      Other Details: ${entry.otherDetails || "None provided"}
      
      --- RISK ENGINE AUDIT ---
      Trust Validation Score: ${analysis.trustScore}/100
      Risk Classification: ${analysis.riskLabel}
      Engine Flags/Anomalies Detected:
      ${analysis.anomalies && analysis.anomalies.length > 0 
        ? analysis.anomalies.map((a, i) => `${i + 1}. ${a}`).join("\n") 
        : "None (Entry mathematically consistent and regular)"}
      
      Write the concise moderation summary now.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: promptText,
      config: {
        systemInstruction,
        temperature: 0.4,
      },
    });

    res.json({
      uuid: entry.uuid,
      explanation: response.text?.trim() || "No explanation could be synthesized at this time."
    });
  } catch (error: any) {
    console.error("Gemini Explanation Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// --- FRAMEWORK GRAPHICS SERVING & DEV MOUNT ---

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    // Vite middleware for real-time asset compilation in dev mode
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Mounted Vite development middleware.");
  } else {
    // Serve static files from compiled dist folder in production
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`NoiseCut moderation server active on: http://0.0.0.0:${PORT}`);
  });
}

startServer();
