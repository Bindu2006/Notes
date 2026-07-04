import json
import socketio
from datetime import datetime, timezone
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pymongo.errors import DuplicateKeyError
from bson import ObjectId

from app.config import DATABASE_NAME
from app.database import init_db, users_collection
from app.auth import get_password_hash, verify_password, create_access_token, get_current_user
from app.models import UserDB
from app.schemas import UserRegister, UserLogin, UserOut, Token, NoteCreate, NoteUpdate, NoteShare, NoteOut
from app.sockets import sio
import app.crud as crud

app = FastAPI(title="Collaborative Notes Studio API")

# Setup CORS to allow React frontend connection
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust to specific domains in production
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    # Configure database indexes on system startup
    await init_db()

# Helper to serialize note database models into JSON-safe dictionaries using Pydantic validation
def serialize_note(note) -> dict:
    return json.loads(NoteOut.model_validate(note).model_dump_json())

# --- Auth Routes ---

@app.post("/api/auth/signup", response_model=Token)
async def signup(user_in: UserRegister):
    # Verify username or email is not already taken
    existing = await users_collection.find_one({
        "$or": [
            {"username": user_in.username},
            {"email": user_in.email}
        ]
    })
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username or email already registered"
        )
        
    pwd_hash = get_password_hash(user_in.password)
    user_doc = {
        "username": user_in.username,
        "email": user_in.email,
        "password_hash": pwd_hash,
        "created_at": datetime.now(timezone.utc)
    }
    try:
        result = await users_collection.insert_one(user_doc)
        user_doc["_id"] = result.inserted_id
        user_db = UserDB(**user_doc)
        
        # Generate JWT access token
        access_token = create_access_token(data={"sub": str(user_db.id)})
        user_out = UserOut(
            id=str(user_db.id),
            username=user_db.username,
            email=user_db.email,
            created_at=user_db.created_at
        )
        return Token(access_token=access_token, token_type="bearer", user=user_out)
    except DuplicateKeyError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username or email already registered"
        )

@app.post("/api/auth/login", response_model=Token)
async def login(user_in: UserLogin):
    user_doc = await users_collection.find_one({"email": user_in.email})
    if not user_doc or not verify_password(user_in.password, user_doc["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    user_db = UserDB(**user_doc)
    access_token = create_access_token(data={"sub": str(user_db.id)})
    user_out = UserOut(
        id=str(user_db.id),
        username=user_db.username,
        email=user_db.email,
        created_at=user_db.created_at
    )
    return Token(access_token=access_token, token_type="bearer", user=user_out)

@app.get("/api/auth/me", response_model=UserOut)
async def read_users_me(current_user: UserDB = Depends(get_current_user)):
    return UserOut(
        id=str(current_user.id),
        username=current_user.username,
        email=current_user.email,
        created_at=current_user.created_at
    )

# --- Note Routes ---

@app.get("/api/notes", response_model=list[NoteOut])
async def list_notes(current_user: UserDB = Depends(get_current_user)):
    notes = await crud.get_user_notes(str(current_user.id))
    return [NoteOut.model_validate(n) for n in notes]

@app.post("/api/notes", response_model=NoteOut)
async def create_new_note(note_in: NoteCreate, current_user: UserDB = Depends(get_current_user)):
    note = await crud.create_note(
        title=note_in.title,
        content=note_in.content,
        owner_id=str(current_user.id),
        owner_username=current_user.username
    )
    return NoteOut.model_validate(note)

@app.get("/api/notes/{note_id}", response_model=NoteOut)
async def get_note(note_id: str, current_user: UserDB = Depends(get_current_user)):
    note = await crud.get_note_by_id(note_id)
    if not note:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")
        
    # Enforce read permission boundaries
    is_owner = note.owner_id == str(current_user.id)
    is_collab = any(col.user_id == str(current_user.id) for col in note.collaborators)
    if not (is_owner or is_collab):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
        
    return NoteOut.model_validate(note)

@app.put("/api/notes/{note_id}", response_model=NoteOut)
async def update_existing_note(note_id: str, note_in: NoteUpdate, current_user: UserDB = Depends(get_current_user)):
    note = await crud.get_note_by_id(note_id)
    if not note:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")
        
    # Enforce edit permission boundaries
    is_owner = note.owner_id == str(current_user.id)
    collab = next((col for col in note.collaborators if col.user_id == str(current_user.id)), None)
    is_collab_editor = collab is not None and collab.role == "edit"
    
    if not (is_owner or is_collab_editor):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No edit permission")
        
    updated_note = await crud.update_note(note_id, title=note_in.title, content=note_in.content)
    
    # Broadcast updated note structure to note subscribers
    serialized = serialize_note(updated_note)
    await sio.emit("note_updated", serialized, room=f"note_{note_id}")
    
    return NoteOut.model_validate(updated_note)

@app.delete("/api/notes/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_existing_note(note_id: str, current_user: UserDB = Depends(get_current_user)):
    note = await crud.get_note_by_id(note_id)
    if not note:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")
        
    # Enforce owner deletion permissions
    if note.owner_id != str(current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the owner can delete this note")
        
    await crud.delete_note(note_id)
    
    # Broadcast deletion event to connected collaborators
    await sio.emit("note_deleted", {"note_id": note_id}, room=f"note_{note_id}")
    return None

@app.post("/api/notes/{note_id}/share", response_model=NoteOut)
async def share_note(note_id: str, share_in: NoteShare, current_user: UserDB = Depends(get_current_user)):
    note = await crud.get_note_by_id(note_id)
    if not note:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")
        
    if note.owner_id != str(current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the owner can share this note")
        
    # Query database to match collaborator by username or email
    collab_user_doc = await users_collection.find_one({
        "$or": [
            {"username": share_in.collaborator_identifier},
            {"email": share_in.collaborator_identifier}
        ]
    })
    if not collab_user_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User to collaborate with not found")
        
    collab_user = UserDB(**collab_user_doc)
    if str(collab_user.id) == note.owner_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot share a note with yourself")
        
    updated_note = await crud.add_collaborator(
        note_id,
        user_id=str(collab_user.id),
        username=collab_user.username,
        role=share_in.role
    )
    
    # Emit note update to sync any open clients
    serialized = serialize_note(updated_note)
    await sio.emit("note_updated", serialized, room=f"note_{note_id}")
    return NoteOut.model_validate(updated_note)

@app.post("/api/notes/{note_id}/unshare", response_model=NoteOut)
async def unshare_note(note_id: str, user_id_in: dict, current_user: UserDB = Depends(get_current_user)):
    note = await crud.get_note_by_id(note_id)
    if not note:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")
        
    if note.owner_id != str(current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the owner can edit collaborations")
        
    target_user_id = user_id_in.get("user_id")
    if not target_user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing user_id")
        
    # Notify target user client to close their editor view immediately
    await sio.emit("user_unshared", {"user_id": target_user_id, "note_id": note_id}, room=f"note_{note_id}")

    updated_note = await crud.remove_collaborator(note_id, target_user_id)
    
    # Broadcast updated collaborator lists
    serialized = serialize_note(updated_note)
    await sio.emit("note_updated", serialized, room=f"note_{note_id}")
    
    return NoteOut.model_validate(updated_note)

# Combine FastAPI routing with Socket.IO ASGI app structure
socket_app = socketio.ASGIApp(sio, other_asgi_app=app)
