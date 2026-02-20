"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getAgentById, getAgentSwarms } from "@/lib/mock-data";

const TYPE_COLORS: Record<string, string> = {
  Crypto: "bg-orange-100 text-orange-700 border-orange-200",
  Sports: "bg-blue-100 text-blue-700 border-blue-200",
  Esports: "bg-purple-100 text-purple-700 border-purple-200",
  Events: "bg-pink-100 text-pink-700 border-pink-200",
  Quant: "bg-cyan-100 text-cyan-700 border-cyan-200",
  Scout: "bg-amber-100 text-amber-700 border-amber-200",
};

const OUTCOME_COLORS: Record<string, string> = {
  win: "text-green-600",
  loss: "text-red-500",
  pending: "text-yellow-600",
};

export default function AgentDetailPage() {
  const params = useParams();
  const agentId = params.agentId as string;
  const agent = getAgentById(agentId);
  const swarms = getAgentSwarms(agentId);

  if (!agent) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="text-4xl mb-4">😕</div>
          <h2 className="text-xl font-bold mb-2">Agent Not Found</h2>
          <Button asChild variant="outline">
            <Link href="/agents">← Back to Fleet</Link>
          </Button>
        </div>
      </div>
    );
  }

  const formatTime = (ts: number) => {
    const diff = Date.now() - ts;
    const hrs = Math.floor(diff / 3600000);
    if (hrs > 24) return `${Math.floor(hrs / 24)}d ago`;
    if (hrs > 0) return `${hrs}h ago`;
    const mins = Math.floor(diff / 60000);
    return mins > 0 ? `${mins}m ago` : "just now";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link href="/agents" className="text-gray-400 hover:text-green-600 transition-colors text-lg mt-2">
          ←
        </Link>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center text-2xl font-bold text-green-700">
            {agent.name.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">{agent.name}</h1>
              <Badge className={TYPE_COLORS[agent.type] || ""}>{agent.type}</Badge>
              <span className={`text-sm flex items-center gap-1.5 ${agent.status === "online" ? "text-green-600" : "text-gray-400"}`}>
                <span className={`w-2.5 h-2.5 rounded-full ${agent.status === "online" ? "bg-green-500" : "bg-gray-300"}`} />
                {agent.status}
              </span>
            </div>
            <p className="text-gray-500 mt-1">{agent.description}</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{agent.winRate}%</div>
            <div className="text-xs text-gray-500 mt-1">Win Rate</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">{agent.totalPredictions}</div>
            <div className="text-xs text-gray-500 mt-1">Total Predictions</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">{swarms.length}</div>
            <div className="text-xs text-gray-500 mt-1">Active Swarms</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">{agent.capabilities.length}</div>
            <div className="text-xs text-gray-500 mt-1">Capabilities</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Capabilities */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">⚡ Capabilities</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {agent.capabilities.map((cap) => (
                <Badge key={cap} variant="secondary" className="text-xs">
                  {cap}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Swarm Memberships */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">🐝 Swarm Memberships</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {swarms.map((swarm) => (
                <Link
                  key={swarm.id}
                  href={`/swarms/${swarm.id}`}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <span className="font-medium text-sm">{swarm.name}</span>
                  <Badge
                    className={
                      swarm.status === "active"
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-600"
                    }
                  >
                    {swarm.status}
                  </Badge>
                </Link>
              ))}
              {swarms.length === 0 && (
                <p className="text-sm text-gray-400">Not assigned to any swarms</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Predictions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">📊 Recent Predictions</CardTitle>
          <CardDescription>Latest market predictions and outcomes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {agent.recentPredictions.map((pred) => (
              <div
                key={pred.id}
                className="flex items-center justify-between p-3 rounded-lg border border-gray-100"
              >
                <div className="flex-1">
                  <div className="font-medium text-sm">{pred.market}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    Position: {pred.position} · Confidence: {pred.confidence}% · {formatTime(pred.timestamp)}
                  </div>
                </div>
                <Badge
                  className={`${
                    pred.outcome === "win"
                      ? "bg-green-100 text-green-700"
                      : pred.outcome === "loss"
                      ? "bg-red-100 text-red-600"
                      : "bg-yellow-100 text-yellow-700"
                  }`}
                >
                  {pred.outcome === "win" ? "✅ Win" : pred.outcome === "loss" ? "❌ Loss" : "⏳ Pending"}
                </Badge>
              </div>
            ))}
            {agent.recentPredictions.length === 0 && (
              <div className="text-center py-8 text-gray-400">
                <div className="text-4xl mb-3">📊</div>
                <p>No predictions yet</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
