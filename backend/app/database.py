import motor.motor_asyncio
from app.config import MONGODB_URL, DATABASE_NAME

client = motor.motor_asyncio.AsyncIOMotorClient(MONGODB_URL)
db = client[DATABASE_NAME]

users_collection = db["users"]
notes_collection = db["notes"]

async def init_db():
    # Create unique indexes for username and email to prevent duplicates at database level
    await users_collection.create_index("username", unique=True)
    await users_collection.create_index("email", unique=True)
