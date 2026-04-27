import os
import sys
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns

# Add backend directory to path to import services if needed
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))
from app.services.embedding_service import EnsembleEmbeddingService
from app.services.score_fusion import reciprocal_rank_fusion

# Create output directory
output_dir = 'plots'
os.makedirs(output_dir, exist_ok=True)

plt.style.use('ggplot')

# Define mock data
queries = [
    "Python backend developer with microservices",
    "Who has experience with machine learning and deep learning?",
    "React and frontend UI expert",
    "Cloud infrastructure and Kubernetes DevOps"
]

resumes = {
    "R1_Backend": "Senior Software Engineer with 5 years of Python, Django, and React experience. Built scalable microservices.",
    "R2_DataSci": "Data Scientist focusing on Machine Learning. Expert in Python, Pandas, Scikit-Learn, and Deep Learning.",
    "R3_Frontend": "Frontend Developer proficient in JavaScript, TypeScript, React, and Next.js. UI/UX enthusiast.",
    "R4_DevOps": "DevOps Engineer with experience in Kubernetes, Docker, AWS, and CI/CD pipelines.",
    "R5_Manager": "Project Manager with Agile and Scrum certifications. Excellent communication skills."
}

resume_ids = list(resumes.keys())
resume_texts = list(resumes.values())

print("Loading Ensemble Models (this may take a moment)...")
models_list = ['all-MiniLM-L6-v2', 'all-mpnet-base-v2', 'multi-qa-MiniLM-L6-cos-v1']
ensemble_service = EnsembleEmbeddingService(models_list)

print("Calculating embeddings...")
# Embed resumes
resume_embeddings = {slug: [] for slug in ensemble_service._models.keys()}
for text in resume_texts:
    emb = ensemble_service.embed_text(text)
    for slug, vec in emb.items():
        resume_embeddings[slug].append(vec)

for slug in resume_embeddings:
    resume_embeddings[slug] = np.array(resume_embeddings[slug])

# Embed queries and evaluate
cosine_similarities = {slug: np.zeros((len(queries), len(resumes))) for slug in resume_embeddings.keys()}

for q_idx, query in enumerate(queries):
    q_emb = ensemble_service.embed_text(query)
    for slug, vec in q_emb.items():
        # Compute cosine similarity (vectors are already L2 normalized)
        sim = np.dot(resume_embeddings[slug], vec)
        cosine_similarities[slug][q_idx] = sim

print("Generating Heatmaps...")
# 1. Cosine Similarity Heatmaps for each model
fig, axes = plt.subplots(1, 3, figsize=(18, 5))
model_slugs = list(cosine_similarities.keys())

for i, slug in enumerate(model_slugs):
    sns.heatmap(cosine_similarities[slug], annot=True, cmap="YlGnBu", 
                xticklabels=resume_ids, yticklabels=[f"Q{i+1}" for i in range(len(queries))],
                ax=axes[i], vmin=0, vmax=1)
    axes[i].set_title(slug)
    axes[i].tick_params(axis='x', rotation=45)

plt.tight_layout()
plt.savefig(os.path.join(output_dir, 'cosine_similarity_heatmaps.png'))
plt.close()


print("Performing Reciprocal Rank Fusion...")
# Evaluate RRF for a specific query (e.g., Query 1: Machine Learning)
target_q_idx = 1
query_name = queries[target_q_idx]

per_model_rankings = {}
for slug in model_slugs:
    sims = cosine_similarities[slug][target_q_idx]
    # Sort descending
    ranked_indices = np.argsort(sims)[::-1]
    per_model_rankings[slug] = [(resume_ids[idx], float(sims[idx])) for idx in ranked_indices]

# Fuse rankings
fused = reciprocal_rank_fusion(per_model_rankings, k=60)

# 2. RRF Scores vs Individual Model Scores Plot
labels = [item[0] for item in fused]
rrf_scores = [item[1] for item in fused]

x = np.arange(len(labels))
width = 0.2

fig, ax1 = plt.subplots(figsize=(12, 6))

# Plot RRF scores on primary Y axis
ax1.bar(x, rrf_scores, color='purple', alpha=0.7, label='RRF Score (Fused)')
ax1.set_ylabel('RRF Score', color='purple')
ax1.tick_params(axis='y', labelcolor='purple')
ax1.set_xticks(x)
ax1.set_xticklabels(labels, rotation=15)
ax1.set_title(f"Ensemble Evaluation for Query: '{query_name}'")

# Plot individual similarities on secondary Y axis
ax2 = ax1.twinx()
colors = ['tab:blue', 'tab:orange', 'tab:green']
for i, slug in enumerate(model_slugs):
    # Extract score for each doc in fused order
    scores = []
    for item in fused:
        raw_scores_dict = item[2]
        scores.append(raw_scores_dict[slug])
    ax2.plot(x, scores, marker='o', linestyle='-', color=colors[i], label=f'{slug} Cosine')

ax2.set_ylabel('Cosine Similarity', color='black')
ax2.tick_params(axis='y', labelcolor='black')

# Combine legends
lines1, labels1 = ax1.get_legend_handles_labels()
lines2, labels2 = ax2.get_legend_handles_labels()
ax2.legend(lines1 + lines2, labels1 + labels2, loc='upper right')

plt.tight_layout()
plt.savefig(os.path.join(output_dir, 'rrf_vs_cosine.png'))
plt.close()


# 3. Rank Variation across models for a specific document
print("Generating Rank Variation plot...")
doc_ranks = {doc_id: [] for doc_id in resume_ids}

for doc_id in resume_ids:
    for slug in model_slugs:
        # Find rank in per_model_rankings
        rank = next(i for i, v in enumerate(per_model_rankings[slug]) if v[0] == doc_id) + 1
        doc_ranks[doc_id].append(rank)

plt.figure(figsize=(10, 6))
for i, doc_id in enumerate(resume_ids):
    plt.plot(model_slugs, doc_ranks[doc_id], marker='o', label=doc_id, alpha=0.8, linewidth=2)

plt.gca().invert_yaxis() # Rank 1 at the top
plt.title(f"Model Rank Disagreement for Query: '{query_name}'\nLower is better (Rank 1)")
plt.ylabel("Assigned Rank")
plt.xlabel("Embedding Model")
plt.yticks(range(1, len(resume_ids) + 1))
plt.legend(bbox_to_anchor=(1.05, 1), loc='upper left')
plt.grid(True, axis='y', linestyle='--', alpha=0.7)
plt.tight_layout()
plt.savefig(os.path.join(output_dir, 'rank_variation.png'))
plt.close()

print("Evaluation complete. Plots saved to 'plots' directory.")
