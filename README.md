# 🎯 SmartHire AI — Recruiter & Student AI Resume Screening

A full-stack platform where **recruiters** post company drives (internship/full-time openings)
and **students** apply directly with their resume. Recruiters can then click **Analyze** to have
AI score every applicant's resume against the drive's requirements, automatically sort candidates
by match score, and filter/shortlist everyone above a chosen percentage — powered by the **Groq API**.

---

## 🧱 Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React (Vite) + Tailwind (CDN) + React Router |
| Backend | Node.js + Express |
| Database | MongoDB (Atlas free tier) |
| Auth | JWT, with `role: 'recruiter' \| 'student'` |
| AI | Groq API (OpenAI-compatible, free tier) |
| PDF parsing | `pdf-parse` |

## 👥 Two Login Types

- **Recruiter** — registers/logs in, creates unlimited **Drives** (e.g. "Drive 1", "Drive 2")
  each with a company name, job requirements, job description, stipend/CTC, and type
  (internship or full-time).
- **Student** — registers/logs in, browses all open drives, and applies to any of them by
  filling in name, contact details, education, role, and uploading a resume (PDF).

## 📁 Project Structure

```
resume-analyzer/
├── backend/
│   ├── server.js
│   ├── config/db.js
│   ├── models/
│   │   ├── User.js          # + role: 'recruiter' | 'student', encrypted Groq key
│   │   ├── Drive.js         # a recruiter's company posting
│   │   └── Application.js   # a student's application to a drive + AI score fields
│   ├── middleware/
│   │   ├── auth.js          # JWT verification (role-aware)
│   │   └── role.js          # requireRole('recruiter' | 'student')
│   ├── routes/
│   │   ├── auth.js          # register (with role) / login / me
│   │   ├── user.js          # save/remove/test Groq API key (recruiter's dashboard key option)
│   │   ├── drives.js        # create/list/analyze/shortlist drives
│   │   └── applications.js  # student applies, recruiter views/downloads resumes
│   └── utils/
│       ├── crypto.js        # AES-256 encryption for the stored Groq key
│       └── groqClient.js    # scores one resume against a drive's requirements
└── frontend/
    └── src/
        ├── pages/
        │   ├── Login.jsx, Register.jsx (with recruiter/student picker), Settings.jsx
        │   ├── BrowseDrives.jsx, ApplyDrive.jsx, MyApplications.jsx      (student)
        │   └── RecruiterDashboard.jsx, DriveDetail.jsx                  (recruiter)
        ├── components/Navbar.jsx (role-aware links)
        └── context/AuthContext.jsx
```

---

## ⚙️ How It Works

### Recruiter flow
1. Registers/logs in choosing **"Recruiter"**.
2. Goes to **Settings** → pastes a free Groq API key (encrypted with AES-256 before being
   stored in MongoDB — never sent back to the browser again).
3. Goes to **My Drives** → **+ New Drive** → fills in company name, drive title, requirements,
   job description, stipend, and type (internship/full-time).
4. Students start applying — each application (with resume) appears under that drive.
5. Recruiter opens the drive and clicks **🤖 Analyze Resumes**. The backend:
   - Decrypts the recruiter's Groq key
   - Sends each candidate's extracted resume text + the drive's requirements/JD to Groq
   - Gets back an ATS score (0–100), matched skills, missing skills, and short recruiter notes
   - Saves scores and **returns all applications sorted by score, highest first**
6. Recruiter sets a **"Shortlist ≥ __%"** threshold and clicks **Apply Filter** →
   everyone at or above that score is automatically marked `shortlisted`, everyone below is
   marked `rejected`. Statuses can also be changed manually per-candidate.
7. Recruiter can click **View** next to any candidate to open their original resume PDF.

### Student flow
1. Registers/logs in choosing **"Student / Job Seeker"**.
2. Goes to **Browse Drives** → sees all open company drives.
3. Clicks **Apply Now** on a drive → fills in name, contact, education, role, uploads
   their resume (PDF) → submits.
4. Goes to **My Applications** to track their ATS score (once analyzed) and status
   (`applied` / `shortlisted` / `rejected`) for every drive they've applied to.

---

## 💻 Local Setup

