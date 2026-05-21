# 🎓 Hire Guru — Secure Smart Interview & Assessment Portal

[![Angular](https://img.shields.io/badge/Angular-18-DD0031?style=for-the-badge&logo=angular&logoColor=white)](https://angular.io/)
[![Node.js](https://img.shields.io/badge/Node.js-24-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-5.2-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-9.4-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Ollama](https://img.shields.io/badge/Ollama-AI-0052FF?style=for-the-badge&logo=ollama&logoColor=white)](https://ollama.com/)

**Hire Guru** (formerly QuizMaster) is a premium, enterprise-grade Interview & Candidate Assessment Portal built on the robust **MEAN stack** (MongoDB, Express, Angular, Node.js). Designed for modern recruitment operations, it combines role-based hiring dashboards with a secure, browser-locked candidate test-taking engine, local AI quiz builders, and digital canvas signature compliance checks.

---

## 🚀 Key Premium Capabilities

### 🛡️ 1. Secure Anti-Cheat Assessment Suite
The candidate quiz engine is protected by a multi-layered security wrapper:
*   **Fullscreen Lock & Detection**: Requests fullscreen status on quiz start, tracking user attempts to escape.
*   **Window Focus & Tab Monitor**: Intercepts `visibilitychange` and browser window `blur` events to detect app/tab-switching.
*   **Warning Warning Overlay**: Displays a modal alert for focus violations. Submits tests automatically upon reaching the transgression threshold (3 counts) with a `violation: true` stamp.
*   **Keyboard Shortcut Blocker**: Blocks Inspect Tool hooks (`F12`, `Ctrl+Shift+I`) and standard copy-paste bindings.
*   **Countdown Session Protection**: Retains warning counts and syncs timers in local storage in the event of an accidental page refresh (`F5`).

### 🤖 2. Local AI Ollama Quiz Generation
Empowers hiring managers to generate full structured quizzes instantly using offline AI models:
*   Integrates natively with local Ollama chat instances (`/api/chat`).
*   Prompts local LLM models to compile multiple-choice questions matching target skills and difficulty levels, returning structured JSON directly into Mongoose.
*   Gracefully falls back to helpful setup messages if local Ollama servers are offline.

### ✍️ 3. Compliant Canvas-Drawn Signatures
Ensures evaluators sign off securely:
*   Evaluators draw their official signatures directly on an interactive canvas in their profile dashboard.
*   Signature is stored securely as a Base64 image payload.
*   Feedback forms restrict submissions until the evaluator's signature is drawn and saved, providing legally audit-ready evaluations.

### 📂 4. Coding Challenge ZIP & Review Pipelines
*   Candidates or PMs can upload compressed zip code test files (restricted to `5MB` upload limits for server safety).
*   Evaluators can download and validate challenges directly from the details drawer, transitioning pipeline phases instantly from `coding_phase` to `evaluation`.

### 👥 5. Cohort Scheduling & Random Quiz Cascading
*   **Group Scheduling**: HR/Admins can schedule assessments for entire classes or teams concurrently.
*   **Randomized Assignment**: Supports selecting a list of quiz bundles and cascading a random quiz selection to each candidate, minimizing collaboration during testing.

---

## 🎭 Enterprise Role Matrix

Hire Guru implements strict role-based dashboard layouts tailored to each stakeholder:

*   **Administrator**: Manages global database configurations, registers staff accounts, imports Excel spreadsheets, and coordinates pipelines.
*   **HR Coordinator**: Monitors stats, schedules individual or group assessments, reviews all candidate files, and executes the final hiring decisions ("Offer", "On Hold", "Rejected").
*   **Project Manager (PM) / Lead**: Reviews candidate coding archives, coordinates interview validations, and submits technical feedback.
*   **Interviewer**: Examines technical profiles, validates technical challenges, and adds detailed ratings and reviews.
*   **Candidate**: Enters a clean, dark-themed dashboard to launch assigned quizzes, view progress tracking steps, upload zip files, and see current phase status.

---

## 💻 Tech Stack

*   **Frontend**: Angular 18 (Standalone Components, Signals, Reactive Directives, HTTP Interceptors, Custom CSS Theme)
*   **Backend**: Node.js, Express 5.x
*   **Database**: MongoDB (Mongoose 9.x ODM)
*   **AI Engine**: Ollama LLM integration
*   **Authentication**: JSON Web Tokens (JWT), HTTP Cookies, timing-safe Bcrypt password hashing
*   **Workbooks Parser**: `xlsx` spreadsheet compilation

---

## 🛠️ Local Installation & Setup

### 1. Clone the Repository
```bash
git clone https://github.com/AravindR-K/Quiz-Master.git
cd Quiz-Master
```

### 2. Backend Configuration
Open the `Backend` directory and install dependencies:
```bash
cd Backend
npm install
```

Create a `.env` file inside the `Backend` folder:
```env
PORT=3000
MONGODB_URI=your_mongodb_connection_uri
JWT_SECRET=your_secure_jwt_secret_key
OLLAMA_URL=http://localhost:11434
```

To seed the initial administrative accounts and sample data:
```bash
npm run seed
```

Start the backend node dev server:
```bash
npm run dev
```

### 3. Frontend Setup
Open a new terminal session in the project root:
```bash
cd Frontend
npm install
```

Start the Angular server:
```bash
npm run start
# or: ng serve
```
Open [http://localhost:4200/](http://localhost:4200/) in your web browser.

---

## 🔑 Seeding / Default Login Credentials

If the database seed script is executed successfully, use the following details to log in and inspect the dashboards:

*   **Administrator**: `admin@quizapp.com` / `admin123`
*   **HR Coordinator**: `hr@quizapp.com` / `hr123`
*   **Project Manager**: `pm@quizapp.com` / `pm123`
*   **Interviewer**: `interviewer@quizapp.com` / `interviewer123`
*   **Sample Candidate**: `candidate@quizapp.com` / `candidate123`

---

## 🎨 Theme & Spacing System
Hire Guru uses a responsive custom **Dark Cyber Theme** (`#0f1117`) centered around optimal text readability during intense assessments. Features elegant HSL customized borders, glassmorphic card overlays, responsive CSS flex grids, and smooth animations.

---

## 🤝 Contributing & License
Contributions, feedback, and issue submissions are welcome. Please open a pull request or file a ticket under the repository issues tab. Distributed under the **MIT License**.
