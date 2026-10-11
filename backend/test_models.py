import asyncio
import pytest
from bson import ObjectId
from app.models import UserDB
from datetime import datetime


@pytest.mark.asyncio
async def test_user_model_parsing():
    # Simulate MongoDB document
    doc = {
        "_id": ObjectId("66601b000000000000000001"),
        "username": "testuser",
        "email": "test@example.com",
        "password_hash": "hash",
        "created_at": datetime.utcnow(),
    }

    user = UserDB(**doc)
    assert user.id == "66601b000000000000000001"
    assert user.username == "testuser"
    assert user.email == "test@example.com"


if __name__ == "__main__":
    asyncio.run(test_user_model_parsing())
