import { motion } from "framer-motion";
import type { ModelMetrics } from "@/lib/mockData";
import { Activity, BarChart3, Database, TrendingDown, TrendingUp } from "lucide-react";

function MetricItem({ label, value, icon: Icon, highlight }: { label: string; value: string; icon: React.ElementType; highlight?: boolean }) {
  return (
    <div
      className={`rounded-lg border border-border p-4 ${
        highlight ? "bg-gradient-to-br from-[#15803d] to-[#22c55e]" : "bg-card"
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`h-4 w-4 ${highlight ? "text-white" : "text-muted-foreground"}`} />
        <span
          className={`text-xs font-medium uppercase tracking-wider ${
            label === "Hit Rate" ? "text-white" : "text-muted-foreground"
          }`}
        >
          {label}
        </span>
      </div>
      <p className={`font-display text-2xl ${highlight ? "text-white" : "text-foreground"}`}>{value}</p>
    </div>
  );
}

export function ModelAccuracy({ metrics }: { metrics: ModelMetrics }) {
  const svdWins = metrics.svd_rmse < metrics.knn_rmse;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      <div>
        <h2 className="font-display text-2xl text-foreground mb-1">Model Performance</h2>
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <MetricItem label="Hit Rate" value="0.9433" icon={TrendingUp} highlight={svdWins}  />
          <MetricItem label="Precision" value="0.1973" icon={Activity}  />
        </div>
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <MetricItem label="Recall" value="0.0185" icon={TrendingDown} />
          <MetricItem label="F1-Score" value="0.0318" icon={Activity} />
        </div>
      </div>

      <div className="border-t border-border pt-4 space-y-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Dataset Info</h3>
        <div className="grid grid-cols-2 gap-3">
          <MetricItem label="Train Set" value="8866" icon={Database} />
          <MetricItem label="Test Set" value="2000" icon={BarChart3} />
        </div>
      </div>
      
    </motion.div>
  );
}
