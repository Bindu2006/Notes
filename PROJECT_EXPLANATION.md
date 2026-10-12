# Collaborative Notes Studio — Full Project Explanation

This document explains the project in detail so it can be used for interviews, technical review, architecture discussions, and deployment understanding.

---

## 1. Project Summary

This application is a collaborative note-taking app where users can:
- sign up and log in
- create notes
- edit notes in a rich text/markdown-like editor
- share notes with other users
- assign collaborator roles: viewer or editor
- collaborate in real time using Socket.IO
- maintain note ownership and access control

It is designed as a full-stack application with:
- React + TypeScript frontend
- FastAPI backend
- MongoDB database
- Docker + Docker Compose for local deployment
- JWT-based authentication
- WebSocket real-time sync

This is a great project example for interviews because it combines:
- authentication
- authorization
- data modeling
- real-time collaboration
- API design
- database indexing
- Docker deployment
- modern frontend state management

---

## 2. Tech Stack Used

### Frontend
- React 19
- TypeScript
- Vite
- React Router
- Tailwind CSS
- Lucide React icons
- Socket.IO client library

Why these were chosen:
- React is ideal for building UI with reusable components
- TypeScript improves reliability and maintainability
- Vite provides very fast local development and build
- Tailwind gives clean, modern styling without large CSS files
- React Router handles auth-protected pages and navigation
- Socket.IO client enables live updates without refreshing the page

Alternatives:
- Vue + Vite
- Next.js
- plain HTML/CSS/JS
- Redux/Zustand for state management (not necessary here because context is enough)

### Backend
- Python 3.11
- FastAPI
- Pydantic
- JWT via python-jose
- bcrypt via passlib / bcrypt
- Motor (MongoDB async driver)
- python-socketio

Why these were chosen:
- FastAPI gives very fast API development with async support
- Pydantic validates request payloads and serializes data cleanly
- JWT gives stateless authentication
- Motor supports async MongoDB operations
- python-socketio supports real-time collaboration with WebSockets

Alternatives:
- Node.js + Express
- Django + Django REST Framework
- Flask + Flask-RESTX
- PostgreSQL with SQLAlchemy for relational design

### Database
- MongoDB 6.0

Why MongoDB here:
- JSON-like document structure matches note objects well
- flexible schema for notes, collaborators, and metadata
- easy to store nested collaborator arrays
- good fit for a collaborative document app where each note contains a list of collaborators

Alternatives:
- PostgreSQL
- MySQL
- Firebase Firestore
- Redis for caching only (not a main DB here)

### Deployment / Containerization
- Docker
- Docker Compose

Why:
- easy local deployment
- reproducible environment
- clean networking between backend, frontend, and database

Alternatives:
- Kubernetes for scale
- PM2 for Node apps
- virtual machines without containers

---

## 3. High-Level Architecture

The application follows a classic full-stack architecture:

Frontend (React app)
  -> calls REST APIs to FastAPI backend
  -> opens Socket.IO connection for live updates
  -> stores JWT token locally in browser storage

Backend (FastAPI)
  -> validates JWT user sessions
  -> authorizes note access
  -> performs CRUD operations on MongoDB
  -> uses Socket.IO to broadcast live note changes

Database (MongoDB)
  -> stores users and notes
  -> keeps collaborator arrays for permission tracking
  -> stores created_at / updated_at timestamps

This architecture is common for collaborative SaaS apps.

---

## 4. Project Folder Structure

Root structure:
- [docker-compose.yml](docker-compose.yml)
- [.env](.env)
- [backend/](backend/)
- [frontend/](frontend/)
- [PROJECT_EXPLANATION.md](PROJECT_EXPLANATION.md)

### Root-level files

#### [docker-compose.yml](docker-compose.yml)
Purpose:
- defines the multi-service Docker environment
- creates MongoDB, backend, and frontend containers
- sets ports and network connections

Why it is needed:
- local development and deployment should be consistent
- the services must know how to communicate with each other

Key details:
- MongoDB container uses image `mongo:6.0`
- backend container runs the FastAPI app
- frontend container runs Vite dev server
- all services share a Docker bridge network named `notes_network`

Why MongoDB is exposed on `27017`:
- local database access from host or container debugging

Alternatives:
- use a managed MongoDB service instead of a container
- use separate compose files for dev and prod

