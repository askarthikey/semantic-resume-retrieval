from datetime import datetime, timezone
from typing import Any

from bson import ObjectId
from pymongo.collection import Collection


class MongoResumeRepository:
    def __init__(self, collection: Collection):
        self.collection = collection

    def create_resume(self, filename: str, candidate_name: str, raw_text: str) -> str:
        payload = {
            "filename": filename,
            "candidate_name": candidate_name,
            "raw_text": raw_text,
            "upload_timestamp": datetime.now(timezone.utc),
            "is_deleted": False,
        }
        inserted = self.collection.insert_one(payload)
        return str(inserted.inserted_id)

    def get_resume(self, mongo_id: str) -> dict[str, Any] | None:
        if not ObjectId.is_valid(mongo_id):
            return None
        return self.collection.find_one({"_id": ObjectId(mongo_id), "is_deleted": False})

    def list_resumes(self, page: int, page_size: int) -> tuple[list[dict[str, Any]], int]:
        query = {"is_deleted": False}
        skip = (page - 1) * page_size
        docs = list(
            self.collection.find(query, {"raw_text": 0})
            .sort("upload_timestamp", -1)
            .skip(skip)
            .limit(page_size)
        )
        total = self.collection.count_documents(query)
        return docs, total

    def soft_delete_resume(self, mongo_id: str) -> bool:
        if not ObjectId.is_valid(mongo_id):
            return False
        result = self.collection.update_one(
            {"_id": ObjectId(mongo_id), "is_deleted": False},
            {"$set": {"is_deleted": True}},
        )
        return result.modified_count == 1

    def get_resumes_by_ids(self, mongo_ids: list[str]) -> dict[str, dict[str, Any]]:
        object_ids = [ObjectId(item) for item in mongo_ids if ObjectId.is_valid(item)]
        if not object_ids:
            return {}
        cursor = self.collection.find({"_id": {"$in": object_ids}, "is_deleted": False})
        docs = list(cursor)
        return {str(doc["_id"]): doc for doc in docs}
