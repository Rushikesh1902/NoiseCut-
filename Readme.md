# NoiseCut 🛡️

> Cutting noise from crowdsourced compensation data.

NoiseCut is an AI-powered trust validation dashboard built for the "Signal Over Noise" Hackathon in collaboration with Levels.fyi.  
The platform acts as an automated moderation hub for crowdsourced compensation data—safeguarding dataset integrity by detecting suspicious or unrealistic entries, calculating deterministic trust scores via Python, and writing concise AI-driven diagnostic summaries using the Gemini API.

---

## 🔗 Live Demo

```md id="g9k4iw"
[https://noisecut.onrender.com]
```

---

## 📸 Preview
### Demo Video

```md id="lmn0jp"
[Watch Demo](https://your-demo-video-link.com)
```

---

# 🚀 Features

* Dynamic JSON dataset import
* Reset data store functionality
* Trust scoring & anomaly detection
* Gemini-powered explanations
* Levels.fyi inspired dark dashboard
* Responsive detail inspection panel

---

# ⚙️ Workflow

```text id="wv17kh"
Import JSON → Analyze Data → Trust Score → Detect Anomalies → Gemini Explanation
```

---

# 🛠️ Tech Stack

Frontend:

* React
* Vite
* Tailwind CSS

Backend:

* Express.js
* TypeScript

AI:

* Gemini API

---

# 📂 Project Structure

```text id="0rxxh4"
.
├── backend/
│
├── src/
│   ├── backend/
│   │   └── scoring.ts
│   │
│   ├── components/
│   │   ├── JSONPasteModal.tsx
│   │   └── Logo.tsx
│   │
│   ├── data/
│   │   └── submissions.json
│   │
│   ├── index.css
│   ├── types.tsx
│   ├── App.tsx
│   └── main.tsx
│
├── index.html
├── metadata.json
├── package.json
├── package-lock.json
├── server.ts
├── .env.example
├── .gitignore
└── README.md
```

---

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
