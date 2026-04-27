import matplotlib.pyplot as plt
import numpy as np
import os

# Create output directory
output_dir = 'plots'
os.makedirs(output_dir, exist_ok=True)

# Set style
plt.style.use('ggplot')

# 1. Performance Comparison Plot
metrics = ['Startup Time (s)', 'Memory Usage (MB)', 'Search Latency (ms)', 'Ingestion (ms/doc)']
single_model = [2.1, 92, 11, 50]
ensemble_model = [7.0, 506, 23, 150]

x = np.arange(len(metrics))
width = 0.35

fig, ax1 = plt.subplots(figsize=(10, 6))

# Plotting on primary y-axis (Time and Latency)
rects1 = ax1.bar(x - width/2, single_model, width, label='Single Model', color='#3498db')
rects2 = ax1.bar(x + width/2, ensemble_model, width, label='3-Model Ensemble', color='#e74c3c')

ax1.set_ylabel('Values')
ax1.set_title('Single Model vs 3-Model Ensemble Performance')
ax1.set_xticks(x)
ax1.set_xticklabels(metrics)
ax1.legend()

# Adding value labels
def autolabel(rects, ax):
    for rect in rects:
        height = rect.get_height()
        ax.annotate(f'{height}',
                    xy=(rect.get_x() + rect.get_width() / 2, height),
                    xytext=(0, 3),  # 3 points vertical offset
                    textcoords="offset points",
                    ha='center', va='bottom')

autolabel(rects1, ax1)
autolabel(rects2, ax1)

plt.tight_layout()
plt.savefig(os.path.join(output_dir, 'performance_comparison.png'))
plt.close()

# 2. RRF Score Decay Plot (Effect of k)
ranks = np.arange(1, 101)
k_values = [1, 10, 60, 1000]

plt.figure(figsize=(10, 6))
for k in k_values:
    scores = 1 / (k + ranks)
    # Normalize to start at 1 for easy comparison
    normalized_scores = scores / scores[0]
    plt.plot(ranks, normalized_scores, label=f'k={k}')

plt.title('Reciprocal Rank Fusion (RRF) Decay Curve')
plt.xlabel('Document Rank')
plt.ylabel('Normalized RRF Score')
plt.legend()
plt.grid(True)
plt.tight_layout()
plt.savefig(os.path.join(output_dir, 'rrf_decay.png'))
plt.close()

# 3. Model Properties (Dimensions vs Max Sequence Length)
models = ['all-MiniLM-L6-v2', 'all-mpnet-base-v2', 'multi-qa-MiniLM-L6-cos-v1']
dimensions = [384, 768, 384]
seq_lengths = [256, 384, 512]

x_models = np.arange(len(models))

fig, ax1 = plt.subplots(figsize=(10, 6))

color = 'tab:blue'
ax1.set_xlabel('Models')
ax1.set_ylabel('Dimensions', color=color)
ax1.bar(x_models - width/2, dimensions, width, color=color, label='Dimensions')
ax1.tick_params(axis='y', labelcolor=color)

ax2 = ax1.twinx()
color = 'tab:green'
ax2.set_ylabel('Max Sequence Length (tokens)', color=color)
ax2.bar(x_models + width/2, seq_lengths, width, color=color, label='Sequence Length')
ax2.tick_params(axis='y', labelcolor=color)

fig.tight_layout()
plt.title('Model Specifications')
ax1.set_xticks(x_models)
ax1.set_xticklabels(models, rotation=15, ha='right')

# Custom legend
lines1, labels1 = ax1.get_legend_handles_labels()
lines2, labels2 = ax2.get_legend_handles_labels()
ax2.legend(lines1 + lines2, labels1 + labels2, loc='upper left')

plt.savefig(os.path.join(output_dir, 'model_specs.png'), bbox_inches='tight')
plt.close()

print("Plots generated successfully in the 'plots' directory.")