#### [.env](.env)
Purpose:
- stores environment variables for local deployment

Variables used:
- `JWT_SECRET`
- `JWT_ALGORITHM`
- `ACCESS_TOKEN_EXPIRE_MINUTES`
- `MONGODB_URL`
- `DATABASE_NAME`
- `VITE_API_URL`

Why environment variables are important:
- avoid hardcoded secrets in source code
- make deployment environment-specific

Alternatives:
- store config in a config file
- use secret managers like AWS Secrets Manager, Azure Key Vault, or GCP Secret Manager

---

## 5. Backend Folder

### [backend/Dockerfile](backend/Dockerfile)
Purpose:
- builds the backend container image

What it does:
- starts from Python 3.11 slim image
- installs backend dependencies from requirements.txt
- copies application code into `/app`
- runs Uvicorn to serve the FastAPI app on port 8000

Why Python slim image:
- smaller than full Python image
- faster build and deployment

Alternatives:
- use a custom base image
- use Gunicorn + Uvicorn workers in production

### [backend/requirements.txt](backend/requirements.txt)
Purpose:
- lists Python dependencies

Major packages:
- fastapi
- uvicorn
- motor
- python-socketio
- python-jose
- bcrypt
- pydantic[email]
- pytest / pytest-asyncio

Why they are needed:
- FastAPI for REST API
- motor for async MongoDB communication
- python-socketio for collaboration
- JWT library for token verification
- bcrypt for password hashing

Alternatives:
- SQLAlchemy + psycopg2 for PostgreSQL
- Flask + Flask-JWT-Extended

### [backend/test_models.py](backend/test_models.py)
Purpose:
- a basic validation test for the model layer

Why it matters:
- ensures the data model behaves as expected on parsing
- good for interview demonstration of testing discipline

This is intentionally simple, and not a full test suite.

Alternatives:
- pytest fixtures and more coverage
- API integration testing with TestClient
- database integration tests using a test MongoDB instance

---

## 6. Backend App Files

### [backend/app/config.py](backend/app/config.py)
Purpose:
- centralizes configuration variables

Important values:
- `MONGODB_URL` -> where MongoDB is located
- `DATABASE_NAME` -> database name
- `JWT_SECRET` -> secret used for signing JWT
- `JWT_ALGORITHM` -> e.g., HS256
- `ACCESS_TOKEN_EXPIRE_MINUTES` -> expiration time of JWT

Why this matters:
- avoids hard-coded credentials and connection strings
- allows same codebase to work in local and production environments

Alternatives:
- environment variables loaded via dotenv
- config classes using dataclasses
- secrets manager

### [backend/app/database.py](backend/app/database.py)
Purpose:
- creates MongoDB connection and indexes

What it does:
- uses `motor.motor_asyncio.AsyncIOMotorClient`
- opens a database instance
- creates two unique indexes on users collection: username and email

Why indexes are needed:
- prevents duplicate usernames and emails at DB level
- improves lookup performance

Important details:
- unique index on `username`
- unique index on `email`
- `init_db()` runs during app startup

Alternatives:
- use SQL primary keys and unique constraints
- use application-level checks only

### [backend/app/models.py](backend/app/models.py)
Purpose:
- defines database entity models for MongoDB documents

Key models:
- `UserDB`
- `Collaborator`
- `NoteDB`

Important design choices:
- `id: Optional[PyObjectId] = Field(alias="_id")`
- custom `PyObjectId` type converts MongoDB ObjectId to string for Pydantic
- `model_config` includes `populate_by_name=True` and `arbitrary_types_allowed=True`

Why this model layer matters:
- MongoDB uses `_id`, but the app often wants `id` from Python code
- this mapping is essential for clean API responses

Alternatives:
- keep raw MongoDB documents and manually convert them
- use SQLAlchemy models with relational schemas

### [backend/app/schemas.py](backend/app/schemas.py)
Purpose:
- defines request and response contracts for FastAPI

Important schemas:
- `UserRegister`
- `UserLogin`
- `UserOut`
- `Token`
- `NoteCreate`
- `NoteUpdate`
- `NoteShare`
- `NoteOut`

Why schemas are used:
- validate incoming data before business logic executes
- generate OpenAPI docs automatically
- ensure consistent output payloads

