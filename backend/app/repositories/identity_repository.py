from datetime import datetime, timezone
from typing import Any

from bson import ObjectId
from pymongo.collection import Collection


class MongoIdentityRepository:
    def __init__(
        self,
        users_collection: Collection,
        workspaces_collection: Collection,
        memberships_collection: Collection,
    ):
        self.users_collection = users_collection
        self.workspaces_collection = workspaces_collection
        self.memberships_collection = memberships_collection

    def ensure_indexes(self) -> None:
        self.users_collection.create_index("email", unique=True)
        self.workspaces_collection.create_index("name")
        self.memberships_collection.create_index([("user_id", 1), ("workspace_id", 1)], unique=True)

    def create_user(self, email: str, password_hash: str) -> dict[str, Any]:
        now = datetime.now(timezone.utc)
        payload = {
            "email": email.lower().strip(),
            "password_hash": password_hash,
            "created_at": now,
        }
        inserted = self.users_collection.insert_one(payload)
        payload["_id"] = inserted.inserted_id
        return payload

    def get_user_by_email(self, email: str) -> dict[str, Any] | None:
        return self.users_collection.find_one({"email": email.lower().strip()})

    def get_user_by_id(self, user_id: str) -> dict[str, Any] | None:
        if not ObjectId.is_valid(user_id):
            return None
        return self.users_collection.find_one({"_id": ObjectId(user_id)})

    def create_workspace(self, name: str, owner_user_id: str) -> dict[str, Any]:
        if not ObjectId.is_valid(owner_user_id):
            raise ValueError("Invalid owner user id")

        now = datetime.now(timezone.utc)
        workspace_payload = {
            "name": name.strip(),
            "created_at": now,
            "created_by": owner_user_id,
        }
        inserted = self.workspaces_collection.insert_one(workspace_payload)
        workspace_id = str(inserted.inserted_id)
        self.add_membership(owner_user_id, workspace_id)
        workspace_payload["_id"] = inserted.inserted_id
        return workspace_payload

    def add_membership(self, user_id: str, workspace_id: str) -> None:
        if not ObjectId.is_valid(user_id) or not ObjectId.is_valid(workspace_id):
            raise ValueError("Invalid user or workspace id")
        self.memberships_collection.update_one(
            {"user_id": user_id, "workspace_id": workspace_id},
            {
                "$setOnInsert": {
                    "created_at": datetime.now(timezone.utc),
                }
            },
            upsert=True,
        )

    def is_member(self, user_id: str, workspace_id: str) -> bool:
        if not ObjectId.is_valid(user_id) or not ObjectId.is_valid(workspace_id):
            return False
        membership = self.memberships_collection.find_one({"user_id": user_id, "workspace_id": workspace_id})
        return membership is not None

    def list_user_workspaces(self, user_id: str) -> list[dict[str, Any]]:
        if not ObjectId.is_valid(user_id):
            return []
        memberships = list(self.memberships_collection.find({"user_id": user_id}))
        workspace_ids = [ObjectId(item["workspace_id"]) for item in memberships if ObjectId.is_valid(item["workspace_id"])]
        if not workspace_ids:
            return []
        return list(self.workspaces_collection.find({"_id": {"$in": workspace_ids}}).sort("created_at", -1))

    def get_workspace(self, workspace_id: str) -> dict[str, Any] | None:
        if not ObjectId.is_valid(workspace_id):
            return None
        return self.workspaces_collection.find_one({"_id": ObjectId(workspace_id)})
