import socketio
from app.auth import decode_token, get_user_by_id
from app.crud import get_note_by_id
import logging
import json
from app.schemas import NoteOut

logger = logging.getLogger("socketio")
logger.setLevel(logging.INFO)

# Create an async Socket.IO server allowing all CORS origins for testing/development
sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins='*')

@sio.event
async def connect(sid, environ, auth):
    logger.info(f"Socket connecting: {sid}")
    if not auth or "token" not in auth:
        logger.warning(f"Connection rejected: missing auth/token for sid {sid}")
        return False  # Reject connection
        
    token = auth["token"]
    if token.startswith("Bearer "):
        token = token[7:]
        
    try:
        payload = decode_token(token)
        user_id = payload.get("sub")
        if not user_id:
            return False
            
        user = await get_user_by_id(user_id)
        if not user:
            return False
            
        # Store user details in socket session for quick retrieval in event handlers
        await sio.save_session(sid, {"user_id": str(user.id), "username": user.username})
        logger.info(f"Socket {sid} authenticated as {user.username}")
        return True
    except Exception as e:
        logger.warning(f"Connection rejected: invalid token for sid {sid} ({str(e)})")
        return False

@sio.event
async def disconnect(sid):
    logger.info(f"Socket disconnected: {sid}")

@sio.event
async def join_note(sid, data):
    note_id = data.get("note_id")
    if not note_id:
        return {"status": "error", "message": "Missing note_id"}
        
    session = await sio.get_session(sid)
    user_id = session.get("user_id")
    username = session.get("username")
    
    note = await get_note_by_id(note_id)
    if not note:
        return {"status": "error", "message": "Note not found"}
        
    # Authenticate note authorization
    is_owner = note.owner_id == user_id
    is_collab = any(col.user_id == user_id for col in note.collaborators)
    
    if not (is_owner or is_collab):
        return {"status": "error", "message": "Unauthorized access"}
        
    room_name = f"note_{note_id}"
    await sio.enter_room(sid, room_name)
    logger.info(f"User {username} joined room {room_name}")
    
    # Broadcast to room that user joined (can be used to show list of active viewers)
    await sio.emit("user_joined", {"username": username, "user_id": user_id}, room=room_name, skip_sid=sid)
    return {"status": "ok", "message": f"Joined room {room_name}"}

@sio.event
async def leave_note(sid, data):
    note_id = data.get("note_id")
    if not note_id:
        return {"status": "error", "message": "Missing note_id"}
        
    session = await sio.get_session(sid)
    user_id = session.get("user_id")
    username = session.get("username")
    
    room_name = f"note_{note_id}"
    await sio.leave_room(sid, room_name)
    logger.info(f"User {username} left room {room_name}")
    
    # Broadcast that user left
    await sio.emit("user_left", {"username": username, "user_id": user_id}, room=room_name, skip_sid=sid)
    return {"status": "ok", "message": f"Left room {room_name}"}

@sio.event
async def edit_note(sid, data):
    note_id = data.get("note_id")
    title = data.get("title")
    content = data.get("content")
    
    if not note_id:
        return {"status": "error", "message": "Missing note_id"}
        
    session = await sio.get_session(sid)
    user_id = session.get("user_id")
    
    note = await get_note_by_id(note_id)
    if not note:
        return {"status": "error", "message": "Note not found"}
        
    # Enforce edit permission boundaries
    is_owner = note.owner_id == user_id
    collab = next((col for col in note.collaborators if col.user_id == user_id), None)
    is_collab_editor = collab is not None and collab.role == "edit"
    
    if not (is_owner or is_collab_editor):
        return {"status": "error", "message": "No edit permission"}
        
    import app.crud as crud
    updated_note = await crud.update_note(note_id, title=title, content=content)
    if not updated_note:
        return {"status": "error", "message": "Failed to update note"}
        
    # Broadcast updated note structure to other room subscribers
    serialized = json.loads(NoteOut.model_validate(updated_note).model_dump_json())
    await sio.emit("note_updated", serialized, room=f"note_{note_id}", skip_sid=sid)
    
    return {"status": "ok", "note": serialized}
