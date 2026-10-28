from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Boolean, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    email = Column(String, unique=True, index=True)
    matric_number = Column(String, unique=True, index=True)  # Added for student portal login
    phone = Column(String, nullable=True)                    # Added for profile page
    password = Column(String)
    role = Column(String, default="student")
    
    complaints = relationship("Complaint", back_populates="owner")
    notifications = relationship("Notification", back_populates="user")

class Complaint(Base):
    __tablename__ = "complaints"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    category = Column(String)
    location = Column(String)
    description = Column(String)
    status = Column(String, default="Pending")
    image_urls = Column(JSON, nullable=True)                 # Changed to JSON to support up to 5 photos
    created_at = Column(DateTime, default=datetime.utcnow)
    user_id = Column(Integer, ForeignKey("users.id"))
    
    owner = relationship("User", back_populates="complaints")
    updates = relationship("Update", back_populates="complaint")

class Update(Base):
    __tablename__ = "updates"
    
    id = Column(Integer, primary_key=True, index=True)
    complaint_id = Column(Integer, ForeignKey("complaints.id"))
    update_text = Column(String)
    updated_at = Column(DateTime, default=datetime.utcnow)
    
    complaint = relationship("Complaint", back_populates="updates")

class Notification(Base):
    __tablename__ = "notifications"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    message = Column(String)
    is_read = Column(Boolean, default=False)                 # Added for unread badge filtering
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", back_populates="notifications")