import { motion } from "framer-motion";
import { AppHeader } from "@/components/AppHeader";
import { ExternalLink } from "lucide-react";

const Analytics = () => {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <div className="container py-10 space-y-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="font-display text-4xl md:text-5xl text-foreground mb-2">
            Analytics <span className="text-gradient">Dashboard</span>
          </h1>

          <p className="text-muted-foreground max-w-2xl">
            Power BI dashboard showing genre popularity, rating distributions,
            user activity trends, and top-rated movies from the MovieLens dataset.
          </p>
        </motion.div>

        {/* Dashboard Image */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-xl border border-border overflow-hidden bg-card"
          style={{ boxShadow: "var(--shadow-card)" }}
        >
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-primary animate-pulse" />
              <span className="text-sm font-medium text-foreground">
                Power BI Dashboard
              </span>
            </div>

          </div>

          {/* Dashboard Image */}
          <div className="w-full p-4">
            <img
              src="/CineAI/CineAI Dashboard.png"
              alt="CineAI Dashboard"
              className="w-full rounded-lg"
            />
          </div>
        </motion.div>

        {/* Dashboard Panels Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {[
            { title: "Top Rated Movies", desc: "Highest rated movies across all users" },
            { title: "Genre Popularity", desc: "Distribution of genres in the dataset" },
            { title: "Rating Distribution", desc: "Histogram of all user ratings" },
            { title: "User Activity Trends", desc: "Rating activity over time" },
          ].map((panel) => (
            <div
              key={panel.title}
              className="rounded-lg border border-border bg-card p-5 space-y-2"
              style={{ boxShadow: "var(--shadow-card)" }}
            >
              <div className="h-2 w-8 rounded-full bg-primary/60" />
              <h3 className="font-display text-lg text-foreground">{panel.title}</h3>
              <p className="text-xs text-muted-foreground">{panel.desc}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
};

export default Analytics;