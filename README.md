# Collaborative Notes Studio

A full-stack notes application with user accounts, shared notes, read/edit collaborator permissions, and live updates. The frontend is built with React and TypeScript, the API with FastAPI, and notes/users are stored in MongoDB. Socket.IO carries live collaboration events.

## Features

- Create an account and sign in with JWT-based authentication.
- Create, edit, and delete notes.
- Share notes with other users as readers or editors.
- Receive live note and sharing updates without refreshing.
- Detect stale edits and reject conflicting updates instead of silently overwriting newer content.

## Technology

- Frontend: React, TypeScript, Vite, React Router, Tailwind CSS
- Backend: Python, FastAPI, Pydantic, Uvicorn
- Database: MongoDB with Motor
- Real time: Socket.IO (`python-socketio` and `socket.io-client`)
- Local orchestration: Docker Compose

## Run With Docker Compose

### Prerequisites

- Docker Desktop (or Docker Engine) with the Docker Compose plugin
- Git, if cloning the repository

### Start

From the repository root, create a local environment file from the example:

```powershell
Copy-Item .env.example .env
```

On macOS or Linux, use `cp .env.example .env` instead. Edit `.env` and replace `JWT_SECRET` with a long, random secret. For the included MongoDB container, keep `MONGODB_URL=mongodb://mongodb:27017`; `mongodb` is the Compose service name and is only resolvable from containers on the Compose network.

Build and start the services:

```sh
docker compose up --build -d
```

Open the frontend at <http://localhost:5173>. The FastAPI interactive API documentation is at <http://localhost:8000/docs>. MongoDB is published locally on port `27017` for development tools.

Useful commands:

```sh
docker compose ps
docker compose logs -f backend
docker compose logs -f frontend
docker compose down
```

MongoDB data is stored in the named `mongo_data` volume and persists when containers are removed with `docker compose down`. Removing the volume with `docker compose down -v` permanently deletes that local database data.

## Configuration

`.env.example` documents the variables used by the Compose setup. `.env` is local-only and ignored by Git.

| Variable | Purpose | Local Compose value |
| --- | --- | --- |
| `JWT_SECRET` | Signs and verifies access tokens. Use a unique, random value. | Set locally |
| `JWT_ALGORITHM` | JWT signing algorithm. | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Access-token lifetime. | `1440` |
| `MONGODB_URL` | MongoDB connection string. | `mongodb://mongodb:27017` |
| `DATABASE_NAME` | MongoDB database name. | `collaborative_notes` |
| `VITE_API_URL` | Backend origin used by the browser frontend. | `http://localhost:8000` |

Do not commit `.env`, production secrets, or database credentials. If a secret has already been pushed, rotate it; removing a file from the latest commit does not remove it from Git history.

## Local Development Without Docker

The simplest supported setup is Docker Compose, which starts MongoDB, the API, and the frontend together. For separate development servers, start MongoDB first, then run the backend and frontend in their respective directories. Configure `MONGODB_URL` for the MongoDB address reachable from the backend process and set `VITE_API_URL` to the API origin reachable from the browser.

Backend dependencies and test:

```sh
python -m pip install -r backend/requirements.txt
python -m pytest backend/test_models.py -q
```

Frontend dependencies and checks:

```sh
cd frontend
npm install
npm run dev
npm run build
npm run lint
```

The frontend development server is at <http://localhost:5173>. Ensure the backend is running at the URL configured by `VITE_API_URL`.

## API Overview

All application routes are prefixed with `/api`:

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/auth/signup` | Register an account |
| `POST` | `/api/auth/login` | Sign in |
| `GET` | `/api/auth/me` | Get the authenticated user |
| `GET` | `/api/notes` | List notes available to the user |
| `POST` | `/api/notes` | Create a note |
| `GET` | `/api/notes/{note_id}` | Read a note |
| `PUT` | `/api/notes/{note_id}` | Update a note |
| `DELETE` | `/api/notes/{note_id}` | Delete a note (owner only) |
| `POST` | `/api/notes/{note_id}/share` | Share a note |
| `POST` | `/api/notes/{note_id}/unshare` | Remove a collaborator |

The REST API uses a bearer token returned by signup/login. Socket.IO uses the same token when establishing its authenticated connection. Open `/docs` on the backend for the generated OpenAPI reference.

## Project Layout

```text
backend/
  app/
    auth.py       Password hashing, JWT handling, and user dependencies
    config.py     Environment-based configuration
    crud.py       MongoDB note operations
    database.py   MongoDB client, collections, and indexes
    main.py       FastAPI routes and ASGI application
    models.py     Database document models
    schemas.py    API request/response validation
    sockets.py    Authenticated Socket.IO events and note rooms
frontend/
  src/
    components/   Navbar, note editor, and sharing modal
    context/      Authentication and socket providers
    pages/        Login, signup, and dashboard
    App.tsx       Route configuration and provider composition
docker-compose.yml
```

For a deeper file-by-file walkthrough and interview preparation notes, see [PROJECT_EXPLANATION.md](PROJECT_EXPLANATION.md).

## Deployment Notes

The included Dockerfiles run Uvicorn with reload and Vite's development server. This Compose configuration is intended for local development and demonstration, not a hardened public production deployment. Before exposing it publicly, use production server settings and a production frontend build, HTTPS, restricted CORS origins, strong managed secrets, database authentication/network restrictions, backups, and monitoring. The current Socket.IO setup also keeps connection state in one backend process; multiple backend replicas need shared Socket.IO coordination such as a Redis manager.