Important details:
- `NoteShare` uses `collaborator_identifier` and `role`
- `NoteOut` includes `id`, `title`, `content`, `owner_id`, `owner_username`, `collaborators`, `created_at`, `updated_at`
- `NoteUpdate` includes `base_updated_at` to prevent stale overwrites during collaborative edits

Alternatives:
- plain dicts
- custom validation logic without Pydantic
- marshmallow or dataclasses

### [backend/app/auth.py](backend/app/auth.py)
Purpose:
- handles authentication logic and JWT generation

Functions:
- `verify_password()`
- `get_password_hash()`
- `create_access_token()`
- `decode_token()`
- `get_user_by_id()`
- `get_current_user()`

Why JWT is used:
- stateless authentication across API requests
- no need to store session state on server
- easy to pass in Authorization header

Important details:
- passwords are hashed using bcrypt before saving to MongoDB
- JWT contains user `sub` claim (subject = user id)
- `get_current_user()` uses dependency injection in FastAPI routes

Alternatives:
- session cookies
- OAuth2 providers like Google, GitHub
- refresh tokens with two-token architecture

### [backend/app/crud.py](backend/app/crud.py)
Purpose:
- contains database operations for notes and collaboration logic

Key functions:
- `get_note_by_id()`
- `get_user_notes()`
- `create_note()`
- `update_note()`
- `delete_note()`
- `add_collaborator()`
- `remove_collaborator()`

Why CRUD is separated:
- keeps routes cleaner
- centralizes database logic
- easier to test and maintain

Important logic:
- notes are returned where user is owner or collaborator
- `update_note()` supports optimistic concurrency by checking `base_updated_at`
- collaborator arrays are modified with MongoDB `$pull` and `$push`

Alternatives:
- put all DB logic directly inside route handlers
- use repository/service pattern with method classes

### [backend/app/sockets.py](backend/app/sockets.py)
Purpose:
- defines Socket.IO server behaviors for real-time collaboration

Key events:
- `connect`
- `disconnect`
- `join_note`
- `leave_note`
- `edit_note`

Important details:
- Socket.IO server is created with `socketio.AsyncServer(async_mode='asgi', cors_allowed_origins='*')`
- user authentication happens during connection using JWT
- each socket stores a user session with `user_id` and `username`
- room-based collaboration is done by note ID
- note room is named `note_<id>`
- `edit_note` validates user permission before saving
- stale-write protection prevents overwriting someone else’s edits

Why this is important:
- users can edit the same note live without reloading
- updates are synced to collaborators in real time

Alternatives:
- polling-based refreshes
- server-sent events (SSE)
- WebSockets without room logic

### [backend/app/main.py](backend/app/main.py)
Purpose:
- main FastAPI application entrypoint
- defines REST endpoints and combines them with Socket.IO

Key endpoints:
- `/api/auth/signup`
- `/api/auth/login`
- `/api/auth/me`
- `/api/notes`
- `/api/notes/{note_id}`
- `/api/notes/{note_id}/share`
- `/api/notes/{note_id}/unshare`

Important logic:
- signup creates user and returns JWT
- login validates email/password and returns token
- note access is permission-checked by ownership or collaborator relationship
- note updates are broadcast to note subscribers
- sharing and unsharing trigger live updates

Why the `socket_app` is used:
- the app is not only a REST API; it also hosts a Socket.IO server
- `socketio.ASGIApp(sio, other_asgi_app=app)` combines the two together

Alternatives:
- separate WebSocket server from API server
- deploy the Socket.IO server in a different service

---

## 7. Frontend App Files

### [frontend/package.json](frontend/package.json)
Purpose:
- lists frontend dependencies and build scripts

Key scripts:
- `npm run dev` -> local Vite dev server
- `npm run build` -> production build for deployment
- `npm run lint` -> code linting

Important dependencies:
- `react`
- `react-dom`
- `react-router-dom`
- `socket.io-client`
- `lucide-react`

Alternatives:
- CRA instead of Vite
- other routing libraries
- other CSS frameworks

### [frontend/vite.config.ts](frontend/vite.config.ts)
Purpose:
- configures Vite bundler

Why important:
- handles React plugin integration
- local dev server config
- build configuration

Alternatives:
- Webpack
- Parcel
- Next.js build system

### [frontend/index.html](frontend/index.html)
Purpose:
- base HTML that Vite injects into

