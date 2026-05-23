# NoiseCut 🛡️ # 
NoiseCut is an AI-powered trust validation dashboard built for the "Signal Over Noise" Hackathon in collaboration with Levels.fyi.

The platform acts as an automated moderation hub for crowdsourced compensation data—safeguarding dataset integrity by detecting suspicious or unrealistic entries, calculating deterministic trust scores via Python, and writing concise AI-driven diagnostic summaries using the Gemini API.
## 🚀 Key Features ##
1. Dynamic JSON Data Ingestion & State Reset
Dynamic Import: Paste or upload raw/crowdsourced compensation JSON entries directly. The entire dashboard recalculates instantly without static placeholders.
Full Wipe/Reset: Hit Reset Data Store to clear all session entries, empty stats panels, flush explanations, and return the table to a pristine "No dataset loaded" placeholder state.
2. Dual-Engine Architecture (Node + Python Bridge)
Deterministic Trust Scores: Handled entirely inside a highly responsive Python script (backend/scoring.py). It calculates a trust metric between 0 and 100, tagging rows with Low, Medium, or High Risk badges.
Score Considerations: Disproportionate base-to-bonus ratio, level/experience disparities, geographical currency mismatching, and missing field parameters.
3. Smart GenAI Highlights (Gemini API)
Integrated with the official @google/genai SDK on the backend.
Automatically writes sharp, analytical explanations contextually parsing why an entry represents an anomaly (e.g., "This compensation appears moderately higher than typical software engineering entries at this grade.") without directly computing trust indexes.
4. Levels.fyi Inspired UI / Detail Inspection Drawer
Row-Selection Tracking: Inspect complete breakdowns of Base, Total Compensation (TC), sign-on bonuses, geographical rates, first-year stock vesting, work location flexibility, and verified company partner signals.
UX Fixes: Uniform highlight/selected row background extensions across responsive grids, zero-lag sidebar interaction, and unified dark interfaces.
## 🛠️ Tech Stack ##
- Frontend: React 18, Vite, Tailwind CSS, Framer Motion (for fluid viewport transitions), Lucide React
- Backend: Express Server, TypeScript (tsx runner), direct Python Child Process Integration
- Data Layer: Local storage & JSON session caching
- AI Engine: Google Cloud Gemini Pro via @google/genai Node SDK
## 📂 Project Directory Structure ##

```
code
Text
├── backend/
│   └── scoring.py          # Complete Python scorer (determines anomaly status & score values)
├── src/
│   ├── backend/
│   │   └── scoring.ts      # TypeScript-equivalent scoring fallback engine
│   ├── components/
│   │   ├── JSONPasteModal.tsx   # JSON Paste & file drop validation
│   │   └── Logo.tsx        # Styled branding asset
│   ├── data/
│   │   └── submissions.json     # Default crowdsourced initial records
│   ├── App.tsx             # Interactive dashboard (sidebar, tables, details panels)
│   ├── types.ts            # Type-safe model interfaces
│   └── main.tsx            # Main application bootstrap
├── server.ts               # Express.js production back-end & Gemini API proxy router
├── package.json            # Node configuration scripts & dynamic dependencies
└── .env.example            # Environment skeleton
```
## ⚡ Setup & Installation ##
Prerequisite
Make sure you have Node.js (v18+) and Python 3 installed on your workstation.
1. Clone the Repository
code
Bash
git clone https://github.com/your-username/noisecut.git
cd noisecut
2. Install Project Dependencies
code
Bash
npm install
3. Configure the Environment
Create a .env file in the root directory:
code
Env
GEMINI_API_KEY=your_actual_gemini_api_key_here
PORT=3000
4. Run the Development Server
This starts the backend Node.js wrapper acting as our proxy and server:
code
Bash
npm run dev
Open your browser and navigate to http://localhost:3000.
5. Build for Production
code
Bash
npm run build
npm start
## 📝 Payload Schema Example
To test the dynamic import, use an array containing JSON objects formatted with this structure:
```
code
JSON
[
  {
    "uuid": "test-id-1",
    "company": "ServiceNow",
    "title": "Software Engineer",
    "jobFamily": "Software Engineer",
    "level": "IC1",
    "yearsOfExperience": 1,
    "yearsAtCompany": 0,
    "location": "Pune, MH, India",
    "exchangeRate": 83.94,
    "baseSalary": 19000,
    "baseSalaryCurrency": "INR",
    "totalCompensation": 27600,
    "avgAnnualStockGrantValue": 5000,
    "avgAnnualBonusValue": 3500,
    "workArrangement": "hybrid"
  }
]
```