### Prerequisites
- Node.js 18+
- A free [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register) cluster (or local MongoDB)
- A free [Groq API key](https://console.groq.com/keys) (entered inside the app by each recruiter, not in `.env`)

### 1. Backend
```bash
cd backend
npm install
cp .env.example .env
```
Edit `.env`:
```
PORT=5000
MONGO_URI=mongodb+srv://<user>:<password>@cluster0.mongodb.net/resume-analyzer
JWT_SECRET=some_long_random_string
ENCRYPTION_KEY=another_long_random_string
```
Run it:
```bash
npm run dev
```
Backend runs on `http://localhost:5000`.

### 2. Frontend
```bash
cd frontend
npm install
cp .env.example .env
```
Edit `.env` if needed (defaults to `http://localhost:5000/api`):
```
VITE_API_URL=http://localhost:5000/api
```
Run it:
```bash
npm run dev
```
Frontend runs on `http://localhost:5173`.

### 3. Try it out
1. Open two browser sessions (or use incognito for one) — register one account as **Recruiter**
   and one as **Student**.
2. As the recruiter: go to Settings, add your Groq key, create a drive.
3. As the student: browse drives, apply with a sample resume PDF.
4. Back as the recruiter: open the drive, click **Analyze Resumes**, watch it sort candidates
   by score, then set a shortlist threshold and apply it.

---

## 🚀 Free Deployment Guide

Deploy this for **$0/month** using:
- **MongoDB Atlas** (free 512MB cluster) — database
- **Render** (free web service) — backend
- **Vercel** (free) — frontend

### Step 1 — MongoDB Atlas (Database)
1. Go to https://www.mongodb.com/cloud/atlas/register and create a free account.
2. Create a free **M0 cluster** (any nearby region).
3. **Database Access** → create a DB user with a password.
4. **Network Access** → **Add IP Address** → **Allow Access from Anywhere** (`0.0.0.0/0`).
5. **Connect** → **Drivers** → copy the connection string, e.g.:
   ```
   mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/resume-analyzer?retryWrites=true&w=majority
   ```

### Step 2 — Deploy the Backend on Render
1. Push this project to a GitHub repo (see Git steps below).
2. https://render.com → sign up free → **New +** → **Web Service** → connect your repo.
3. Settings:
   - **Root Directory:** `backend`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** Free
4. **Environment** variables:
   ```
   MONGO_URI = <your Atlas connection string>
   JWT_SECRET = <any long random string>
   ENCRYPTION_KEY = <another long random string>
   ```
5. Deploy → you'll get a URL like `https://campus-drive-backend.onrender.com`.
   > Free Render services sleep after 15 min idle and take ~30-60s to wake on the next request — normal for the free tier.

### Step 3 — Deploy the Frontend on Vercel
1. https://vercel.com → sign up free → **Add New** → **Project** → import the same repo.
2. Settings:
   - **Root Directory:** `frontend`
   - **Framework Preset:** Vite
3. Environment variable:
   ```
   VITE_API_URL = https://campus-drive-backend.onrender.com/api
   ```
   (use your actual Render URL, keep the `/api` suffix)
4. Deploy → you'll get a URL like `https://campus-drive-portal.vercel.app`.

### Step 4 — Test it live
Open your Vercel URL and repeat the "Try it out" steps above with real accounts.

### Alternative free hosts
- Backend: Railway (free trial credits) instead of Render — same steps.
- Frontend: Netlify instead of Vercel — same steps.

---

## 📦 Pushing to GitHub

```bash
cd resume-analyzer
git init
git add .
git commit -m "Initial commit: Campus Drive Portal"
git branch -M main
git remote add origin https://github.com/<your-username>/resume-analyzer.git
git push -u origin main
```

---

## 🔐 Security Notes
- Passwords are hashed with `bcrypt`.
- Each recruiter's Groq API key is encrypted (AES-256-CBC) with a server-side `ENCRYPTION_KEY`
  before being stored in MongoDB — never returned to the frontend after saving.
- Resumes are stored as base64 inside MongoDB (not on disk), so they survive restarts on
  free-tier hosts with ephemeral filesystems like Render.
- The resume-viewing endpoint accepts the JWT as a `?token=` query parameter (in addition to
  the `Authorization` header) so recruiters can open a PDF in a new browser tab. Keep this in
  mind if you extend the app — treat that URL as sensitive since anyone with the link and a
  valid token could view it.
- Use strong, unique values for `JWT_SECRET` and `ENCRYPTION_KEY` in production
  (e.g. generate with `openssl rand -hex 32`).

## 🛠 Troubleshooting
- **"Please add your Groq API key" error** → the recruiter needs to save a key in Settings first.
- **"You have already applied to this drive"** → each student can only apply once per drive by design.
- **CORS errors in production** → double check `VITE_API_URL` in Vercel matches your Render backend URL exactly (including `/api`).
- **Backend takes 30-60s to respond the first time** → Render's free tier waking from sleep; normal.
- **Analysis seems slow for many applicants** → resumes are scored one at a time to stay within
  Groq's free-tier rate limits; large drives (50+ candidates) will take longer.