Minimal but crucial:
- root DOM element `#root`
- browser loads JS bundle here

Alternatives:
- direct static HTML without build system

### [frontend/src/main.tsx](frontend/src/main.tsx)
Purpose:
- entry point for React app
- mounts the app into the browser DOM

What it does:
- imports CSS
- imports the root `App` component
- launches React with `StrictMode`

Alternatives:
- createRoot without StrictMode
- server-side rendering setups

### [frontend/src/App.tsx](frontend/src/App.tsx)
Purpose:
- defines route structure and auth flow

Key concepts:
- `AuthProvider` wraps the whole app
- `ProtectedRoute` blocks unauthenticated users
- `PublicRoute` redirects logged-in users away from login/signup pages
- `SocketProvider` is created only when a user is authenticated

Why this is good architecture:
- app is only allowed to have sockets when user is authorized
- login flow is separated cleanly

Alternatives:
- keep auth logic inside every page
- use a monolithic page architecture without route guards

### [frontend/src/context/AuthContext.tsx](frontend/src/context/AuthContext.tsx)
Purpose:
- stores auth state for the frontend

State values:
- `user`
- `token`
- `loading`

Methods:
- `login()`
- `signup()`
- `logout()`

Important details:
- token is stored in `localStorage`
- on app load, it validates the token via `/api/auth/me`
- if token is invalid, user is logged out automatically

Why localStorage is used:
- keeps the user logged in between reloads
- easy to persist auth session in a simple app

Alternatives:
- sessionStorage
- cookies with HttpOnly (more secure but more complex)
- auth libraries like Auth0 or Clerk

### [frontend/src/context/SocketContext.tsx](frontend/src/context/SocketContext.tsx)
Purpose:
- provides a singleton Socket.IO connection per authenticated user

What it does:
- creates a Socket.IO client connection when token exists
- sends JWT in `auth.token`
- logs connection status
- exposes socket instance through `useSocket()`

Why this matters:
- user-specific realtime communication is centralized
- simplifies collaboration without duplicating socket setup across pages

Alternatives:
- one socket per component
- no socket context and manual connection in each component

### [frontend/src/components/Navbar.tsx](frontend/src/components/Navbar.tsx)
Purpose:
- top navigation bar for logged-in users

It contains:
- app branding
- live socket connection status indicator
- theme switcher
- user name display
- logout button

Why it matters:
- provides a polished desktop-style workspace UI
- shows live system state and user context

Alternatives:
- plain text navigation bar
- side nav

### [frontend/src/pages/Login.tsx](frontend/src/pages/Login.tsx)
Purpose:
- login page

What it does:
- gathers email and password
- calls `login` from AuthContext
- redirects user to dashboard on success
- shows validation errors on failure

Alternatives:
- login modal instead of page
- OAuth login form

### [frontend/src/pages/Signup.tsx](frontend/src/pages/Signup.tsx)
Purpose:
- registration page

What it does:
- validates username, email, password, confirm password
- calls `signup` from AuthContext
- redirects to dashboard after successful sign-up

Alternatives:
- simplified sign-up with only email/password
- social login registration

### [frontend/src/pages/Dashboard.tsx](frontend/src/pages/Dashboard.tsx)
Purpose:
- main work area after login

This is the most important frontend file.

It contains:
- note list panel
- create note button
- shared note section
- active note selection
- fetching all notes from backend
- listening to socket events like `note_updated`, `note_deleted`, `user_unshared`, `note_shared`
- state management for notes and active note

Key responsibilities:
- fetch notes from `/api/notes`
- sort notes by updated timestamp
- keep current note in active state
- update UI when another user edits or shares a note
- maintain theme UI state

Why this is the main orchestration layer:
- frontend state, data fetching, and real-time events converge here

Alternatives:
- split dashboard into smaller components
- use a global state manager like Redux, Zustand, or TanStack Query

### [frontend/src/components/EditNote.tsx](frontend/src/components/EditNote.tsx)
Purpose:
- note editor interface

Features:
- title input
- content textarea
- markdown-style toolbar for headings, bold, italic, bullet lists, code
- read-only mode for users without edit permission
- autosave with debounced socket emit
- live synchronization with the backend

Why it matters:
- this is the core collaborative editing experience
- it demonstrates the real-time note editing flow

