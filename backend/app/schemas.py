from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Optional, List
from datetime import datetime
from app.models import Collaborator, NoteDB

class UserRegister(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=6)

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserOut(BaseModel):
    id: str
    username: str
    email: EmailStr
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserOut

    model_config = ConfigDict(from_attributes=True)

class TokenData(BaseModel):
    user_id: str
    username: str

class NoteCreate(BaseModel):
    title: str = Field(default="", max_length=200)
    content: str = Field(default="")

class NoteUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None

class NoteShare(BaseModel):
    collaborator_identifier: str = Field(..., description="Username or Email of the collaborator")
    role: str = Field("read", pattern="^(read|edit)$")

class NoteOut(BaseModel):
    id: str
    title: str
    content: str
    owner_id: str
    owner_username: str
    collaborators: List[Collaborator]
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
