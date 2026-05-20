# Hire Guru Interview Portal — Architecture & Technical Reference

This document provides a complete technical guide to the codebase of the **Hire Guru** Interview Portal. It covers both the **Express/Node.js/MongoDB Backend** and the **Angular 17+ Frontend**, detailing every directory, file, model schema, API endpoint, and standalone frontend component.

---

## 1. Directory Tree & Architecture Overview

The application follows a clean, decoupled Client-Server architecture:
*   **Backend**: A RESTful Express server communicating with a MongoDB database using Mongoose.
*   **Frontend**: A modern Angular application featuring standalone components, reactive signals, and custom route guards.

```
Quiz-Master/
├── Backend/
│   ├── config/            # DB Connection utilities
│   ├── middleware/        # Authentication and file upload middlewares
│   ├── models/            # Mongoose Schemas (User, Interview, Quiz, Question)
│   ├── routes/            # REST API endpoints
│   ├── uploads/           # Static storage for zip files and signatures
│   └── server.js          # Main application entry point
└── Frontend/
    ├── src/
    │   ├── app/
    │   │   ├── components/# Layout and Sidebar elements
    │   │   ├── guards/    # Role-based route protectors
    │   │   ├── pages/     # Feature components grouped by role
    │   │   └── services/  # API and anti-cheat Angular services
    │   └── styles.css     # Global responsive styles
```

---

## 2. Backend Architecture (Express & Mongoose)

### 2.1 Database Models (`Backend/models/`)

#### 1. User Model (`User.js`)
Represents all system users (Candidates, Interviewers, PMs, HRs, and Admins).
*   **What it does**: Stores user profile details, credentials, and digital signatures.
*   **How it does it**: 
    *   Uses a pre-save hook to automatically hash raw passwords using `bcryptjs` (salt factor 10).
    *   Defines an enum for `role`: `['admin', 'hr', 'candidate', 'pm', 'interviewer']`.
    *   Stores signatures as standard Base64-encoded strings (enabling easy PDF rendering and canvas saving).
    *   Tracks candidate groups (e.g., `'Fresher'`) and skills.

#### 2. Interview Model (`Interview.js`)
The central entity mapping a candidate's journey through assessments and evaluations.
*   **What it does**: Holds evaluations, assignments, quiz marks, and final decision states.
*   **How it does it**:
    *   Contains reference fields mapping to the `User` model: `candidateId`, `assignedInterviewers`, `assignedHRs`, and `assignedPMs`.
    *   Maintains an embeddable sub-document schema `evaluationSchema` to record feedback from multiple stakeholders:
        ```javascript
        {
          evaluatorId: ObjectId,
          evaluatorRole: String,
          comments: String,
          recommendation: Enum['offer', 'on_hold', 'rejected', '2nd_round'],
          date: Date
        }
        ```
    *   Manages the linear progression of states: `pending`, `quiz_phase`, `coding_phase`, `evaluation`, and `completed`.

#### 3. Quiz & Question Models (`Quiz.js`, `Question.js`)
*   **What they do**: Define assessment blueprints and individual question banks.
*   **How they do it**:
    *   `Quiz.js` configures time limits, difficulty settings, and assignees.
    *   `Question.js` stores questions, options, and index mappings for automated grading.

---

### 2.2 API Routers & Controllers (`Backend/routes/`)

All API routes start with `/api` and are mapped in `server.js`:

#### 1. Authentication Endpoints (`/api/auth`)
File: `routes/auth.js`
*   `POST /register`: Registers new candidates and links them to a default group.
*   `POST /login`: Validates credentials, sets `isLoggedIn: true` via an optimized `updateOne` query (avoiding pre-save password re-hashing), and generates a JWT.
*   `POST /logout`: Updates `isLoggedIn: false` and invalidates client session state.
*   `POST /signature`: Updates the logged-in staff member's Base64 digital signature.
*   `GET /me`: Returns currently validated session payload.

#### 2. Interview Operations (`/api/interview`)
File: `routes/interview.js`
*   `POST /`: Creates an individual interview and sets up quiz trackers.
*   `POST /group`: Creates a batch of interviews for an entire candidate group. Supports automatic random assignment of quizzes from target sets.
*   `GET /`: Fetches interviews. Evaluators are restricted to seeing interviews where they are explicitly assigned or named as a creator.
*   `PUT /:id/evaluate`: Saves or updates an evaluator's feedback and auto-advances the status.
*   `PUT /:id/decision`: Sets the absolute final selection outcome and switches state to `completed`.
*   `POST /:id/coding-submission`: Saves the uploaded zip file to `/uploads` using multer middleware.
*   `PUT /:id/validate-coding`: Validates code quality and advances the interview phase.

---

### 2.3 Middleware Stack (`Backend/middleware/`)

*   **Auth Middleware (`auth.js`)**:
    Extracts the Bearer token from the `Authorization` header, decodes the JWT signature, and checks the database for verification. The `authorize(...roles)` function implements role-based route blocking:
    ```javascript
    exports.authorize = (...roles) => {
      return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
          return res.status(403).json({ message: 'Forbidden' });
        }
        next();
      };
    };
    ```
*   **File Uploads (`upload.js`)**:
    Uses `multer` configured to accept `.zip`, `.rar`, and images, renaming them securely with unique timestamps.

---

## 3. Frontend Architecture (Angular 17+)

The frontend is a lightweight, responsive SPA using Angular's standalone components.

### 3.1 Core Navigation & Role Guards (`guards/auth.guard.ts`)

Navigation access is secured by Angular route guards, matching active token payload checks:
*   `adminGuard`: Validates role is `admin`.
*   `hrGuard`: Validates role is `hr`.
*   `pmGuard`: Validates role is `pm`.
*   `interviewerGuard`: Validates role is `interviewer`.
*   `candidateGuard`: Validates role is `candidate`.

---

### 3.2 Key Pages & Features (`pages/`)

#### 1. HR Portal Components (`pages/hr/`)
*   **dashboard/**: Renders candidate pipelines, overview counts, and validation queues.
*   **individual-interview/**: HR interface to create individual candidates, assign exactly one Interviewer, PM, and HR via clean radio selectors, and assign specific aptitude tests.
*   **group-interview/**: Supports batch candidate configuration.

#### 2. Project Manager Portal (`pages/ProjectManager/`)
*   **group-interview/** & **individual-interview/**: Enables PMs to view validation files, download candidate codes, write comments, sign, and make recommendations.

#### 3. Interviewer Portal (`pages/Interviewer/`)
*   Provides similar focused assessment cards as the PM view, customized for appointed interviewers.

#### 4. Candidate Portal Components (`pages/candidate/`)
*   **profile/**: Holds resume storage settings and topics of interest comfortable ratings.
*   **take-quiz/**: The secure assessment room featuring a live countdown, full-screen lock request, cheat counters, tab change watchers, and the auto-grading system.

---

### 3.3 Angular Services (`services/`)

#### 1. Anti-Cheat Engine (`anti-cheat.service.ts`)
*   **What it does**: Tracks exam environment security and blocks external windows.
*   **How it does it**:
    *   Attaches native browser event listeners to `window` for `blur` and `focus`.
    *   Tracks visibility state changes in `document.hidden`.
    *   Triggers warning modals via a shared RXJS state pipeline and records cheat transgression counters.

#### 2. Quiz API Service (`quiz.service.ts`)
*   Acts as the central reactive client communicating with backend endpoints `/api/interview`, `/api/auth`, and `/api/hr` to pass score arrays, validation parameters, and candidate profile signatures.