Important logic:
- when the note content changes, a timer is set to send `edit_note` event
- this prevents excessive writes in quick succession
- stale `base_updated_at` prevents overwrites
- permission checks are enforced before edits

Alternatives:
- rich text editor like TipTap or Quill
- plain textarea without markdown toolbar
- local-only editing without collaboration

### [frontend/src/components/ShareModal.tsx](frontend/src/components/ShareModal.tsx)
Purpose:
- UI for note sharing and collaborator management

Features:
- add collaborator by username or email
- select role: read or edit
- remove collaborator
- show collaborator list

Why it matters:
- collaboration is a core requirement of the app
- this component interacts with `/api/notes/{note_id}/share` and `/api/notes/{note_id}/unshare`

Alternatives:
- simpler share by user ID only
- share by email-only invitation flow

### [frontend/src/index.css](frontend/src/index.css)
Purpose:
- global styling layer,
- Tailwind base and custom premium UI theme

Important design features:
- dark theme palette
- gradient text
- glassmorphism effect
- scrollbars styling
- button glow animation

Why CSS is important:
- styling is part of product experience and brand identity
- this helps create a polished SaaS feel

Alternatives:
- app-specific CSS modules
- CSS-in-JS libraries
- Chakra UI / MUI

---

## 8. Authentication Flow in Detail

### Sign Up
1. user enters username, email, password
2. frontend calls `/api/auth/signup`
3. backend checks if username or email already exists
4. password is hashed with bcrypt
5. new user document is inserted into MongoDB
6. backend creates JWT and returns token + user info
7. frontend stores token in localStorage
8. user is redirected to dashboard

### Login
1. user enters email and password
2. frontend calls `/api/auth/login`
3. backend searches user by email
4. verifies password with bcrypt
5. issues JWT
6. frontend stores token and user state

### Auth Validation on Reload
1. app reads `notes_token` from localStorage
2. calls `/api/auth/me`
3. backend verifies JWT using `get_current_user()`
4. user info is restored if valid

This pattern is common for JWT-based React apps.

Alternative designs:
- HTTP-only cookies with server session
- OAuth2 with provider tokens
- refresh token rotation

---

## 9. Note Ownership and Authorization Model

The application uses a clear permission model:
- owner can edit and delete
- owner can share or unshare notes
- collaborators can have `read` or `edit` rights

This is implemented by checking:
- `note.owner_id == current_user.id`
- or collaborator record exists with matching `user_id`
- and role matches `edit` when editing

This is a strong interview topic because it demonstrates:
- access control
- authorization logic
- security awareness
- design thinking around multi-user systems

Alternatives:
- role-based access control with a general permissions table
- document ACLs stored as nested permission objects
- admin roles

---

## 10. Real-Time Collaboration Design

This project is not just a CRUD app. It is a real-time collaboration app.

### What real-time functionality does
- when one user edits a note, the backend emits an event to all users in the note room
- other users see the updated content instantly
- users joining the room are added to the note channel
- users leaving are removed from the room

### Why rooms are used
A room per note is a clean design because only users who are authorized for that note should receive updates.

### Why Socket.IO
- easier setup than raw WebSockets
- supports event-based communication
- handles reconnection and message events cleanly

Alternatives:
- polling every few seconds
- Server-Sent Events (SSE)
- Firebase Realtime Database

---

## 11. Concurrency and Stale Writes

This is a very important interview topic.

The app uses a stale-write prevention strategy:
- client sends `base_updated_at` with mutation request
- backend compares current note timestamp to the client’s copy
- if the note changed since the client loaded it, update is rejected

This prevents silent overwrite problems where two users edit at the same time.

Why this is important:
- without this, two users could overwrite each other’s changes randomly
- collaborative apps need conflict prevention and version checks

Alternatives:
- last-write-wins without safeguards
- CRDTs for text merging
- operational transformation
- full diff/merge algorithm

---

## 12. Data Model Details

### User document
Example structure:
```json
{
  "_id": "ObjectId",
  "username": "alice",
  "email": "alice@example.com",
  "password_hash": "bcrypt-hash",
  "created_at": "datetime"
}
```

