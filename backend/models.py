from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Boolean, JSON, Text
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from database import Base

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)                          # full_name
    email = Column(String, unique=True, index=True)
    matric_number = Column(String, unique=True, index=True)     # login_id
    phone = Column(String, nullable=True)
    password = Column(String)                                  # password_hash
    role = Column(String, default="student")                   # "student" | "admin"
    
    complaints = relationship("Complaint", back_populates="student", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")
    tokens = relationship("Token", back_populates="user", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "role": self.role or "student",
            "login_id": self.matric_number,
            "full_name": self.name,
            "email": self.email,
            "phone": self.phone or ""
        }

class Token(Base):
    __tablename__ = "tokens"
    
    token_hash = Column(String(64), primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    
    user = relationship("User", back_populates="tokens")

class Complaint(Base):
    __tablename__ = "complaints"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    title = Column(String, index=True)
    category = Column(String)
    location = Column(String)
    description = Column(String)
    status = Column(String, default="Pending")
    assigned_to = Column(String, nullable=True)
    image_urls = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    
    student = relationship("User", back_populates="complaints")
    updates = relationship("Update", back_populates="complaint", cascade="all, delete-orphan")

    @property
    def ref(self):
        return f"FIX-{self.id:04d}"

    def to_summary_dict(self):
        return {
            "id": self.id,
            "ref": self.ref,
            "title": self.title,
            "category": self.category,
            "location": self.location,
            "status": self.status,
            "assigned_to": self.assigned_to or "",
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }

    def to_detail_dict(self, include_student=False):
        d = self.to_summary_dict()
        d["description"] = self.description or ""
        d["photos"] = self.image_urls or []
        sorted_updates = sorted(self.updates, key=lambda x: x.created_at or datetime.min)
        d["updates"] = [u.to_dict() for u in sorted_updates]
        if include_student and self.student:
            d["student"] = {
                "id": self.student.id,
                "name": self.student.name,
                "login_id": self.student.matric_number
            }
        return d

class Update(Base):
    __tablename__ = "updates"
    
    id = Column(Integer, primary_key=True, index=True)
    complaint_id = Column(Integer, ForeignKey("complaints.id", ondelete="CASCADE"))
    message = Column(Text, nullable=True)
    update_text = Column(String, nullable=True)
    status = Column(String, nullable=True)
    author = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    
    complaint = relationship("Complaint", back_populates="updates")

    def to_dict(self):
        return {
            "id": self.id,
            "message": self.message or self.update_text or "",
            "status": self.status or "",
            "author": self.author or "",
            "created_at": self.created_at.isoformat() if self.created_at else None
        }

class Notification(Base):
    __tablename__ = "notifications"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    type = Column(String, default="update_added")
    message = Column(String)
    complaint_id = Column(Integer, nullable=True)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    
    user = relationship("User", back_populates="notifications")

    def to_dict(self):
        return {
            "id": self.id,
            "type": self.type or "update_added",
            "message": self.message,
            "complaint_id": self.complaint_id,
            "is_read": bool(self.is_read),
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
