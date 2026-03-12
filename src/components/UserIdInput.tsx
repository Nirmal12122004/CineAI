import { useState } from "react";
import { Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function UserIdInput({ onSubmit, loading }: { onSubmit: (name: string) => void; loading: boolean }) {
  const [value, setValue] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (trimmed.length > 0) onSubmit(trimmed);
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-3 w-full max-w-md">
      <Input
        type="text"
        placeholder="Enter a movie name (e.g. Inception)"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        maxLength={200}
        className="bg-secondary border-border text-foreground placeholder:text-muted-foreground focus:ring-primary"
      />
      <Button type="submit" disabled={loading || !value.trim()} className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2 animate-pulse-glow">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        Recommend
      </Button>
    </form>
  );
}
