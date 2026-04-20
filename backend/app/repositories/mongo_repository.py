from datetime import datetime, timezone
from typing import Any

from bson import ObjectId
from pymongo.collection import Collection


class MongoResumeRepository:
    def __init__(self, collection: Collection):
        self.collection = collection

    def create_resume(
        self,
        filename: str,
        candidate_name: str,
        raw_text: str,
        storage_bucket: str | None = None,
        storage_object_key: str | None = None,
        storage_mime_type: str | None = None,
        storage_size_bytes: int | None = None,
    ) -> str:
        payload = {
            "filename": filename,
            "candidate_name": candidate_name,
            "raw_text": raw_text,
            "upload_timestamp": datetime.now(timezone.utc),
            "is_deleted": False,
            "storage_bucket": storage_bucket,
            "storage_object_key": storage_object_key,
            "storage_mime_type": storage_mime_type,
            "storage_size_bytes": storage_size_bytes,
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


class MongoUploadJobRepository:
    def __init__(self, collection: Collection):
        self.collection = collection

    def create_job(self, files: list[dict[str, Any]]) -> str:
        now = datetime.now(timezone.utc)
        total_files = len(files)
        success_count = sum(1 for file_info in files if file_info.get("status") == "success")
        failure_count = sum(1 for file_info in files if file_info.get("status") == "error")
        processed_files = success_count + failure_count
        has_pending = any(file_info.get("status") in {"pending", "processing"} for file_info in files)

        status = "queued"
        completed_at = None
        if not has_pending:
            if failure_count == 0:
                status = "completed"
            elif success_count == 0:
                status = "failed"
            else:
                status = "partially_completed"
            completed_at = now

        payload = {
            "status": status,
            "total_files": total_files,
            "processed_files": processed_files,
            "success_count": success_count,
            "failure_count": failure_count,
            "files": files,
            "created_at": now,
            "started_at": None,
            "completed_at": completed_at,
        }
        inserted = self.collection.insert_one(payload)
        return str(inserted.inserted_id)

    def get_job(self, job_id: str) -> dict[str, Any] | None:
        if not ObjectId.is_valid(job_id):
            return None
        return self.collection.find_one({"_id": ObjectId(job_id)})

    def mark_started(self, job_id: str) -> None:
        if not ObjectId.is_valid(job_id):
            return
        self.collection.update_one(
            {"_id": ObjectId(job_id)},
            {
                "$set": {
                    "status": "processing",
                    "started_at": datetime.now(timezone.utc),
                }
            },
        )

    def mark_file_processing(self, job_id: str, file_id: str) -> None:
        if not ObjectId.is_valid(job_id):
            return
        self.collection.update_one(
            {"_id": ObjectId(job_id), "files.file_id": file_id},
            {
                "$set": {
                    "files.$.status": "processing",
                    "files.$.error": None,
                }
            },
        )

    def mark_file_success(self, job_id: str, file_id: str, mongo_id: str, candidate_name: str) -> None:
        if not ObjectId.is_valid(job_id):
            return
        self.collection.update_one(
            {"_id": ObjectId(job_id), "files.file_id": file_id},
            {
                "$set": {
                    "files.$.status": "success",
                    "files.$.error": None,
                    "files.$.mongo_id": mongo_id,
                    "files.$.candidate_name": candidate_name,
                },
                "$inc": {
                    "processed_files": 1,
                    "success_count": 1,
                },
            },
        )

    def mark_file_error(self, job_id: str, file_id: str, error: str) -> None:
        if not ObjectId.is_valid(job_id):
            return
        self.collection.update_one(
            {"_id": ObjectId(job_id), "files.file_id": file_id},
            {
                "$set": {
                    "files.$.status": "error",
                    "files.$.error": error,
                },
                "$inc": {
                    "processed_files": 1,
                    "failure_count": 1,
                },
            },
        )

    def finalize_job(self, job_id: str) -> None:
        job = self.get_job(job_id)
        if not job or not ObjectId.is_valid(job_id):
            return

        success_count = int(job.get("success_count", 0))
        failure_count = int(job.get("failure_count", 0))
        if failure_count == 0:
            status = "completed"
        elif success_count == 0:
            status = "failed"
        else:
            status = "partially_completed"

        self.collection.update_one(
            {"_id": ObjectId(job_id)},
            {
                "$set": {
                    "status": status,
                    "completed_at": datetime.now(timezone.utc),
                }
            },
        )
