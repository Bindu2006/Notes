from bson import ObjectId
from typing import List, Optional
from datetime import datetime, timezone
from app.database import notes_collection
from app.models import NoteDB, Collaborator

async def get_note_by_id(note_id: str) -> Optional[NoteDB]:
    if not ObjectId.is_valid(note_id):
        return None
    note = await notes_collection.find_one({"_id": ObjectId(note_id)})
    if note:
        return NoteDB(**note)
    return None

async def get_user_notes(user_id: str) -> List[NoteDB]:
    # Find notes where the user is either the owner or a collaborator
    cursor = notes_collection.find({
        "$or": [
            {"owner_id": user_id},
            {"collaborators.user_id": user_id}
        ]
    }).sort("updated_at", -1)
    notes = []
    async for doc in cursor:
        notes.append(NoteDB(**doc))
    return notes

async def create_note(title: str, content: str, owner_id: str, owner_username: str) -> NoteDB:
    now = datetime.now(timezone.utc)
    note_doc = {
        "title": title,
        "content": content,
        "owner_id": owner_id,
        "owner_username": owner_username,
        "collaborators": [],
        "created_at": now,
        "updated_at": now
    }
    result = await notes_collection.insert_one(note_doc)
    note_doc["_id"] = result.inserted_id
    return NoteDB(**note_doc)

async def update_note(
    note_id: str,
    title: Optional[str],
    content: Optional[str],
    base_updated_at: Optional[datetime] = None,
) -> Optional[NoteDB]:
    if not ObjectId.is_valid(note_id):
        return None

    update_data = {}
    if title is not None:
        update_data["title"] = title
    if content is not None:
        update_data["content"] = content
    if not update_data:
        return await get_note_by_id(note_id)

    now = datetime.now(timezone.utc)
    update_data["updated_at"] = now

    filter_query = {"_id": ObjectId(note_id)}
    if base_updated_at is not None:
        if isinstance(base_updated_at, str):
            try:
                base_updated_at = datetime.fromisoformat(base_updated_at.replace("Z", "+00:00"))
            except ValueError:
                base_updated_at = None
        if base_updated_at is not None:
            filter_query["updated_at"] = base_updated_at

    result = await notes_collection.update_one(
        filter_query,
        {"$set": update_data}
    )

    if base_updated_at is not None and result.matched_count == 0:
        return None

    return await get_note_by_id(note_id)

async def delete_note(note_id: str) -> bool:
    if not ObjectId.is_valid(note_id):
        return False
    result = await notes_collection.delete_one({"_id": ObjectId(note_id)})
    return result.deleted_count > 0

async def add_collaborator(note_id: str, user_id: str, username: str, role: str) -> Optional[NoteDB]:
    if not ObjectId.is_valid(note_id):
        return None
    # Remove existing record if present to overwrite
    await notes_collection.update_one(
        {"_id": ObjectId(note_id)},
        {"$pull": {"collaborators": {"user_id": user_id}}}
    )
    # Push the new collaborator record
    await notes_collection.update_one(
        {"_id": ObjectId(note_id)},
        {"$push": {"collaborators": {"user_id": user_id, "username": username, "role": role}}}
    )
    return await get_note_by_id(note_id)

async def remove_collaborator(note_id: str, user_id: str) -> Optional[NoteDB]:
    if not ObjectId.is_valid(note_id):
        return None
    await notes_collection.update_one(
        {"_id": ObjectId(note_id)},
        {"$pull": {"collaborators": {"user_id": user_id}}}
    )
    return await get_note_by_id(note_id)
