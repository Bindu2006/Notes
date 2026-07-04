import asyncio
from bson import ObjectId
from app.models import UserDB
from datetime import datetime

async def test():
    # Simulate MongoDB document
    doc = {
        "_id": ObjectId("66601b000000000000000001"),
        "username": "testuser",
        "email": "test@example.com",
        "password_hash": "hash",
        "created_at": datetime.utcnow()
    }
    
    user = UserDB(**doc)
    print("User object ID:", user.id)
    print("User object dict:", user.model_dump())
    print("User _id representation:", user.id == "66601b000000000000000001")

if __name__ == "__main__":
    asyncio.run(test())
