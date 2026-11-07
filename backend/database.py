"""
SkyGuard — SQLAlchemy Database Layer (SQLite)
"""

import os
from datetime import datetime
from sqlalchemy import (
    Boolean, Column, Float, Integer, String, create_engine, Text, text
)
from sqlalchemy.orm import DeclarativeBase, sessionmaker

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH     = os.path.join(BACKEND_DIR, "skyguard.db")
DB_URL      = f"sqlite:///{DB_PATH}"

engine       = create_engine(DB_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


class Base(DeclarativeBase):
    pass


class SensorReading(Base):
    __tablename__ = "sensor_readings"

    id                 = Column(Integer, primary_key=True, index=True)
    timestamp          = Column(String,  nullable=False)
    temperature        = Column(Float,   nullable=False)
    pressure           = Column(Float,   nullable=False)
    humidity           = Column(Float,   nullable=False)
    fault_type         = Column(String,  default="NONE")
    if_label           = Column(Integer, default=1)       # 1=normal, -1=anomaly
    lof_label          = Column(Integer, default=1)
    km_cluster         = Column(Integer, default=0)
    pca_x              = Column(Float,   default=0.0)
    pca_y              = Column(Float,   default=0.0)
    if_score           = Column(Float,   default=0.0)
    lof_score          = Column(Float,   default=0.0)
    is_anomaly         = Column(Boolean, default=False)
    
    # 12-Feature details
    delta_temp         = Column(Float,   default=0.0)
    delta_pressure     = Column(Float,   default=0.0)
    delta_humidity     = Column(Float,   default=0.0)
    roll_mean_temp     = Column(Float,   default=0.0)
    roll_mean_pressure = Column(Float,   default=0.0)
    roll_mean_humidity = Column(Float,   default=0.0)
    roll_std_temp      = Column(Float,   default=0.0)
    roll_std_pressure  = Column(Float,   default=0.0)
    roll_std_humidity  = Column(Float,   default=0.0)

    def to_dict(self):
        return {
            "id":                 self.id,
            "timestamp":          self.timestamp,
            "temperature":        self.temperature,
            "pressure":           self.pressure,
            "humidity":           self.humidity,
            "fault_type":         self.fault_type,
            "if_label":           self.if_label,
            "lof_label":          self.lof_label,
            "km_cluster":         self.km_cluster,
            "pca_x":              self.pca_x,
            "pca_y":              self.pca_y,
            "if_score":           self.if_score,
            "iforest_score":      self.if_score,      # alias
            "lof_score":          self.lof_score,
            "is_anomaly":         bool(self.is_anomaly),
            "delta_temp":         self.delta_temp or 0.0,
            "delta_pressure":     self.delta_pressure or 0.0,
            "delta_humidity":     self.delta_humidity or 0.0,
            "roll_mean_temp":     self.roll_mean_temp or 0.0,
            "roll_mean_pressure": self.roll_mean_pressure or 0.0,
            "roll_mean_humidity": self.roll_mean_humidity or 0.0,
            "roll_std_temp":      self.roll_std_temp or 0.0,
            "roll_std_pressure":  self.roll_std_pressure or 0.0,
            "roll_std_humidity":  self.roll_std_humidity or 0.0,
        }


class Alert(Base):
    __tablename__ = "sensor_alerts"

    id                 = Column(Integer, primary_key=True, index=True)
    timestamp          = Column(String,  nullable=False)
    title              = Column(String,  nullable=False)
    message            = Column(Text,    nullable=False)
    diagnosis_message  = Column(Text,    nullable=True)
    severity           = Column(String,  default="WARNING")   # "WARNING" | "CRITICAL"
    fault_type         = Column(String,  default="NONE")
    sensor             = Column(String,  default="unknown")
    reading_id         = Column(Integer, nullable=True)
    is_acknowledged    = Column(Boolean, default=False)
    acknowledged_at    = Column(String,  nullable=True)
    status             = Column(String,  default="OPEN")     # "OPEN" | "ACKNOWLEDGED" | "RESOLVED" | "DISMISSED"
    resolved_at        = Column(String,  nullable=True)
    dismissed_at       = Column(String,  nullable=True)
    is_simulated       = Column(Boolean, default=False)

    def to_dict(self):
        msg = self.diagnosis_message or self.message
        # Compute status if legacy row has is_acknowledged=True but status is OPEN
        st = self.status or ("ACKNOWLEDGED" if self.is_acknowledged else "OPEN")
        return {
            "id":                self.id,
            "timestamp":         self.timestamp,
            "title":             self.title,
            "message":           msg,
            "diagnosis_message": msg,
            "severity":          self.severity,
            "fault_type":        self.fault_type,
            "sensor":            self.sensor,
            "reading_id":        self.reading_id,
            "is_acknowledged":   bool(self.is_acknowledged or st == "ACKNOWLEDGED"),
            "acknowledged_at":   self.acknowledged_at,
            "status":            st,
            "resolved_at":       self.resolved_at,
            "dismissed_at":      self.dismissed_at,
            "is_simulated":      bool(self.is_simulated or self.fault_type in ["SPIKE_FAULT", "FROZEN_SENSOR", "DRIFT_FAULT", "CROSS_SENSOR_MISMATCH", "NOISE_FAULT", "STICKY_SENSOR"]),
        }


def init_db():
    Base.metadata.create_all(bind=engine)
    # Check and apply lightweight column migrations for SQLite
    with engine.connect() as conn:
        try:
            result = conn.execute(text("PRAGMA table_info(sensor_alerts)"))
            existing_cols = {row[1] for row in result.fetchall()}
            if "status" not in existing_cols:
                conn.execute(text("ALTER TABLE sensor_alerts ADD COLUMN status VARCHAR DEFAULT 'OPEN'"))
            if "resolved_at" not in existing_cols:
                conn.execute(text("ALTER TABLE sensor_alerts ADD COLUMN resolved_at VARCHAR"))
            if "dismissed_at" not in existing_cols:
                conn.execute(text("ALTER TABLE sensor_alerts ADD COLUMN dismissed_at VARCHAR"))
            if "is_simulated" not in existing_cols:
                conn.execute(text("ALTER TABLE sensor_alerts ADD COLUMN is_simulated BOOLEAN DEFAULT 0"))
            conn.commit()
        except Exception as e:
            print(f"[DB] Migration check notice: {e}")
    print(f"[DB] SQLite initialised at {DB_PATH}")