### Note document
```json
{
  "_id": "ObjectId",
  "title": "Project ideas",
  "content": "Plan for release",
  "owner_id": "user-id",
  "owner_username": "alice",
  "collaborators": [
    {
      "user_id": "user-id-2",
      "username": "bob",
      "role": "edit"
    }
  ],
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

Why the note stores collaborators directly:
- one note can easily compute access rights without additional joins
- simpler for a small app
- efficient for single-collection document model

Alternative design:
- separate `note_permissions` collection
- many-to-many relation tables
- normalized relational schema

---

## 13. Why MongoDB is a Good Fit

MongoDB is a strong fit for this project because:
- notes are nested documents
- collaborator information is attached to each note
- the app doesn’t require complex relational joins
- document model aligns well with JSON-like data from frontend

However, it also has trade-offs:
- harder to do complex relational queries
- transaction handling is more limited than relational DBs in some patterns
- data consistency requires careful application logic

Alternatives:
- PostgreSQL for stricter relational integrity
- DynamoDB for AWS-centric apps

---

## 14. Security Observations

This project does a good job with core basics, but there are important production considerations.

Current protections:
- password hashing with bcrypt
- JWT authentication
- permission checks on note access
- Mongo unique indexes on email and username
- no plain-text password storage

Things to improve for production:
- use strict CORS policy instead of `*`
- use stronger secret management
- move config to secure environment variables or vault
- add rate-limiting for auth endpoints
- use HTTPS everywhere
- add logging and monitoring
- add tests for auth, permissions, and collaboration flows

Alternatives:
- OAuth2 / OpenID Connect
- managed auth platforms like Auth0 or Clerk

---

## 15. Why This Project Is Interview-Friendly

This project demonstrates several real-world software engineering skills:

### Backend skills
- API design
- validation
- authorization
- JWT security
- async database operations
- WebSocket event architecture

### Frontend skills
- route guarding
- auth context
- socket integration
- component composition
- UI state synchronization

### Database skills
- document modeling
- indexing
- permission-aware design
- timestamps and stale writes

### DevOps skills
- Docker Compose
- environment variables
- service networking
- deployment readiness

This is exactly the kind of project an interviewer likes because it is a complete product, not a toy example.

---

## 16. Interview Talking Points

If you are preparing for interviews, you can talk about these points:

### “Why did you choose FastAPI?”
Because it is fast, modern, async-friendly, and easy to build APIs quickly with Pydantic validation.

### “Why MongoDB?”
Because the app is document-centric and stores nested collaborator data in each note document.

### “How do you handle collaborative edits?”
With Socket.IO room-based events and stale-write protection using `updated_at` version checks.

### “How do you secure the app?”
By hashing passwords, using JWT, validating access for each route, and storing sensitive config as environment variables.

### “What are the trade-offs?”
MongoDB offers flexibility but less relational strictness than PostgreSQL. The app uses a document model to keep things simple.

### “What would you improve?”
CORS restrictions, better production config, HTTPS, rate limiting, test coverage, maybe a production frontend build and reverse proxy.

---

## 17. Best Alternative Architecture Ideas

If this project were to be redesigned for a production-grade SaaS app, alternatives could include:

### Option A: PostgreSQL + SQLAlchemy
Better if you want:
- strict schema
- stronger relational integrity
- complex querying
- easier analytics and reporting

### Option B: React + Zustand + TanStack Query
Better if you want:
- cleaner global state pattern
- better server-state caching
- stronger data-fetching patterns

### Option C: Next.js instead of Vite + React
Better if you want:
- SSR
- easier SEO and routing
- monolithic app architecture

### Option D: Use WebRTC or collaboration protocol for advanced docs
Better if you want:
- advanced multi-user editing model
- operational transformation or CRDT-based merge conflict handling

---

## 18. Final Summary

This project is a strong example of a modern collaborative SaaS application because it combines:
- authentication and authorization
- MongoDB document storage
- real-time collaboration via WebSockets
- a clean React frontend
- a FastAPI backend
- Dockerized deployment
- event-driven synchronization

It is excellent interview material because it shows practical understanding of:
- system design
- backend security
- frontend state
- real-time collaboration
- database modeling
- deployment and environment management

If you can explain each file and the interplay between them, you will sound very strong in an interview.

---

## 19. Good Interview One-Liner

“I built a real-time collaborative notes app using React, FastAPI, MongoDB, and Socket.IO, with JWT auth, role-based sharing, and document-level permission checks, deployed via Docker and designed for multi-user sync without overwriting each other’s edits.”

This sentence captures the essence of the project very well.
