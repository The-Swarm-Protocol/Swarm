"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTeam } from "@/contexts/TeamContext";
import {
  getMissionsByTeam,
  getAgentsByTeam,
  getSwarmsByTeam,
  createMission as createFirestoreMission,
  type FirestoreMission,
  type FirestoreAgent,
  type FirestoreSwarm,
} from "@/lib/firestore";
import { mockMissions, getAgentById, getSwarmById, type Mission, type MarketType } from "@/lib/mock-data";
import { MissionDetailDialog } from "@/components/mission-detail-dialog";
import { CreateMissionDialog } from "@/components/create-mission-dialog";

const columns = [
  { status: "pending" as const, label: "Pending", icon: "🎯", bg: "bg-yellow-50", border: "border-yellow-200" },
  { status: "active" as const, label: "Active", icon: "🔄", bg: "bg-blue-50", border: "border-blue-200" },
  { status: "resolved" as const, label: "Resolved", icon: "✅", bg: "bg-green-50", border: "border-green-200" },
];

export default function MissionsPage() {
  const { currentTeam } = useTeam();
  const [selectedMission, setSelectedMission] = useState<Mission | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [firestoreMissions, setFirestoreMissions] = useState<FirestoreMission[]>([]);
  const [firestoreAgents, setFirestoreAgents] = useState<FirestoreAgent[]>([]);
  const [firestoreSwarms, setFirestoreSwarms] = useState<FirestoreSwarm[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!currentTeam) {
      setFirestoreMissions([]);
      setLoaded(true);
      return;
    }
    Promise.all([
      getMissionsByTeam(currentTeam.id),
      getAgentsByTeam(currentTeam.id),
      getSwarmsByTeam(currentTeam.id),
    ]).then(([m, a, s]) => {
      setFirestoreMissions(m);
      setFirestoreAgents(a);
      setFirestoreSwarms(s);
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, [currentTeam]);

  const useFirestore = loaded && firestoreMissions.length > 0;

  // Convert Firestore missions to display format
  const missions: Mission[] = useFirestore
    ? firestoreMissions.map((m) => ({
        id: m.id!,
        title: m.title,
        description: m.description,
        status: m.status,
        priority: m.priority,
        marketType: m.marketType,
        assigneeId: m.assigneeId,
        swarmId: m.swarmId,
        prediction: m.prediction,
        outcome: m.outcome,
        timeline: [],
        targetDate: m.targetDate,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
      }))
    : mockMissions;

  const getAgentName = (agentId: string | null) => {
    if (!agentId) return "Unassigned";
    if (useFirestore) {
      return firestoreAgents.find((a) => a.id === agentId)?.name || "Unknown";
    }
    return getAgentById(agentId)?.name || "Unknown";
  };

  const getSwarmName = (swarmId: string) => {
    if (useFirestore) {
      return firestoreSwarms.find((s) => s.id === swarmId)?.name || "—";
    }
    return getSwarmById(swarmId)?.name || "—";
  };

  const getMissionsByStatus = (status: string) =>
    missions.filter((m) => m.status === status);

  const handleCreateMission = async (data: {
    title: string;
    description: string;
    marketType: MarketType;
    swarmId: string;
    targetDate: string;
  }) => {
    if (!currentTeam) return;
    try {
      await createFirestoreMission({
        title: data.title,
        description: data.description,
        status: "pending",
        priority: "normal",
        marketType: data.marketType,
        assigneeId: null,
        swarmId: data.swarmId,
        teamId: currentTeam.id,
        prediction: null,
        outcome: null,
        targetDate: data.targetDate ? new Date(data.targetDate).getTime() : Date.now() + 604800000,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      // Refresh
      const m = await getMissionsByTeam(currentTeam.id);
      setFirestoreMissions(m);
    } catch (err) {
      console.error("Failed to create mission:", err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">📋 Tasks</h1>
          <p className="text-gray-500 mt-1">Track agent tasks and deliverables</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white">
          + New Task
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {columns.map((col) => {
          const colMissions = getMissionsByStatus(col.status);
          return (
            <div key={col.status} className="space-y-3">
              <div className={`flex items-center justify-between rounded-lg px-4 py-2 ${col.bg} border ${col.border}`}>
                <div className="flex items-center gap-2">
                  <span>{col.icon}</span>
                  <h2 className="font-semibold text-sm">{col.label}</h2>
                </div>
                <Badge variant="outline" className="text-xs">{colMissions.length}</Badge>
              </div>

              <div className="space-y-3">
                {colMissions.map((mission) => (
                  <Card
                    key={mission.id}
                    className="cursor-pointer hover:shadow-md transition-shadow border-gray-200"
                    onClick={() => { setSelectedMission(mission); setDetailOpen(true); }}
                  >
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <h3 className="text-sm font-semibold leading-tight">{mission.title}</h3>
                        <Badge variant="outline" className="text-[10px] shrink-0 ml-2">{mission.marketType}</Badge>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span>📁 {getSwarmName(mission.swarmId)}</span>
                        <span>·</span>
                        <span>🤖 {getAgentName(mission.assigneeId)}</span>
                      </div>

                      {mission.prediction && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-600 truncate flex-1">{mission.prediction.position}</span>
                          <div className="flex items-center gap-1.5 ml-2">
                            <div className="w-12 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-blue-600 rounded-full"
                                style={{ width: `${mission.prediction.confidence}%` }}
                              />
                            </div>
                            <span className="font-medium">{mission.prediction.confidence}%</span>
                          </div>
                        </div>
                      )}

                      {mission.outcome && (
                        <div className={`text-xs font-semibold ${mission.outcome.pnl >= 0 ? "text-blue-600" : "text-red-600"}`}>
                          {mission.outcome.pnl >= 0 ? "+" : ""}{mission.outcome.pnl.toLocaleString()} USDC
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}

                {colMissions.length === 0 && (
                  <div className="text-center py-8 text-sm text-gray-400">No tasks</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <MissionDetailDialog mission={selectedMission} open={detailOpen} onOpenChange={setDetailOpen} />
      <CreateMissionDialog open={createOpen} onOpenChange={setCreateOpen} onSubmit={handleCreateMission} />
    </div>
  );
}
