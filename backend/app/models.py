from pydantic import BaseModel, Field, BeforeValidator, ConfigDict
from typing import Annotated, Optional, List
from datetime import timezone, datetime

# Custom type to handle MongoDB ObjectIds as string representation
PyObjectId = Annotated[str, BeforeValidator(str)]

class UserDB(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    username: str
    email: str
    password_hash: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
    )

class Collaborator(BaseModel):
    user_id: str
    username: str
    role: str  # "read" or "edit"

class NoteDB(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    title: str
    content: str
    owner_id: str
    owner_username: str
    collaborators: List[Collaborator] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
    )
