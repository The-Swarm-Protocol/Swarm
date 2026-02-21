"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useTeam } from "@/contexts/TeamContext";
import { createSwarm, getAgentsByTeam, type FirestoreAgent } from "@/lib/firestore";
import { mockAgents } from "@/lib/mock-data";

interface CreateSwarmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

export function CreateSwarmDialog({ open, onOpenChange, onCreated }: CreateSwarmDialogProps) {
  const { currentTeam } = useTeam();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [agents, setAgents] = useState<FirestoreAgent[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!currentTeam) return;
    getAgentsByTeam(currentTeam.id).then((a) => {
      setAgents(a);
    });
  }, [currentTeam]);

  // Use Firestore agents if available, otherwise mock
  const displayAgents = agents.length > 0
    ? agents.map((a) => ({ id: a.id!, name: a.name, type: a.type, status: a.status }))
    : mockAgents.map((a) => ({ id: a.id, name: a.name, type: a.type, status: a.status }));

  const toggleAgent = (agentId: string) => {
    setSelectedAgents((prev) =>
      prev.includes(agentId) ? prev.filter((id) => id !== agentId) : [...prev, agentId]
    );
  };

  const handleCreate = async () => {
    if (!currentTeam || !name.trim()) return;
    setSaving(true);
    try {
      await createSwarm({
        name: name.trim(),
        description,
        status: "active",
        agentIds: selectedAgents,
        teamId: currentTeam.id,
        createdAt: Date.now(),
      });
      setName("");
      setDescription("");
      setSelectedAgents([]);
      onOpenChange(false);
      onCreated?.();
    } catch (err) {
      console.error("Failed to create swarm:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>Create Project</DialogTitle>
        <DialogDescription>Set up a new project with your agents.</DialogDescription>
      </DialogHeader>
      <DialogContent>
        <div className="space-y-2">
          <Label htmlFor="swarm-name">Project Name *</Label>
          <Input
            id="swarm-name"
            placeholder="e.g. Q1 Research Sprint"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="swarm-desc">Description</Label>
          <Textarea
            id="swarm-desc"
            placeholder="What is this project's objective?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Select Agents</Label>
          <div className="grid grid-cols-2 gap-2">
            {displayAgents.map((agent) => (
              <button
                key={agent.id}
                type="button"
                onClick={() => toggleAgent(agent.id)}
                className={`flex items-center gap-2 p-2 rounded-lg border text-left text-sm transition-colors ${
                  selectedAgents.includes(agent.id)
                    ? "border-blue-600 bg-blue-50 text-blue-700"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${agent.status === "online" ? "bg-blue-600" : "bg-gray-300"}`} />
                <div>
                  <div className="font-medium">{agent.name}</div>
                  <div className="text-xs text-gray-500">{agent.type}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </DialogContent>
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button
          onClick={handleCreate}
          disabled={!name.trim() || saving}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          {saving ? "Creating..." : "Create Project"}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
