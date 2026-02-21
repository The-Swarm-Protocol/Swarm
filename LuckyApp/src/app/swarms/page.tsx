"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CreateSwarmDialog } from "@/components/create-swarm-dialog";
import { useTeam } from "@/contexts/TeamContext";
import { getSwarmsByTeam, getAgentsByTeam, getMissionsByTeam, type FirestoreSwarm, type FirestoreAgent, type FirestoreMission } from "@/lib/firestore";
import { mockSwarms, mockAgents, mockMissions } from "@/lib/mock-data";

export default function SwarmsPage() {
  const [showCreate, setShowCreate] = useState(false);
  const { currentTeam } = useTeam();
  const [swarms, setSwarms] = useState<FirestoreSwarm[]>([]);
  const [agents, setAgents] = useState<FirestoreAgent[]>([]);
  const [missions, setMissions] = useState<FirestoreMission[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!currentTeam) {
      setSwarms([]);
      setAgents([]);
      setMissions([]);
      setLoaded(true);
      return;
    }

    Promise.all([
      getSwarmsByTeam(currentTeam.id),
      getAgentsByTeam(currentTeam.id),
      getMissionsByTeam(currentTeam.id),
    ]).then(([s, a, m]) => {
      setSwarms(s);
      setAgents(a);
      setMissions(m);
      setLoaded(true);
    }).catch((err) => {
      console.error("Failed to load swarms data:", err);
      setLoaded(true);
    });
  }, [currentTeam]);

  // Use Firestore data if available, otherwise fall back to mock
  const displaySwarms = loaded && swarms.length > 0 ? swarms : mockSwarms.map((s) => ({
    ...s,
    teamId: currentTeam?.id || "",
    agentIds: s.agentIds,
  }));
  const displayAgents = loaded && agents.length > 0 ? agents : mockAgents.map((a) => ({
    ...a,
    teamId: currentTeam?.id || "",
    createdAt: Date.now(),
  }));
  const displayMissions = loaded && missions.length > 0 ? missions : mockMissions.map((m) => ({
    ...m,
    teamId: currentTeam?.id || "",
  }));

  const handleSwarmCreated = () => {
    if (currentTeam) {
      getSwarmsByTeam(currentTeam.id).then(setSwarms);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">🐝 Swarms</h1>
          <p className="text-gray-500 mt-1">
            Manage your prediction market swarms
          </p>
        </div>
        <Button
          onClick={() => setShowCreate(true)}
          className="bg-amber-500 hover:bg-amber-600 text-white"
        >
          + Create Swarm
        </Button>
      </div>

      {loaded && swarms.length === 0 && !mockSwarms.length && (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg">No swarms yet</p>
          <p className="text-sm mt-1">Create your first swarm to get started</p>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {displaySwarms.map((swarm) => {
          const agentCount = swarm.agentIds?.length || 0;
          const missionCount = displayMissions.filter(
            (m) => m.swarmId === swarm.id
          ).length;
          const swarmAgents = displayAgents.filter((a) =>
            swarm.agentIds?.includes(a.id || "")
          );

          return (
            <Link key={swarm.id} href={`/swarms/${swarm.id}`}>
              <Card className="hover:border-amber-300 transition-colors cursor-pointer h-full">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-lg">{swarm.name}</CardTitle>
                      <CardDescription>{swarm.description}</CardDescription>
                    </div>
                    <Badge
                      className={
                        swarm.status === "active"
                          ? "bg-amber-100 text-amber-700 border-amber-200"
                          : "bg-gray-100 text-gray-600 border-gray-200"
                      }
                    >
                      {swarm.status === "active" ? "● Active" : "⏸ Paused"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
                    <span>🤖 {agentCount} Agents</span>
                    <span>🎯 {missionCount} Missions</span>
                  </div>
                  <div className="flex -space-x-2">
                    {swarmAgents.slice(0, 4).map((agent) => (
                      <div
                        key={agent.id}
                        className="w-8 h-8 rounded-full bg-amber-100 border-2 border-white flex items-center justify-center text-xs font-bold text-amber-700"
                        title={agent.name}
                      >
                        {agent.name.charAt(0)}
                      </div>
                    ))}
                    {swarmAgents.length > 4 && (
                      <div className="w-8 h-8 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center text-xs font-medium text-gray-500">
                        +{swarmAgents.length - 4}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <CreateSwarmDialog open={showCreate} onOpenChange={setShowCreate} onCreated={handleSwarmCreated} />
    </div>
  );
}
