# Mega Novels

Full-stack app with:
- React frontend (modern UI + react-icons)
- Express backend API
- Firebase Google Auth (client)
- Firebase Realtime Database (server via Firebase Admin)

## Features implemented
- Google login
- First-time profile setup (nickname + Google profile picture)
- Publish novels in any language
- Like novels
- Comment on novels
- Create groups
- Join/leave groups
- Group chat messages
- Direct messages between users

## Project structure
- `client/` React + Vite frontend
- `server/` Express API + Firebase Admin

## Environment setup

### 1) Client env
Copy `client/.env.example` to `client/.env` and fill values.

### 2) Server env
Copy `server/.env.example` to `server/.env` and fill values.

You need Firebase project credentials from a service account for server env:
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `FIREBASE_DATABASE_URL`

## Run
In two terminals:

Terminal A:
```bash
cd server
npm install
npm run dev
```

Terminal B:
```bash
cd client
npm install
npm run dev
```

Frontend: `http://localhost:5173`
Backend: `http://localhost:4000`

## Important Firebase notes
- Enable **Google Auth** in Firebase Authentication.
- Use Realtime Database (not Firestore) and set security rules appropriate for your app.
- Backend already verifies Firebase ID tokens; database writes go through backend routes.

## API overview
All `/api/*` routes require `Authorization: Bearer <firebase_id_token>`.

- `GET /api/profiles/me`
- `POST /api/profiles/me`
- `GET /api/profiles`
- `GET /api/novels`
- `POST /api/novels`
- `POST /api/novels/:novelId/like`
- `GET /api/novels/:novelId/comments`
- `POST /api/novels/:novelId/comments`
- `GET /api/groups`
- `POST /api/groups`
- `POST /api/groups/:groupId/join`
- `GET /api/groups/:groupId/messages`
- `POST /api/groups/:groupId/messages`
- `GET /api/dms/:otherUid`
- `POST /api/dms/:otherUid`
